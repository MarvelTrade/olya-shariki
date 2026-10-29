// Новые механики: шоколад (разрастается), соски Маши (довести до низа), телепорты, clone() для бота.
// Поле — строками, как в helpers.mjs, плюс токены: x — шоколад, p — соска.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, ids } from './helpers.mjs';
import { createGame } from '../../src/engine/index.js';
import { makeRng } from '../../src/levels/index.js';

function mk(rows, o = {}) {
  const toks = rows.map(r => r.trim().split(/\s+/));
  const clean = toks.map(r => r.map(t => (t === 'x' || t === 'p' ? '.' : t)).join(' '));
  const { w, h, mask, crate, board } = parse(clean);
  const choco = toks.map(r => r.map(t => (t === 'x' ? 1 : 0)));
  toks.forEach((r, y) => r.forEach((t, x) => { if (t === 'x') board[y][x] = null; if (t === 'p') board[y][x] = 'p'; }));
  const cfg = {
    n: 0, w, h, mask, colors: 5, goals: o.goals ?? [{ kind: 'score', n: 1e9, left: 1e9 }],
    ice: mask.map(r => r.map(() => 0)), crate, choco, locks: 0, lockDouble: 0, moves: o.moves ?? 20,
    t1: 0, t2: 1000, t3: 2000, world: 0, pacifiers: o.pacifiers, teleports: o.teleports,
  };
  return createGame(cfg, makeRng(o.seed ?? 42), { board });
}
const allSfx = res => res.steps.flatMap(s => s.sfx.map(x => x[0]));
const count = (grid) => grid.flat().filter(Boolean).length;

/* ---------- шоколад ---------- */
test('шоколад: матч рядом съедает плитку, цель «choco» уменьшается, звук choco', () => {
  const g = mk(['. . . .', '. x . .', '0 0 . 0'], { goals: [{ kind: 'choco', n: 1, left: 1 }] });
  assert.equal(g.state.goals[0].left, 1);
  const res = g.swap([2, 2], [3, 2]);
  assert.equal(res.ok, true);
  assert.equal(g.state.choco[1][1], 0);
  assert.equal(g.state.goals[0].left, 0);
  assert.ok(allSfx(res).includes('choco'));
  assert.ok(res.steps.some(s => s.hits.some(h => h.kind === 'choco' && h.x === 1 && h.y === 1)));
  assert.equal(g.isWon(), true);
});

test('шоколад разрастается, если за ход его не тронули (шаг choco, цель растёт)', () => {
  const g = mk(['x . . . .', '. . . . .', '. . . . 0', '. . 0 0 .'], { goals: [{ kind: 'choco', n: 1, left: 1 }] });
  const res = g.swap([4, 2], [4, 3]);
  assert.equal(res.ok, true);
  const st = res.steps.find(s => s.type === 'choco');
  assert.ok(st, 'есть шаг choco');
  assert.equal(count(g.state.choco), 2);
  assert.equal(g.state.goals[0].left, 2);
  assert.equal(st.board.choco.flat().filter(Boolean).length, 2, 'снимок содержит шоколад');
  const grown = st.hits.find(h => h.grow);
  assert.ok((grown.x === 1 && grown.y === 0) || (grown.x === 0 && grown.y === 1));
  assert.equal(g.state.tiles[grown.y][grown.x], null, 'в клетке шоколада нет фишки');
});

test('шоколад не растёт, если за ход его съели; не растёт от бустера', () => {
  const g = mk(['x x . .', '. . . .', '. . . .'], { goals: [{ kind: 'choco', n: 2, left: 2 }] });
  g.hammer(3, 2);
  assert.equal(count(g.state.choco), 2);
  g.hammer(0, 1); // удар рядом с шоколадом съедает его
  assert.equal(g.state.choco[0][0], 0);
});

test('фишки не падают сквозь шоколад — место под ним заполняется сбоку', () => {
  const g = mk(['. . .', '. x .', '. . .', '. . .']);
  const top = g.state.tiles[0][1].id;
  g.hammer(1, 3);
  assert.equal(g.state.choco[1][1], 1);
  assert.equal(g.state.tiles[0][1].id, top);
  assert.ok(g.state.tiles[2][1] && g.state.tiles[3][1]);
});

