/**
 * Fire-and-forget helper that asynchronously executes a Promise in the background
 * without blocking the main UI thread, safely catching and logging any errors.
 */
export function fireAndForget(
	promise: Promise<unknown>,
	operationName = 'background persistence'
): void {
	promise.catch((error) => {
		console.error(`[Dexie DB Error during ${operationName}]:`, error);
	});
}
