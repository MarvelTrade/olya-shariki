// Экран игры: связывает движок (src/engine), рендер поля (src/render) и интерфейс.
// Движок считает ход целиком и отдаёт шаги; здесь мы их проигрываем и обрабатываем ввод.
import { app, $, persist, show, modal, closeModal, sound, onTap } from './app.js';
import { createGame } from '../engine/index.js';
import { genLevel, LEVELS, WORLDS } from '../levels/index.js';
import { createBoardView } from '../render/board-view.js';
import { bichonSVG, avatarSVG } from '../render/characters.js';
import { worldBackground } from '../render/worlds-art.js';
import { buildGoals, updateHUD, resetHUD } from './hud.js';
import { showMap } from './map.js';
import { openIntro } from './intro.js';
import { openSettings } from './settings.js';
import { showWin, showLose } from './result.js';
import { BOOSTERS } from './texts.js';

const HINT_AFTER = 5; // секунд бездействия до подсказки

/** Текущий уровень: { n, cfg, game, busy, extraUsed, booster, idle, wi } или null. */
let G = null;
let paused = false;
const canvas = $('#board');
const view = createBoardView(canvas, {
  onStep(step) {
    for (const s of step.sfx || []) sound.play(s[0], s[1]);
    if (G) updateHUD(step.board, G.cfg);
  },
});
const V = view.state;
const worldName = () => (WORLDS[G.wi] || WORLDS[0]).name;
const refreshHUD = () => updateHUD(G.game.snapshot(), G.cfg);
const setHint = text => { $('#hintline').textContent = text; };

export function startLevel(n) {
  const cfg = genLevel(n);
  const game = createGame(cfg, Math.random);
  const wi = cfg.world ?? Math.floor((n - 1) / 20);
  const g = G = { n, cfg, game, wi, busy: true, extraUsed: false, booster: null, idle: 0 };
  paused = false;
  view.reset(game);
  V.opts.vibrate = app.save.vibro !== false;
  V.arrow = cfg.tutorial?.arrow ? { from: cfg.tutorial.arrow.from, to: cfg.tutorial.arrow.to } : null;
  $('#game').style.background = worldBackground(wi);
  $('#lvlName').textContent = 'Уровень ' + n;
  show('game'); view.layout($('#boardWrap'));
  resetHUD(); buildGoals($('#goals'), game.state.goals, true); refreshHUD(); updateBoosters();
  setHint(cfg.tutorial?.text || worldName());
  $('#hintline').classList.toggle('tut', !!cfg.tutorial);
  sound.music(wi);
  view.waitSettled().then(() => { if (G === g) { g.busy = false; g.idle = 0; } });
}

export function toMap(scroll) { view.cancel(); G = null; showMap(scroll); }

/* ---------- ход ---------- */
async function trySwap(a, b) {
  if (!G || G.busy || paused || G.game.status !== 'play') return;
  const [ax, ay] = a, [bx, by] = b; if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return;
  V.selected = null;
  const g = G;
  const res = g.game.swap(a, b);
  if (res.reason === 'immovable') { sound.play('bad'); view.haptic(10); return; }
  g.busy = true; V.hint = null; g.idle = 0;
  await view.play(res.steps);
  if (!res.ok) { g.busy = false; return; }
  if (V.arrow) { V.arrow = null; setHint(worldName()); $('#hintline').classList.remove('tut'); }
  afterMove(g);
}
function afterMove(g) {
  if (G !== g) return;
  refreshHUD();
  if (g.game.isWon()) return win();
  if (g.game.isLost()) { g.busy = true; return lose(); }
  g.busy = false; g.idle = 0;
}

