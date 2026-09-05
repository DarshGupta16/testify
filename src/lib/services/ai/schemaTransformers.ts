/**
 * Testify - Canonical Schema Transformers
 *
 * Provides bidirectional and provider-specific transformers to convert
 * a single canonical JSON Schema into Google Gemini Schema, OpenAI Strict JSON Schema,
 * and Anthropic Tool definitions.
 */

import { Type } from '@google/genai';

/**
 * Mapping between standard JSON Schema primitive types and Google GenAI Type enum.
 */
const JSON_SCHEMA_TO_GEMINI_TYPE: Record<string, Type> = {
	object: Type.OBJECT,
	string: Type.STRING,
	array: Type.ARRAY,
	integer: Type.INTEGER,
	number: Type.NUMBER,
	boolean: Type.BOOLEAN,
};

/**
 * Shape of OpenAI Structured Outputs response_format object in strict mode.
 */
export interface OpenAIStrictSchemaDefinition {
	type: 'json_schema';
	json_schema: {
		name: string;
		strict: true;
		schema: Record<string, unknown>;
	};
	[key: string]: unknown;
}

/**
 * Shape of Anthropic tool definition for structured output extraction.
 */
export interface AnthropicToolDefinition {
	name: string;
	description: string;
	input_schema: {
		type: 'object';
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * Recursively maps JSON Schema types ('object', 'string', 'array', 'integer', 'number', 'boolean')
 * to @google/genai Type enum (Type.OBJECT, Type.STRING, Type.ARRAY, Type.INTEGER, Type.NUMBER, Type.BOOLEAN).
 * Preserves properties, items, required, description, enum, and strips OpenAI-specific keywords.
 */
export function toGeminiSchema(jsonSchema: Record<string, unknown>): Record<string, unknown> {
	if (!jsonSchema || typeof jsonSchema !== 'object' || Array.isArray(jsonSchema)) {
		return jsonSchema;
	}

	const result: Record<string, unknown> = { ...jsonSchema };

	// Omit OpenAI-specific fields that Google GenAI Schema does not support
	delete result.additionalProperties;

	// Map type to @google/genai Type enum
	if (typeof result.type === 'string') {
		const lower = result.type.toLowerCase();
		if (lower in JSON_SCHEMA_TO_GEMINI_TYPE) {
			result.type = JSON_SCHEMA_TO_GEMINI_TYPE[lower];
		} else {
			const upper = result.type.toUpperCase();
			if (upper in Type) {
				result.type = (Type as Record<string, Type>)[upper];
			}
		}
	} else if (Array.isArray(result.type)) {
		const typeArray = result.type;
		const nonNull = typeArray.find((t) => t !== 'null');
		if (typeof nonNull === 'string' && nonNull.toLowerCase() in JSON_SCHEMA_TO_GEMINI_TYPE) {
			result.type = JSON_SCHEMA_TO_GEMINI_TYPE[nonNull.toLowerCase()];
		}
		if (typeArray.includes('null')) {
			result.nullable = true;
		}
	}

	// Recursively transform properties
	if (
		result.properties &&
		typeof result.properties === 'object' &&
		!Array.isArray(result.properties)
	) {
		const props = result.properties as Record<string, Record<string, unknown>>;
		const transformedProps: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(props)) {
			transformedProps[key] =
				val && typeof val === 'object' ? toGeminiSchema(val as Record<string, unknown>) : val;
		}
		result.properties = transformedProps;
	}

	// Recursively transform items
	if (result.items) {
		if (Array.isArray(result.items)) {
			result.items = result.items.map((item) =>
				item && typeof item === 'object' ? toGeminiSchema(item as Record<string, unknown>) : item
			);
		} else if (typeof result.items === 'object') {
			result.items = toGeminiSchema(result.items as Record<string, unknown>);
		}
	}

	return result;
}

/**
 * Recursively ensures all object definitions have additionalProperties: false (required by OpenAI strict mode)
 * and all property keys are included in required.
 */
export function toOpenAIStrictSchema(
	name: string,
	jsonSchema: Record<string, unknown>
): OpenAIStrictSchemaDefinition {
	function transformStrict(schema: Record<string, unknown>): Record<string, unknown> {
		if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
			return schema;
		}

		const result: Record<string, unknown> = { ...schema };

		// Normalize type to lowercase JSON Schema string
		if (typeof result.type === 'string') {
			result.type = result.type.toLowerCase();
		}

		// Process properties
		if (
			result.properties &&
			typeof result.properties === 'object' &&
			!Array.isArray(result.properties)
		) {
			const props = result.properties as Record<string, Record<string, unknown>>;
			const transformedProps: Record<string, unknown> = {};
			for (const [key, val] of Object.entries(props)) {
				transformedProps[key] =
					val && typeof val === 'object' ? transformStrict(val as Record<string, unknown>) : val;
			}
			result.properties = transformedProps;

			// Enforce additionalProperties: false for OpenAI strict mode
			result.additionalProperties = false;

			// Enforce all property keys included in required for OpenAI strict mode
			const propKeys = Object.keys(transformedProps);
			const existingRequired = Array.isArray(result.required) ? (result.required as string[]) : [];
			const requiredSet = new Set(existingRequired);
			for (const key of propKeys) {
				requiredSet.add(key);
			}
			result.required = Array.from(requiredSet);
		} else if (result.type === 'object') {
			result.additionalProperties = false;
			if (!Array.isArray(result.required)) {
				result.required = [];
			}
		}

		// Process items
		if (result.items) {
			if (Array.isArray(result.items)) {
				result.items = result.items.map((item) =>
					item && typeof item === 'object'
						? transformStrict(item as Record<string, unknown>)
						: item
				);
			} else if (typeof result.items === 'object') {
				result.items = transformStrict(result.items as Record<string, unknown>);
			}
		}

		return result;
	}

	return {
		type: 'json_schema',
		json_schema: {
			name,
			strict: true,
			schema: transformStrict(jsonSchema),
		},
	};
}

/**
 * Transforms a canonical JSON Schema into an Anthropic Tool definition.
 */
export function toAnthropicTool(
	name: string,
	description: string,
	jsonSchema: Record<string, unknown>
): AnthropicToolDefinition {
	function normalizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
		if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
			return schema;
		}

		const result: Record<string, unknown> = { ...schema };

		if (typeof result.type === 'string') {
			result.type = result.type.toLowerCase();
		}

		if (
			result.properties &&
			typeof result.properties === 'object' &&
			!Array.isArray(result.properties)
		) {
			const props = result.properties as Record<string, Record<string, unknown>>;
			const transformedProps: Record<string, unknown> = {};
			for (const [key, val] of Object.entries(props)) {
				transformedProps[key] =
					val && typeof val === 'object' ? normalizeSchema(val as Record<string, unknown>) : val;
			}
			result.properties = transformedProps;
		}

		if (result.items) {
			if (Array.isArray(result.items)) {
				result.items = result.items.map((item) =>
					item && typeof item === 'object'
						? normalizeSchema(item as Record<string, unknown>)
						: item
				);
			} else if (typeof result.items === 'object') {
				result.items = normalizeSchema(result.items as Record<string, unknown>);
			}
		}

		return result;
	}

	const normalized = normalizeSchema(jsonSchema);

	return {
		name,
		description,
		input_schema: {
			...normalized,
			type: 'object',
		},
	};
}
