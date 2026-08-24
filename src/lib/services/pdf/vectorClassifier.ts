import * as mupdf from 'mupdf';
import { createPngUrls } from '$lib/utils/bytes';
import { DisjointSet } from '$lib/utils/dsu';
import { doBoxesOverlapOrNear, isPointInside, unionBoxes } from './geometry';
import type { BoundingBox, ExtractedEmbeddedImage, VectorPathRecord } from './types';

/**
 * Calculates standard perceptual luminance (0.0 to 1.0) from CMYK, RGB, or Grayscale color vectors.
 */
export function calculatePerceptualLuminance(color?: number[]): number | undefined {
	if (!color || color.length === 0) return undefined;

	// CMYK: [c, m, y, k] -> convert to RGB then perceptual luminance
	if (color.length === 4) {
		const [c, m, y, k] = color;
		const r = (1 - c) * (1 - k);
		const g = (1 - m) * (1 - k);
		const b = (1 - y) * (1 - k);
		return 0.299 * r + 0.587 * g + 0.114 * b;
	}

	// RGB: [r, g, b]
	if (color.length === 3) {
		const [r, g, b] = color;
		return 0.299 * r + 0.587 * g + 0.114 * b;
	}

	// Grayscale: [gray]
	if (color.length === 1) {
		return color[0];
	}

	return undefined;
}

/**
 * Filters raw vector path commands to remove background watermarks,
 * full-page boundary boxes, and faint tint patterns.
 */
export function filterVectorPaths(
	paths: VectorPathRecord[],
	pageWidth: number,
	pageHeight: number
): VectorPathRecord[] {
	return paths.filter((p) => {
		const w = p.bounds[2] - p.bounds[0];
		const h = p.bounds[3] - p.bounds[1];

		// Filter out full-page borders or full-width/full-height divider rules
		if (w >= pageWidth * 0.7 && h <= 14) return false;
		if (h >= pageHeight * 0.35 && w <= 45) return false;
		if (w >= pageWidth * 0.92 && h >= pageHeight * 0.92) return false;

		// Filter out faint watermarks by alpha or high luminance (light background tints)
		if (p.alpha !== undefined && p.alpha < 0.35) return false;

		const luminance = calculatePerceptualLuminance(p.color);
		if (luminance !== undefined && luminance > 0.8) {
			return false;
		}

		return true;
	});
}

/**
 * Groups adjacent vector paths into clusters using Spatial Hashing and Disjoint Set Union (DSU).
 * Achieves O(N) average time complexity and resolves all transitive connections in a single pass.
 */
export function clusterVectorPaths(
	paths: VectorPathRecord[],
	hGap = 20,
	vGap = 8
): BoundingBox[][] {
	const n = paths.length;
	if (n === 0) return [];
	if (n === 1) return [[paths[0].bounds]];

	const dsu = new DisjointSet(n);

	// Grid cell dimensions chosen to balance spatial partitioning with document scales
	const cellW = 40;
	const cellH = 24;

	// 1. Populate the spatial hash grid: packed 32-bit integer cellKey -> array of path indices
	const grid = new Map<number, number[]>();

	for (let i = 0; i < n; i++) {
		const [x0, y0, x1, y1] = paths[i].bounds;
		const minCol = Math.floor(x0 / cellW);
		const maxCol = Math.floor(x1 / cellW);
		const minRow = Math.floor(y0 / cellH);
		const maxRow = Math.floor(y1 / cellH);

		for (let r = minRow; r <= maxRow; r++) {
			for (let c = minCol; c <= maxCol; c++) {
				const key = ((r & 0xffff) << 16) | (c & 0xffff);
				const cell = grid.get(key);
				if (cell) {
					cell.push(i);
				} else {
					grid.set(key, [i]);
				}
			}
		}
	}

	// 2. Query each path's dilated bounding box to find neighboring paths
	for (let i = 0; i < n; i++) {
		const boxA = paths[i].bounds;
		const qMinCol = Math.floor((boxA[0] - hGap) / cellW);
		const qMaxCol = Math.floor((boxA[2] + hGap) / cellW);
		const qMinRow = Math.floor((boxA[1] - vGap) / cellH);
		const qMaxRow = Math.floor((boxA[3] + vGap) / cellH);

		for (let r = qMinRow; r <= qMaxRow; r++) {
			for (let c = qMinCol; c <= qMaxCol; c++) {
				const key = ((r & 0xffff) << 16) | (c & 0xffff);
				const cell = grid.get(key);
				if (!cell) continue;

				for (const j of cell) {
					if (j <= i) continue;
					if (dsu.connected(i, j)) continue;

					if (doBoxesOverlapOrNear(boxA, paths[j].bounds, hGap, vGap)) {
						dsu.union(i, j);
					}
				}
			}
		}
	}

	// 3. Group vector bounding boxes by their DSU root representative
	const clusterMap = new Map<number, BoundingBox[]>();
	for (let i = 0; i < n; i++) {
		const root = dsu.find(i);
		let cluster = clusterMap.get(root);
		if (!cluster) {
			cluster = [];
			clusterMap.set(root, cluster);
		}
		cluster.push(paths[i].bounds);
	}

	return Array.from(clusterMap.values());
}

export interface ValidClusterResult {
	box: BoundingBox;
	w: number;
	h: number;
	pathCount: number;
}

/**
 * Multi-Tier Geometric Diagram Classifier:
 * Determines whether a cluster represents a true 2D diagram (complex, simple, or minimal)
 * or if it is an inline math formula, fraction bar, or full-page document table grid.
 */
