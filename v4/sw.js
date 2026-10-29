/* Nature Explorer v4 · service worker para uso sin conexión.
   - La app (HTML, JS, CSS, librerías y fuentes) queda guardada al instalarse.
   - APIs de iNaturalist y GBIF: primero red; si no hay señal, la última respuesta guardada.
   - Teselas del mapa y fotos: primero lo guardado (las descarga «Guardar zona» o se guardan al verlas). */
'use strict';
// Cambiar VERSION al publicar cambios en la app para que los teléfonos descarguen la versión nueva.
const VERSION = 'v4-offline-17';
const SHELL = `nx4-shell-${VERSION}`;
const API = 'nx4-api';
const TILES = 'nx4-tiles';
const IMG = 'nx4-img';
const FONTS = 'nx4-fonts';

const SHELL_FILES = [
  './', 'index.html', 'app.js', 'styles.css', 'prototipo.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('nx4-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isTile = (u) => u.hostname === 'server.arcgisonline.com' || (u.hostname === 'api.gbif.org' && u.pathname.startsWith('/v2/map/'));
const isApi = (u) => u.hostname === 'api.inaturalist.org' || u.hostname === 'api.gbif.org';
const isImg = (u) => /(^|\.)inaturalist-open-data\.s3\.amazonaws\.com$|^static\.inaturalist\.org$/.test(u.hostname);
const isFont = (u) => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';

// Guarda solo respuestas legibles (no «opacas»): las opacas ocupan mucho espacio en el teléfono.
async function put(cacheName, req, res) {
  if (res && res.ok && res.type !== 'opaque') {
    const c = await caches.open(cacheName);
    await c.put(req, res.clone());
  }
  return res;
}
async function cacheFirst(cacheName, req) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  try { return await put(cacheName, req, await fetch(req)); } catch { return new Response('', { status: 504, statusText: 'Sin conexión' }); }
}
async function networkFirst(cacheName, req, ms) {
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    return await put(cacheName, req, res);
  } catch {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    return new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json', 'X-Offline': '1' } });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    // La app: primero lo guardado y se actualiza en segundo plano para la próxima apertura.
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      const net = fetch(req).then((res) => put(SHELL, req, res)).catch(() => null);
      return hit || (await net) || caches.match('index.html');
    })());
    return;
  }
  if (isTile(u)) { e.respondWith(cacheFirst(TILES, req)); return; }
  if (isImg(u)) { e.respondWith(cacheFirst(IMG, req)); return; }
  if (isFont(u)) { e.respondWith(cacheFirst(FONTS, req)); return; }
  if (u.hostname === 'cdnjs.cloudflare.com') { e.respondWith(cacheFirst(SHELL, req)); return; }
  if (isApi(u)) { e.respondWith(networkFirst(API, req, 12000)); return; }
});
