/**
 * Testify - AI Provider Base Adapter Interface
 */

import type { AIProvider } from '$lib/types/apiKeys';
import type { AIGenerationPayload, AIGenerationResult } from '../types';

export interface AIProviderAdapter {
	readonly id: AIProvider;
	generateQuestions(payload: AIGenerationPayload): Promise<AIGenerationResult>;
}
