import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { SETTINGS_KEYS } from '$lib/services/settings';
import type { SecurityMode } from '$lib/types/apiKeys';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours (120 minutes)

export class SecurityStore {
	private database: TestifyDatabase;

	// Reactive Public State
	securityMode = $state<SecurityMode>('lax');
	hasMasterPassword = $state<boolean>(false);
	isUnlocked = $state<boolean>(true);

	decryptedAt = $state<number | null>(null);
	expiresAt = $state<number | null>(null);
	currentTime = $state<number>(Date.now());
	isBusy = $state<boolean>(false);
	busyMessage = $state<string>('');

	// Private Ephemeral Credential Holder (Non-reactive to minimize UI leak surface)
	private activeMasterPassword = '';

	// Timers
	private wipeTimer: ReturnType<typeof setTimeout> | null = null;
	private intervalTicker: ReturnType<typeof setInterval> | null = null;

	// Callback hook when session expires naturally
	private onSessionExpireHook: (() => void) | null = null;

	// Derived Properties
	timeRemainingMs = $derived.by(() => {
		if (this.securityMode === 'lax') return Number.POSITIVE_INFINITY;
		if (!this.isUnlocked || !this.expiresAt) return 0;
		const remaining = this.expiresAt - this.currentTime;
		return remaining > 0 ? remaining : 0;
	});

	timeRemainingFormatted = $derived.by(() => {
		if (this.securityMode === 'lax') return 'Always Unlocked (Lax)';
		if (!this.isUnlocked || this.timeRemainingMs <= 0) return 'Locked';

		const totalSeconds = Math.floor(this.timeRemainingMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		}
		return `${seconds}s`;
	});

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	/**
	 * Registers an expiry listener (e.g. to purge memory keys in ApiKeyStore).
	 */
	setOnSessionExpire(hook: () => void) {
		this.onSessionExpireHook = hook;
	}

	/**
	 * Safe accessor to retrieve active master password for in-session encryption operations.
	 */
	getActiveMasterPassword(): string {
		return this.activeMasterPassword;
	}

	async init() {
		// 1. Load saved security mode (default: lax)
		const savedMode = await this.database.getSetting<SecurityMode>(
			SETTINGS_KEYS.SECURITY_MODE,
			'lax'
		);
		this.securityMode = savedMode === 'strict' ? 'strict' : 'lax';

		// 2. Load master password configuration flag
		const hasPwdSetting = await this.database.getSetting<boolean>(
			SETTINGS_KEYS.HAS_MASTER_PASSWORD,
			false
		);
		const records = await this.database.getAllApiKeys();
		const hasAnyEncrypted = records.some((r) => r.isEncrypted);
		this.hasMasterPassword = hasPwdSetting || hasAnyEncrypted;

		// 3. Set unlock state
		if (this.securityMode === 'lax') {
			this.isUnlocked = true;
		} else {
			this.isUnlocked = false;
			this.activeMasterPassword = '';
		}

		this.startTicker();
	}

	private startTicker() {
		if (this.intervalTicker) clearInterval(this.intervalTicker);
		this.intervalTicker = setInterval(() => {
			this.currentTime = Date.now();
			if (
				this.securityMode === 'strict' &&
				this.isUnlocked &&
				this.expiresAt &&
				this.currentTime >= this.expiresAt
			) {
				this.lock('Session expired. Credentials cleared from memory after 2 hours.');
			}
		}, 1000);
	}

	/**
	 * Sets the master password and switches mode to Strict.
	 */
	async setMasterPassword(password: string): Promise<void> {
		this.isBusy = true;
		this.busyMessage = 'Activating master password & Strict mode...';

		try {
			this.hasMasterPassword = true;
			this.activeMasterPassword = password;
			this.securityMode = 'strict';
			this.isUnlocked = true;
			this.scheduleMemoryWipe();

			fireAndForget(
				(async () => {
					await this.database.setSetting(SETTINGS_KEYS.SECURITY_MODE, 'strict');
					await this.database.setSetting(SETTINGS_KEYS.HAS_MASTER_PASSWORD, true);
				})(),
				'Saving master password settings'
			);
		} finally {
			this.isBusy = false;
			this.busyMessage = '';
		}
	}

