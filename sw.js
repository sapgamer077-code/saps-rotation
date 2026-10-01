/* Rotation — offline support. Bump VERSION on every release so phones pick up the new files. */
const VERSION = "rotation-2026-10-01-4";
const SHELL = [
  "./", "index.html", "theme.css", "app.js", "catalog.js", "rot.js", "size.js", "platform.js", "config.js", "manifest.webmanifest",
  "supabase.js",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "rotation-fonts").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fonts: cache after first load so the app looks right offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("rotation-fonts").then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // App files: network first (so updates land right away), cached copy when offline.
  if (url.origin === self.location.origin) {
    // no-cache: always check with the server first, so a new release never mixes with old files from the browser cache
    e.respondWith(fetch(req, { cache: "no-cache" }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)) }
      return r;
    }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? caches.match("index.html") : Response.error())));
  }
  // Everything else (Supabase, Gemini) goes straight to the network.
});
