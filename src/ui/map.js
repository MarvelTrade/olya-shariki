// Карта уровней: извилистая тропинка снизу вверх через 6 миров семьи, с декором вдоль дороги.
import { app, $, show, sound, onTap } from './app.js';
import { LEVELS, WORLDS } from '../levels/index.js';
import { starSVG } from '../render/draw.js';
import { bichonSVG, avatarSVG } from '../render/characters.js';
import { WORLD_ART, worldBackground, decorHTML, BUNTING } from '../render/worlds-art.js';
import { WORLD_HOST } from './texts.js';
import { openIntro } from './intro.js';
import { openSettings } from './settings.js';
import { openLetter, letterUnlocked } from './letter.js';

const STEP = 96, TOP_PAD = 230, BOTTOM_PAD = 250;
const PER_WORLD = 20;
const mapH = () => TOP_PAD + (LEVELS - 1) * STEP + BOTTOM_PAD;
const posY = i => mapH() - BOTTOM_PAD - (i - 1) * STEP;
const posX = i => 0.5 + 0.3 * Math.sin((i - 1) * 0.62);
const worldOf = i => Math.min(WORLDS.length - 1, Math.floor((i - 1) / PER_WORLD));

export const unlocked = n => n === 1 || (app.save.stars[n - 1] || 0) > 0;
export function currentLevel() { for (let i = 1; i <= LEVELS; i++) if (!app.save.stars[i]) return i; return LEVELS; }

const LOCK = '<svg viewBox="0 0 24 24" class="lk" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3" fill="#fff"/><path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="#fff" stroke-width="2.6" fill="none"/></svg>';

