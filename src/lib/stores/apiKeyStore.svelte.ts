import {
	clearKeyDerivationCache,
	decryptApiKey,
	encryptApiKey,
	encryptWithKey,
	getDerivedCryptoKey,
	uint8ArrayToBase64,
} from '$lib/services/crypto';
import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import type { AIProvider, SecurityMode, StoredApiKeyRecord } from '$lib/types/apiKeys';

export class ApiKeyStore {
	private database: TestifyDatabase;

	// In-memory state
	configuredProviders = $state<Record<AIProvider, boolean>>({
		openai: false,
		anthropic: false,
		google: false,
		groq: false,
	});

	// Plaintext credentials cache in active memory
	memoryKeys = $state<Partial<Record<AIProvider, string>>>({});

	// Derived Properties
	hasAnyConfigured = $derived.by(() => {
		return Object.values(this.configuredProviders).some(Boolean);
	});

	configuredCount = $derived.by(() => {
		return Object.values(this.configuredProviders).filter(Boolean).length;
	});

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	async init(securityMode: SecurityMode) {
		const records = await this.database.getAllApiKeys();

		const nextConfigured: Record<AIProvider, boolean> = {
			openai: false,
			anthropic: false,
			google: false,
			groq: false,
		};

		const nextMemoryKeys: Partial<Record<AIProvider, string>> = {};

		for (const record of records) {
			nextConfigured[record.provider] = true;

			if (securityMode === 'lax' && !record.isEncrypted && record.plaintextKey) {
				nextMemoryKeys[record.provider] = record.plaintextKey;
			}
		}

		this.configuredProviders = nextConfigured;

		if (securityMode === 'lax') {
			this.memoryKeys = nextMemoryKeys;
		} else {
			this.memoryKeys = {};
		}
	}

	/**
	 * Sets an API key for a provider.
	 * Updates in-memory state synchronously, then asynchronously persists to database.
	 */
	setKey(provider: AIProvider, key: string, securityMode: SecurityMode, password?: string): void {
		const trimmedKey = key.trim();
		if (!trimmedKey) return;

		// 1. Synchronous in-memory update
		this.memoryKeys[provider] = trimmedKey;
		this.configuredProviders[provider] = true;

		// 2. Fire-and-forget background asynchronous Dexie write
		fireAndForget(
			(async () => {
				if (securityMode === 'lax') {
					const record: StoredApiKeyRecord = {
						provider,
						securityMode: 'lax',
						isEncrypted: false,
						plaintextKey: trimmedKey,
						updatedAt: new Date().toISOString(),
					};
					await this.database.saveApiKeyRecord(record);
				} else {
					if (!password) {
						throw new Error('Master password is required to encrypt key in strict mode');
					}
					const encrypted = await encryptApiKey(trimmedKey, password);
					const record: StoredApiKeyRecord = {
						provider,
						securityMode: 'strict',
						isEncrypted: true,
						ciphertext: encrypted.ciphertext,
						iv: encrypted.iv,
						salt: encrypted.salt,
						updatedAt: new Date().toISOString(),
					};
					await this.database.saveApiKeyRecord(record);
				}
			})(),
			`Saving ${provider} API Key`
		);
	}

	/**
	 * Removes an API key for a provider.
	 */
	removeKey(provider: AIProvider): void {
		delete this.memoryKeys[provider];
		this.configuredProviders[provider] = false;
		fireAndForget(this.database.deleteApiKeyRecord(provider), `Deleting ${provider} API Key`);
	}

	/**
	 * Atomically decrypts all stored records in parallel into active memory cache using the single-derivation crypto workflow.
	 * Throws if the master password fails authentication for any encrypted key.
	 */
	async decryptAllKeys(password: string): Promise<void> {
		const records = await this.database.getAllApiKeys();
		const unlockedMap: Partial<Record<AIProvider, string>> = {};

		const decryptionTasks = records.map(async (record) => {
			if (record.isEncrypted && record.ciphertext && record.iv && record.salt) {
				const decrypted = await decryptApiKey(
					{
						ciphertext: record.ciphertext,
						iv: record.iv,
						salt: record.salt,
					},
					password
				);
				return { provider: record.provider, key: decrypted };
			}
			if (record.plaintextKey) {
				return { provider: record.provider, key: record.plaintextKey };
			}
			return null;
		});

		const results = await Promise.all(decryptionTasks);
		for (const res of results) {
			if (res) {
				unlockedMap[res.provider] = res.key;
			}
		}

		// Atomic commit to memory
		this.memoryKeys = unlockedMap;
	}

	/**
	 * Encrypts current in-memory keys and persists them to Dexie.
	 */
	async encryptAllKeys(password: string): Promise<void> {
		const currentKeys = { ...this.memoryKeys };
		const sharedSalt = crypto.getRandomValues(new Uint8Array(16));
		const sharedSaltBase64 = uint8ArrayToBase64(sharedSalt);
		const cryptoKey = await getDerivedCryptoKey(password, sharedSalt);

		for (const [provider, rawKey] of Object.entries(currentKeys)) {
			if (rawKey) {
				const { ciphertext, iv } = await encryptWithKey(rawKey, cryptoKey);
				await this.database.saveApiKeyRecord({
					provider: provider as AIProvider,
					securityMode: 'strict',
					isEncrypted: true,
					ciphertext,
					iv,
					salt: sharedSaltBase64,
					updatedAt: new Date().toISOString(),
				});
			}
		}
	}

	/**
	 * Converts current in-memory keys to plaintext records in Dexie.
	 */
	async makeAllKeysPlaintext(): Promise<void> {
		const currentKeys = { ...this.memoryKeys };
		for (const [provider, rawKey] of Object.entries(currentKeys)) {
			if (rawKey) {
				await this.database.saveApiKeyRecord({
					provider: provider as AIProvider,
					securityMode: 'lax',
					isEncrypted: false,
					plaintextKey: rawKey,
					updatedAt: new Date().toISOString(),
				});
			}
		}
	}

	/**
	 * Clears all keys from memory and Dexie database.
	 */
	async clearAllKeys(): Promise<void> {
		this.memoryKeys = {};
		clearKeyDerivationCache();
		this.configuredProviders = {
			openai: false,
			anthropic: false,
			google: false,
			groq: false,
		};
		await this.database.clearAllApiKeys();
	}

	/**
	 * Purges in-memory keys (used when locking strict mode).
	 */
	purgeMemory(): void {
		this.memoryKeys = {};
		clearKeyDerivationCache();
	}

	/**
	 * Checks if a provider has an API key configured.
	 */
	isConfigured(provider: AIProvider): boolean {
		return Boolean(this.configuredProviders[provider]);
	}

	/**
	 * Checks if a provider has an active, decrypted API key available in memory.
	 */
	hasKey(provider: AIProvider): boolean {
		return Boolean(this.memoryKeys[provider]);
	}

	/**
	 * Retrieves an active API key from memory if available.
	 */
	getKey(provider: AIProvider): string | undefined {
		return this.memoryKeys[provider];
	}

	/**
	 * Returns masked version of key for secure UI presentation.
	 */
	getMaskedKey(provider: AIProvider, isUnlocked: boolean, securityMode: SecurityMode): string {
		const key = this.memoryKeys[provider];
		if (!key) {
			if (this.configuredProviders[provider]) {
				return securityMode === 'strict' && !isUnlocked ? 'Encrypted' : '••••••••••••••••';
			}
			return '';
		}
		if (key.length <= 8) {
			return '••••••••';
		}
		return `${key.slice(0, 5)}...${key.slice(-4)}`;
	}
}