export function classifyDiagramClusters(
	clusters: BoundingBox[][],
	pageWidth: number,
	pageHeight: number,
	existingImageBoxes: Array<{ x: number; y: number; w: number; h: number }>
): ValidClusterResult[] {
	const validClusters: ValidClusterResult[] = [];
	const pageArea = pageWidth * pageHeight;

	for (const cluster of clusters) {
		const box = unionBoxes(cluster);
		const w = box[2] - box[0];
		const h = box[3] - box[1];
		const pathCount = cluster.length;
		const area = w * h;
		const aspectRatio = w / Math.max(1, h);

		// EXCLUSION 0: Full-page layout frames, multi-question document tables, and page-level grids
		// A question diagram never spans >75% of page width AND >40% of page height (or >35% of total page area)
		if ((w >= pageWidth * 0.75 && h >= pageHeight * 0.4) || area >= pageArea * 0.35) {
			continue;
		}

		// EXCLUSION A: Header/Footer/Margin separator lines (wide/tall & paper-thin)
		if (w > 200 && h <= 12) continue;
		if (h > 150 && w <= 45) continue;
		if (w <= 8 || h <= 8) continue;

		// EXCLUSION B: Single flat 1D equation lines (fractions, underlines)
		if (h <= 4) continue;

		// EXCLUSION C: Inline math formulas sitting in a flat single-text-line strip (h <= 20 pt and low area)
		if (h <= 20 && area < 800 && pathCount <= 6) continue;

		// Check if this cluster matches any diagram tier:
		let isDiagram = false;

		// TIER 1: Complex 2D Diagrams (Mechanics, Circuits, Multi-shape setups: >= 10 paths)
		if (pathCount >= 10 && w >= 25 && h >= 25 && aspectRatio >= 0.15 && aspectRatio <= 6.5) {
			isDiagram = true;
		}
		// TIER 2: Moderate/Simple 2D Diagrams (4-9 paths: e.g. Free-body diagrams, Pendulum, Box on floor)
		else if (pathCount >= 4 && w >= 24 && h >= 24 && aspectRatio >= 0.15 && aspectRatio <= 6.0) {
			isDiagram = true;
		}
		// TIER 3: Minimal 2D Geometric Setups (2-3 paths: e.g. 3-line Triangle, 2-axis Coordinate Graph)
		else if (
			pathCount >= 2 &&
			w >= 30 &&
			h >= 30 &&
			aspectRatio >= 0.25 &&
			aspectRatio <= 4.0 &&
			area >= 900
		) {
			isDiagram = true;
		}

		if (!isDiagram) continue;

		// Check if this cluster already overlaps with an extracted raster image
		const centerX = box[0] + w / 2;
		const centerY = box[1] + h / 2;
		const overlapsRaster = existingImageBoxes.some((r) => isPointInside(centerX, centerY, r));
		if (overlapsRaster) continue;

		validClusters.push({ box, w, h, pathCount });
	}

	// Sort top-to-bottom
	validClusters.sort((a, b) => a.box[1] - b.box[1]);
	return validClusters;
}

/**
 * Crops and renders each valid diagram cluster into a crisp PNG asset.
 */
export function cropVectorDiagrams(
	page: mupdf.Page,
	validClusters: ValidClusterResult[],
	pageWidth: number,
	pageHeight: number,
	pageNumber: number,
	startIndex: number,
	renderScale = 2.0
): ExtractedEmbeddedImage[] {
	const diagrams: ExtractedEmbeddedImage[] = [];
	let currentIdx = startIndex;

	for (const cluster of validClusters) {
		const pad = 6;
		const x0 = Math.max(0, cluster.box[0] - pad);
		const y0 = Math.max(0, cluster.box[1] - pad);
		const x1 = Math.min(pageWidth, cluster.box[2] + pad);
		const y1 = Math.min(pageHeight, cluster.box[3] + pad);
		const cropW = x1 - x0;
		const cropH = y1 - y0;

		const pixelW = Math.round(cropW * renderScale);
		const pixelH = Math.round(cropH * renderScale);

		let cropPixmap: mupdf.Pixmap | null = null;
		let drawDevice: mupdf.DrawDevice | null = null;

		try {
			cropPixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, pixelW, pixelH], false);
			cropPixmap.clear(0xffffff); // Crisp white background for exam diagrams

			const matrix = mupdf.Matrix.concat(
				mupdf.Matrix.translate(-x0, -y0),
				mupdf.Matrix.scale(renderScale, renderScale)
			);

			drawDevice = new mupdf.DrawDevice(matrix, cropPixmap);
			page.runPageContents(drawDevice, mupdf.Matrix.identity);
			drawDevice.close();

			const pngBytes = cropPixmap.asPNG();
			const { dataUrl, blobUrl } = createPngUrls(pngBytes);

			const posBox = {
				x: Math.round(x0),
				y: Math.round(y0),
				width: Math.round(cropW),
				height: Math.round(cropH),
			};

			currentIdx++;
			diagrams.push({
				id: `p${pageNumber}_diag_${currentIdx}`,
				pageNumber,
				imageIndex: currentIdx,
				type: 'vector_diagram',
				width: pixelW,
				height: pixelH,
				sizeBytes: pngBytes.byteLength,
				mimeType: 'image/png',
				dataUrl,
				blobUrl,
				position: posBox,
			});
		} catch (err) {
			console.warn(`Error cropping vector diagram on page ${pageNumber}:`, err);
		} finally {
			drawDevice?.destroy();
			cropPixmap?.destroy();
		}
	}

	return diagrams;
}
