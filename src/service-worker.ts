/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = `testify-app-v${version}`;
const STATIC_CACHE_NAME = `testify-static-v${version}`;
const FONT_CACHE_NAME = 'testify-fonts-v1';

// Build assets (Vite JS/CSS bundles) and static files (icons, manifest, favicon, etc.)
const ASSETS_TO_PRECACHE = Array.from(
	new Set([
		'/',
		...build,
		...files.filter(
			(file) =>
				!file.endsWith('robots.txt') && !file.endsWith('sitemap.xml') && !file.startsWith('/dev')
		),
	])
);

// Install: Pre-cache application shell, scripts, styles, and core static assets
self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			// Cache files with fault tolerance so single missing non-critical file does not break entire SW install
			await Promise.all(
				ASSETS_TO_PRECACHE.map(async (asset) => {
					try {
						await cache.add(asset);
					} catch (err) {
						console.warn(`[ServiceWorker] Failed to precache asset "${asset}":`, err);
					}
				})
			);
			await self.skipWaiting();
		})()
	);
});

// Activate: Prune stale caches from older builds and take control of all clients
self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const activeCaches = new Set([CACHE_NAME, STATIC_CACHE_NAME, FONT_CACHE_NAME]);
			const cacheKeys = await caches.keys();

			await Promise.all(
				cacheKeys
					.filter((key) => !activeCaches.has(key))
					.map((key) => {
						console.info(`[ServiceWorker] Deleting outdated cache "${key}"`);
						return caches.delete(key);
					})
			);

			await self.clients.claim();
		})()
	);
});

// Fetch: 100% Local-First Stale-While-Revalidate with Fire-and-Forget Background Revalidation
self.addEventListener('fetch', (event: FetchEvent) => {
	const { request } = event;

	// Only intercept standard HTTP(S) GET requests
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// 1. Bypass AI provider endpoints, connectivity pings, and non-HTTP schemes
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return;
	}

	if (url.searchParams.has('_ping')) {
		return;
	}

	if (
		url.hostname.includes('api.openai.com') ||
		url.hostname.includes('api.anthropic.com') ||
		url.hostname.includes('generativelanguage.googleapis.com') ||
		url.hostname.includes('api.groq.com') ||
		url.hostname.includes('google.com') ||
		url.hostname === '1.1.1.1'
	) {
		return;
	}

	// 2. Google Fonts & KaTeX Webfonts: Cache-First with Dynamic Font Cache
	if (
		url.hostname === 'fonts.googleapis.com' ||
		url.hostname === 'fonts.gstatic.com' ||
		url.pathname.includes('/fonts/') ||
		url.pathname.endsWith('.woff2') ||
		url.pathname.endsWith('.woff') ||
		url.pathname.endsWith('.ttf')
	) {
		event.respondWith(
			(async () => {
				const fontCache = await caches.open(FONT_CACHE_NAME);
				const cachedResponse = await fontCache.match(request);
				if (cachedResponse) {
					return cachedResponse;
				}

				try {
					const networkResponse = await fetch(request);
					if (networkResponse.ok) {
						fontCache.put(request, networkResponse.clone());
					}
					return networkResponse;
				} catch {
					return new Response('', { status: 408, statusText: 'Offline Font Not Cached' });
				}
			})()
		);
		return;
	}

	// 3. Navigation requests (HTML pages & SPA routes like /test/...):
	// Local-First: Serve cached app shell immediately (0ms delay), then fire-and-forget background revalidate
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);

				// Fast retrieval of cached shell
				const exactMatch = await cache.match(request);
				const rootMatch = await cache.match('/', { ignoreSearch: true });
				const globalMatch = await caches.match('/', { ignoreSearch: true });
				const cachedShell = exactMatch || rootMatch || globalMatch;

				// Background asynchronous fire-and-forget revalidation
				const revalidatePromise = fetch(request)
					.then(async (networkResponse) => {
						if (networkResponse?.ok) {
							const openCache = await caches.open(CACHE_NAME);
							await openCache.put(request, networkResponse.clone());
						}
					})
					.catch(() => {
						// Offline or background network failure is silently caught
					});

				event.waitUntil(revalidatePromise);

				// If local shell exists, serve it IMMEDIATELY without waiting for network
				if (cachedShell) {
					return cachedShell;
				}

				// Fallback for very first visit if not yet cached
				try {
					const networkResponse = await fetch(request);
					if (networkResponse.ok) {
						cache.put(request, networkResponse.clone());
					}
					return networkResponse;
				} catch {
					return new Response('Offline — Testify application shell is not available in cache.', {
						status: 503,
						headers: { 'Content-Type': 'text/plain' },
					});
				}
			})()
		);
		return;
	}

	// 4. Immutable build assets (/_app/immutable/...): Cache-First (Never changes for a given hash)
	if (url.pathname.startsWith('/_app/immutable/')) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				const cachedResponse = await cache.match(request);
				if (cachedResponse) {
					return cachedResponse;
				}

				try {
					const networkResponse = await fetch(request);
					if (networkResponse.ok) {
						cache.put(request, networkResponse.clone());
					}
					return networkResponse;
				} catch (err) {
					console.warn(`[ServiceWorker] Immutable asset fetch failed for "${url.pathname}":`, err);
					throw err;
				}
			})()
		);
		return;
	}

	// 5. Pre-cached static files & bundles: Local-First Stale-While-Revalidate
	if (ASSETS_TO_PRECACHE.includes(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				const cachedResponse = await cache.match(request);

				// Fire-and-forget background update
				const bgUpdate = fetch(request)
					.then(async (networkResponse) => {
						if (networkResponse?.ok) {
							const openCache = await caches.open(CACHE_NAME);
							await openCache.put(request, networkResponse.clone());
						}
					})
					.catch(() => {
						// Offline
					});
				event.waitUntil(bgUpdate);

				if (cachedResponse) {
					return cachedResponse;
				}

				try {
					const networkResponse = await fetch(request);
					if (networkResponse.ok) {
						cache.put(request, networkResponse.clone());
					}
					return networkResponse;
				} catch (err) {
					console.warn(`[ServiceWorker] Asset fetch failed for "${url.pathname}":`, err);
					throw err;
				}
			})()
		);
		return;
	}

	// 6. Generic Same-Origin requests: Local-First Stale-While-Revalidate
	if (url.origin === self.location.origin) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				const cachedResponse = await cache.match(request);

				const bgFetch = fetch(request)
					.then(async (networkResponse) => {
						if (networkResponse?.ok) {
							const openCache = await caches.open(CACHE_NAME);
							await openCache.put(request, networkResponse.clone());
						}
					})
					.catch(() => {
						// Offline
					});
				event.waitUntil(bgFetch);

				if (cachedResponse) {
					return cachedResponse;
				}

				try {
					const networkResponse = await fetch(request);
					if (networkResponse.ok) {
						cache.put(request, networkResponse.clone());
					}
					return networkResponse;
				} catch {
					return cachedResponse || new Response('', { status: 503 });
				}
			})()
		);
	}
});
