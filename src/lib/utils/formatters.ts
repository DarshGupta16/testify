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
 * Formats numeric marks or counts.
 */
export function formatNumber(val: number): string {
	return new Intl.NumberFormat('en-US').format(val);
}
