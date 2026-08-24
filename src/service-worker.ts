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

// Fetch: Strategy-based offline caching and offline SPA fallback
self.addEventListener('fetch', (event: FetchEvent) => {
	const { request } = event;

	// Only intercept standard HTTP(S) GET requests
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// 1. Bypass AI provider endpoints and non-HTTP schemes
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return;
	}

	if (
		url.hostname.includes('api.openai.com') ||
		url.hostname.includes('api.anthropic.com') ||
		url.hostname.includes('generativelanguage.googleapis.com') ||
		url.hostname.includes('api.groq.com')
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
					// Offline fallback if font isn't in cache: return empty or let browser use system fonts
					return new Response('', { status: 408, statusText: 'Offline Font Not Cached' });
				}
			})()
		);
		return;
	}

	// 3. Navigation requests (HTML pages): Network-first with Cache fallback to App Shell
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const networkResponse = await fetch(request);
					if (networkResponse.ok) {
						const cache = await caches.open(CACHE_NAME);
						cache.put(request, networkResponse.clone());
						return networkResponse;
					}
				} catch (networkError) {
					console.warn(
						'[ServiceWorker] Navigation fetch failed, falling back to cache:',
						networkError
					);
				}

				// If network fails (offline), try exact URL match, then root SPA shell '/'
				const cache = await caches.open(CACHE_NAME);
				const cachedResponse = await cache.match(request);
				if (cachedResponse) {
					return cachedResponse;
				}

				const rootShell = await cache.match('/');
				if (rootShell) {
					return rootShell;
				}

				return new Response('Offline — Testify application shell is not available in cache.', {
					status: 503,
					headers: { 'Content-Type': 'text/plain' },
				});
			})()
		);
		return;
	}

	// 4. Static assets & build bundles: Cache-First with background revalidation
	if (ASSETS_TO_PRECACHE.includes(url.pathname)) {
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
					console.warn(`[ServiceWorker] Asset fetch failed for "${url.pathname}":`, err);
					throw err;
				}
			})()
		);
		return;
	}

	// 5. Generic Same-Origin requests: Stale-While-Revalidate
	if (url.origin === self.location.origin) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				const cachedResponse = await cache.match(request);

				const fetchPromise = fetch(request)
					.then((networkResponse) => {
						if (networkResponse.ok) {
							cache.put(request, networkResponse.clone());
						}
						return networkResponse;
					})
					.catch(() => cachedResponse);

				return cachedResponse || (await fetchPromise);
			})()
		);
	}
});
