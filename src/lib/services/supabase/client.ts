import { createClient } from '@supabase/supabase-js';
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

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Singleton Supabase Client with full database typing
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
});
