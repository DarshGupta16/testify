/**
 * Network & PWA Installation State Store
 *
 * Provides reactive online/offline connectivity tracking with proactive network probing
 * using external zero-cost public endpoints (Google / Cloudflare), bypassing Vercel traffic.
 */

export interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: 'accepted' | 'dismissed';
		platform: string;
	}>;
	prompt(): Promise<void>;
}

export class NetworkStore {
	// Reactive Connectivity State
	isOnline = $state<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
	wasOffline = $state<boolean>(false);

	// Reactive PWA Installability State
	isInstallable = $state<boolean>(false);
	private deferredPrompt: BeforeInstallPromptEvent | null = null;

	// Callbacks
	private onReconnectCallback?: () => void;
	private onDisconnectCallback?: () => void;

	// Event listener references for cleanup
	private handleOnlineBound?: () => void;
	private handleOfflineBound?: () => void;
	private handleFocusBound?: () => void;
	private handleVisibilityBound?: () => void;
	private handleBeforeInstallPromptBound?: (e: Event) => void;
	private handleAppInstalledBound?: () => void;
	private pollIntervalId?: ReturnType<typeof setInterval>;
	private isChecking = false;

	init(onReconnect?: () => void, onDisconnect?: () => void) {
		if (typeof window === 'undefined') return;

		this.onReconnectCallback = onReconnect;
		this.onDisconnectCallback = onDisconnect;
		this.isOnline = navigator.onLine;

		this.handleOnlineBound = () => {
			this.checkConnectivity();
		};

		this.handleOfflineBound = () => {
			this.setOnlineState(false);
		};

		this.handleFocusBound = () => {
			this.checkConnectivity();
		};

		this.handleVisibilityBound = () => {
			if (document.visibilityState === 'visible') {
				this.checkConnectivity();
			}
		};

		this.handleBeforeInstallPromptBound = (e: Event) => {
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			this.deferredPrompt = e as BeforeInstallPromptEvent;
			this.isInstallable = true;
		};

		this.handleAppInstalledBound = () => {
			this.isInstallable = false;
			this.deferredPrompt = null;
			console.info('[PWA] Application installed successfully.');
		};

		window.addEventListener('online', this.handleOnlineBound);
		window.addEventListener('offline', this.handleOfflineBound);
		window.addEventListener('focus', this.handleFocusBound);
		document.addEventListener('visibilitychange', this.handleVisibilityBound);
		window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPromptBound);
		window.addEventListener('appinstalled', this.handleAppInstalledBound);

		// Proactive background connectivity verification poll every 6 seconds
		this.pollIntervalId = setInterval(() => {
			this.checkConnectivity();
		}, 6000);

		// Initial proactive verification
		this.checkConnectivity();
	}

	/**
	 * Active network probe using external public endpoints (Google / Cloudflare) with no-cors mode.
	 * Bypasses Vercel completely (zero bandwidth / function invocations).
	 */
	async checkConnectivity(): Promise<boolean> {
		if (typeof window === 'undefined' || this.isChecking) {
			return this.isOnline;
		}

		this.isChecking = true;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		try {
			// 1. Probe Google's public favicon with no-cors (zero Vercel traffic)
			await fetch(`https://www.google.com/favicon.ico?_ping=${Date.now()}`, {
				mode: 'no-cors',
				cache: 'no-store',
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			this.setOnlineState(true);
			return true;
		} catch {
			clearTimeout(timeoutId);

			// 2. Fallback to Cloudflare 1.1.1.1 if Google was unreachable
			try {
				const fallbackController = new AbortController();
				const fallbackTimeout = setTimeout(() => fallbackController.abort(), 1500);
				await fetch(`https://1.1.1.1/favicon.ico?_ping=${Date.now()}`, {
					mode: 'no-cors',
					cache: 'no-store',
					signal: fallbackController.signal,
				});
				clearTimeout(fallbackTimeout);
				this.setOnlineState(true);
				return true;
			} catch {
				this.setOnlineState(false);
				return false;
			}
		} finally {
			this.isChecking = false;
		}
	}

	private setOnlineState(online: boolean) {
		if (this.isOnline === online) return;

		if (online) {
			this.isOnline = true;
			if (this.wasOffline) {
				this.onReconnectCallback?.();
			}
		} else {
			this.isOnline = false;
			this.wasOffline = true;
			this.onDisconnectCallback?.();
		}
	}

	/**
	 * Triggers the browser's native PWA installation dialog
	 */
	async promptInstall(): Promise<boolean> {
		if (!this.deferredPrompt) {
			return false;
		}

		try {
			await this.deferredPrompt.prompt();
			const choice = await this.deferredPrompt.userChoice;
			this.deferredPrompt = null;
			this.isInstallable = false;
			return choice.outcome === 'accepted';
		} catch (err) {
			console.error('[PWA] Install prompt failed:', err);
			return false;
		}
	}

	destroy() {
		if (typeof window === 'undefined') return;
		if (this.pollIntervalId) clearInterval(this.pollIntervalId);
		if (this.handleOnlineBound) window.removeEventListener('online', this.handleOnlineBound);
		if (this.handleOfflineBound) window.removeEventListener('offline', this.handleOfflineBound);
		if (this.handleFocusBound) window.removeEventListener('focus', this.handleFocusBound);
		if (this.handleVisibilityBound) {
			document.removeEventListener('visibilitychange', this.handleVisibilityBound);
		}
		if (this.handleBeforeInstallPromptBound) {
			window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPromptBound);
		}
		if (this.handleAppInstalledBound) {
			window.removeEventListener('appinstalled', this.handleAppInstalledBound);
		}
	}
}
