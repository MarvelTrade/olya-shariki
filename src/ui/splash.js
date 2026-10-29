// Заставка: «Олины шарики», семья машет рукой, собаки прыгают.
import { $, app, show, sound, onTap } from './app.js';
import { avatarSVG, bichonSVG } from '../render/characters.js';
import { SPLASH_SUB, LOADING_TIPS } from './texts.js';
import { COLORS } from '../render/palette.js';

export function buildSplash(onPlay, onSettings) {
  const el = $('#splash');
  const balls = COLORS.map((c, i) => `<i style="--c:${c.main};--l:${c.light};--i:${i}"></i>`).join('');
  const total = Object.values(app.save.stars).reduce((a, b) => a + b, 0);
  el.innerHTML = `
  <div class="splash-sky" aria-hidden="true">${balls}</div>
  <div class="splash-top pad">
    <p class="splash-for">Для Оли</p>
    <h1 class="splash-title"><span>Олины</span><span>шарики</span></h1>
    <p class="splash-sub">${SPLASH_SUB}</p>
  </div>
  <div class="family" aria-label="Семья машет рукой">
    <div class="fam back">
      <figure style="--d:.0s">${avatarSVG('lenya', { wave: true })}<figcaption>Лёня</figcaption></figure>
      <figure style="--d:.25s">${avatarSVG('anton', { wave: true })}<figcaption>Антон</figcaption></figure>
      <figure class="mom" style="--d:.5s">${avatarSVG('olya', { wave: true })}<figcaption>Оля</figcaption></figure>
      <figure style="--d:.75s">${avatarSVG('sasha', { wave: true })}<figcaption>Саша</figcaption></figure>
    </div>
    <div class="fam front">
      <figure class="dog" style="--d:.1s">${bichonSVG('chapa', 'jump', 'hop')}<figcaption>Чапа</figcaption></figure>
      <figure class="baby" style="--d:.3s"><div class="crib">${avatarSVG('masha')}</div><figcaption>Маша</figcaption></figure>
      <figure class="dog" style="--d:.6s">${bichonSVG('pusha', 'happy')}<figcaption>Пуша</figcaption></figure>
    </div>
  </div>
  <div class="splash-btns pad">
    <button class="btn big" id="sPlay">${total ? 'Продолжить' : 'Играть'}</button>
    <button class="btn alt" id="sSettings">Настройки</button>
    <p class="splash-tip">${LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]}</p>
  </div>`;
  onTap($('#sPlay'), () => { sound.unlock(); onPlay(); });
  onTap($('#sSettings'), () => { sound.unlock(); onSettings(); });
}

export function showSplash() { show('splash'); sound.music(null); }
