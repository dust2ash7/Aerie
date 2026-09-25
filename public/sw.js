const CACHE = "aerie-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["./", "./index.html"])));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("aerie") && url.hash) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const path = url.pathname;
        const shell = path.endsWith("/") || path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".svg") || path.endsWith(".png") || path.endsWith(".webmanifest");
        if (res.ok && shell) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("./index.html"))),
  );
});
