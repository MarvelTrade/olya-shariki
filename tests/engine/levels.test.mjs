// Генератор уровней совпадает со старым: снапшот tests/fixtures/levels-legacy.json снят
// со старого index.html (tools/snapshot-legacy-levels.mjs) ДО рефакторинга.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genLevel, LEVELS, makeRng } from '../../src/levels/index.js';
import { legacyGenLevel } from '../legacy/legacy.mjs';

const SNAP = JSON.parse(readFileSync(new URL('../fixtures/levels-legacy.json', import.meta.url), 'utf8'));

test('120 уровней в снапшоте', () => {
  assert.equal(LEVELS, 120);
  assert.equal(SNAP.length, 120);
});

test('genLevel(1..120) = снапшот старой версии (маски, цели, ходы, лёд, ящики, пороги)', () => {
  for (let n = 1; n <= LEVELS; n++) assert.deepEqual(JSON.parse(JSON.stringify(genLevel(n))), SNAP[n - 1], `уровень ${n}`);
});

test('genLevel совпадает со старым кодом и за пределами 120 (на будущее до 200)', () => {
  const old = legacyGenLevel();
  for (let n = 121; n <= 200; n++) assert.deepEqual(JSON.parse(JSON.stringify(genLevel(n))), JSON.parse(JSON.stringify(old.genLevel(n))), `уровень ${n}`);
});

test('makeRng детерминирован и совпадает со старым', () => {
  const old = legacyGenLevel().makeRng(12345), neu = makeRng(12345);
  for (let i = 0; i < 1000; i++) assert.equal(neu(), old());
});
