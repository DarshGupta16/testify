/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import { toCloneable } from '../src/lib/utils/snapshot.svelte';

describe('toCloneable utility', () => {
	it('safely clones plain objects and primitives', () => {
		expect(toCloneable(null)).toBeNull();
		expect(toCloneable(undefined)).toBeUndefined();
		expect(toCloneable(42)).toBe(42);
		expect(toCloneable('test')).toBe('test');

		const plain = { id: 'test_1', title: 'Sample Test', count: 10 };
		const cloned = toCloneable(plain);
		expect(cloned).toEqual(plain);
		expect(cloned).not.toBe(plain);
	});

	it('safely clones Proxy objects where structuredClone would fail', () => {
		const target = {
			id: 'test_proxy',
			title: 'Proxy Test',
			questions: [
				{ id: 'q1', text: 'Question 1' },
				{ id: 'q2', text: 'Question 2' },
			],
		};

		const proxy = new Proxy(target, {});

		// Verify that native structuredClone on this Proxy throws DataCloneError
		expect(() => structuredClone(proxy)).toThrow();

		// toCloneable must succeed without throwing
		const cloned = toCloneable(proxy);
		expect(cloned).toEqual(target);
		expect(cloned).not.toBe(proxy);
	});

	it('ensures deep isolation so edits to cloned copy do not mutate original', () => {
		const original = {
			id: 'test_original',
			nested: { count: 1 },
			items: ['a', 'b'],
		};

		const proxy = new Proxy(original, {});
		const cloned = toCloneable(proxy);

		cloned.nested.count = 999;
		cloned.items.push('c');

		expect(original.nested.count).toBe(1);
		expect(original.items).toEqual(['a', 'b']);
	});
});
