import type { Session, User } from '@supabase/supabase-js';
import { db, deleteUserDatabase, getDatabaseForUser, switchActiveDatabase } from '$lib/services/db';
import {
	getAccountSessionTokens,
	getSavedAccounts,
	isSupabaseConfigured,
	localToSupabaseSync,
	removeAccountSession,
	type SavedAccountSummary,
	saveAccountSession,
	setupRealtimeSubscriptions,
	supabase,
	supabaseDeltaSync,
	supabaseToLocalSync,
	updateAccountLastActive,
	updateAccountTokens,
} from '$lib/services/supabase';
import type { AppStore } from '$lib/stores/appContext.svelte';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export class AuthStore {
	private app?: AppStore;
	private unsubscribeRealtime: (() => void) | null = null;

	// Reactive Auth & Sync State
	user = $state<User | null>(null);
	session = $state<Session | null>(null);
	savedAccounts = $state<SavedAccountSummary[]>([]);
	isInitialized = $state<boolean>(false);
	isLoading = $state<boolean>(false);
	syncStatus = $state<SyncState>('idle');
	syncError = $state<string | null>(null);
	showDeviceSyncPrompt = $state<boolean>(false);
	pendingLocalTestsCount = $state<number>(0);

	// Derived Auth State
	get isAuthenticated(): boolean {
		return Boolean(this.user);
	}
	get userEmail(): string {
		return this.user?.email || '';
	}

	/**
	 * Initialize authentication session and register auth state listener
	 */
	async init(app: AppStore): Promise<void> {
		this.app = app;

		// 1. Load saved accounts from origin-private encrypted session vault
		try {
			this.savedAccounts = await getSavedAccounts();
		} catch (err) {
			console.warn('[AuthStore] Error loading saved accounts:', err);
		}

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

				if (data.session?.user) {
					// Activate physical database partition for this user
					switchActiveDatabase(data.session.user.id);

					// Persist/refresh session in vault
					await saveAccountSession(
						{
							userId: data.session.user.id,
							email: data.session.user.email || '',
							displayName:
								data.session.user.user_metadata?.full_name ||
								data.session.user.user_metadata?.name ||
								null,
							avatarUrl: data.session.user.user_metadata?.avatar_url || null,
						},
						{
							accessToken: data.session.access_token,
							refreshToken: data.session.refresh_token,
							expiresAt: data.session.expires_at,
						}
					);
					this.savedAccounts = await getSavedAccounts();
				}
			}

			// Listen for auth state transitions (Sign In, Sign Out, Token Refresh)
			supabase.auth.onAuthStateChange(async (event, newSession) => {
				const previousUser = this.user;

				if (newSession?.user) {
					this.session = newSession;
					this.user = newSession.user;

					if (event === 'TOKEN_REFRESHED') {
						// Update rotated token in encrypted vault
						await updateAccountTokens(newSession.user.id, {
							accessToken: newSession.access_token,
							refreshToken: newSession.refresh_token,
							expiresAt: newSession.expires_at,
						});
						this.savedAccounts = await getSavedAccounts();
					} else {
						// Register or update active session
						await saveAccountSession(
							{
								userId: newSession.user.id,
								email: newSession.user.email || '',
								displayName:
									newSession.user.user_metadata?.full_name ||
									newSession.user.user_metadata?.name ||
									null,
								avatarUrl: newSession.user.user_metadata?.avatar_url || null,
							},
							{
								accessToken: newSession.access_token,
								refreshToken: newSession.refresh_token,
								expiresAt: newSession.expires_at,
							}
						);
						this.savedAccounts = await getSavedAccounts();
					}

					if (!previousUser || previousUser.id !== newSession.user.id) {
						// User logged in or switched account: switch active Dexie partition
						switchActiveDatabase(newSession.user.id);
						await this.handleUserAuthenticated(event);
					}
				} else if (event === 'SIGNED_OUT') {
					// Explicit cloud sign out
					this.session = null;
					this.user = null;
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
	 * Handles newly authenticated user, checking whether guest data migration is needed.
	 */
	private async handleUserAuthenticated(event: string): Promise<void> {
		if (!this.app) return;

		// 1. Rehydrate stores so the UI immediately reflects the newly active user database
		await this.app.rehydrateUserStores();

		// 2. Check if the guest partition has any assessments that need migration decision
		const guestDb = getDatabaseForUser(null);
		const guestTests = await guestDb.getAllTests();
		if (guestTests.length > 0) {
			this.pendingLocalTestsCount = guestTests.length;
			this.showDeviceSyncPrompt = true;
		} else {
			// No guest papers to migrate, proceed with normal cloud sync
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
	 * Moves all local assessments, folders, and attempts from guest profile to the authenticated user's account,
	 * clears the guest partition, rehydrates UI, and uploads data to Supabase cloud.
	 */
	async mergeAndUploadLocalData(): Promise<void> {
		if (!this.user || !this.app) return;
		this.syncStatus = 'syncing';

		try {
			const guestDb = getDatabaseForUser(null);
			const userDb = getDatabaseForUser(this.user.id);

			const [tests, folders, subjects, attempts, docAssets] = await Promise.all([
				guestDb.tests.toArray().catch(() => []),
				guestDb.folders.toArray().catch(() => []),
				guestDb.subjects.toArray().catch(() => []),
				guestDb.attempts.toArray().catch(() => []),
				guestDb.testDocAssets.toArray().catch(() => []),
			]);

			// 1. Copy data from guest database into user database partition
			if (subjects.length > 0) await userDb.subjects.bulkPut(subjects);
			if (folders.length > 0) await userDb.folders.bulkPut(folders);
			if (tests.length > 0) await userDb.tests.bulkPut(tests);
			if (attempts.length > 0) await userDb.attempts.bulkPut(attempts);
			if (docAssets.length > 0) await userDb.testDocAssets.bulkPut(docAssets);

			// 2. Clear all data from guest database so guest profile is reset
			await Promise.all([
				guestDb.tests.clear().catch(() => {}),
				guestDb.folders.clear().catch(() => {}),
				guestDb.subjects.clear().catch(() => {}),
				guestDb.attempts.clear().catch(() => {}),
				guestDb.testDocAssets.clear().catch(() => {}),
				guestDb.generationJobs.clear().catch(() => {}),
				guestDb.offlineOps.clear().catch(() => {}),
			]);

			// 3. Upsert subjects to Supabase cloud
			for (const s of subjects) {
				await supabase.from('subjects').upsert({
					id: s.id,
					name: s.name,
					created_at: s.createdAt,
					updated_at: s.updatedAt || new Date().toISOString(),
				});
			}

			// 4. Upsert folders to Supabase cloud
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

			// 5. Upsert tests to Supabase cloud
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

			// 6. Upsert attempts to Supabase cloud
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

			// 7. Rehydrate in-memory stores so UI immediately displays newly moved papers
			await this.app.rehydrateUserStores();
			this.showDeviceSyncPrompt = false;

			await this.startSyncCycle();
			this.app.toast.show('Guest papers moved to your account and synced to cloud.', 'success');
		} catch (err) {
			console.error('[AuthStore] Failed merging local data:', err);
			this.syncStatus = 'error';
			this.syncError = (err as Error).message || 'Failed to merge local assessments';
		} finally {
			if (this.app) {
				await this.app.rehydrateUserStores();
			}
			this.showDeviceSyncPrompt = false;
		}
	}

	/**
	 * Preserves Guest profile as separate and hydrates user stores from cloud account.
	 */
	async keepCloudOnly(): Promise<void> {
		if (!this.user || !this.app) return;
		this.syncStatus = 'syncing';

		try {
			await supabaseToLocalSync(this.app);
			this.syncStatus = 'synced';
			this.app.toast.show('Guest profile kept separate. Synchronized from cloud.', 'info');
		} catch (err) {
			console.error('[AuthStore] Failed keeping cloud only:', err);
			this.syncStatus = 'error';
			this.syncError = (err as Error).message || 'Failed pulling cloud assessments';
		} finally {
			await this.app.rehydrateUserStores();
			this.showDeviceSyncPrompt = false;
		}
	}

	/**
	 * Manual user-triggered sync action from the top navigation bar.
	 */
	async syncNow(): Promise<void> {
		if (!this.user) return;

		// Check if there are guest papers on this machine that should be moved to this account
		const guestDb = getDatabaseForUser(null);
		const guestTests = await guestDb.getAllTests();
		if (guestTests.length > 0) {
			this.pendingLocalTestsCount = guestTests.length;
			this.showDeviceSyncPrompt = true;
			return;
		}

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

	/**
	 * Switches active profile to a saved user account.
	 * Swaps local database partition and rehydrates UI stores immediately (0ms latency, works completely offline).
	 * Clears local client JWT credentials before switching so no cross-tenant spillover occurs,
	 * then asynchronously restores cloud session in the background without blocking.
	 */
	async switchAccount(userId: string): Promise<void> {
		if (!userId) return;
		const account = this.savedAccounts.find((a) => a.userId === userId);
		if (!account) return;

		// 0. Disconnect previous realtime subscription
		if (this.unsubscribeRealtime) {
			this.unsubscribeRealtime();
			this.unsubscribeRealtime = null;
		}

		// 1. Immediately switch physical Dexie partition to this user
		switchActiveDatabase(userId);
		await updateAccountLastActive(userId);
		this.savedAccounts = await getSavedAccounts();

		// 2. Set optimistic user state for instant UI responsiveness
		this.user = {
			id: account.userId,
			email: account.email,
			user_metadata: {
				full_name: account.displayName,
				avatar_url: account.avatarUrl,
			},
			app_metadata: {},
			aud: 'authenticated',
			created_at: account.lastActiveAt,
		} as unknown as User;
		this.session = null;
		this.syncStatus = 'idle';

		// 3. Rehydrate all domain stores from local database partition
		if (this.app) {
			await this.app.rehydrateUserStores();
			this.app.toast.show(`Switched to ${account.email}`, 'success');
		}

		// 4. Asynchronously restore Supabase cloud session in the background
		if (typeof window !== 'undefined' && navigator.onLine && isSupabaseConfigured) {
			(async () => {
				try {
					const tokens = await getAccountSessionTokens(userId);
					if (tokens) {
						const { data, error } = await supabase.auth.setSession({
							access_token: tokens.accessToken,
							refresh_token: tokens.refreshToken,
						});
						if (error) {
							console.warn('[AuthStore] Background session restoration warning:', error);
						} else if (data.session) {
							this.session = data.session;
							this.user = data.session.user;
							await this.startSyncCycle();
						}
					}
				} catch (err) {
					console.warn('[AuthStore] Background cloud session restoration error:', err);
				}
			})();
		}
	}

	/**
	 * Switches active profile to the local Guest partition (testify_guest).
	 * Disconnects cloud sync listeners, clears local Supabase session, and rehydrates stores immediately.
	 */
	async switchToGuest(): Promise<void> {
		if (this.unsubscribeRealtime) {
			this.unsubscribeRealtime();
			this.unsubscribeRealtime = null;
		}

		// Clear active client session locally without revoking remote tokens on server
		if (isSupabaseConfigured) {
			try {
				if (typeof (supabase.auth as any)._removeSession === 'function') {
					await (supabase.auth as any)._removeSession();
				}
			} catch (err) {
				console.warn('[AuthStore] Supabase _removeSession warning during switchToGuest:', err);
			}
		}

		// Switch Dexie database to testify_guest
		switchActiveDatabase(null);

		this.user = null;
		this.session = null;
		this.syncStatus = 'idle';
		this.syncError = null;
		this.showDeviceSyncPrompt = false;

		if (this.app) {
			await this.app.rehydrateUserStores();
			this.app.toast.show('Switched to Guest profile.', 'info');
		}
	}

	/**
	 * Signs out of the current account.
	 * - If wipeLocalData is true (public computers): revokes session on server, wipes testify_${userId} partition and vault session.
	 * - If wipeLocalData is false (family computers): performs local sign-out, preserves partition and switches to guest.
	 */
	async signOut(options: { wipeLocalData?: boolean } = {}): Promise<void> {
		this.isLoading = true;
		const currentUserId = this.user?.id;
		const shouldWipe = Boolean(options.wipeLocalData);

		try {
			if (isSupabaseConfigured) {
				try {
					if (shouldWipe) {
						// Global scope explicitly revokes server session
						await supabase.auth.signOut({ scope: 'global' });
					} else {
						// Preserve saved tokens in session registry; clear local client session only
						if (typeof (supabase.auth as any)._removeSession === 'function') {
							await (supabase.auth as any)._removeSession();
						}
					}
				} catch (err) {
					console.warn('[AuthStore] Supabase signOut error:', err);
				}
			}

			if (currentUserId) {
				if (shouldWipe) {
					await removeAccountSession(currentUserId);
					await deleteUserDatabase(currentUserId);
				} else {
					await updateAccountLastActive(currentUserId);
				}
			}

			this.savedAccounts = await getSavedAccounts();
			await this.switchToGuest();

			if (this.app) {
				if (shouldWipe) {
					this.app.toast.show('Signed out and erased local partition.', 'warning');
				} else {
					this.app.toast.show('Signed out. Local papers preserved on this device.', 'info');
				}
			}
		} catch (err) {
			console.error('[AuthStore] Error during signOut:', err);
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
				if (userId) {
					await removeAccountSession(userId);
					await deleteUserDatabase(userId);
				}
				this.savedAccounts = await getSavedAccounts();
				await this.switchToGuest();
				if (this.app) {
					this.app.toast.show('Account and all assessment data permanently erased.', 'warning');
				}
			} else {
				// 'cloud_only': Copy local assessments from user partition to guest partition so they are preserved
				if (userId) {
					try {
						const userDb = getDatabaseForUser(userId);
						const guestDb = getDatabaseForUser(null);
						await userDb.open();
						await guestDb.open();

						const [tests, folders, subjects, attempts, docAssets] = await Promise.all([
							userDb.tests.toArray().catch(() => []),
							userDb.folders.toArray().catch(() => []),
							userDb.subjects.toArray().catch(() => []),
							userDb.attempts.toArray().catch(() => []),
							userDb.testDocAssets.toArray().catch(() => []),
						]);

						if (tests.length > 0) await guestDb.tests.bulkPut(tests);
						if (folders.length > 0) await guestDb.folders.bulkPut(folders);
						if (subjects.length > 0) await guestDb.subjects.bulkPut(subjects);
						if (attempts.length > 0) await guestDb.attempts.bulkPut(attempts);
						if (docAssets.length > 0) await guestDb.testDocAssets.bulkPut(docAssets);
					} catch (migErr) {
						console.warn('[AuthStore] Failed transferring records to guest partition:', migErr);
					}

					await removeAccountSession(userId);
					await deleteUserDatabase(userId);
				}

				this.savedAccounts = await getSavedAccounts();
				await this.switchToGuest();
				if (this.app) {
					this.app.toast.show(
						'Cloud data deleted. Local papers preserved in Guest profile.',
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