	/**
	 * Unlocks session with verified master password.
	 */
	unlock(password: string): void {
		this.activeMasterPassword = password;
		this.hasMasterPassword = true;
		this.isUnlocked = true;
		this.scheduleMemoryWipe();
	}

	/**
	 * Locks session and purges active master password from memory.
	 */
	lock(reason?: string): void {
		if (this.securityMode === 'lax') return;

		this.isUnlocked = false;
		this.activeMasterPassword = '';
		this.decryptedAt = null;
		this.expiresAt = null;

		if (this.wipeTimer) {
			clearTimeout(this.wipeTimer);
			this.wipeTimer = null;
		}

		if (this.onSessionExpireHook) {
			this.onSessionExpireHook();
		}

		if (reason) {
			console.info(`[SecurityStore] ${reason}`);
		}
	}

	/**
	 * Resets master password and resets security mode to Lax.
	 */
	async resetMasterPassword(): Promise<void> {
		this.hasMasterPassword = false;
		this.activeMasterPassword = '';
		this.securityMode = 'lax';
		this.isUnlocked = true;
		this.decryptedAt = null;
		this.expiresAt = null;

		if (this.wipeTimer) {
			clearTimeout(this.wipeTimer);
			this.wipeTimer = null;
		}

		fireAndForget(
			(async () => {
				await this.database.setSetting(SETTINGS_KEYS.HAS_MASTER_PASSWORD, false);
				await this.database.setSetting(SETTINGS_KEYS.SECURITY_MODE, 'lax');
			})(),
			'Resetting master password setting'
		);
	}

	/**
	 * Switches security mode between Lax and Strict.
	 */
	async switchSecurityMode(targetMode: SecurityMode, password?: string): Promise<void> {
		if (this.securityMode === targetMode) return;

		this.isBusy = true;
		this.busyMessage = `Converting security mode to ${targetMode.toUpperCase()}...`;

		try {
			if (targetMode === 'strict') {
				if (!password) {
					throw new Error('Master password is required to switch to Strict mode.');
				}
				this.securityMode = 'strict';
				this.hasMasterPassword = true;
				this.activeMasterPassword = password;
				this.isUnlocked = true;
				this.scheduleMemoryWipe();

				fireAndForget(
					(async () => {
						await this.database.setSetting(SETTINGS_KEYS.SECURITY_MODE, 'strict');
						await this.database.setSetting(SETTINGS_KEYS.HAS_MASTER_PASSWORD, true);
					})(),
					'Migrating settings to Strict Mode'
				);
			} else {
				this.securityMode = 'lax';
				this.isUnlocked = true;
				this.activeMasterPassword = '';
				if (this.wipeTimer) clearTimeout(this.wipeTimer);
				this.decryptedAt = null;
				this.expiresAt = null;

				fireAndForget(
					this.database.setSetting(SETTINGS_KEYS.SECURITY_MODE, 'lax'),
					'Migrating settings to Lax Mode'
				);
			}
		} finally {
			this.isBusy = false;
			this.busyMessage = '';
		}
	}

	private scheduleMemoryWipe() {
		const now = Date.now();
		this.decryptedAt = now;
		this.expiresAt = now + TWO_HOURS_MS;

		if (this.wipeTimer) clearTimeout(this.wipeTimer);
		this.wipeTimer = setTimeout(() => {
			this.lock('2-hour session expired. Credentials cleared from memory.');
		}, TWO_HOURS_MS);
	}

	destroy() {
		if (this.wipeTimer) clearTimeout(this.wipeTimer);
		if (this.intervalTicker) clearInterval(this.intervalTicker);
	}
}
