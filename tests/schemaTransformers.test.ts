/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import { Type } from '@google/genai';
import {
	toGeminiSchema,
	toOpenAIStrictSchema,
	toAnthropicTool,
} from '../src/lib/services/ai/schemaTransformers';
import {
	PAPER_BLUEPRINT_CANONICAL_SCHEMA,
	GEMINI_PAPER_BLUEPRINT_SCHEMA,
	OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA,
	OPENAI_PAPER_BLUEPRINT_SCHEMA,
	ANTHROPIC_PAPER_BLUEPRINT_TOOL,
	GROQ_PAPER_BLUEPRINT_SCHEMA,
} from '../src/lib/services/ai/similarPaperSchemas';
import {
	ASSESSMENT_CANONICAL_SCHEMA,
	GEMINI_ASSESSMENT_SCHEMA,
	OPENAI_STRICT_ASSESSMENT_SCHEMA,
	OPENAI_ASSESSMENT_SCHEMA,
	ANTHROPIC_ASSESSMENT_TOOL,
	GROQ_ASSESSMENT_SCHEMA,
} from '../src/lib/services/ai/schemas';

describe('schemaTransformers', () => {
	const sampleSchema = {
		type: 'object',
		description: 'A sample root object',
		properties: {
			strProp: {
				type: 'string',
				description: 'A string property',
				enum: ['val1', 'val2'],
			},
			intProp: {
				type: 'integer',
				description: 'An integer property',
			},
			numProp: {
				type: 'number',
				description: 'A number property',
			},
			boolProp: {
				type: 'boolean',
				description: 'A boolean property',
			},
			arrProp: {
				type: 'array',
				description: 'An array of objects',
				items: {
					type: 'object',
					properties: {
						childStr: { type: 'string' },
					},
					required: ['childStr'],
				},
			},
		},
		required: ['strProp'],
	};

	describe('toGeminiSchema', () => {
		it('recursively maps JSON Schema types to Google GenAI Type enum', () => {
			const gemini = toGeminiSchema(sampleSchema);

			expect(gemini.type).toBe(Type.OBJECT);
			expect(gemini.description).toBe('A sample root object');

			const props = gemini.properties as Record<string, Record<string, unknown>>;
			expect(props.strProp.type).toBe(Type.STRING);
			expect(props.strProp.enum).toEqual(['val1', 'val2']);
			expect(props.intProp.type).toBe(Type.INTEGER);
			expect(props.numProp.type).toBe(Type.NUMBER);
			expect(props.boolProp.type).toBe(Type.BOOLEAN);

			expect(props.arrProp.type).toBe(Type.ARRAY);
			const items = props.arrProp.items as Record<string, unknown>;
			expect(items.type).toBe(Type.OBJECT);

			const childProps = items.properties as Record<string, Record<string, unknown>>;
			expect(childProps.childStr.type).toBe(Type.STRING);
		});

		it('strips additionalProperties and preserves required', () => {
			const input = {
				type: 'object',
				additionalProperties: false,
				properties: {
					a: { type: 'string' },
				},
				required: ['a'],
			};
			const gemini = toGeminiSchema(input);
			expect(gemini.additionalProperties).toBeUndefined();
			expect(gemini.required).toEqual(['a']);
		});
	});

	describe('toOpenAIStrictSchema', () => {
		it('enforces additionalProperties: false and ensures all property keys in required', () => {
			const openAI = toOpenAIStrictSchema('test_model', sampleSchema);

			expect(openAI.type).toBe('json_schema');
			expect(openAI.json_schema.name).toBe('test_model');
			expect(openAI.json_schema.strict).toBe(true);

			const schema = openAI.json_schema.schema;
			expect(schema.type).toBe('object');
			expect(schema.additionalProperties).toBe(false);

			// All properties must be in required
			const req = schema.required as string[];
			expect(req).toContain('strProp');
			expect(req).toContain('intProp');
			expect(req).toContain('numProp');
			expect(req).toContain('boolProp');
			expect(req).toContain('arrProp');

			// Nested object in array items
			const props = schema.properties as Record<string, Record<string, unknown>>;
			const arrItems = props.arrProp.items as Record<string, unknown>;
			expect(arrItems.type).toBe('object');
			expect(arrItems.additionalProperties).toBe(false);
			expect(arrItems.required).toEqual(['childStr']);
		});
	});

	describe('toAnthropicTool', () => {
		it('wraps schema into Anthropic tool format with input_schema', () => {
			const tool = toAnthropicTool(
				'test_tool',
				'A test tool description',
				sampleSchema
			);

			expect(tool.name).toBe('test_tool');
			expect(tool.description).toBe('A test tool description');
			expect(tool.input_schema.type).toBe('object');
			expect(tool.input_schema.properties).toBeDefined();
		});
	});

	describe('similarPaperSchemas exports', () => {
		it('provides canonical schema and valid provider exports', () => {
			expect(PAPER_BLUEPRINT_CANONICAL_SCHEMA.type).toBe('object');
			const props = PAPER_BLUEPRINT_CANONICAL_SCHEMA.properties as Record<string, unknown>;
			expect(Object.keys(props).length).toBe(14);

			// Gemini export
			expect(GEMINI_PAPER_BLUEPRINT_SCHEMA.type).toBe(Type.OBJECT);

			// OpenAI export
			expect(OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA.type).toBe('json_schema');
			expect(OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA.json_schema.name).toBe('paper_blueprint');
			expect(OPENAI_PAPER_BLUEPRINT_SCHEMA).toBe(OPENAI_STRICT_PAPER_BLUEPRINT_SCHEMA);

			// Anthropic export
			expect(ANTHROPIC_PAPER_BLUEPRINT_TOOL.name).toBe('extract_paper_blueprint');
			expect(ANTHROPIC_PAPER_BLUEPRINT_TOOL.input_schema.type).toBe('object');

			// Groq export
			expect(GROQ_PAPER_BLUEPRINT_SCHEMA).toEqual({ type: 'json_object' });
		});
	});

	describe('schemas exports', () => {
		it('provides canonical assessment schema and valid provider exports', () => {
			expect(ASSESSMENT_CANONICAL_SCHEMA.type).toBe('object');

			// Gemini export
			expect(GEMINI_ASSESSMENT_SCHEMA.type).toBe(Type.OBJECT);

			// OpenAI export
			expect(OPENAI_STRICT_ASSESSMENT_SCHEMA.type).toBe('json_schema');
			expect(OPENAI_STRICT_ASSESSMENT_SCHEMA.json_schema.name).toBe('assessment');
			expect(OPENAI_ASSESSMENT_SCHEMA).toBe(OPENAI_STRICT_ASSESSMENT_SCHEMA);

			// Anthropic export
			expect(ANTHROPIC_ASSESSMENT_TOOL.name).toBe('digitize_exam_paper');
			expect(ANTHROPIC_ASSESSMENT_TOOL.input_schema.type).toBe('object');

			// Groq export
			expect(GROQ_ASSESSMENT_SCHEMA).toEqual({ type: 'json_object' });
		});
	});
});
