// Точка входа «Олиных шариков».
import { app, sound } from './ui/app.js';
import { buildSplash, showSplash } from './ui/splash.js';
import { initMap, showMap } from './ui/map.js';
import { initGameScreen, debug } from './ui/game-screen.js';
import { openSettings } from './ui/settings.js';

sound.init();
initGameScreen();
initMap(() => { buildSplash(goMap, () => openSettings()); showSplash(); });
const goMap = () => showMap(true);
buildSplash(goMap, () => openSettings());
showSplash();
window.__olya = Object.assign(debug, { app, showMap });

// Офлайн: service worker (только по http(s), не с file://)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW не зарегистрирован:', e));
  });
}
