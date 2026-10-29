// Верхняя панель: ходы, счёт, полоска звёзд, цели. Цели «подпрыгивают», когда уменьшаются.
import { $ } from './app.js';
import { iconURL, starSVG } from '../render/draw.js';

const goalDone = (g, score) => (g.kind === 'score' ? score >= g.n : g.left <= 0);
const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };

/** Плашки целей. live — показывать остаток (left), иначе всего (n). */
export function buildGoals(el, goals, live) {
  el.innerHTML = goals.map((g, i) => {
    const img = `<img alt="" src="${iconURL(g.kind, g.c)}">`;
    const val = g.kind === 'score' ? g.n.toLocaleString('ru-RU') : live ? g.left : g.n;
    return `<div class="goal" data-i="${i}" data-v="${val}">${img}<b>${val}</b></div>`;
  }).join('');
}

let lastMoves = null, lastScore = null;
/** Обновить HUD по снимку поля (step.board или game.snapshot()). */
export function updateHUD(b, cfg) {
  const mv = $('#moves');
  if (lastMoves !== b.moves) { mv.textContent = b.moves; if (lastMoves !== null) bump($('#movesBox')); lastMoves = b.moves; }
  $('#movesBox').classList.toggle('low', b.moves <= 5);
  if (lastScore !== b.score) { $('#score').textContent = b.score.toLocaleString('ru-RU'); lastScore = b.score; }
  const t3 = cfg.t3 || 1; $('#barFill').style.width = Math.min(100, b.score / t3 * 100) + '%';
  const allDone = b.goals.every(g => goalDone(g, b.score));
  const bar = $('#bar'); const marks = [cfg.t1 || Math.round(t3 * 0.25), cfg.t2, t3];
  let mk = bar.querySelectorAll('.mk');
  if (mk.length !== 3) { mk.forEach(e => e.remove()); marks.forEach(m => { const d = document.createElement('div'); d.className = 'mk'; d.style.left = Math.min(100, m / t3 * 100) + '%'; bar.appendChild(d); }); mk = bar.querySelectorAll('.mk'); }
  marks.forEach((m, i) => {
    const on = b.score >= m && (i !== 0 || allDone || !!cfg.t1);
    const d = mk[i]; if (d.dataset.on !== String(on)) { d.dataset.on = String(on); d.innerHTML = starSVG(on); if (on) bump(d); }
  });
  b.goals.forEach((g, i) => {
    const el = $(`#goals [data-i="${i}"]`); if (!el) return;
    const done = goalDone(g, b.score);
    const val = done ? '✓' : g.kind === 'score' ? g.n.toLocaleString('ru-RU') : String(g.left);
    if (el.dataset.v !== val) { el.dataset.v = val; el.querySelector('b').textContent = val; bump(el); }
    el.classList.toggle('done', done);
  });
}
/** Сбросить кэш HUD (новый уровень). */
export function resetHUD() { lastMoves = null; lastScore = null; const bar = $('#bar'); bar?.querySelectorAll('.mk').forEach(e => e.remove()); }
