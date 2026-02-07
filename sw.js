const CACHE_NAME = "ramadan-mm-v15";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=7",
  "./app.js?v=10",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Cache-first (fast + offline)
self.addEventListener("fetch", (event) => {
  const reqUrl = new URL(event.request.url);

  // ✅ DO NOT intercept cross-origin requests (Aladhan API, CDNs)
  if (reqUrl.origin !== self.location.origin) return;

  // only handle GET
  if (event.request.method !== "GET") return;

  const req = event.request;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        if (req.method === "GET" && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});