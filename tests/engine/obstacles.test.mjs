// Гравитация через дыры маски, лёд, ящики-подарки, заморозка.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, first, ids } from './helpers.mjs';

test('гравитация: фишки падают сквозь дыру маски, сверху появляются новые', () => {
  const g = game([
    '. 2 .',
    '. 3 .',
    '. _ .',
    '. 0 .',
    '0 . 0',
  ]);
  const before = ids(g.snapshot());
  const res = g.swap([1, 3], [1, 4]);
  const fall = first(res, 'fall');
  const after = ids(fall.board);
  assert.equal(after[4][1], before[4][1]);  // фишка-наполнитель с (1,4) поднялась на (1,3) и упала обратно
  assert.equal(after[3][1], before[1][1]);  // (1,1) пролетела сквозь дыру (1,2) на (1,3)
  assert.equal(after[1][1], before[0][1]);  // (1,0) → (1,1)
  assert.equal(after[2][1], null);          // дыра пуста
  assert.ok(after[0][1] > Math.max(...before.flat().filter(v => v != null))); // сверху — новая фишка
  assert.ok(fall.spawn.some(s => s.x === 1));
  // после падения поле полное
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (!(x === 1 && y === 2)) assert.ok(g.state.tiles[y][x], `${x},${y}`);
});

test('гравитация: в столбце без дыр всё сдвигается вниз', () => {
  const g = game(['. . . .', '. . . .', '0 0 . 0', '. . 0 .']);
  const before = ids(g.snapshot());
  const res = g.swap([2, 3], [2, 2]);
  const after = ids(first(res, 'fall').board);
  assert.equal(after[2][0], before[1][0]);
  assert.equal(after[1][0], before[0][0]);
});

test('лёд в 1 слой тает от взрыва, цель уменьшается', () => {
  const g = game(['. . .', '. . .'], { ice: ['0 1 0', '0 0 0'], goals: [{ kind: 'ice', n: 1, left: 1 }] });
  g.hammer(1, 0);
  assert.equal(g.state.ice[0][1], 0);
  assert.equal(g.state.goals[0].left, 0);
  assert.equal(g.isWon(), true);
});

test('лёд в 2 слоя: после одного взрыва остаётся 1 слой, цель не меняется', () => {
  const g = game(['. . .', '. . .'], { ice: ['0 2 0', '0 0 0'], goals: [{ kind: 'ice', n: 1, left: 1 }] });
  const res = g.hammer(1, 0);
  assert.equal(g.state.ice[0][1], 1);
  assert.equal(g.state.goals[0].left, 1);
  assert.ok(first(res, 'blast').hits.some(h => h.kind === 'ice' && h.left === 1));
});

test('лёд под матчем тает', () => {
  const g = game(['0 0 . .', '. . 0 .'], { ice: ['1 1 1 0', '0 0 0 0'], goals: [{ kind: 'ice', n: 3, left: 3 }] });
  g.swap([2, 1], [2, 0]);
  assert.deepEqual(g.state.ice[0], [0, 0, 0, 0]);
  assert.equal(g.state.goals[0].left, 0);
});

test('ящик открывается от соседнего матча', () => {
  const g = game(['. # . .', '0 0 . .', '. . 0 .'], { goals: [{ kind: 'crate', n: 1, left: 1 }] });
  const res = g.swap([2, 2], [2, 1]);
  assert.equal(g.state.crate[0][1], 0);
  assert.equal(g.state.goals[0].left, 0);
  assert.ok(first(res, 'blast').hits.some(h => h.kind === 'crate' && h.opened));
});

test('двойной ящик: после удара остаётся 1 слой, фишки не падают сквозь ящик', () => {
  const g = game(['. 2 . .', '. #2 . .', '0 0 . .', '. . 0 .'], { goals: [{ kind: 'crate', n: 1, left: 1 }] });
  const above = g.state.tiles[0][1].id;
  const res = g.swap([2, 3], [2, 2]);
  assert.equal(first(res, 'blast').board.crate[1][1], 1);
  assert.equal(g.state.goals[0].left, 1);
  assert.equal(first(res, 'fall').board.tiles[0][1].id, above); // фишка над ящиком осталась на месте
  assert.equal(first(res, 'fall').board.tiles[1][1], null);     // в клетке ящика фишки нет
});

test('ящик бьётся один раз за взрыв, даже если задет и полосой, и соседством', () => {
  const g = game(['. . . .', '1h . #2 .', '. . . .'], { goals: [{ kind: 'crate', n: 1, left: 1 }] });
  g.hammer(0, 1);
  assert.equal(g.state.crate[1][2], 1);
});

test('заморозка: замороженная фишка не двигается', () => {
  const g = game(['0 1* .', '. . .']);
  const res = g.swap([0, 0], [1, 0]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'immovable');
  assert.equal(g.movable(1, 0), false);
});

test('заморозка: матч снимает лёд с фишки, фишка остаётся', () => {
  const g = game(['0 0* . .', '. . 0 .'], { goals: [{ kind: 'lock', n: 1, left: 1 }] });
  const id = g.state.tiles[0][1].id;
  const res = g.swap([2, 1], [2, 0]);
  const b = first(res, 'blast');
  assert.equal(b.removed.length, 2);
  assert.equal(b.board.tiles[0][1].id, id);
  assert.equal(b.board.tiles[0][1].lock, 0);
  assert.equal(g.state.goals[0].left, 0);
});

test('двойная заморозка: один удар снимает один слой', () => {
  const g = game(['. . .', '. 3** .'], { goals: [{ kind: 'lock', n: 1, left: 1 }] });
  g.hammer(1, 1);
  assert.equal(g.state.tiles[1][1].lock, 1);
  assert.equal(g.state.goals[0].left, 1);
  g.hammer(1, 1);
  assert.equal(g.state.tiles[1][1].lock, 0);
  assert.equal(g.state.goals[0].left, 0);
});

test('заморозка: замороженная фишка не падает, место под ней заполняется сбоку', () => {
  const g = game(['. . . .', '4* . . .', '0 0 . 0', '. . 0 .']);
  const id = g.state.tiles[1][0].id;
  const res = g.swap([2, 3], [2, 2]);
  const fall = first(res, 'fall');
  assert.equal(fall.board.tiles[1][0].id, id);
  assert.ok(fall.board.tiles[2][0], 'клетка под замороженной заполнена');
});
