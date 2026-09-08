/* Kesher service worker: offline fallback, static asset cache and Web Push (sessions 10 and 13). */
var CACHE = "kesher-v2";
var OFFLINE_URL = "/hors-ligne";
var PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          PRECACHE.map(function (url) {
            return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
          }),
        );
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (key) {
            return key !== CACHE;
          }).map(function (key) {
            return caches.delete(key);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always from the network (private data is never stored), offline fallback otherwise.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(OFFLINE_URL).then(function (cached) {
          return cached || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        });
      }),
    );
    return;
  }

  // Immutable build assets and icons: cache first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response.ok) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return response;
        });
      }),
    );
  }
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  var options = {
    body: data.body || undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { href: data.href || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Kesher", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(href);
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
