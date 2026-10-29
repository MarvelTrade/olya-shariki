// Экран игры: связывает движок (src/engine), рендер поля (src/render) и интерфейс.
// Движок считает ход целиком и отдаёт шаги; здесь мы их проигрываем и обрабатываем ввод.
import { app, $, persist, show, modal, closeModal } from './app.js';
import { createGame } from '../engine/index.js';
import { genLevel, LEVELS, WORLDS } from '../levels/index.js';
import { createBoardView } from '../render/board-view.js';
import { drawBichon, drawPiece, bichonCanvas, iconURL, starSVG } from '../render/draw.js';
import { sfx, playSfx, unlockAudio } from '../audio/sound.js';
import { buildGoals, updateHUD } from './hud.js';
import { buildMap, scrollToCurrent } from './map.js';
import { openIntro } from './intro.js';
import { WIN_MSG } from './texts.js';

/** Текущий уровень: { n, cfg, game, busy, extraUsed, booster, idle } или null. */
let G = null;
const canvas = $('#board');
const view = createBoardView(canvas, {
  onStep(step) {
    for (const s of step.sfx || []) playSfx(s);
    if (G) updateHUD(step.board, G.cfg);
  },
});
const V = view.state;
const worldName = () => WORLDS[G.cfg.world].name;
const refreshHUD = () => updateHUD(G.game.snapshot(), G.cfg);

export function startLevel(n) {
  const cfg = genLevel(n);
  const game = createGame(cfg, Math.random);
  const g = G = { n, cfg, game, busy: true, extraUsed: false, booster: null, idle: 0 };
  view.reset(game);
  const W = WORLDS[cfg.world];
  $('#game').style.background = `linear-gradient(180deg,${W.bg[0]},${W.bg[1]})`;
  $('#lvlName').textContent = 'Уровень ' + n;
  show('game'); view.layout($('#boardWrap'));
  buildGoals($('#goals'), game.state.goals, true); refreshHUD(); updateBoosters();
  $('#hintline').textContent = W.name;
  view.waitSettled().then(() => { if (G === g) { g.busy = false; g.idle = 0; } });
}

export function toMap(scroll) {
  view.cancel(); show('map'); buildMap(); if (scroll) scrollToCurrent();
}

/* ---------- ход ---------- */
async function trySwap(a, b) {
  if (!G || G.busy || G.game.status !== 'play') return;
  const [ax, ay] = a, [bx, by] = b; if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return;
  V.selected = null;
  const g = G;
  const res = g.game.swap(a, b);
  if (res.reason === 'immovable') { sfx.bad(); return; }
  g.busy = true; V.hint = null; g.idle = 0;
  await view.play(res.steps);
  if (!res.ok) { g.busy = false; return; }
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
function updateBoosters() {
  const save = app.save;
  [['chapa', '#bChapa'], ['pusha', '#bPusha'], ['masha', '#bMasha']].forEach(([k, id]) => {
    const b = $(id); b.querySelector('em').textContent = save.boost[k] || 0; b.disabled = !(save.boost[k] > 0); b.classList.toggle('active', !!G && G.booster === k);
  });
}
const canAct = () => G && !G.busy && G.game.status === 'play';

async function useChapa(x, y) {
  const g = G;
  if (!g.cfg.mask[y][x]) return;
  g.booster = null; app.save.boost.chapa--; persist(); updateBoosters(); $('#hintline').textContent = worldName();
  g.busy = true; V.hint = null;
  view.popup('Гав!', x, y - 0.3, V.cs * 0.55, '#ff5c8a');
  const res = g.game.hammer(x, y);
  await view.play(res.steps);
  afterMove(g);
}

function initBoosters() {
  const save = app.save;
  $('#bChapa').addEventListener('click', () => {
    if (!canAct() || !(save.boost.chapa > 0)) return;
    G.booster = G.booster === 'chapa' ? null : 'chapa';
    $('#hintline').textContent = G.booster ? 'Нажми на шарик, коробку или лёд — Чапа прыгнет туда' : worldName();
    updateBoosters();
  });
  $('#bPusha').addEventListener('click', async () => {
    if (!canAct() || !(save.boost.pusha > 0)) return;
    save.boost.pusha--; persist(); updateBoosters();
    const g = G; g.busy = true; V.hint = null;
    await view.play(g.game.shuffle().steps);
    g.busy = false; g.idle = 0;
  });
  $('#bMasha').addEventListener('click', () => {
    if (!canAct() || !(save.boost.masha > 0)) return;
    save.boost.masha--; persist();
    G.game.addMoves(3); view.banner('Маша улыбнулась: +3 хода'); sfx.masha();
    refreshHUD(); updateBoosters();
  });
  // иконки бустеров
  const d = (id, fn) => { const c = $(id + ' canvas'), x = c.getContext('2d'); fn(x); };
  d('#bChapa', x => drawBichon(x, 44, 47, 72, true)); d('#bPusha', x => drawBichon(x, 44, 47, 72, false)); d('#bMasha', x => drawPiece(x, 3, 44, 44, 30));
}

/* ---------- ввод: свайп или два тапа ---------- */
function initInput() {
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (!G) return; unlockAudio();
    const c = view.cellAt(e); if (!c) return;
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
      else if (G.game.movable(c[0], c[1])) V.selected = c;
    }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
}

