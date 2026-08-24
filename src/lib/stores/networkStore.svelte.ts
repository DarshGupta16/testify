/**
 * Network & PWA Installation State Store
 *
 * Provides reactive online/offline connectivity tracking and PWA installation prompt handling.
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

	// Event listener references for cleanup
	private handleOnlineBound?: () => void;
	private handleOfflineBound?: () => void;
	private handleBeforeInstallPromptBound?: (e: Event) => void;
	private handleAppInstalledBound?: () => void;

	init(onReconnect?: () => void, onDisconnect?: () => void) {
		if (typeof window === 'undefined') return;

		this.isOnline = navigator.onLine;

		this.handleOnlineBound = () => {
			this.isOnline = true;
			if (this.wasOffline) {
				onReconnect?.();
			}
		};

		this.handleOfflineBound = () => {
			this.isOnline = false;
			this.wasOffline = true;
			onDisconnect?.();
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
		window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPromptBound);
		window.addEventListener('appinstalled', this.handleAppInstalledBound);
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
		if (this.handleOnlineBound) window.removeEventListener('online', this.handleOnlineBound);
		if (this.handleOfflineBound) window.removeEventListener('offline', this.handleOfflineBound);
		if (this.handleBeforeInstallPromptBound) {
			window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPromptBound);
		}
		if (this.handleAppInstalledBound) {
			window.removeEventListener('appinstalled', this.handleAppInstalledBound);
		}
	}
}