export function buildMap() {
  const save = app.save, inner = $('#mapInner'), H = mapH();
  inner.innerHTML = ''; inner.style.height = H + 'px';
  const html = [];
  // фоны миров
  WORLDS.forEach((W, wi) => {
    const top = wi === WORLDS.length - 1 ? 0 : posY(wi * PER_WORLD + PER_WORLD) - STEP / 2;
    const bot = wi === 0 ? H : posY(wi * PER_WORLD + 1) + STEP / 2;
    html.push(`<div class="world-bg w${wi}" style="top:${top}px;height:${bot - top}px;background:${worldBackground(wi)}"></div>`);
    if (wi === 2) { const cy = (top + bot) / 2; html.push(`<svg class="field-lines" style="top:${top}px;height:${bot - top}px" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50H100" stroke="#fff" stroke-width=".5" vector-effect="non-scaling-stroke" opacity=".7"/></svg><div class="field-circle" style="top:${cy - 90}px"></div>`); }
    if (wi === 5) html.push(`<div class="bunting" style="top:${top + 6}px">${BUNTING()}</div>`);
  });
  // декор вдоль тропинки — с той стороны, где нет дороги
  let k = 0;
  for (let i = 2; i <= LEVELS; i += 3) {
    const wi = worldOf(i), px = posX(i), left = px > 0.5;
    const { html: d, w: w0 } = decorHTML(wi, k++); const w = Math.round(w0 * 1.35);
    const x = left ? 4 + (k % 3) * 3 : 96 - (k % 3) * 3;
    html.push(`<div class="decor" style="left:calc(${x}% - ${w / 2}px);top:${posY(i) - w / 2}px;width:${w}px;--r:${(k % 5 - 2) * 4}deg">${d}</div>`);
    // на широком экране — ещё по краям
    const d2 = decorHTML(wi, k + 3);
    html.push(`<div class="decor wide" style="left:calc(${left ? -32 : 132}% - ${d2.w / 2}px);top:${posY(i) - 20}px;width:${d2.w * 1.3}px">${d2.html}</div>`);
  }
  // тропинка
  const pts = []; for (let i = 1; i <= LEVELS; i++) pts.push([posX(i) * 100, posY(i)]);
  let d = `M${pts[0][0]} ${pts[0][1] + 140} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`; }
  d += ` L${pts.at(-1)[0]} ${pts.at(-1)[1] - 120}`;
  html.push(`<svg id="mapSvg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="rgba(120,60,100,.10)" stroke-width="34" stroke-linecap="round" vector-effect="non-scaling-stroke" transform="translate(0 5)"/>
    <path d="${d}" fill="none" stroke="#fffaf4" stroke-width="30" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="${d}" fill="none" stroke="rgba(255,140,170,.35)" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`);
  // таблички миров с «хозяином» мира
  WORLDS.forEach((W, wi) => {
    const top = wi === 0 ? posY(1) + 70 : posY(wi * PER_WORLD + 1) + 44;
    const host = WORLD_HOST[wi] || 'olya';
    const pic = wi === 1 ? `<span class="b-av two">${bichonSVG('chapa', 'happy')}${bichonSVG('pusha', 'happy')}</span>` : wi === 5 ? `<span class="b-av">${avatarSVG('anton', { badge: true, badgeColor: '#fff0e0' })}</span>` : `<span class="b-av">${avatarSVG(host, { badge: true, badgeColor: '#fff4f8' })}</span>`;
    html.push(`<div class="banner world-banner" style="top:${top}px;--acc:${WORLD_ART[wi]?.accent || W.node}">${pic}<div><small>Мир ${wi + 1}</small><b>${W.name}</b><span>${W.note}</span></div></div>`);
  });
  // финиш наверху
  const done = letterUnlocked();
  html.push(`<div class="banner finish" style="top:28px"><div class="fin-fam">${['olya', 'anton', 'lenya', 'sasha', 'masha'].map(w => avatarSVG(w, { badge: true })).join('')}</div><b>Финиш: все вместе</b><span>Оля, Антон, Лёня, Саша, Маша, Чапа и Пуша</span>${done ? '<button class="btn gold sm" id="openLetter">Письмо для Оли</button>' : `<span class="secret">${LOCK}Пройди все ${Math.min(120, LEVELS)} уровней — там тебя ждёт письмо</span>`}</div>`);
  // старт внизу
  html.push(`<div class="banner start" style="top:${H - 132}px">${bichonSVG('chapa', 'happy')}<div><b>Для Оли</b><span>с любовью от Антона, детей и собак</span></div>${bichonSVG('pusha', 'happy')}</div>`);
  inner.insertAdjacentHTML('beforeend', html.join(''));

  // кружки уровней
  const cur = currentLevel(), frag = document.createDocumentFragment();
  for (let i = 1; i <= LEVELS; i++) {
    const W = WORLDS[worldOf(i)], st = save.stars[i] || 0, un = unlocked(i);
    const b = document.createElement('button');
    b.className = 'node' + (un ? '' : ' locked') + (i === cur && un ? ' cur' : '') + (i % 10 === 0 ? ' big' : '') + (st === 3 ? ' perfect' : '');
    b.style.left = posX(i) * 100 + '%'; b.style.top = posY(i) + 'px'; b.style.setProperty('--n', W.node);
    b.innerHTML = un ? `<span>${i}</span>` : LOCK;
    b.setAttribute('aria-label', `Уровень ${i}${st ? `, звёзд: ${st}` : ''}${un ? '' : ', закрыт'}`);
    if (st || (un && i < cur)) { const s = document.createElement('span'); s.className = 'st'; s.innerHTML = [1, 2, 3].map(q => starSVG(q <= st)).join(''); b.appendChild(s); }
    if (un) b.onclick = () => { sound.play('button'); openIntro(i); };
    else b.tabIndex = -1;
    frag.appendChild(b);
  }
  inner.appendChild(frag);
  // питомец ждёт у текущего уровня
  const px = posX(cur), pet = document.createElement('div');
  pet.className = 'map-pet'; pet.innerHTML = bichonSVG(cur % 2 ? 'chapa' : 'pusha', 'wait');
  pet.style.left = `calc(${(px > 0.5 ? px - 0.2 : px + 0.2) * 100}% - 36px)`; pet.style.top = (posY(cur) - 52) + 'px';
  inner.appendChild(pet);
  if (done) onTap($('#openLetter'), openLetter);

  let total = 0; for (const key in save.stars) total += save.stars[key];
  $('#totalStars').innerHTML = starSVG(true) + `<b>${total}</b><small>/ ${LEVELS * 3}</small>`;
}

export function scrollToCurrent() { const sc = $('#mapScroll'); sc.scrollTop = posY(currentLevel()) - sc.clientHeight * 0.55; }

/** Показать карту (и включить музыку мира текущего уровня). */
export function showMap(scroll = true) {
  show('map'); buildMap(); if (scroll) scrollToCurrent();
  sound.music(worldOf(currentLevel()));
}

export function initMap(onHome) {
  onTap($('#settingsBtn'), () => openSettings());
  onTap($('#homeBtn'), onHome);
}
