import type * as mupdf from 'mupdf';
import { createPngUrls } from '$lib/utils/bytes';
import type { ExtractedEmbeddedImage } from './types';

export interface RasterExtractContext {
	pageNumber: number;
	embeddedImages: ExtractedEmbeddedImage[];
	seenImageHashes: Set<string>;
	rasterImageBoxes: Array<{ x: number; y: number; w: number; h: number }>;
}

/**
 * Minimum pixel and display point dimensions to distinguish real figures
 * from microscopic halftone dither tiles, stipple masks, and background bullets.
 */
const MIN_RASTER_PIXEL_DIM = 32;
const MIN_RASTER_DISPLAY_DIM = 20;

/**
 * Extracts and decodes a discrete raster image object from a MuPDF device callback.
 */
export function processRasterImage(
	image: mupdf.Image,
	ctm: number[] | null | undefined,
	ctx: RasterExtractContext,
	isMask = false
): void {
	try {
		const imgW = image.getWidth();
		const imgH = image.getHeight();
		if (imgW <= 0 || imgH <= 0) return;

		const dispW = ctm ? Math.round(Math.abs(ctm[0])) : imgW;
		const dispH = ctm ? Math.round(Math.abs(ctm[3])) : imgH;

		// Filter out microscopic halftone dither tiles / stipple patterns
		if (
			imgW < MIN_RASTER_PIXEL_DIM ||
			imgH < MIN_RASTER_PIXEL_DIM ||
			dispW < MIN_RASTER_DISPLAY_DIM ||
			dispH < MIN_RASTER_DISPLAY_DIM
		) {
			return;
		}

		let px: mupdf.Pixmap | null = null;
		try {
			px = image.toPixmap();
			const png = px.asPNG();
			const hash = `${isMask ? 'mask_' : ''}${imgW}x${imgH}_${png.byteLength}_${png.subarray(0, 16).join('-')}`;

			if (!ctx.seenImageHashes.has(hash)) {
				ctx.seenImageHashes.add(hash);
				const { dataUrl, blobUrl } = createPngUrls(png);

				const posX = ctm ? Math.round(ctm[4]) : 0;
				const posY = ctm ? Math.round(ctm[5]) : 0;
				const posBox = { x: posX, y: posY, width: dispW, height: dispH };
				ctx.rasterImageBoxes.push({ x: posX, y: posY, w: dispW, h: dispH });

				const nextIndex = ctx.embeddedImages.length + 1;
				ctx.embeddedImages.push({
					id: `p${ctx.pageNumber}_img_${nextIndex}`,
					pageNumber: ctx.pageNumber,
					imageIndex: nextIndex,
					type: 'raster_image',
					width: imgW,
					height: imgH,
					sizeBytes: png.byteLength,
					mimeType: 'image/png',
					dataUrl,
					blobUrl,
					position: posBox,
				});
			}
		} finally {
			px?.destroy();
		}
	} catch (err) {
		console.warn(`Error extracting raster image on page ${ctx.pageNumber}:`, err);
	}
}
