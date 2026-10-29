// Service worker «Олиных шариков»: офлайн-режим.
// ВАЖНО: при любом изменении файлов игры увеличь CACHE_VERSION — иначе у Оли останется старая версия.
// Список ASSETS проверяет тест tests/engine/pwa.test.mjs (все файлы src/, styles/, icons/ должны быть в нём).
const CACHE_VERSION = 'v2.0.0';
const APP_CACHE = 'olya-app-' + CACHE_VERSION;
const FONT_CACHE = 'olya-fonts-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './src/main.js',
  './src/save.js',
  './src/audio/sound.js',
  './src/engine/index.js',
  './src/engine/game.js',
  './src/engine/texts.js',
  './src/levels/index.js',
  './src/levels/generator.js',
  './src/levels/rng.js',
  './src/levels/worlds.js',
  './src/render/board-view.js',
  './src/render/draw.js',
  './src/render/palette.js',
  './src/ui/app.js',
  './src/ui/game-screen.js',
  './src/ui/hud.js',
  './src/ui/intro.js',
  './src/ui/map.js',
  './src/ui/texts.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('olya-app-') && k !== APP_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: кешируем по мере загрузки (stylesheet и сами шрифты)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Страница: из сети (чтобы быстрее получать обновления), офлайн — из кеша
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => { putCopy(APP_CACHE, req, res); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))),
    );
    return;
  }
  // Остальное: сначала кеш, в фоне обновляем
  event.respondWith(staleWhileRevalidate(req, APP_CACHE));
});

function putCopy(cacheName, req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(cacheName).then(c => c.put(req, copy));
  }
}

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(cache => cache.match(req).then(cached => {
    const net = fetch(req).then(res => { putCopy(cacheName, req, res); return res; }).catch(() => cached);
    return cached || net;
  }));
}
