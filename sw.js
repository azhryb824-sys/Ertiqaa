const CACHE = "shumoos-v20260713-equal-letterhead-pages";
const ASSETS = [
  "/", "/index.html", "/login.html", "/register.html", "/dashboard.html",
  "/styles.css", "/app.js", "/manifest.json", "/pdfmake-gen.js",
  "/assets/shumoos-logo.png",
  "/assets/fonts/cairo-vfs.js"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return fetch(request).catch(() => new Response(JSON.stringify({error: "offline"}), {status: 503}));
  event.respondWith(
    fetch(request).then(response => {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, clone).catch(() => {}));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || new Response("", {status: 404})))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  );
  return self.clients.claim();
});
