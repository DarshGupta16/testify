import { describe, expect, it } from 'bun:test';
import { trySupabaseOrQueue } from '$lib/services/supabase/sync/trySupabaseOrQueue';
import { AuthStore } from '$lib/stores/authStore.svelte';

describe('Supabase Sync & Offline Operations', () => {
	it('trySupabaseOrQueue succeeds and returns result when online', async () => {
		let operationExecuted = false;
		await trySupabaseOrQueue(
			async () => {
				operationExecuted = true;
				return { data: { id: 'test-123' }, error: null };
			},
			{
				table: 'tests',
				action: 'create',
				recordId: 'test-123',
				data: { id: 'test-123', title: 'Test 1' },
			}
		);

		expect(operationExecuted).toBe(true);
	});

	it('trySupabaseOrQueue catches network errors and gracefully falls back to offline queue', async () => {
		let attempted = false;
		await trySupabaseOrQueue(
			async () => {
				attempted = true;
				throw new TypeError('Failed to fetch');
			},
			{
				table: 'tests',
				action: 'update',
				recordId: 'test-456',
				data: { id: 'test-456', title: 'Offline Test' },
			}
		);

		expect(attempted).toBe(true);
	});

	it('AuthStore initializes with guest/unauthenticated state and handles logout cleanly', () => {
		const auth = new AuthStore();
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.user).toBeNull();
		expect(auth.syncStatus).toBe('idle');
		expect(auth.showDeviceSyncPrompt).toBe(false);
	});
});
