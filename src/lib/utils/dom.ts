/**
 * Browser DOM & UI Interaction Utilities
 */

/**
 * Copies a string to user's system clipboard with robust fallback for non-secure contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fallback to legacy execCommand
		}
	}

	if (typeof document !== 'undefined') {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			const successful = document.execCommand('copy');
			document.body.removeChild(textarea);
			return successful;
		} catch {
			return false;
		}
	}

	return false;
}

/**
 * Triggers a native browser file download for a given Blob URL or Data URL.
 */
export function downloadImage(url: string, filename: string): void {
	if (typeof document === 'undefined') return;

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}