/* ---------- бустеры ---------- */
function boosterPic(k, emo) {
  if (k === 'masha') return avatarSVG('masha', { awake: emo === 'happy' });
  return bichonSVG(k, emo || 'wait');
}
function setBoosterEmo(k, emo, ms = 900) {
  const el = $(`#b${k[0].toUpperCase()}${k.slice(1)} .b-pic`); if (!el) return;
  el.innerHTML = boosterPic(k, emo); el.classList.add('acting');
  clearTimeout(el._t); el._t = setTimeout(() => { el.innerHTML = boosterPic(k); el.classList.remove('acting'); }, ms);
}
function updateBoosters() {
  const save = app.save;
  for (const k of ['chapa', 'pusha', 'masha']) {
    const b = $(`#b${k[0].toUpperCase()}${k.slice(1)}`), n = save.boost[k] || 0;
    b.querySelector('em').textContent = n; b.classList.toggle('empty', !(n > 0));
    b.setAttribute('aria-disabled', String(!(n > 0)));
    b.classList.toggle('active', !!G && G.booster === k);
  }
}
const canAct = () => G && !G.busy && !paused && G.game.status === 'play';

async function useChapa(x, y) {
  const g = G;
  if (!g.cfg.mask[y][x]) return;
  g.booster = null; app.save.boost.chapa--; persist(); updateBoosters(); setHint(worldName());
  g.busy = true; V.hint = null;
  setBoosterEmo('chapa', 'jump'); sound.play('barkChapa');
  view.popup('Гав!', x, y - 0.3, V.cs * 0.6, '#ffd0db'); view.paw(x, y);
  const res = g.game.hammer(x, y);
  await view.play(res.steps);
  afterMove(g);
}

function initBoosters() {
  const save = app.save;
  for (const k of ['chapa', 'pusha', 'masha']) $(`#b${k[0].toUpperCase()}${k.slice(1)} .b-pic`).innerHTML = boosterPic(k);
  onTap($('#bChapa'), () => {
    if (!canAct()) return;
    if (!(save.boost.chapa > 0)) { setHint('Чапа устал прыгать. Три звезды на уровне — и он снова в деле!'); setBoosterEmo('chapa', 'sad'); return; }
    G.booster = G.booster === 'chapa' ? null : 'chapa';
    setHint(G.booster ? BOOSTERS.chapa.hint : worldName());
    if (G.booster) setBoosterEmo('chapa', 'happy', 1200);
    updateBoosters();
  });
  onTap($('#bPusha'), async () => {
    if (!canAct()) return;
    if (!(save.boost.pusha > 0)) { setHint('Пуша спит. Три звезды — и он проснётся помогать.'); setBoosterEmo('pusha', 'sad'); return; }
    save.boost.pusha--; persist(); updateBoosters();
    setBoosterEmo('pusha', 'jump'); sound.play('barkPusha');
    const g = G; g.busy = true; V.hint = null;
    await view.play(g.game.shuffle().steps);
    if (G === g) { g.busy = false; g.idle = 0; }
  });
  onTap($('#bMasha'), () => {
    if (!canAct()) return;
    if (!(save.boost.masha > 0)) { setHint('Маша спит. Не будем будить — соберём три звезды.'); return; }
    save.boost.masha--; persist();
    G.game.addMoves(3); view.banner('Маша улыбнулась: +3 хода'); sound.play('masha');
    setBoosterEmo('masha', 'happy', 1400);
    refreshHUD(); updateBoosters();
  });
}

/* ---------- ввод: свайп или два тапа ---------- */
function initInput() {
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (!G || paused) return; sound.unlock();
    const c = view.cellAt(e); if (!c) return;
    G.idle = 0; if (!G.busy) V.hint = null;
    if (G.booster === 'chapa') { if (!G.busy && G.game.status === 'play') useChapa(c[0], c[1]); return; }
    drag = { c, x: e.clientX, y: e.clientY, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* старые браузеры */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.moved) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > V.cs * 0.35) { drag.moved = true; const [x, y] = drag.c; const t = Math.abs(dx) > Math.abs(dy) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dy)]; trySwap(drag.c, t); }
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && !drag.moved && G && !G.busy) {
      const c = drag.c, s = V.selected;
      if (s && Math.abs(s[0] - c[0]) + Math.abs(s[1] - c[1]) === 1) trySwap(s, c);
      else if (s && s[0] === c[0] && s[1] === c[1]) V.selected = null;
      else if (G.game.movable(c[0], c[1])) { V.selected = c; sound.play('swap'); }
    }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
}

