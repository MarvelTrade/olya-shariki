// Срабатывание спецфишек и их комбинации.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, first, removedCells } from './helpers.mjs';

const all = (w, h) => { const o = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.push(`${x},${y}`); return o.sort(); };
const diamond = (cx, cy, r, w, h) => {
  const o = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (Math.abs(dx) + Math.abs(dy) <= r && x >= 0 && y >= 0 && x < w && y < h) o.push(`${x},${y}`);
  }
  return o.sort();
};

test('горизонтальная полоса сносит строку', () => {
  const g = game(['. . . . .', '. . . . .', '. . 1h . .', '. . . . .']);
  const res = g.hammer(2, 2);
  assert.deepEqual(removedCells(res), ['0,2', '1,2', '2,2', '3,2', '4,2']);
  assert.deepEqual(first(res, 'blast').fx.map(f => f.type), ['h']);
});

test('вертикальная полоса сносит столбец', () => {
  const g = game(['. . . .', '. 1v . .', '. . . .']);
  assert.deepEqual(removedCells(g.hammer(1, 1)), ['1,0', '1,1', '1,2']);
});

test('бомба сносит ромб радиуса 2', () => {
  const g = game(['. . . . .', '. . . . .', '. . 1b . .', '. . . . .', '. . . . .']);
  assert.deepEqual(removedCells(g.hammer(2, 2)), diamond(2, 2, 2, 5, 5));
});

test('цепная реакция: полоса задевает бомбу', () => {
  const g = game(['. . . . .', '. . . . .', '1h . . 2b .', '. . . . .', '. . . . .']);
  const cells = removedCells(g.hammer(0, 2));
  for (const k of diamond(3, 2, 2, 5, 5)) assert.ok(cells.includes(k), k);
});

test('радуга + обычная фишка: убирает все фишки этого цвета', () => {
  const g = game([
    'C 0 . .',
    '. . 0 .',
    '0 . . .',
  ]);
  const res = g.swap([0, 0], [1, 0]);
  assert.equal(res.ok, true);
  const b = first(res, 'blast');
  assert.equal(b.removed.filter(r => r.c === 0).length, 3);
  assert.equal(b.removed.length, 4); // + сама радуга
  assert.equal(g.state.moves, 19);
});

test('радуга + радуга: всё поле', () => {
  const g = game(['C C . .', '. . . .', '. . . .']);
  const res = g.swap([0, 0], [1, 0]);
  assert.deepEqual(removedCells(res), all(4, 3));
  assert.equal(first(res, 'blast').banner, 'Радужный взрыв!');
});

test('радуга + полоса: фишки цвета превращаются в полосы и взрываются', () => {
  const g = game(['C 0h . . .', '. . . 0 .', '. 0 . . .', '. . . . .']);
  const res = g.swap([0, 0], [1, 0]);
  const mark = first(res, 'mark');
  assert.ok(mark, 'есть шаг пометки');
  const marked = mark.board.tiles.flat().filter(t => t && t.c === 0 && (t.sp === 'h' || t.sp === 'v'));
  assert.equal(marked.length, 3); // 2 новые полосы + исходная
  assert.ok(first(res, 'blast').removed.length >= 6);
});

test('бомба + бомба: ромб радиуса 4', () => {
  const g = game(Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => (y === 4 && x === 4 ? '1b' : y === 4 && x === 5 ? '2b' : '.')).join(' ')));
  const res = g.swap([4, 4], [5, 4]);
  assert.deepEqual(removedCells(res), diamond(5, 4, 4, 9, 9));
  assert.equal(first(res, 'blast').banner, 'Бабах!');
});

test('бомба + полоса: супер-крест 3 строки и 3 столбца', () => {
  const g = game(Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => (y === 3 && x === 3 ? '1b' : y === 3 && x === 4 ? '2h' : '.')).join(' ')));
  const res = g.swap([3, 3], [4, 3]);
  const exp = new Set();
  for (let i = -1; i <= 1; i++) for (let k = 0; k < 7; k++) { exp.add(`${k},${3 + i}`); exp.add(`${4 + i},${k}`); }
  assert.deepEqual(removedCells(res), [...exp].sort());
  assert.equal(first(res, 'blast').banner, 'Супер-крест!');
});

test('полоса + полоса: крест (строка и столбец)', () => {
  const g = game(['. . . . .', '. . . . .', '. 1h 2v . .', '. . . . .']);
  const res = g.swap([1, 2], [2, 2]);
  const exp = new Set();
  for (let k = 0; k < 5; k++) exp.add(`${k},2`);
  for (let k = 0; k < 4; k++) exp.add(`2,${k}`);
  assert.deepEqual(removedCells(res), [...exp].sort());
});
