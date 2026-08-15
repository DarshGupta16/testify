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
	defaultModel: string;
	suggestedModels: string[];
	visionNotice?: string;
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
		defaultModel: 'gpt-5.6-sol',
		suggestedModels: [
			'gpt-5.6-sol',
			'gpt-5.6-terra',
			'gpt-5.6-luna',
			'o4-mini',
			'o3-pro',
			'gpt-5.5',
			'gpt-5.4-mini',
		],
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
		defaultModel: 'claude-sonnet-5',
		suggestedModels: [
			'claude-sonnet-5',
			'claude-opus-5',
			'claude-fable-5',
			'claude-haiku-4-5',
			'claude-sonnet-4-6',
		],
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
		defaultModel: 'gemini-3.7-flash',
		suggestedModels: [
			'gemini-3.7-flash',
			'gemini-3.6-flash',
			'gemini-3.5-flash',
			'gemini-3.5-flash-lite',
			'gemini-3.1-pro-preview',
			'gemma-4-31b-it',
			'gemma-4-26b-a4b-it',
		],
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
		defaultModel: 'qwen/qwen3.6-27b',
		visionNotice:
			"Notice: qwen/qwen3.6-27b is the only model on Groq that supports this app's functionality (multimodal vision processing for PDF page renders, diagrams, and figures).",
		suggestedModels: ['qwen/qwen3.6-27b'],
	},
];
