export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
	message: string;
	type: ToastType;
}

export class ToastStore {
	current = $state<ToastMessage | null>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;

	show(message: string, type: ToastType = 'success', durationMs = 3500) {
		if (this.timer) clearTimeout(this.timer);
		this.current = { message, type };
		this.timer = setTimeout(() => {
			this.current = null;
		}, durationMs);
	}

	dismiss() {
		if (this.timer) clearTimeout(this.timer);
		this.current = null;
	}
}
