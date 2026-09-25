import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import type { Database } from './types';

const supabaseUrl =
	env.PUBLIC_SUPABASE_URL ||
	(typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
	'';

const supabaseAnonKey =
	env.PUBLIC_SUPABASE_ANON_KEY ||
	(typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) ||
	'';

export const isSupabaseConfigured = Boolean(
	supabaseUrl &&
		supabaseAnonKey &&
		typeof supabaseUrl === 'string' &&
		supabaseUrl.startsWith('http')
);

/**
 * Creates a safe dummy client for guest mode or when Supabase credentials are missing.
 * Prevents TypeError: Invalid URL on module evaluation and prevents runtime crashes.
 */
function createDummyClient(): SupabaseClient<Database> {
	const dummyProxy: any = new Proxy(() => {}, {
		get(_target, prop) {
			if (prop === 'then') {
				return (resolve: (val: any) => void) => {
					resolve({ data: null, error: null, count: 0, status: 200, statusText: 'OK' });
				};
			}
			if (prop === 'auth') {
				return {
					getSession: async () => ({ data: { session: null }, error: null }),
					getUser: async () => ({ data: { user: null }, error: null }),
					onAuthStateChange: () => ({
						data: {
							subscription: {
								id: 'dummy',
								callback: () => {},
								unsubscribe: () => {},
							},
						},
					}),
					signInWithPassword: async () => ({
						data: { user: null, session: null },
						error: new Error('Supabase is not configured'),
					}),
					signUp: async () => ({
						data: { user: null, session: null },
						error: new Error('Supabase is not configured'),
					}),
					signOut: async () => ({ error: null }),
					resetPasswordForEmail: async () => ({ error: new Error('Supabase is not configured') }),
					updateUser: async () => ({
						data: { user: null },
						error: new Error('Supabase is not configured'),
					}),
					signInWithOAuth: async () => ({
						data: { provider: '', url: null },
						error: new Error('Supabase is not configured'),
					}),
				};
			}
			if (prop === 'storage') {
				return {
					from: () => dummyProxy,
				};
			}
			if (prop === 'channel') {
				return () => dummyProxy;
			}
			if (prop === 'subscribe') {
				return (cb?: (status: string) => void) => {
					if (cb) cb('CLOSED');
					return dummyProxy;
				};
			}
			if (prop === 'unsubscribe' || prop === 'removeChannel' || prop === 'removeAllChannels') {
				return async () => 'ok';
			}
			return dummyProxy;
		},
		apply(_target, _thisArg, _args) {
			return dummyProxy;
		},
	});

	return dummyProxy as SupabaseClient<Database>;
}

/**
 * Singleton Supabase Client with full database typing
 */
export const supabase: SupabaseClient<Database> = isSupabaseConfigured
	? createClient<Database>(supabaseUrl, supabaseAnonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true,
			},
			realtime: {
				params: {
					eventsPerSecond: 10,
				},
			},
		})
	: createDummyClient();
