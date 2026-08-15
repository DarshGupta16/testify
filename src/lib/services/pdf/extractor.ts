import * as mupdf from 'mupdf';
import { createPngUrls } from '$lib/utils/bytes';
import { processRasterImage, type RasterExtractContext } from './rasterExtractor';
import type {
	ExtractedEmbeddedImage,
	ExtractedPdfPage,
	PdfExtractionOptions,
	PdfExtractionResult,
	VectorPathRecord,
} from './types';
import {
	classifyDiagramClusters,
	clusterVectorPaths,
	cropVectorDiagrams,
	filterVectorPaths,
} from './vectorClassifier';

/**
 * Normalizes input source into a Uint8Array byte buffer and extracts file metadata.
 */
async function normalizePdfInput(
	input: File | Blob | ArrayBuffer | Uint8Array
): Promise<{ data: Uint8Array; fileName: string; fileSizeBytes: number }> {
	let data: Uint8Array;
	let fileName = 'document.pdf';
	let fileSizeBytes = 0;

	if (input instanceof File) {
		fileName = input.name;
		fileSizeBytes = input.size;
		const buffer = await input.arrayBuffer();
		data = new Uint8Array(buffer);
	} else if (input instanceof Blob) {
		fileSizeBytes = input.size;
		const buffer = await input.arrayBuffer();
		data = new Uint8Array(buffer);
	} else if (input instanceof Uint8Array) {
		data = input;
		fileSizeBytes = input.byteLength;
	} else {
		data = new Uint8Array(input);
		fileSizeBytes = input.byteLength;
	}

	return { data, fileName, fileSizeBytes };
}

/**
 * Extracts raster pages, embedded bitmap images, and vector diagrams from a PDF.
 * Implements strict, defensive WebAssembly resource management (try...finally blocks).
 */
export async function extractPdfPagesAndImages(
	input: File | Blob | ArrayBuffer | Uint8Array,
	options: PdfExtractionOptions = {}
): Promise<PdfExtractionResult> {
	const startTime = performance.now();
	const scale = options.scale ?? 1.25;

	const { data: uint8Data, fileName, fileSizeBytes } = await normalizePdfInput(input);

	let doc: mupdf.Document | null = null;
	const pages: ExtractedPdfPage[] = [];
	let totalEmbeddedImages = 0;

	try {
		doc = mupdf.Document.openDocument(uint8Data, 'application/pdf');
		const totalPages = doc.countPages();

		for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
			const pageNumber = pageIndex + 1;

			options.onProgress?.({
				currentPage: pageNumber,
				totalPages,
				statusText: `Rendering page ${pageNumber} of ${totalPages} & extracting diagrams...`,
			});

			// Yield briefly to ensure browser UI responsiveness during heavy WASM operations
			await new Promise((resolve) => setTimeout(resolve, 0));

			const page = doc.loadPage(pageIndex);
			let pagePixmap: mupdf.Pixmap | null = null;
			let device: mupdf.Device | null = null;

			try {
				const bounds = page.getBounds();
				const origWidth = Math.round(bounds[2] - bounds[0]);
				const origHeight = Math.round(bounds[3] - bounds[1]);

				// 1. Render entire page to high-quality raster PNG
				const scaleMatrix = mupdf.Matrix.scale(scale, scale);
				pagePixmap = page.toPixmap(scaleMatrix, mupdf.ColorSpace.DeviceRGB, false);
				const pagePngBytes = pagePixmap.asPNG();
				const { dataUrl: pageDataUrl, blobUrl: pageBlobUrl } = createPngUrls(pagePngBytes);
				const rasterWidth = pagePixmap.getWidth();
				const rasterHeight = pagePixmap.getHeight();
				const rasterSizeBytes = pagePngBytes.byteLength;

				// 2. Traverse page contents to capture raster images and vector paths
				const embeddedImages: ExtractedEmbeddedImage[] = [];
				const vectorPaths: VectorPathRecord[] = [];

				const rasterCtx: RasterExtractContext = {
					pageNumber,
					embeddedImages,
					seenImageHashes: new Set<string>(),
					rasterImageBoxes: [],
				};

				device = new mupdf.Device({
					fillImage(image, ctm) {
						processRasterImage(image, ctm, rasterCtx, false);
					},
					fillImageMask(image, ctm) {
						processRasterImage(image, ctm, rasterCtx, true);
					},
					strokePath(path, stroke, ctm, _cs, color, alpha) {
						try {
							const b = path.getBounds(stroke, ctm);
							if (b && !mupdf.Rect.isEmpty(b) && mupdf.Rect.isValid(b)) {
								vectorPaths.push({
									bounds: b as [number, number, number, number],
									color,
									alpha,
									type: 'stroke',
								});
							}
						} catch {}
					},
					fillPath(path, _evenOdd, ctm, _cs, color, alpha) {
						try {
							const b = path.getBounds(null as unknown as mupdf.StrokeState, ctm);
							if (b && !mupdf.Rect.isEmpty(b) && mupdf.Rect.isValid(b)) {
								vectorPaths.push({
									bounds: b as [number, number, number, number],
									color,
									alpha,
									type: 'fill',
								});
							}
						} catch {}
					},
				});

				page.runPageContents(device, mupdf.Matrix.identity);
				device.close();

				// 3. Process vector diagrams
				const filteredPaths = filterVectorPaths(vectorPaths, origWidth, origHeight);
				const rawClusters = clusterVectorPaths(filteredPaths);
				const validClusters = classifyDiagramClusters(
					rawClusters,
					origWidth,
					origHeight,
					rasterCtx.rasterImageBoxes
				);

				const vectorDiagrams = cropVectorDiagrams(
					page,
					validClusters,
					origWidth,
					origHeight,
					pageNumber,
					embeddedImages.length,
					2.0 // Render crops at 2.0x for sharpness
				);

				embeddedImages.push(...vectorDiagrams);

				// 4. Sort extracted diagrams in top-to-bottom reading order
				embeddedImages.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
				embeddedImages.forEach((img, idx) => {
					img.imageIndex = idx + 1;
				});

				totalEmbeddedImages += embeddedImages.length;

				pages.push({
					pageNumber,
					pageWidth: origWidth,
					pageHeight: origHeight,
					rasterWidth,
					rasterHeight,
					rasterSizeBytes,
					rasterDataUrl: pageDataUrl,
					rasterBlobUrl: pageBlobUrl,
					embeddedImages,
				});
			} finally {
				pagePixmap?.destroy();
				device?.destroy();
				page.destroy();
			}
		}
	} finally {
		doc?.destroy();
	}

	const durationMs = Math.round(performance.now() - startTime);

	return {
		fileName,
		fileSizeBytes,
		totalPages: pages.length,
		totalEmbeddedImages,
		durationMs,
		scale,
		pages,
	};
}
