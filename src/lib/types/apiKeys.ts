/**
 * Testify - AI Provider & API Key Security Types
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'groq';

export type SecurityMode = 'strict' | 'lax';

export interface StoredApiKeyRecord {
	provider: AIProvider;
	securityMode: SecurityMode;
	isEncrypted: boolean;
	plaintextKey?: string;
	ciphertext?: string; // Base64 encoded AES-GCM ciphertext
	iv?: string; // Base64 encoded 12-byte IV
	salt?: string; // Base64 encoded 16-byte Argon2 salt
	updatedAt: string; // ISO date string
}

export interface ProviderMetadata {
	id: AIProvider;
	name: string;
	keyPrefix: string;
	docsUrl: string;
	badgeBg: string;
	badgeBorder: string;
	badgeText: string;
	placeholder: string;
}

export const AI_PROVIDERS: ProviderMetadata[] = [
	{
		id: 'openai',
		name: 'OpenAI',
		keyPrefix: 'sk-',
		docsUrl: 'https://platform.openai.com/api-keys',
		badgeBg: '#10a37f',
		badgeBorder: '#0e8064',
		badgeText: '#ffffff',
		placeholder: 'sk-proj-...',
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		keyPrefix: 'sk-ant-',
		docsUrl: 'https://console.anthropic.com/settings/keys',
		badgeBg: '#d97706',
		badgeBorder: '#b45309',
		badgeText: '#ffffff',
		placeholder: 'sk-ant-api03-...',
	},
	{
		id: 'google',
		name: 'Google',
		keyPrefix: 'AIza',
		docsUrl: 'https://aistudio.google.com/app/apikey',
		badgeBg: '#2563eb',
		badgeBorder: '#1d4ed8',
		badgeText: '#ffffff',
		placeholder: 'AIzaSy...',
	},
	{
		id: 'groq',
		name: 'Groq',
		keyPrefix: 'gsk_',
		docsUrl: 'https://console.groq.com/keys',
		badgeBg: '#f97316',
		badgeBorder: '#ea580c',
		badgeText: '#ffffff',
		placeholder: 'gsk_...',
	},
];
