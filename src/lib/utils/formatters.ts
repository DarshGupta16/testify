/**
 * Formatting Utilities for Dates, Durations, and Metrics
 */

/**
 * Formats an ISO date string into a friendly localized display (e.g. "Aug 15, 2026").
 */
export function formatDate(isoString: string): string {
	try {
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	} catch {
		return 'Recently';
	}
}

/**
 * Formats duration in minutes into a concise string (e.g. "45m" or "1.5 hrs").
 */
export function formatDuration(totalMins: number): string {
	if (totalMins < 60) return `${totalMins}m`;
	const hours = (totalMins / 60).toFixed(1);
	return `${hours} hrs`;
}

/**
 * Formats seconds into digital timer display (HH:MM:SS or MM:SS).
 * If total seconds >= 3600 or forceHours is true, returns "HH:MM:SS" (e.g. "01:59:52").
 * Otherwise returns "MM:SS" (e.g. "45:30").
 */
export function formatDigitalTimer(totalSeconds: number, forceHours = false): string {
	const safeSecs = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(safeSecs / 3600);
	const m = Math.floor((safeSecs % 3600) / 60);
	const s = safeSecs % 60;

	if (h > 0 || forceHours) {
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
	return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats seconds into human-readable duration (e.g. "1h 45m 20s", "45m 10s", or "25s").
 */
export function formatSecondsToText(totalSeconds: number): string {
	const safeSecs = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(safeSecs / 3600);
	const m = Math.floor((safeSecs % 3600) / 60);
	const s = safeSecs % 60;

	if (h > 0) {
		if (m === 0 && s === 0) return `${h}h`;
		if (s === 0) return `${h}h ${m}m`;
		return `${h}h ${m}m ${s}s`;
	}
	if (m === 0) return `${s}s`;
	if (s === 0) return `${m}m`;
	return `${m}m ${s}s`;
}

/**
 * Formats numeric marks or counts.
 */
export function formatNumber(val: number): string {
	return new Intl.NumberFormat('en-US').format(val);
}
