import type { BoundingBox } from './types';

/**
 * Computes the minimal bounding box enclosing all provided boxes.
 */
export function unionBoxes(boxes: BoundingBox[]): BoundingBox {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const b of boxes) {
		if (b[0] < minX) minX = b[0];
		if (b[1] < minY) minY = b[1];
		if (b[2] > maxX) maxX = b[2];
		if (b[3] > maxY) maxY = b[3];
	}

	return [minX, minY, maxX, maxY];
}

/**
 * Determines if two bounding boxes overlap or are within anisotropic horizontal/vertical proximity gaps.
 * Uses a generous horizontal threshold (e.g. 20pt) to unify sub-figures on the same line,
 * and a tight vertical threshold (e.g. 8pt) to keep separate questions isolated.
 */
export function doBoxesOverlapOrNear(
	b1: BoundingBox,
	b2: BoundingBox,
	hGap = 20,
	vGap = 8
): boolean {
	return !(
		b1[2] + hGap < b2[0] ||
		b2[2] + hGap < b1[0] ||
		b1[3] + vGap < b2[1] ||
		b2[3] + vGap < b1[1]
	);
}

/**
 * Checks if a point or box center is contained within a target bounding box.
 */
export function isPointInside(
	x: number,
	y: number,
	b: { x: number; y: number; w: number; h: number }
): boolean {
	return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
