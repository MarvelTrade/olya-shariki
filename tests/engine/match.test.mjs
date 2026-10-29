// Матчи 3/4/5, L/T → бомба, 5 в ряд → радуга, неверный ход.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, first, removedCells } from './helpers.mjs';

test('3 в ряд: убираются 3 фишки, спецфишки нет, ход потрачен', () => {
  const g = game([
    '0 0 . . . .',
    '. . 0 . . .',
    '. . . . . .',
    '. . . . . .',
  ]);
  const res = g.swap([2, 1], [2, 0]);
  assert.equal(res.ok, true);
  assert.deepEqual(removedCells(res), ['0,0', '1,0', '2,0']);
  assert.equal(first(res, 'blast').created.length, 0);
  assert.equal(g.state.moves, 19);
  assert.ok(g.state.score >= 60);
});

test('4 в ряд по горизонтали → вертикальная полоса на месте хода', () => {
  const g = game([
    '0 0 . 0 . .',
    '. . 0 . . .',
    '. . . . . .',
    '. . . . . .',
  ]);
  const res = g.swap([2, 1], [2, 0]);
  const b = first(res, 'blast');
  assert.deepEqual(b.created.map(c => [c.x, c.y, c.sp]), [[2, 0, 'v']]);
  assert.deepEqual(removedCells(res), ['0,0', '1,0', '3,0']); // сама полоса защищена и остаётся
});

test('4 в ряд по вертикали → горизонтальная полоса', () => {
  const g = game([
    '0 . . .',
    '. 0 . .',
    '0 . . .',
    '0 . . .',
    '. . . .',
  ]);
  const res = g.swap([1, 1], [0, 1]);
  assert.deepEqual(first(res, 'blast').created.map(c => [c.x, c.y, c.sp]), [[0, 1, 'h']]);
});

test('5 в ряд → радуга', () => {
  const g = game([
    '0 0 . 0 0 .',
    '. . 0 . . .',
    '. . . . . .',
    '. . . . . .',
  ]);
  const res = g.swap([2, 1], [2, 0]);
  assert.deepEqual(first(res, 'blast').created.map(c => [c.x, c.y, c.sp]), [[2, 0, 'c']]);
  assert.equal(first(res, 'blast').removed.length, 4);
});

test('L-фигура → бомба', () => {
  const g = game([
    '0 0 . 0 .',
    '. . 0 . .',
    '. . 0 . .',
    '. . . . .',
  ]);
  const res = g.swap([3, 0], [2, 0]);
  assert.deepEqual(first(res, 'blast').created.map(c => [c.x, c.y, c.sp]), [[2, 0, 'b']]);
  assert.equal(first(res, 'blast').removed.length, 4);
});

test('T-фигура → бомба', () => {
  const g = game([
    '. 0 . .',
    '0 . 0 .',
    '. 0 . .',
    '. 0 . .',
    '. . . .',
  ]);
  const res = g.swap([1, 0], [1, 1]);
  assert.deepEqual(first(res, 'blast').created.map(c => [c.x, c.y, c.sp]), [[1, 1, 'b']]);
});

test('ход без матча возвращается и не тратит ход', () => {
  const g = game([
    '. . . .',
    '. . . .',
    '. . . .',
  ]);
  const res = g.swap([0, 0], [1, 0]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'noMatch');
  assert.deepEqual(res.steps.map(s => s.type), ['swap', 'swapBack']);
  assert.equal(g.state.moves, 20);
  assert.equal(g.state.tiles[0][0].c, 1);
});

test('не соседние клетки и дыры — ход отклонён', () => {
  const g = game([
    '. . _ .',
    '. . . .',
  ]);
  assert.equal(g.swap([0, 0], [2, 1]).reason, 'notAdjacent');
  assert.equal(g.swap([1, 0], [2, 0]).reason, 'immovable');
});
