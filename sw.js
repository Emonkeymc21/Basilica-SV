const CACHE = "san-vicente-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",

  "./data/songs.json",
  "./data/prayers.json",
  "./data/saints.json",
  "./data/history.json",
  "./data/schedule.json",
  "./data/announcements.json",
  "./data/events.json",

  "./assets/img/logo.png",
  "./assets/img/curso-canto-gregoriano.png",
  "./assets/img/catequesis-familiar.png",
  "./assets/img/misa-enfermos.png",
  "./assets/img/horarios-primavera-verano.png",
  "./assets/img/solo-por-hoy-cover.jpg",
  "./assets/img/solo-por-hoy-3.jpg",
  "./assets/img/solo-por-hoy-2.jpg",
  "./assets/img/solo-por-hoy-1.jpg",
  "./assets/img/flyer-cristo-rey.jpg",
  "./assets/img/flyer-nuestra-senora-salud.jpg",
  "./assets/img/flyer-dedicacion-san-juan-letran.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
