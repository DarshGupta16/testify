import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import type { SecurityMode } from '$lib/types/apiKeys';

const SETTING_KEY_SECURITY_MODE = 'testify_security_mode';
const SETTING_KEY_HAS_MASTER_PWD = 'testify_has_master_password';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours (120 minutes)

export class SecurityStore {
	private database: TestifyDatabase;

	// Reactive State
	securityMode = $state<SecurityMode>('lax');
	hasMasterPassword = $state<boolean>(false);
	isUnlocked = $state<boolean>(true);
	activeMasterPassword = $state<string>(''); // Ephemeral in-memory session cache

	decryptedAt = $state<number | null>(null);
	expiresAt = $state<number | null>(null);
	currentTime = $state<number>(Date.now());
	isBusy = $state<boolean>(false);
	busyMessage = $state<string>('');

	// Timers
	private wipeTimer: ReturnType<typeof setTimeout> | null = null;
	private intervalTicker: ReturnType<typeof setInterval> | null = null;

	// Callback hook when session expires
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

	setOnSessionExpire(hook: () => void) {
		this.onSessionExpireHook = hook;
	}

	async init() {
		// 1. Load saved security mode (default: lax)
		const savedMode = await this.database.getSetting<SecurityMode>(
			SETTING_KEY_SECURITY_MODE,
			'lax'
		);
		this.securityMode = savedMode === 'strict' ? 'strict' : 'lax';

		// 2. Load master password configuration flag
		const hasPwdSetting = await this.database.getSetting<boolean>(
			SETTING_KEY_HAS_MASTER_PWD,
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
	 * Sets or changes the master password and enables Strict mode.
	 */
	async setMasterPassword(
		password: string,
		onEncryptCallback?: (pwd: string) => Promise<void>
	): Promise<void> {
		this.isBusy = true;
		this.busyMessage = 'Encrypting credentials with master password...';

		try {
			this.hasMasterPassword = true;
			this.activeMasterPassword = password;
			this.securityMode = 'strict';
			this.isUnlocked = true;
			this.scheduleMemoryWipe();

			if (onEncryptCallback) {
				await onEncryptCallback(password);
			}

			fireAndForget(
				(async () => {
					await this.database.setSetting(SETTING_KEY_SECURITY_MODE, 'strict');
					await this.database.setSetting(SETTING_KEY_HAS_MASTER_PWD, true);
				})(),
				'Saving master password settings'
			);
		} finally {
			this.isBusy = false;
			this.busyMessage = '';
		}
	}

	/**
	 * Unlocks session with master password.
	 */
	async unlock(
		password: string,
		onDecryptCallback: (pwd: string) => Promise<void>
	): Promise<boolean> {
		this.isBusy = true;
		this.busyMessage = 'Deriving Argon2 key & decrypting credentials...';

		try {
			await onDecryptCallback(password);

			this.activeMasterPassword = password;
			this.hasMasterPassword = true;
			this.isUnlocked = true;
			this.scheduleMemoryWipe();
			return true;
		} finally {
			this.isBusy = false;
			this.busyMessage = '';
		}
	}

	/**
	 * Locks session and purges decrypted credentials from memory.
	 */
	lock(reason?: string, onLockCallback?: () => void): void {
		if (this.securityMode === 'lax') return;

		this.isUnlocked = false;
		this.activeMasterPassword = '';
		this.decryptedAt = null;
		this.expiresAt = null;

		if (this.wipeTimer) {
			clearTimeout(this.wipeTimer);
			this.wipeTimer = null;
		}

		if (onLockCallback) {
			onLockCallback();
		}
		if (this.onSessionExpireHook) {
			this.onSessionExpireHook();
		}

		if (reason) {
			console.info(`[SecurityStore] ${reason}`);
		}
	}

	/**
	 * Resets master password and purges all credentials.
	 */
	async resetMasterPassword(onResetCallback?: () => Promise<void>): Promise<void> {
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

		if (onResetCallback) {
			await onResetCallback();
		}

		fireAndForget(
			(async () => {
				await this.database.setSetting(SETTING_KEY_HAS_MASTER_PWD, false);
				await this.database.setSetting(SETTING_KEY_SECURITY_MODE, 'lax');
			})(),
			'Resetting master password setting'
		);
	}

	/**
	 * Switches security mode between Lax and Strict.
	 */
	async switchSecurityMode(
		targetMode: SecurityMode,
		hasKeys: boolean,
		password?: string,
		onMigrate?: (mode: SecurityMode, pwd?: string) => Promise<void>
	): Promise<void> {
		if (this.securityMode === targetMode) return;

		// If no keys exist, switch mode instantly
		if (!hasKeys) {
			this.securityMode = targetMode;
			this.isUnlocked = targetMode === 'lax';
			if (targetMode === 'strict' && password) {
				this.hasMasterPassword = true;
				this.activeMasterPassword = password;
			}
			if (this.wipeTimer) clearTimeout(this.wipeTimer);
			this.decryptedAt = null;
			this.expiresAt = null;

			fireAndForget(
				(async () => {
					await this.database.setSetting(SETTING_KEY_SECURITY_MODE, targetMode);
					if (targetMode === 'strict' && password) {
						await this.database.setSetting(SETTING_KEY_HAS_MASTER_PWD, true);
					}
				})(),
				`Updating security mode to ${targetMode}`
			);
			return;
		}

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

				if (onMigrate) {
					await onMigrate('strict', password);
				}

				fireAndForget(
					(async () => {
						await this.database.setSetting(SETTING_KEY_SECURITY_MODE, 'strict');
						await this.database.setSetting(SETTING_KEY_HAS_MASTER_PWD, true);
					})(),
					'Migrating settings to Strict Mode'
				);
			} else {
				this.securityMode = 'lax';
				this.isUnlocked = true;
				if (this.wipeTimer) clearTimeout(this.wipeTimer);
				this.decryptedAt = null;
				this.expiresAt = null;

				if (onMigrate) {
					await onMigrate('lax', password);
				}

				fireAndForget(
					this.database.setSetting(SETTING_KEY_SECURITY_MODE, 'lax'),
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
