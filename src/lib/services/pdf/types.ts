/**
 * Domain Models and Types for PDF Extraction and Diagram Processing
 */

export type DiagramSourceType = 'raster_image' | 'vector_diagram';

export interface ImagePosition {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ExtractedEmbeddedImage {
	id: string;
	pageNumber: number;
	imageIndex: number;
	type: DiagramSourceType;
	width: number;
	height: number;
	sizeBytes: number;
	mimeType: string;
	dataUrl: string;
	blobUrl?: string;
	position?: ImagePosition;
}

export interface ExtractedPdfPage {
	pageNumber: number;
	pageWidth: number;
	pageHeight: number;
	rasterWidth: number;
	rasterHeight: number;
	rasterSizeBytes: number;
	rasterDataUrl: string;
	rasterBlobUrl?: string;
	embeddedImages: ExtractedEmbeddedImage[];
}

export interface PdfExtractionResult {
	fileName: string;
	fileSizeBytes: number;
	totalPages: number;
	totalEmbeddedImages: number;
	durationMs: number;
	scale: number;
	pages: ExtractedPdfPage[];
}

export interface PdfExtractionProgress {
	currentPage: number;
	totalPages: number;
	statusText: string;
}

export interface PdfExtractionOptions {
	scale?: number;
	onProgress?: (progress: PdfExtractionProgress) => void;
}

export type BoundingBox = [number, number, number, number]; // [x0, y0, x1, y1]

export interface VectorPathRecord {
	bounds: BoundingBox;
	color?: number[];
	alpha?: number;
	type: 'stroke' | 'fill';
}

export interface DiagramCluster {
	box: BoundingBox;
	w: number;
	h: number;
	pathCount: number;
	area: number;
	aspectRatio: number;
}
