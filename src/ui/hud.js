// Верхняя панель: ходы, счёт, полоска звёзд, цели.
import { $ } from './app.js';
import { iconURL, starSVG } from '../render/draw.js';

const goalDone = (g, score) => (g.kind === 'score' ? score >= g.n : g.left <= 0);

/** Плашки целей. live — показывать остаток (left), иначе всего (n). */
export function buildGoals(el, goals, live) {
  el.innerHTML = goals.map((g, i) => {
    const img = `<img alt="" src="${iconURL(g.kind, g.c)}">`;
    if (g.kind === 'score') return `<div class="goal" data-i="${i}">${img}<b>${g.n.toLocaleString('ru-RU')}</b></div>`;
    return `<div class="goal" data-i="${i}">${img}<b>${live ? g.left : g.n}</b></div>`;
  }).join('');
}

/** Обновить HUD по снимку поля (step.board или game.snapshot()). */
export function updateHUD(b, cfg) {
  $('#moves').textContent = b.moves; $('#movesBox').classList.toggle('low', b.moves <= 5);
  $('#score').textContent = b.score.toLocaleString('ru-RU');
  const t3 = cfg.t3; $('#barFill').style.width = Math.min(100, b.score / t3 * 100) + '%';
  const allDone = b.goals.every(g => goalDone(g, b.score));
  const bar = $('#bar'); bar.querySelectorAll('.mk').forEach(e => e.remove());
  const marks = [cfg.t1 || Math.round(t3 * 0.25), cfg.t2, t3];
  marks.forEach(m => { const d = document.createElement('div'); d.className = 'mk'; d.style.left = Math.min(100, m / t3 * 100) + '%'; d.innerHTML = starSVG(b.score >= m && (m !== marks[0] || allDone || cfg.t1)); bar.appendChild(d); });
  b.goals.forEach((g, i) => {
    const el = $(`#goals [data-i="${i}"]`); if (!el) return;
    const done = goalDone(g, b.score);
    el.classList.toggle('done', done);
    if (g.kind !== 'score') el.querySelector('b').textContent = done ? '✓' : g.left;
    else if (done) el.querySelector('b').textContent = '✓';
  });
}
