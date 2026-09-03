/**
 * The judge pad's service worker.
 *
 * Its whole job is that a judge who has lost signal still gets their buttons
 * when they reopen the app, instead of the browser's dinosaur. The scoring
 * itself does not depend on this — presses are queued in IndexedDB by the page
 * and sent when the network returns — but a pad that won't open is no use to
 * somebody holding a queue of presses.
 *
 * Deliberately small. There is no build step generating a precache manifest,
 * because the one thing worse than no service worker at an event is a stale one
 * serving last month's scoring rules to a judge who has no way to clear it.
 *
 * Three rules:
 *
 *   /api/          never cached. A score is not a thing to serve from memory.
 *   /_next/static/ cache first. The filenames contain a content hash, so a
 *                  cached one can never be the wrong version.
 *   navigations    network first, falling back to the last copy that worked.
 *
 * Scoped to /public/judge by the header the page registers it with, so nothing
 * here can affect the admin side of the app.
 */

const CACHE = "tkd-judge-v1";

self.addEventListener("install", (event) => {
  // Take over as soon as this version is ready rather than waiting for every
  // pad in the hall to be closed first.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Anything from an older version of this worker goes, so a fix ships
      // properly rather than sitting behind a cache nobody can reach.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Scores, rings, presses: always the real thing or nothing.
  if (url.pathname.startsWith("/api/")) return;

  // Hashed assets. The name changes when the content does, so a hit is always
  // the right file and never needs revalidating.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          void cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  // The page itself. Network first, because a judge with signal should always
  // get the current bout; the cache is only there for the times they don't.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE);
            void cache.put(request, response.clone());
          }
          return response;
        } catch {
          const hit = await caches.match(request);
          if (hit) return hit;
          // Last resort: any judge page we have, rather than a browser error.
          // The page will fetch its own ring as soon as there is a network, and
          // shows the queue in the meantime.
          const cache = await caches.open(CACHE);
          const anyPad = (await cache.keys()).find((c) => new URL(c.url).pathname.startsWith("/public/judge"));
          if (anyPad) {
            const fallback = await cache.match(anyPad);
            if (fallback) return fallback;
          }
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title>" +
              "<body style=\"font:16px system-ui;padding:2rem;background:#09090b;color:#fff\">" +
              "<h1 style=\"font-size:1.1rem\">No signal</h1>" +
              "<p>This pad hasn't been opened on this phone before, so there is nothing saved to show. " +
              "Reconnect and it will load.</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
  }
});
