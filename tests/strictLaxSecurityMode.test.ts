import { describe, expect, it, beforeEach } from 'bun:test';
import { SecurityStore } from '$lib/stores/securityStore.svelte';
import { ApiKeyStore } from '$lib/stores/apiKeyStore.svelte';
import { SETTINGS_KEYS } from '$lib/services/settings';
import type { StoredApiKeyRecord } from '$lib/types/apiKeys';
import { encryptApiKey } from '$lib/services/crypto';

describe('Strict-to-Lax Mode Barrier & Security Store Protections', () => {
	let mockStorage: Record<string, any>;
	let mockRecords: StoredApiKeyRecord[];
	let mockDb: any;

	beforeEach(() => {
		mockStorage = {};
		mockRecords = [];
		mockDb = {
			getAllApiKeys: async () => [...mockRecords],
			saveApiKeyRecord: async (rec: StoredApiKeyRecord) => {
				const idx = mockRecords.findIndex((r) => r.provider === rec.provider);
				if (idx >= 0) {
					mockRecords[idx] = { ...rec };
				} else {
					mockRecords.push({ ...rec });
				}
			},
			deleteApiKeyRecord: async (provider: string) => {
				const idx = mockRecords.findIndex((r) => r.provider === provider);
				if (idx >= 0) {
					mockRecords.splice(idx, 1);
				}
			},
			clearAllApiKeys: async () => {
				mockRecords.length = 0;
			},
			getSetting: async (key: string, defaultValue: any) => {
				return mockStorage[key] ?? defaultValue;
			},
			setSetting: async (key: string, value: any) => {
				mockStorage[key] = value;
			},
		};
	});

	it('SecurityStore.init automatically enforces strict mode if encrypted keys exist in DB', async () => {
		// Arrange: database has an encrypted key (e.g. synced from another device)
		const enc = await encryptApiKey('sk-ant-test-key-12345', 'MyMasterPassword123!');
		mockRecords.push({
			provider: 'anthropic',
			securityMode: 'strict',
			isEncrypted: true,
			ciphertext: enc.ciphertext,
			iv: enc.iv,
			salt: enc.salt,
			updatedAt: new Date().toISOString(),
		});

		// Even if local storage setting was previously set to 'lax'
		mockStorage[SETTINGS_KEYS.SECURITY_MODE] = 'lax';
		mockStorage[SETTINGS_KEYS.HAS_MASTER_PASSWORD] = false;

		const security = new SecurityStore(mockDb);
		await security.init();

		// Assert: strict mode is enforced and locked
		expect(security.securityMode).toBe('strict');
		expect(security.hasMasterPassword).toBe(true);
		expect(security.isUnlocked).toBe(false);
		expect(mockStorage[SETTINGS_KEYS.SECURITY_MODE]).toBe('strict');
		expect(mockStorage[SETTINGS_KEYS.HAS_MASTER_PASSWORD]).toBe(true);
	});

	it('SecurityStore.init initializes as lax and unlocked when only plaintext keys exist', async () => {
		mockRecords.push({
			provider: 'openai',
			securityMode: 'lax',
			isEncrypted: false,
			plaintextKey: 'sk-open-test-key-54321',
			updatedAt: new Date().toISOString(),
		});
		mockStorage[SETTINGS_KEYS.SECURITY_MODE] = 'lax';

		const security = new SecurityStore(mockDb);
		await security.init();

		expect(security.securityMode).toBe('lax');
		expect(security.hasMasterPassword).toBe(false);
		expect(security.isUnlocked).toBe(true);
	});

	it('ApiKeyStore.makeAllKeysPlaintext converts encrypted keys to plaintext records in Dexie', async () => {
		const masterPassword = 'MasterPassword2026!';
		const enc = await encryptApiKey('sk-ant-sample-secret-key', masterPassword);
		mockRecords.push({
			provider: 'anthropic',
			securityMode: 'strict',
			isEncrypted: true,
			ciphertext: enc.ciphertext,
			iv: enc.iv,
			salt: enc.salt,
			updatedAt: new Date().toISOString(),
		});

		const apiKeys = new ApiKeyStore(mockDb);
		await apiKeys.init('strict');

		// Decrypt keys into memory
		await apiKeys.decryptAllKeys(masterPassword);
		expect(apiKeys.hasKey('anthropic')).toBe(true);
		expect(apiKeys.getKey('anthropic')).toBe('sk-ant-sample-secret-key');

		// Convert to plaintext records
		await apiKeys.makeAllKeysPlaintext();

		// Record in database should now be plaintext and not encrypted
		const updatedRecord = mockRecords.find((r) => r.provider === 'anthropic');
		expect(updatedRecord).toBeDefined();
		expect(updatedRecord?.isEncrypted).toBe(false);
		expect(updatedRecord?.securityMode).toBe('lax');
		expect(updatedRecord?.plaintextKey).toBe('sk-ant-sample-secret-key');
		expect(updatedRecord?.ciphertext).toBeUndefined();
	});

	it('ApiKeyStore.setSyncToCloud updates cloud sync setting in database', async () => {
		const apiKeys = new ApiKeyStore(mockDb);
		await apiKeys.init('lax');

		expect(apiKeys.syncToCloud).toBe(false);

		await apiKeys.setSyncToCloud(true);
		expect(apiKeys.syncToCloud).toBe(true);
		expect(mockStorage['sync_api_keys_to_cloud']).toBe(true);

		await apiKeys.setSyncToCloud(false);
		expect(apiKeys.syncToCloud).toBe(false);
		expect(mockStorage['sync_api_keys_to_cloud']).toBe(false);
	});

	it('Strict-to-Lax transition requires master password and fails on invalid password', async () => {
		const masterPassword = 'CorrectMasterPassword!88';
		const security = new SecurityStore(mockDb);
		const apiKeys = new ApiKeyStore(mockDb);

		// Setup strict mode with master password
		await security.setMasterPassword(masterPassword);
		const enc = await encryptApiKey('sk-google-key-999', masterPassword);
		mockRecords.push({
			provider: 'google',
			securityMode: 'strict',
			isEncrypted: true,
			ciphertext: enc.ciphertext,
			iv: enc.iv,
			salt: enc.salt,
			updatedAt: new Date().toISOString(),
		});

		await security.init();
		await apiKeys.init('strict');
		await apiKeys.setSyncToCloud(true);

		expect(security.securityMode).toBe('strict');
		expect(apiKeys.syncToCloud).toBe(true);

		// AppStore handleSwitchToLax behavior
		const handleSwitchToLax = async (password?: string) => {
			if (security.securityMode === 'lax') return;

			const records = await mockDb.getAllApiKeys();
			const hasEncryptedKeys = records.some((r: any) => r.isEncrypted);

			if (security.hasMasterPassword || hasEncryptedKeys) {
				if (!password) {
					throw new Error(
						'Master password is required to decrypt API keys before switching to Lax mode.'
					);
				}
				await apiKeys.decryptAllKeys(password);
			}

			await apiKeys.makeAllKeysPlaintext();
			await apiKeys.setSyncToCloud(false);
			await security.switchSecurityMode('lax');
		};

		// 1. Calling without password throws error
		let noPasswordError: Error | null = null;
		try {
			await handleSwitchToLax();
		} catch (err: any) {
			noPasswordError = err;
		}
		expect(noPasswordError).not.toBeNull();
		expect(noPasswordError?.message).toContain('Master password is required');
		expect(security.securityMode).toBe('strict'); // Mode not changed
		expect(apiKeys.syncToCloud).toBe(true); // Cloud sync not disabled

		// 2. Calling with incorrect password throws decryption error
		let wrongPasswordError: Error | null = null;
		try {
			await handleSwitchToLax('WrongPassword999!');
		} catch (err: any) {
			wrongPasswordError = err;
		}
		expect(wrongPasswordError).not.toBeNull();
		expect(security.securityMode).toBe('strict'); // Mode not changed
		expect(mockRecords[0].isEncrypted).toBe(true); // Keys still encrypted

		// 3. Calling with correct password successfully transitions to Lax mode
		await handleSwitchToLax(masterPassword);

		expect(security.securityMode).toBe('lax');
		expect(security.hasMasterPassword).toBe(false);
		expect(security.isUnlocked).toBe(true);
		expect(apiKeys.syncToCloud).toBe(false);
		expect(mockStorage['sync_api_keys_to_cloud']).toBe(false);

		// Stored record is converted to plaintext
		const updatedGoogleKey = mockRecords.find((r) => r.provider === 'google');
		expect(updatedGoogleKey?.isEncrypted).toBe(false);
		expect(updatedGoogleKey?.plaintextKey).toBe('sk-google-key-999');
	});
});
