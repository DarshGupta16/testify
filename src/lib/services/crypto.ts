import { argon2id } from 'hash-wasm';
import { base64ToUint8Array, uint8ArrayToBase64 } from '$lib/utils/bytes';

/**
 * Testify - Cryptographic Security Service
 *
 * Implements Argon2id Password-Based Key Derivation (WebAssembly)
 * and AES-256-GCM authenticated encryption for API keys in browser storage.
 */

// Cryptographic configuration parameters
const ARGON2_CONFIG = {
	iterations: 3,
	memorySize: 65536, // 64 MB (memory-hard against GPU/ASIC attacks)
	hashLength: 32, // 256-bit AES key output
	parallelism: 1,
};

const AES_ALGORITHM = 'AES-GCM';
const SALT_BYTE_LENGTH = 16; // 128-bit salt
const IV_BYTE_LENGTH = 12; // 96-bit IV recommended for AES-GCM

// Re-export byte converters for backward compatibility
export { base64ToUint8Array, uint8ArrayToBase64 };

/**
 * Helper to ensure a TypedArray's buffer is a strict ArrayBuffer for Web Crypto API
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

// In-memory Promise-cached session KEK derivations to guarantee Argon2id runs once per (password, salt) pair
const keyDerivationCache = new Map<string, Promise<CryptoKey>>();

/**
 * Derives a 256-bit symmetric encryption key from a master password and salt using Argon2id.
 */
export async function deriveArgon2Key(password: string, salt: Uint8Array): Promise<Uint8Array> {
	if (!password || password.length === 0) {
		throw new Error('Password must not be empty.');
	}
	if (!salt || salt.length < 16) {
		throw new Error('Salt must be at least 16 bytes.');
	}

	const rawKey = await argon2id({
		password,
		salt,
		iterations: ARGON2_CONFIG.iterations,
		memorySize: ARGON2_CONFIG.memorySize,
		hashLength: ARGON2_CONFIG.hashLength,
		parallelism: ARGON2_CONFIG.parallelism,
		outputType: 'binary',
	});

	return rawKey;
}

/**
 * Derives (or returns cached) WebCrypto AES-256-GCM CryptoKey from password and salt.
 * Ensures Argon2id computation only runs once even when multiple keys are decrypted in parallel.
 * Immediately zeroes the raw key byte buffer in memory with rawKey.fill(0) after WebCrypto import.
 */
export function getDerivedCryptoKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
	const saltBase64 = uint8ArrayToBase64(salt);
	const cacheKey = `${password}:${saltBase64}`;

	const cached = keyDerivationCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const derivationPromise = (async () => {
		const rawKey = await deriveArgon2Key(password, salt);
		const rawKeyBuffer = toArrayBuffer(rawKey);

		try {
			const cryptoKey = await crypto.subtle.importKey(
				'raw',
				rawKeyBuffer,
				{ name: AES_ALGORITHM },
				false,
				['encrypt', 'decrypt']
			);
			return cryptoKey;
		} finally {
			// Zero out the raw key byte buffer immediately after WebCrypto import
			rawKey.fill(0);
		}
	})();

	keyDerivationCache.set(cacheKey, derivationPromise);
	return derivationPromise;
}

/**
 * Clears the in-memory derived CryptoKey cache.
 */
export function clearKeyDerivationCache(): void {
	keyDerivationCache.clear();
}

/**
 * Encrypts a plaintext API key string using AES-256-GCM with a key derived via Argon2id.
 */
export async function encryptApiKey(
	plaintext: string,
	password: string,
	customSalt?: Uint8Array
): Promise<{ ciphertext: string; iv: string; salt: string }> {
	if (!plaintext) {
		throw new Error('Cannot encrypt empty plaintext key.');
	}
	if (!password) {
		throw new Error('Master password is required for encryption.');
	}

	// 1. Generate cryptographically secure random salt (or use supplied) and IV
	const salt = customSalt || crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));

	// 2. Derive 256-bit key from password using Argon2id (cached per session/salt)
	const cryptoKey = await getDerivedCryptoKey(password, salt);

	// 3. Encrypt with AES-GCM
	const encoder = new TextEncoder();
	const plaintextBytes = encoder.encode(plaintext);
	const ivBuffer = toArrayBuffer(iv);

	const encryptedBuffer = await crypto.subtle.encrypt(
		{ name: AES_ALGORITHM, iv: ivBuffer },
		cryptoKey,
		plaintextBytes
	);

	return {
		ciphertext: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
		iv: uint8ArrayToBase64(iv),
		salt: uint8ArrayToBase64(salt),
	};
}

/**
 * Decrypts an encrypted API key payload using AES-256-GCM and a master password.
 * Throws an error if the master password is wrong or ciphertext is corrupted/tampered.
 */
export async function decryptApiKey(
	encrypted: { ciphertext: string; iv: string; salt: string },
	password: string
): Promise<string> {
	if (!encrypted.ciphertext || !encrypted.iv || !encrypted.salt) {
		throw new Error('Malformed encrypted payload: missing ciphertext, iv, or salt.');
	}
	if (!password) {
		throw new Error('Master password is required for decryption.');
	}

	try {
		const salt = base64ToUint8Array(encrypted.salt);
		const iv = base64ToUint8Array(encrypted.iv);
		const ciphertextBytes = base64ToUint8Array(encrypted.ciphertext);

		// 1. Re-derive or retrieve cached WebCrypto key
		const cryptoKey = await getDerivedCryptoKey(password, salt);

		// 2. Decrypt ciphertext
		const ivBuffer = toArrayBuffer(iv);
		const ciphertextBuffer = toArrayBuffer(ciphertextBytes);

		const decryptedBuffer = await crypto.subtle.decrypt(
			{ name: AES_ALGORITHM, iv: ivBuffer },
			cryptoKey,
			ciphertextBuffer
		);

		const decoder = new TextDecoder();
		return decoder.decode(decryptedBuffer);
	} catch (_err) {
		// AES-GCM authentication tag verification failure indicates incorrect password or tampering
		console.warn('[Crypto] Decryption failed - invalid password or corrupted data');
		throw new Error('Invalid master password or corrupted key data.');
	}
}

/**
 * Encrypts directly using an existing WebCrypto CryptoKey.
 */
export async function encryptWithKey(
	plaintext: string,
	cryptoKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
	const encoder = new TextEncoder();
	const plaintextBytes = encoder.encode(plaintext);

	const encryptedBuffer = await crypto.subtle.encrypt(
		{ name: AES_ALGORITHM, iv: toArrayBuffer(iv) },
		cryptoKey,
		plaintextBytes
	);

	return {
		ciphertext: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
		iv: uint8ArrayToBase64(iv),
	};
}

/**
 * Decrypts directly using an existing WebCrypto CryptoKey.
 */
export async function decryptWithKey(
	ciphertext: string,
	iv: string,
	cryptoKey: CryptoKey
): Promise<string> {
	const ivBytes = base64ToUint8Array(iv);
	const ciphertextBytes = base64ToUint8Array(ciphertext);

	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: AES_ALGORITHM, iv: toArrayBuffer(ivBytes) },
		cryptoKey,
		toArrayBuffer(ciphertextBytes)
	);

	const decoder = new TextDecoder();
	return decoder.decode(decryptedBuffer);
}
