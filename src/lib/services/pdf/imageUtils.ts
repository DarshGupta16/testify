/**
 * Image and Buffer Transformation Utilities
 */

/**
 * Converts a Uint8Array buffer into a standard Base64 string in chunks
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
 * Converts a raw PNG byte buffer into both a Base64 data URL (for persistent serialization/API)
 * and an ephemeral Object URL (for high-performance browser DOM rendering).
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
