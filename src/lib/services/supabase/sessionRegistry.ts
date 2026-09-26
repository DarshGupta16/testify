import Dexie, { type EntityTable } from 'dexie';
import { base64ToUint8Array, uint8ArrayToBase64 } from '$lib/utils/bytes';

/**
 * Public summary of a saved user account for 0ms offline switching.
 * Contains no credentials or secrets.
 */
export interface SavedAccountSummary {
	userId: string;
	email: string;
	displayName?: string | null;
	avatarUrl?: string | null;
	lastActiveAt: string;
}

/**
 * Decrypted authentication tokens required to restore a cloud Supabase session.
 */
export interface DecryptedSessionTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt?: number;
}

/**
 * AES-GCM encrypted tokens payload.
 */
export interface EncryptedSessionTokens {
	iv: string; // Base64 96-bit initialization vector
	ciphertext: string; // Base64 AES-GCM ciphertext + authentication tag
}

/**
 * Complete encrypted vault record persisted in origin-private IndexedDB.
 */
export interface StoredAccountVaultRecord extends SavedAccountSummary {
	encryptedTokens: EncryptedSessionTokens;
}

export interface SystemVaultKeyRecord {
	id: string; // 'device_key'
	key: CryptoKey;
}

/**
 * Dedicated IndexedDB database for origin-private system secrets and session tokens.
 */
class TestifySystemVaultDatabase extends Dexie {
	keys!: EntityTable<SystemVaultKeyRecord, 'id'>;
	accounts!: EntityTable<StoredAccountVaultRecord, 'userId'>;

	constructor() {
		super('testify_system_vault');
		this.version(1).stores({
			keys: 'id',
			accounts: 'userId, email, lastActiveAt',
		});
	}
}

let vaultInstance: TestifySystemVaultDatabase | null = null;

function getVaultDb(): TestifySystemVaultDatabase {
	if (!vaultInstance) {
		vaultInstance = new TestifySystemVaultDatabase();
	}
	return vaultInstance;
}

// In-memory cache for device key and fallback store when IndexedDB is unavailable (e.g. SSR, headless tests)
let cachedDeviceKey: CryptoKey | null = null;
let inMemoryKey: CryptoKey | null = null;
let keyPromise: Promise<CryptoKey> | null = null;
const inMemoryAccounts = new Map<string, StoredAccountVaultRecord>();

/**
 * Retrieves or generates the hardware/device-bound Web Crypto AES-256-GCM symmetric key.
 * The key is generated with extractable: false so raw key bytes can never be extracted by JavaScript.
 * Uses a singleton promise guard to prevent race conditions during concurrent startup calls.
 */
export async function getDeviceBoundKey(): Promise<CryptoKey> {
	if (cachedDeviceKey) return cachedDeviceKey;
	if (keyPromise) return keyPromise;

	keyPromise = (async () => {
		const isIdbAvailable = typeof indexedDB !== 'undefined';
		if (isIdbAvailable) {
			try {
				const vault = getVaultDb();
				const stored = await vault.keys.get('device_key');
				if (stored?.key) {
					cachedDeviceKey = stored.key;
					return stored.key;
				}
			} catch (err) {
				console.warn('[SessionVault] Failed checking device key in IDB:', err);
			}
		}

		if (inMemoryKey) {
			cachedDeviceKey = inMemoryKey;
			return inMemoryKey;
		}

		// Generate non-extractable 256-bit AES-GCM key bound to this device/origin
		const newKey = await crypto.subtle.generateKey(
			{ name: 'AES-GCM', length: 256 },
			false, // extractable: false - critical security guarantee
			['encrypt', 'decrypt']
		);

		if (isIdbAvailable) {
			try {
				const vault = getVaultDb();
				await vault.keys.put({ id: 'device_key', key: newKey });
			} catch (err) {
				console.warn('[SessionVault] Failed persisting device key in IDB:', err);
			}
		}

		inMemoryKey = newKey;
		cachedDeviceKey = newKey;
		return newKey;
	})().finally(() => {
		keyPromise = null;
	});

	return keyPromise;
}

/**
 * Encrypts session tokens using the non-extractable device-bound key.
 */
export async function encryptTokens(
	tokens: DecryptedSessionTokens,
	key: CryptoKey
): Promise<EncryptedSessionTokens> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(tokens));
	const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

	return {
		iv: uint8ArrayToBase64(iv),
		ciphertext: uint8ArrayToBase64(new Uint8Array(cipherBuffer)),
	};
}

/**
 * Decrypts encrypted session tokens using the non-extractable device-bound key.
 */
export async function decryptTokens(
	encrypted: EncryptedSessionTokens,
	key: CryptoKey
): Promise<DecryptedSessionTokens> {
	const iv = base64ToUint8Array(encrypted.iv);
	const ciphertext = base64ToUint8Array(encrypted.ciphertext);
	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: iv as unknown as BufferSource },
		key,
		ciphertext as unknown as BufferSource
	);

	const jsonStr = new TextDecoder().decode(decryptedBuffer);
	return JSON.parse(jsonStr) as DecryptedSessionTokens;
}

/**
 * Registers or updates an authenticated account in the encrypted session vault.
 */
