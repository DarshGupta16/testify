/**
 * Byte, Buffer, and Base64 Conversion Utilities
 */

/**
 * Converts a Uint8Array buffer into a standard Base64 string in 32KB chunks
 * to prevent call-stack overflow on large high-resolution page renders.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	const len = bytes.byteLength;
	const chunkSize = 0x8000; // 32KB chunks

	for (let i = 0; i < len; i += chunkSize) {
		const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
		binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
	}

	return btoa(binary);
}

/**
 * Converts a Base64 string into a Uint8Array byte buffer.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

/**
 * Converts raw PNG bytes into both a persistent Base64 Data URL
 * and an ephemeral Object URL for fast DOM rendering.
 */
export function createPngUrls(pngBytes: Uint8Array): {
	dataUrl: string;
	blobUrl: string;
} {
	const base64 = uint8ArrayToBase64(pngBytes);
	const dataUrl = `data:image/png;base64,${base64}`;

	const blob = new Blob([pngBytes as BlobPart], { type: 'image/png' });
	const blobUrl = URL.createObjectURL(blob);

	return { dataUrl, blobUrl };
}

/**
 * Formats raw byte counts into human-readable strings (e.g. 2.4 MB).
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
