import type { Session, User } from '@supabase/supabase-js';
import { db } from '$lib/services/db';
import {
	isSupabaseConfigured,
	localToSupabaseSync,
	setupRealtimeSubscriptions,
	supabase,
	supabaseDeltaSync,
	supabaseToLocalSync,
} from '$lib/services/supabase';
import type { AppStore } from '$lib/stores/appContext.svelte';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export class AuthStore {
	private app?: AppStore;
	private unsubscribeRealtime: (() => void) | null = null;

	// Reactive Auth & Sync State
	user = $state<User | null>(null);
	session = $state<Session | null>(null);
	isInitialized = $state<boolean>(false);
	isLoading = $state<boolean>(false);
	syncStatus = $state<SyncState>('idle');
	syncError = $state<string | null>(null);
	showDeviceSyncPrompt = $state<boolean>(false);
	pendingLocalTestsCount = $state<number>(0);

	// Derived Auth State
	isAuthenticated = $derived(Boolean(this.user));
	userEmail = $derived(this.user?.email || '');

	/**
	 * Initialize authentication session and register auth state listener
	 */
	async init(app: AppStore): Promise<void> {
		this.app = app;
		if (!isSupabaseConfigured) {
			console.warn('[AuthStore] Supabase credentials not configured in environment.');
			this.isInitialized = true;
			return;
		}

		try {
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				console.error('[AuthStore] Error fetching initial session:', error);
			} else {
				this.session = data.session;
				this.user = data.session?.user || null;
			}

			// Listen for auth state transitions (Sign In, Sign Out, Token Refresh)
			supabase.auth.onAuthStateChange(async (event, newSession) => {
				const previousUser = this.user;
				this.session = newSession;
				this.user = newSession?.user || null;

				if (newSession?.user && (!previousUser || previousUser.id !== newSession.user.id)) {
					// User logged in or switched account
					await this.handleUserAuthenticated(event);
				} else if (!newSession?.user && previousUser) {
					// User logged out
					this.handleUserLoggedOut();
				}
			});

			if (this.user) {
				await this.startSyncCycle();
			}
		} catch (err) {
			console.error('[AuthStore] Initialization failed:', err);
		} finally {
			this.isInitialized = true;
		}
	}

	/**
	 * Handles newly authenticated user, checking whether local data reconciliation is needed.
	 */
	private async handleUserAuthenticated(event: string): Promise<void> {
		if (!this.app) return;

		const localTests = await db.getAllTests();
		const hasExistingLocalPapers = localTests.length > 0;

		// First-time signup automatically uploads all local papers
		if (event === 'SIGNED_UP' && hasExistingLocalPapers) {
			await this.mergeAndUploadLocalData();
			await this.startSyncCycle();
			return;
		}

		// If logging in on another device with existing local papers, prompt user for decision
		if (hasExistingLocalPapers) {
			this.pendingLocalTestsCount = localTests.length;
			this.showDeviceSyncPrompt = true;
		} else {
			// Fresh device, pull cloud tests
			await this.keepCloudOnly();
			await this.startSyncCycle();
		}
	}

	private handleUserLoggedOut(): void {
		if (this.unsubscribeRealtime) {
			this.unsubscribeRealtime();
			this.unsubscribeRealtime = null;
		}
		this.syncStatus = 'idle';
		this.syncError = null;
		this.showDeviceSyncPrompt = false;
	}

	/**
	 * Starts the two-way sync cycle: drains local offline_ops, pulls cloud delta, and establishes realtime.
	 */
	async startSyncCycle(): Promise<void> {
		if (!this.user || !this.app) return;

		this.syncStatus = 'syncing';
		this.syncError = null;

		try {
			// 1. Drain pending offline ops
			await localToSupabaseSync();

			// 2. Fetch incremental cloud changes
			await supabaseDeltaSync(this.app);

			// 3. Connect real-time change listener
			if (!this.unsubscribeRealtime) {
				this.unsubscribeRealtime = setupRealtimeSubscriptions(this.app);
			}

			this.syncStatus = 'synced';
		} catch (err) {
			console.error('[AuthStore] Sync cycle failed:', err);
			this.syncStatus = 'error';
			this.syncError = (err as Error).message || 'Failed to sync with cloud';
		}
	}

	/**
	 * Uploads and reconciles all local tests, folders, subjects, and attempts with user's Supabase account.
	 */
	async mergeAndUploadLocalData(): Promise<void> {
		if (!this.user || !this.app) return;
		this.syncStatus = 'syncing';

		try {
			const [tests, folders, subjects, attempts] = await Promise.all([
				db.getAllTests(),
				db.getAllFolders(),
				db.getAllSubjects(),
				db.getAllAttempts(),
			]);

			// 1. Upsert subjects
			for (const s of subjects) {
				await supabase.from('subjects').upsert({
					id: s.id,
					name: s.name,
					created_at: s.createdAt,
					updated_at: s.updatedAt || new Date().toISOString(),
				});
			}

			// 2. Upsert folders
			for (const f of folders) {
				await supabase.from('folders').upsert({
					id: f.id,
					name: f.name,
					parent_folder_id: f.parentFolderId || null,
					color: f.color || null,
					icon: f.icon || null,
					order_index: f.order,
					description: f.description || null,
					created_at: f.createdAt,
					updated_at: f.updatedAt,
				});
			}

			// 3. Upsert tests
			for (const t of tests) {
				await supabase.from('tests').upsert({
					id: t.id,
					title: t.title,
					description: t.description || null,
					subject_id: t.subjectId,
					folder_id: t.folderId || null,
					duration_minutes: t.durationMinutes,
					total_marks: t.totalMarks,
					test_file_name: t.testFileName,
					test_file_size_formatted: t.testFileSizeFormatted,
					answer_key_file_name: t.answerKeyFileName || null,
					answer_key_file_size_formatted: t.answerKeyFileSizeFormatted || null,
					status: t.status,
					questions: t.questions as unknown as import('$lib/services/supabase/types').Json,
					blueprint: t.blueprint as unknown as import('$lib/services/supabase/types').Json,
					token_usage: t.tokenUsage as unknown as import('$lib/services/supabase/types').Json,
					ai_provider: t.aiProvider || null,
					ai_model: t.aiModel || null,
					created_at: t.createdAt,
					updated_at: t.updatedAt || new Date().toISOString(),
				});
			}

			// 4. Upsert attempts
			for (const a of attempts) {
				await supabase.from('attempts').upsert({
					id: a.id,
					test_id: a.testId,
					test_title: a.testTitle,
					started_at: a.startedAt,
					completed_at: a.completedAt || null,
					duration_seconds_taken: a.durationSecondsTaken,
					mode: a.mode,
					status: a.status,
					responses: a.responses as unknown as import('$lib/services/supabase/types').Json,
					score: a.score,
					max_possible_score: a.maxPossibleScore,
					accuracy_percentage: a.accuracyPercentage,
					total_questions: a.totalQuestions,
					answered_count: a.answeredCount,
					correct_count: a.correctCount,
					incorrect_count: a.incorrectCount,
					unattempted_count: a.unattemptedCount,
					review_count: a.reviewCount,
					updated_at: a.updatedAt || new Date().toISOString(),
				});
			}

			this.showDeviceSyncPrompt = false;
			await this.startSyncCycle();
			this.app.toast.show('Local assessments merged and uploaded to cloud.', 'success');
		} catch (err) {
			console.error('[AuthStore] Failed merging local data:', err);
			this.syncStatus = 'error';
			this.syncError = (err as Error).message || 'Failed to merge local assessments';
		}
	}

	/**
	 * Discards unlinked local papers and hydrates exclusively from user's Supabase account.
	 */
	async keepCloudOnly(): Promise<void> {
		if (!this.user || !this.app) return;
		this.syncStatus = 'syncing';

		try {
			await supabaseToLocalSync(this.app);
			this.showDeviceSyncPrompt = false;
			this.syncStatus = 'synced';
			this.app.toast.show('Synchronized assessments from your cloud account.', 'success');
		} catch (err) {
			console.error('[AuthStore] Failed keeping cloud only:', err);
			this.syncStatus = 'error';
			this.syncError = (err as Error).message || 'Failed pulling cloud assessments';
		}
	}

	/**
	 * Manual user-triggered sync action from the top navigation bar.
	 */
	async syncNow(): Promise<void> {
		if (!this.user) return;
		await this.startSyncCycle();
		if (this.app) {
			this.app.toast.show('Synchronization complete.', 'success');
		}
	}

	// --- Authentication Actions ---

	async signInWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
		this.isLoading = true;
		try {
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
			return { error: null };
		} catch (err) {
			return { error: err as Error };
		} finally {
			this.isLoading = false;
		}
	}

	async signUp(email: string, password: string): Promise<{ error: Error | null }> {
		this.isLoading = true;
		try {
			const { error } = await supabase.auth.signUp({ email, password });
			if (error) throw error;
			return { error: null };
		} catch (err) {
			return { error: err as Error };
		} finally {
			this.isLoading = false;
		}
	}

	async signInWithOAuth(provider: 'google' | 'github'): Promise<{ error: Error | null }> {
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
				},
			});
			if (error) throw error;
			return { error: null };
		} catch (err) {
			return { error: err as Error };
		}
	}

	async resetPassword(email: string): Promise<{ error: Error | null }> {
		this.isLoading = true;
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo:
					typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
			});
			if (error) throw error;
			return { error: null };
		} catch (err) {
			return { error: err as Error };
		} finally {
			this.isLoading = false;
		}
	}

	async signOut(): Promise<void> {
		this.isLoading = true;
		try {
			await supabase.auth.signOut();
			this.handleUserLoggedOut();
			if (this.app) {
				this.app.toast.show('Signed out successfully.', 'info');
			}
		} catch (err) {
			console.error('[AuthStore] Failed signing out:', err);
		} finally {
			this.isLoading = false;
		}
	}

	async updateEmail(newEmail: string): Promise<{ error: Error | null; message?: string }> {
		this.isLoading = true;
		try {
			const { error } = await supabase.auth.updateUser({ email: newEmail });
			if (error) throw error;
			return {
				error: null,
				message: `Confirmation email sent to ${newEmail}. Please click the link in your inbox to confirm the change.`,
			};
		} catch (err) {
			return { error: err as Error };
		} finally {
			this.isLoading = false;
		}
	}

	async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
		this.isLoading = true;
		try {
			const { error } = await supabase.auth.updateUser({ password: newPassword });
			if (error) throw error;
			return { error: null };
		} catch (err) {
			return { error: err as Error };
		} finally {
			this.isLoading = false;
		}
	}

	async getCloudTelemetry(): Promise<{ testCount: number; attemptCount: number }> {
		if (!this.user) return { testCount: 0, attemptCount: 0 };
		try {
			const [testsRes, attemptsRes] = await Promise.all([
				supabase.from('tests').select('id', { count: 'exact', head: true }),
				supabase.from('attempts').select('id', { count: 'exact', head: true }),
			]);
			return {
				testCount: testsRes.count || 0,
				attemptCount: attemptsRes.count || 0,
			};
		} catch (err) {
			console.error('[AuthStore] Failed fetching cloud telemetry:', err);
			return { testCount: 0, attemptCount: 0 };
		}
	}

	async deleteAccount(mode: 'cloud_only' | 'everything'): Promise<{ error: Error | null }> {
		this.isLoading = true;
		try {
			const userId = this.user?.id;
			if (userId) {
				// 1. Invoke atomic delete_user_account RPC (SECURITY DEFINER in PostgreSQL)
				const { error: rpcError } = await supabase.rpc('delete_user_account');

				if (rpcError) {
					console.warn(
						'[AuthStore] RPC delete_user_account failed, attempting client fallback:',
						rpcError
					);
					// Fallback to table-by-table delete if RPC is not yet deployed on server
					await Promise.allSettled([
						supabase.from('tests').delete().eq('user_id', userId),
						supabase.from('folders').delete().eq('user_id', userId),
						supabase.from('subjects').delete().eq('user_id', userId),
						supabase.from('attempts').delete().eq('user_id', userId),
						supabase.from('settings').delete().eq('user_id', userId),
						supabase.from('synced_api_keys').delete().eq('user_id', userId),
					]);
				}

				// 2. Sign out of Supabase session
				await supabase.auth.signOut();
			}

			// 3. Handle local state according to chosen mode
			if (mode === 'everything') {
				if (this.app) {
					this.app.tests.clearAll();
					this.app.folders.folders = [];
					this.app.folders.rebuildIndices([]);
					this.app.attempts.clearAll();
					await db.clearAllFolders();
					await db.offlineOps.clear();
					await db.testDocAssets.clear();
					await db.subjects.clear();
					this.app.subjects.subjects = [];
					await this.app.apiKeys.clearAllKeys();
				}
				this.handleUserLoggedOut();
				if (this.app) {
					this.app.toast.show('Account and all assessment data permanently erased.', 'warning');
				}
			} else {
				// 'cloud_only': Local tests, folders, attempts, and assets are fully preserved
				this.handleUserLoggedOut();
				if (this.app) {
					this.app.toast.show(
						'Cloud data deleted. Local papers preserved on this device.',
						'success'
					);
				}
			}

			return { error: null };
		} catch (err) {
			console.error('[AuthStore] Error deleting account:', err);
			return { error: err as Error };
		} finally {
			this.isLoading = false;
		}
	}
}
