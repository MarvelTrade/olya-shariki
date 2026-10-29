// Дифференциальный тест: новый движок и СТАРЫЙ код (из tests/fixtures/legacy-index.html)
// с одинаковым rng обязаны после каждого хода давать одно и то же поле, счёт, ходы и цели.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyGame, legacySnapshot } from '../legacy/legacy.mjs';
import { createGame } from '../../src/engine/index.js';
import { genLevel, makeRng } from '../../src/levels/index.js';

function newSnapshot(game) {
  const S = game.state;
  return {
    tiles: S.tiles.map(row => row.map(t => (t ? { c: t.c, sp: t.sp || null, lock: t.lock } : null))),
    ice: S.ice.map(r => r.slice()), crate: S.crate.map(r => r.slice()),
    score: S.score, moves: S.moves, goals: S.goals.map(g => g.left),
  };
}

async function play(level, seed, maxMoves = 60) {
  const old = legacyGame(level, makeRng(seed));
  const neu = createGame(genLevel(level), makeRng(seed));
  assert.deepEqual(newSnapshot(neu), legacySnapshot(old), `ур.${level} сид ${seed}: стартовое поле`);
  const pick = makeRng(seed * 31 + 7); // выбор хода — отдельный rng, одинаковый для обоих
  for (let i = 0; i < maxMoves; i++) {
    if (neu.isWon() || neu.isLost()) break;
    const r = pick();
    // иногда — бустеры, иногда — неверный ход, обычно — случайный верный ход
    if (r < 0.04) {
      const x = Math.floor(pick() * neu.state.w), y = Math.floor(pick() * neu.state.h);
      neu.hammer(x, y); await old.useChapa(x, y);
    } else if (r < 0.07) {
      neu.shuffle(); await old.pusha();
    } else if (r < 0.12) {
      const x = Math.floor(pick() * (neu.state.w - 1)), y = Math.floor(pick() * neu.state.h);
      neu.swap([x, y], [x + 1, y]); await old.trySwap([x, y], [x + 1, y]);
    } else {
      const ms = neu.findMoves();
      assert.deepEqual(ms[0] || null, JSON.parse(JSON.stringify(old.findMove())), 'findMove совпадает');
      if (!ms.length) break;
      const [a, b] = ms[Math.floor(pick() * ms.length)];
      neu.swap(a, b); await old.trySwap(a, b);
    }
    assert.deepEqual(newSnapshot(neu), legacySnapshot(old), `ур.${level} сид ${seed}: после действия ${i}`);
    if (neu.isLost() && pick() < 0.5) { neu.addMoves(5); old.addMoves(5); }
  }
  if (neu.isWon()) assert.equal(old.result, 'win');
}

const LEVELS = [1, 2, 3, 4, 5, 9, 10, 15, 21, 30, 37, 45, 55, 61, 77, 90, 100, 115, 120];
for (const n of LEVELS) {
  test(`уровень ${n}: новый движок = старый код`, async () => {
    for (const seed of [1, 2, 3]) await play(n, seed);
  });
}