export async function saveAccountSession(
	account: {
		userId: string;
		email: string;
		displayName?: string | null;
		avatarUrl?: string | null;
	},
	tokens: DecryptedSessionTokens
): Promise<void> {
	const key = await getDeviceBoundKey();
	const encryptedTokens = await encryptTokens(tokens, key);

	const record: StoredAccountVaultRecord = {
		userId: account.userId,
		email: account.email,
		displayName: account.displayName || null,
		avatarUrl: account.avatarUrl || null,
		lastActiveAt: new Date().toISOString(),
		encryptedTokens,
	};

	inMemoryAccounts.set(record.userId, record);

	if (typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			await vault.accounts.put(record);
		} catch (err) {
			console.warn('[SessionVault] Failed writing account to IDB:', err);
		}
	}
}

/**
 * Retrieves all saved accounts for immediate 0ms UI rendering and profile switching.
 * Does NOT decrypt tokens, keeping performance instantaneous and unblocking the main thread.
 */
export async function getSavedAccounts(): Promise<SavedAccountSummary[]> {
	const summariesMap = new Map<string, SavedAccountSummary>();

	// 1. Load from IndexedDB if available
	if (typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			const stored = await vault.accounts.toArray();
			for (const rec of stored) {
				inMemoryAccounts.set(rec.userId, rec);
				summariesMap.set(rec.userId, {
					userId: rec.userId,
					email: rec.email,
					displayName: rec.displayName,
					avatarUrl: rec.avatarUrl,
					lastActiveAt: rec.lastActiveAt,
				});
			}
		} catch (err) {
			console.warn('[SessionVault] Failed reading accounts from IDB:', err);
		}
	}

	// 2. Include in-memory fallback accounts
	for (const rec of inMemoryAccounts.values()) {
		if (!summariesMap.has(rec.userId)) {
			summariesMap.set(rec.userId, {
				userId: rec.userId,
				email: rec.email,
				displayName: rec.displayName,
				avatarUrl: rec.avatarUrl,
				lastActiveAt: rec.lastActiveAt,
			});
		}
	}

	return Array.from(summariesMap.values()).sort(
		(a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
	);
}

/**
 * Decrypts and retrieves authentication tokens for a specific account.
 * Used during background cloud session restoration.
 */
export async function getAccountSessionTokens(
	userId: string
): Promise<DecryptedSessionTokens | null> {
	let record: StoredAccountVaultRecord | undefined = inMemoryAccounts.get(userId);

	if (!record && typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			record = await vault.accounts.get(userId);
			if (record) {
				inMemoryAccounts.set(userId, record);
			}
		} catch (err) {
			console.warn('[SessionVault] Failed getting account tokens from IDB:', err);
		}
	}

	if (!record?.encryptedTokens) {
		return null;
	}

	try {
		const key = await getDeviceBoundKey();
		return await decryptTokens(record.encryptedTokens, key);
	} catch (err) {
		console.error(`[SessionVault] Decryption failed for user "${userId}":`, err);
		return null;
	}
}

/**
 * Updates tokens for an existing saved account (e.g. after TOKEN_REFRESHED).
 */
export async function updateAccountTokens(
	userId: string,
	tokens: DecryptedSessionTokens
): Promise<void> {
	const key = await getDeviceBoundKey();
	const encryptedTokens = await encryptTokens(tokens, key);
	const now = new Date().toISOString();

	const existing = inMemoryAccounts.get(userId);
	if (existing) {
		existing.encryptedTokens = encryptedTokens;
		existing.lastActiveAt = now;
	}

	if (typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			await vault.accounts.update(userId, {
				encryptedTokens,
				lastActiveAt: now,
			});
		} catch (err) {
			console.warn('[SessionVault] Failed updating account tokens in IDB:', err);
		}
	}
}

/**
 * Updates last active timestamp for an account.
 */
export async function updateAccountLastActive(userId: string): Promise<void> {
	const now = new Date().toISOString();
	const existing = inMemoryAccounts.get(userId);
	if (existing) {
		existing.lastActiveAt = now;
	}

	if (typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			await vault.accounts.update(userId, {
				lastActiveAt: now,
			});
		} catch (err) {
			console.warn('[SessionVault] Failed updating last active in IDB:', err);
		}
	}
}

/**
 * Removes an account from the encrypted session vault.
 */
export async function removeAccountSession(userId: string): Promise<void> {
	inMemoryAccounts.delete(userId);

	if (typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			await vault.accounts.delete(userId);
		} catch (err) {
			console.warn('[SessionVault] Failed removing account from IDB:', err);
		}
	}
}

/**
 * Clears all accounts from the encrypted session vault.
 */
export async function clearAllAccounts(): Promise<void> {
	inMemoryAccounts.clear();

	if (typeof indexedDB !== 'undefined') {
		try {
			const vault = getVaultDb();
			await vault.accounts.clear();
		} catch (err) {
			console.warn('[SessionVault] Failed clearing accounts from IDB:', err);
		}
	}
}

/**
 * Test utility to reset session vault state and cache.
 */
export function _resetSessionVaultForTesting(): void {
	inMemoryAccounts.clear();
	cachedDeviceKey = null;
	inMemoryKey = null;
	if (vaultInstance) {
		try {
			vaultInstance.close();
		} catch {
			// ignore
		}
		vaultInstance = null;
	}
}
