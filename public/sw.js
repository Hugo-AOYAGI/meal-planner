// Opens the app without network: the page and its built files are kept; the API is never cached here
// (the shopping list keeps its own copy on the device, see src/client/lib/api/persist.ts).
const CACHE = "repas-app";
const PAGE = "/";
/** a page slower than this (weak signal in a shop) is served from the cache, and updated in the background */
const PAGE_TIMEOUT_MS = 3000;

/** The built files the page needs: its scripts and styles, and the fonts its styles load. */
async function filesOf(html) {
  const files = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  for (const css of files.filter((f) => f.endsWith(".css"))) {
    const text = await (await fetch(css)).text();
    files.push(...[...text.matchAll(/url\((?:"|')?(\/assets\/[^"')]+)/g)].map((m) => m[1]));
  }
  return [...new Set(files)];
}

/** Keeps `page` and what it needs, and drops the files of older versions. */
async function keep(page) {
  const cache = await caches.open(CACHE);
  const files = await filesOf(await page.clone().text());
  const missing = [];
  for (const f of files) if (!(await cache.match(f))) missing.push(f);
  await cache.addAll(missing); // built files never change under the same name: fetched once
  await cache.put(PAGE, page);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/") && !files.includes(path)) await cache.delete(request);
  }
}

async function freshPage() {
  const page = await fetch(PAGE, { cache: "no-store" });
  if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) throw new Error(`page ${page.status}`);
  return page;
}

self.addEventListener("install", (event) => {
  event.waitUntil(freshPage().then(keep).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    const fresh = freshPage();
    const copy = fresh.then((page) => page.clone()); // taken before the page is handed to the browser
    event.waitUntil(copy.then(keep).catch(() => {}));
    const cached = caches.match(PAGE);
    const timeout = new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS));
    event.respondWith(
      Promise.race([fresh, timeout.then(() => cached.then((c) => c ?? fresh))]).catch(() =>
        cached.then((c) => c ?? Response.error()),
      ),
    );
    return;
  }
  // built files never change under the same name; icons and manifest: the cache, refreshed in the background
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then(async (response) => {
        if (response.ok && !url.pathname.startsWith("/assets/")) await (await caches.open(CACHE)).put(request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    }),
  );
});

// Leftover reminders (see src/server/services/fridge/reminders.ts): `{ title, body, url }`
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Restes", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/badge-96.png", // the status bar icon: Android keeps only its shape (alpha), so a colour icon is a plain square
      tag: "leftovers", // a new reminder replaces yesterday's
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === location.origin);
      if (open) return open.navigate(url).then((w) => (w ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
