/**
 * Testify - State Snapshot & Serialization Utility
 *
 * Strips reactive proxies (e.g. Svelte 5 $state proxies) so that records
 * can be safely serialized by browser IndexedDB Structured Clone algorithm.
 * Uses native Svelte 5 $state.snapshot() with safe cascading fallbacks
 * (structuredClone -> JSON parse/stringify -> identity).
 */

export function toCloneable<T>(data: T): T {
	if (data === null || typeof data !== 'object') {
		return data;
	}

	// 1. Primary: Native Svelte 5 $state.snapshot
	try {
		return $state.snapshot(data as object) as unknown as T;
	} catch {
		// Fallback to secondary clone methods if snapshot fails
	}

	// 2. Secondary fallback: Web standard structuredClone
	try {
		if (typeof structuredClone === 'function') {
			return structuredClone(data);
		}
	} catch {
		// Fallback to JSON clone
	}

	// 3. Tertiary fallback: JSON serialization clone
	try {
		return JSON.parse(JSON.stringify(data)) as T;
	} catch {
		// If object contains circular references or un-stringifiable elements, return original data
		return data;
	}
}