/* ---------- победа / поражение ---------- */
function win() {
  const save = app.save;
  const n = G.n, score = G.game.state.score, st = G.game.stars(), prev = save.stars[n] || 0;
  if (st > prev) save.stars[n] = st; if (score > (save.best[n] || 0)) save.best[n] = score;
  let gift = '';
  if (st === 3 && prev < 3) { const k = ['chapa', 'pusha', 'masha'][Math.floor(Math.random() * 3)]; save.boost[k] = (save.boost[k] || 0) + 1; gift = `<p class="small">Подарок за три звезды: +1 ${k === 'chapa' ? 'прыжок Чапы' : k === 'pusha' ? 'перемешка Пуши' : 'улыбка Маши'}</p>`; }
  persist(); sfx.win();
  const m = modal(`<h2>${['', 'Получилось!', 'Здорово!', 'Идеально!'][st]}</h2>
    <div class="bigstars">${[1, 2, 3].map(i => starSVG(i <= st)).join('')}</div>
    <p class="sub">${score.toLocaleString('ru-RU')} очков</p>
    <div class="petrow" id="mPets"></div>
    <p class="msg">${WIN_MSG[Math.floor(Math.random() * WIN_MSG.length)]}</p>${gift}
    <div class="btns">${n < LEVELS ? '<button class="btn" id="mNext">Дальше</button>' : '<p class="msg">Оля, ты прошла все 120 уровней! Семья гордится тобой.</p>'}
    <button class="btn alt" id="mAgain">Ещё раз</button><button class="btn alt" id="mMap">На карту</button></div>`);
  m.querySelector('#mPets').append(bichonCanvas(80, true), bichonCanvas(80, false));
  const nx = m.querySelector('#mNext'); if (nx) nx.onclick = () => { closeModal(); toMap(false); openIntro(n + 1); };
  m.querySelector('#mAgain').onclick = () => { closeModal(); startLevel(n); };
  m.querySelector('#mMap').onclick = () => { closeModal(); toMap(true); };
}
function lose() {
  sfx.lose();
  const S = G.game.state;
  const left = S.goals.filter(g => (g.kind === 'score' ? S.score < g.n : g.left > 0)).map(g => `<div class="goal"><img alt="" src="${iconURL(g.kind, g.c)}"><b>${g.kind === 'score' ? (g.n - S.score).toLocaleString('ru-RU') : g.left}</b></div>`).join('');
  const m = modal(`<h2>Ходы кончились</h2><p class="sub">Осталось совсем чуть-чуть:</p><div class="goals">${left}</div>
    <div class="petrow" id="mPets"></div>
    <div class="btns">${G.extraUsed ? '' : '<button class="btn gold" id="mExtra">Пуша принёс +5 ходов</button>'}
    <button class="btn" id="mAgain">Заново</button><button class="btn alt" id="mMap">На карту</button></div>`);
  m.querySelector('#mPets').append(bichonCanvas(80, false));
  const ex = m.querySelector('#mExtra');
  if (ex) ex.onclick = () => { closeModal(); G.extraUsed = true; G.game.addMoves(5); sfx.woof(); view.banner('+5 ходов от Пуши!'); refreshHUD(); G.busy = false; G.idle = 0; };
  m.querySelector('#mAgain').onclick = () => { closeModal(); startLevel(G.n); };
  m.querySelector('#mMap').onclick = () => { closeModal(); toMap(true); };
}

/* ---------- цикл кадров ---------- */
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G && app.screen === 'game') {
    view.update(dt);
    if (!G.busy && G.game.status === 'play') { G.idle += dt; if (G.idle > 6 && !V.hint) V.hint = G.game.findMove(); }
    view.draw();
  }
  requestAnimationFrame(loop);
}
let last = 0;

export function initGameScreen() {
  initBoosters();
  initInput();
  $('#backBtn').addEventListener('click', () => toMap(true));
  window.addEventListener('resize', () => { if (app.screen === 'game' && G) view.layout($('#boardWrap')); });
  last = performance.now();
  requestAnimationFrame(loop);
}

/** Для отладки и автотестов (Playwright): window.__olya. */
export const debug = { get G() { return G; }, view };
