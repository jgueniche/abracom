import "server-only";

/**
 * Service worker source (sessions 10 and 13), served by `app/sw.js/route.ts` with a cache name
 * derived from the build so that the precached offline page is refreshed on every deployment.
 * Pages are never cached (private data); only immutable build assets and icons are.
 */
export function buildServiceWorker(buildId: string): string {
  const cacheName = `kesher-${buildId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return `/* Kesher service worker — build ${buildId} */
var CACHE = ${JSON.stringify(cacheName)};
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
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
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

/** Only same-origin paths may be opened from a notification. */
function safeHref(value) {
  try {
    var url = new URL(value || "/notifications", self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search : "/notifications";
  } catch (error) {
    return "/notifications";
  }
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
          return (
            cached ||
            new Response("Hors ligne", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
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
  } catch (error) {
    data = { title: event.data ? event.data.text() : "" };
  }
  var options = {
    body: data.body || undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { href: safeHref(data.href) },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Kesher", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var href = safeHref(event.notification.data && event.notification.data.href);
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

// The browser rotated the subscription: subscribe again and tell the server.
self.addEventListener("pushsubscriptionchange", function (event) {
  var options = event.oldSubscription ? event.oldSubscription.options : null;
  if (!options || !options.applicationServerKey) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
      .then(function (subscription) {
        return fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(subscription.toJSON()),
        });
      })
      .catch(function () {}),
  );
});
`;
}

/** Stable per deployment: the git commit on Vercel, otherwise the process start time. */
export function currentBuildId(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.NEXT_PUBLIC_BUILD_ID ?? startedAt
  );
}

const startedAt = Date.now().toString(36);
