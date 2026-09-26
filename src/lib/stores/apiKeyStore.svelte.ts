import {
	clearKeyDerivationCache,
	decryptApiKey,
	encryptApiKey,
	encryptWithKey,
	getDerivedCryptoKey,
	uint8ArrayToBase64,
} from '$lib/services/crypto';
import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { SETTINGS_KEYS } from '$lib/services/settings';
import { supabase, trySupabaseOrQueue } from '$lib/services/supabase';
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

	// User toggle for syncing encrypted keys to Supabase cloud in Strict mode
	syncToCloud = $state<boolean>(false);

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
		this.syncToCloud = await this.database.getSetting<boolean>('sync_api_keys_to_cloud', false);

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

					if (this.syncToCloud) {
						fireAndForget(
							trySupabaseOrQueue(
								async () =>
									supabase.from('synced_api_keys').upsert({
										provider,
										security_mode: 'strict',
										ciphertext: encrypted.ciphertext,
										iv: encrypted.iv,
										salt: encrypted.salt,
										updated_at: record.updatedAt,
									}),
								{ table: 'synced_api_keys', action: 'create', recordId: provider, data: record }
							),
							`Syncing encrypted ${provider} key to Supabase`
						);
					}
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

		if (this.syncToCloud) {
			fireAndForget(
				trySupabaseOrQueue(
					async () => supabase.from('synced_api_keys').delete().eq('provider', provider),
					{ table: 'synced_api_keys', action: 'delete', recordId: provider, data: null }
				),
				`Deleting ${provider} key from Supabase`
			);
		}
	}

	/**
	 * Toggles user preference for syncing encrypted API keys to Supabase in Strict mode.
	 */
	async setSyncToCloud(enabled: boolean): Promise<void> {
		this.syncToCloud = enabled;
		await this.database.setSetting('sync_api_keys_to_cloud', enabled);

		if (enabled) {
			const records = await this.database.getAllApiKeys();
			for (const r of records) {
				const { ciphertext, iv, salt } = r;
				if (r.isEncrypted && ciphertext && iv && salt) {
					await trySupabaseOrQueue(
						async () =>
							supabase.from('synced_api_keys').upsert({
								provider: r.provider,
								security_mode: 'strict',
								ciphertext,
								iv,
								salt,
								updated_at: r.updatedAt,
							}),
						{ table: 'synced_api_keys', action: 'create', recordId: r.provider, data: r }
					);
				}
			}
		} else {
			await trySupabaseOrQueue(
				async () => supabase.from('synced_api_keys').delete().neq('provider', ''),
				{ table: 'synced_api_keys', action: 'delete', recordId: 'ALL', data: null }
			);
		}
	}

	/**
	 * Atomically decrypts all stored records in parallel into active memory cache using the single-derivation crypto workflow.
	 * Throws if the master password fails authentication for any encrypted key or against the canary token.
	 */
	async decryptAllKeys(password: string): Promise<void> {
		const records = await this.database.getAllApiKeys();
		const hasEncryptedKeys = records.some((r) => r.isEncrypted && r.ciphertext && r.iv && r.salt);

		// Canary Token Verification:
		// When unlocking Strict Mode with 0 encrypted API keys configured, validate
		// against the stored canary token to prevent vacuously returning true with an incorrect password.
		if (!hasEncryptedKeys) {
			const canary = await this.database.getSetting<{
				ciphertext: string;
				iv: string;
				salt: string;
			} | null>(SETTINGS_KEYS.CANARY_TOKEN, null);

			if (canary && canary.ciphertext && canary.iv && canary.salt) {
				const decrypted = await decryptApiKey(canary, password);
				if (decrypted !== 'TESTIFY_CANARY_VALID') {
					throw new Error('Invalid master password.');
				}
			}
		}

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

		// Always ensure the canary token is saved / updated
		const canary = await encryptApiKey('TESTIFY_CANARY_VALID', password);
		await this.database.setSetting(SETTINGS_KEYS.CANARY_TOKEN, canary);
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
