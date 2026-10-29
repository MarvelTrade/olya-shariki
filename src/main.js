// Точка входа «Олиных шариков».
import { app } from './ui/app.js';
import { setSoundEnabled } from './audio/sound.js';
import { buildMap, scrollToCurrent, initMap } from './ui/map.js';
import { initGameScreen, debug } from './ui/game-screen.js';

setSoundEnabled(app.save.sound);
initMap();
initGameScreen();
buildMap();
requestAnimationFrame(scrollToCurrent);
window.__olya = debug;

// Офлайн: service worker (только по http(s), не с file://)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW не зарегистрирован:', e));
  });
}
