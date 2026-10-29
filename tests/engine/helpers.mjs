// Помощники для тестов движка: поле задаётся строками.
// Токены (через пробел): 0..5 — цвет; суффикс h/v/b — спецфишка (полоса/полоса/бомба); C — радуга (цвет 5);
// * — заморозка (** — двойная); _ — дыра в маске; # — ящик (#2 — двойной); . — «наполнитель» без матчей.
import { createGame } from '../../src/engine/index.js';
import { makeRng } from '../../src/levels/index.js';

/** Цвет-наполнитель 1..4 без троек ни по горизонтали, ни по вертикали. */
export const fill = (x, y) => ((x + 2 * y) % 4) + 1;

export function parse(rows) {
  const toks = rows.map(r => r.trim().split(/\s+/));
  const h = toks.length, w = toks[0].length;
  const mask = [], crate = [], board = [];
  for (let y = 0; y < h; y++) {
    mask.push([]); crate.push([]); board.push([]);
    for (let x = 0; x < w; x++) {
      const t = toks[y][x];
      if (t === '_') { mask[y].push(false); crate[y].push(0); board[y].push(null); continue; }
      mask[y].push(true);
      if (t[0] === '#') { crate[y].push(Number(t.slice(1) || 1)); board[y].push(null); continue; }
      crate[y].push(0);
      if (t === '.') { board[y].push(fill(x, y)); continue; }
      const lock = (t.match(/\*/g) || []).length;
      const body = t.replace(/\*/g, '');
      if (body === 'C') { board[y].push({ c: 5, sp: 'c', lock }); continue; }
      const c = Number(body[0]);
      const sp = body[1] || null;
      board[y].push({ c, sp, lock });
    }
  }
  return { w, h, mask, crate, board };
}

/**
 * Игра по строкам поля.
 * @param {string[]} rows
 * @param {object} [o] ice: строки цифр, goals, moves, colors, seed
 */
export function game(rows, o = {}) {
  const { w, h, mask, crate, board } = parse(rows);
  const ice = o.ice ? o.ice.map(r => r.trim().split(/\s+/).map(Number)) : mask.map(r => r.map(() => 0));
  const cfg = {
    n: 0, w, h, mask, colors: o.colors ?? 5, goals: o.goals ?? [{ kind: 'score', n: 1e9, left: 1e9 }],
    ice, crate, locks: 0, lockDouble: 0, moves: o.moves ?? 20, t1: 0, t2: 1000, t3: 2000, world: 0,
  };
  return createGame(cfg, makeRng(o.seed ?? 42), { board });
}

/** Первый шаг заданного типа. */
export const first = (res, type) => res.steps.find(s => s.type === type);
/** Удалённые в первом взрыве клетки как "x,y". */
export const removedCells = res => first(res, 'blast').removed.map(r => `${r.x},${r.y}`).sort();
/** Поле как сетка id (для проверки перемещений). */
export const ids = board => board.tiles.map(r => r.map(t => (t ? t.id : null)));