/* ---------- соски Маши ---------- */
test('соска падает, у нижнего края собирается: цель, звук, очки; затем появляется следующая', () => {
  const g = mk(['. . .', '. p .', '. . .'], { pacifiers: { total: 2, max: 1 }, goals: [{ kind: 'pacifier', n: 2, left: 2 }] });
  assert.equal(g.state.tiles[1][1].pac, true);
  assert.equal(g.state.tiles[1][1].c, -1);
  const res = g.hammer(1, 2);
  const st = res.steps.find(s => s.type === 'pacifier');
  assert.ok(st, 'есть шаг pacifier');
  assert.ok(st.removed.some(r => r.pac));
  assert.ok(allSfx(res).includes('pacifier'));
  assert.equal(g.state.goals[0].left, 1);
  assert.equal(g.state.pac.done, 1);
  const pacs = g.state.tiles.flat().filter(t => t && t.pac);
  assert.equal(pacs.length, 1, 'вторая соска появилась сверху');
  assert.ok(res.steps.some(s => s.board.tiles.flat().some(t => t && t.pac)), 'в снимке у соски pac:true');
});

test('соску нельзя взорвать и сматчить, она не перемешивается в середину', () => {
  const g = mk(['. p .', '. . .', '. . .', '. . .'], { pacifiers: { total: 1, max: 1 } });
  const id = g.state.tiles[0][1].id;
  g.hammer(1, 0);
  assert.equal(g.state.tiles[0][1].id, id);
  g.shuffle();
  assert.equal(g.state.tiles[0][1].id, id);
});

test('соска + радуга — не комбо (радуга не взрывает соски)', () => {
  const g = mk(['C p .', '. . .', '. . .'], { pacifiers: { total: 1, max: 1 } });
  const res = g.swap([0, 0], [1, 0]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'noMatch');
});

test('уровень с сосками: стартовые соски ставятся сами (по cfg.pacifiers.max)', () => {
  const W = 6, H = 6, row = () => Array(W).fill(0);
  const cfg = { n: 0, w: W, h: H, mask: Array.from({ length: H }, () => Array(W).fill(true)), colors: 5,
    goals: [{ kind: 'pacifier', n: 3, left: 3 }], ice: Array.from({ length: H }, row), crate: Array.from({ length: H }, row),
    locks: 0, lockDouble: 0, moves: 20, t1: 0, t2: 1, t3: 2, world: 0, pacifiers: { total: 3, max: 2 } };
  const g = createGame(cfg, makeRng(3));
  assert.equal(g.state.tiles[0].filter(t => t.pac).length, 2);
  assert.equal(g.state.pac.spawned, 2);
});

/* ---------- телепорты ---------- */
test('телепорт: фишка из клетки-входа переходит в клетку-выход, шаг fall содержит teleport и звук', () => {
  const g = mk(['. . .', '. . .', '. . .', '. . .'], { teleports: [[[0, 3], [2, 0]]] });
  const before = ids(g.snapshot());
  const res = g.hammer(2, 3);
  const fall = res.steps.find(s => s.type === 'fall');
  assert.equal(g.state.tiles[0][2].id, before[3][0], 'фишка с (0,3) теперь на (2,0)');
  assert.ok(fall.teleport.some(t => t.id === before[3][0] && t.from + '' === '0,3' && t.to + '' === '2,0'));
  assert.ok(allSfx(res).includes('teleport'));
  assert.ok(!fall.spawn.some(s => s.x === 2), 'в столбец выхода новые фишки сверху не падают');
  for (const r of g.state.tiles) for (const t of r) assert.ok(t, 'поле заполнено');
});

test('соска проходит через телепорт и собирается внизу другого столбца', () => {
  const g = mk(['. . .', '. . .', 'p . .', '. . .'], { teleports: [[[0, 3], [2, 0]]], pacifiers: { total: 1, max: 1 }, goals: [{ kind: 'pacifier', n: 1, left: 1 }] });
  g.hammer(0, 3);                 // соска падает в (0,3) — это вход телепорта, а не выход
  assert.equal(g.state.goals[0].left, 1);
  assert.ok(g.state.tiles.flat().some(t => t && t.pac));
  for (let i = 0; i < 4 && g.state.goals[0].left; i++) g.hammer(2, 3); // и спускается в столбце 2
  assert.equal(g.state.goals[0].left, 0);
});

/* ---------- clone ---------- */
test('clone(): копия с тем же состоянием, ходы в копии не меняют оригинал', () => {
  const g = mk(['x . . .', '. p . .', '0 0 . 0'], { pacifiers: { total: 2, max: 1 } });
  const before = JSON.stringify(g.snapshot());
  const c = g.clone(makeRng(5));
  assert.deepEqual(c.snapshot(), g.snapshot());
  c.swap([2, 2], [3, 2]);
  assert.equal(JSON.stringify(g.snapshot()), before);
  assert.notEqual(JSON.stringify(c.snapshot()), before);
});
