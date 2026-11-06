const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/logo%20-%20192x192.jpeg",
  "/logo%20512x512.jpeg",
];

const CACHE_NAME = "anli-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) {
    return;
  }

  const isSensitiveApi =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/") ||
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/login") ||
    url.pathname.includes("/logout") ||
    url.pathname.includes("/session") ||
    url.pathname.includes("/payroll") ||
    url.pathname.includes("/employees") ||
    url.pathname.includes("/users") ||
    url.pathname.includes("/company-profile");

  if (isSensitiveApi) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/")),
        ),
    );
    return;
  }

  if (
    /(?:^\/|\.(?:js|css|png|jpg|jpeg|svg|webp|ico|json|woff2?|ttf))$/.test(
      url.pathname,
    )
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  }
});
