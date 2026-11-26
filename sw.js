// نحفظ ملفات البرنامج فقط. بيانات الطفل تبقى في localStorage.
// مع الإنترنت نجلب أحدث نسخة دائمًا، ودون إنترنت نستخدم النسخة المحفوظة.
const CACHE = "digital-rescuer-__VERSION__";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./state.js",
  "./missions.js",
  "./manifest.webmanifest",
  "./assets/hero.svg",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/festival-qr.png",
  "./assets/fonts.css",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" يتجاوز ذاكرة المتصفح كي لا نحفظ ملفات قديمة بالخطأ.
      .then((cache) =>
        cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith("digital-rescuer-") && name !== CACHE,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request, { cache: "no-cache" });
        if (fresh.ok && request.mode !== "navigate")
          cache.put(request, fresh.clone());
        return fresh;
      } catch {
        if (request.mode === "navigate")
          return (
            (await cache.match(new URL("./index.html", self.registration.scope))) ||
            Response.error()
          );
        return (await cache.match(request)) || Response.error();
      }
    })(),
  );
});