/* ---------- пауза ---------- */
function pause() {
  if (!G || paused) return;
  paused = true; sound.music(null);
  const m = modal(`
    <div class="pause-pets">${bichonSVG('chapa', 'wait')}${bichonSVG('pusha', 'wait')}</div>
    <h2>Пауза</h2><p class="sub">Чапа и Пуша ждут. Терпеливо. Почти.</p>
    <div class="btns">
      <button class="btn big" id="pResume">Продолжить</button>
      <button class="btn alt" id="pSettings">Настройки</button>
      <div class="row"><button class="btn alt" id="pRestart">Заново</button><button class="btn alt" id="pMap">На карту</button></div>
    </div>`, { cls: 'pause', onClose: resume });
  onTap(m.querySelector('#pResume'), closeModal);
  onTap(m.querySelector('#pSettings'), () => { closeModal(); paused = true; sound.music(null); openSettings(() => pause2()); });
  onTap(m.querySelector('#pRestart'), () => { const n = G.n; closeModal(); startLevel(n); });
  onTap(m.querySelector('#pMap'), () => { closeModal(); toMap(true); });
}
function pause2() { paused = false; pause(); }
function resume() { paused = false; if (G) { G.idle = 0; sound.music(G.wi); } }

/* ---------- победа / поражение ---------- */
function win() {
  const save = app.save, g = G;
  const n = g.n, score = g.game.state.score, st = g.game.stars(), prev = save.stars[n] || 0;
  if (st > prev) save.stars[n] = st; if (score > (save.best[n] || 0)) save.best[n] = score;
  let gift = null;
  if (st === 3 && prev < 3) { const k = ['chapa', 'pusha', 'masha'][Math.floor(Math.random() * 3)]; save.boost[k] = (save.boost[k] || 0) + 1; gift = k; }
  persist(); sound.music(null);
  showWin({ n, score, stars: st, gift, last: n >= Math.min(120, LEVELS), best: score >= (save.best[n] || 0) && prev > 0 }, {
    next: n < LEVELS ? () => { toMap(false); openIntro(n + 1); } : null,
    again: () => startLevel(n),
    map: () => toMap(true),
  });
}
function lose() {
  const S = G.game.state; sound.music(null);
  showLose({ goals: S.goals, score: S.score, extraUsed: G.extraUsed }, {
    extra: () => { G.extraUsed = true; G.game.addMoves(5); sound.play('woof'); view.banner('+5 ходов от Пуши!'); refreshHUD(); G.busy = false; G.idle = 0; sound.music(G.wi); },
    again: () => startLevel(G.n),
    map: () => toMap(true),
  });
}

/* ---------- цикл кадров ---------- */
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G && app.screen === 'game') {
    view.update(dt);
    if (!G.busy && !paused && G.game.status === 'play' && !G.booster) { G.idle += dt; if (G.idle > HINT_AFTER && !V.hint && !V.arrow) V.hint = G.game.findMove(); }
    view.draw();
  }
  requestAnimationFrame(loop);
}
let last = 0;

export function initGameScreen() {
  initBoosters();
  initInput();
  onTap($('#pauseBtn'), pause);
  window.addEventListener('resize', () => { if (app.screen === 'game' && G) view.layout($('#boardWrap')); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && app.screen === 'game' && !paused && $('#modal').hidden) pause(); });
  last = performance.now();
  requestAnimationFrame(loop);
}

/** Для отладки и автотестов (Playwright): window.__olya. */
export const debug = { get G() { return G; }, view, startLevel, pause };
