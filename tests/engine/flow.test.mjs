// findMove/перемешивание, победа/поражение, бустеры, завершение каскадов.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './helpers.mjs';
import { createGame } from '../../src/engine/index.js';
import { genLevel, makeRng, LEVELS } from '../../src/levels/index.js';

// Поле без единого хода: шахматка из 2 цветов по диагоналям 3×3 периодом
const DEAD = ['1 2 3 1 2', '2 3 1 2 3', '3 1 2 3 1', '1 2 3 1 2'];

test('findMove находит ход, findMoves — все ходы, первый совпадает', () => {
  const g = game(['0 0 . 0', '. . . .']);
  const ms = g.findMoves();
  assert.ok(ms.length >= 1);
  assert.deepEqual(g.findMove(), ms[0]);
  assert.ok(ms.some(([a, b]) => (a + '' === '2,0' && b + '' === '3,0')));
});

test('радуга или две спецфишки рядом — это ход', () => {
  assert.ok(game(['C . .', '. . .']).findMove());
  assert.ok(game(['1h 2b .', '. . .']).findMove());
});

test('на поле без ходов findMove = null, ensureMoves перемешивает', () => {
  const g = game(DEAD, { colors: 4 });
  assert.equal(g.findMove(), null);
  const res = g.ensureMoves();
  assert.deepEqual(res.steps.map(s => s.type), ['shuffle']);
  assert.equal(res.steps[0].banner, 'Пуша перемешал шарики!');
  assert.ok(g.findMove(), 'после перемешивания есть ход');
  assert.equal(g.hasMatches(), false, 'и нет готовых матчей');
});

test('ensureMoves не трогает поле, если ход есть', () => {
  const g = game(['0 0 . 0', '. . . .']);
  assert.equal(g.ensureMoves().steps.length, 0);
});

test('бустер Пуши: перемешивает, ход не тратится', () => {
  const g = game(DEAD, { colors: 4 });
  const res = g.shuffle();
  assert.equal(res.ok, true);
  assert.equal(res.steps[0].type, 'shuffle');
  assert.equal(g.state.moves, 20);
  assert.ok(g.findMove());
});

test('замороженные фишки при перемешивании остаются на месте', () => {
  const rows = DEAD.map((r, y) => (y === 0 ? r.replace(/^1/, '1*') : r));
  const g = game(rows, { colors: 4 });
  const id = g.state.tiles[0][0].id;
  g.shuffle();
  assert.equal(g.state.tiles[0][0].id, id);
});

test('победа: цель выполнена → бонус за оставшиеся ходы → isWon', () => {
  const g = game(['0 0 . . .', '. . 0 . .', '. . . . .', '. . . . .'], { goals: [{ kind: 'col', c: 0, n: 3, left: 3 }], moves: 5 });
  const res = g.swap([2, 1], [2, 0]);
  assert.equal(g.isWon(), true);
  assert.equal(g.isLost(), false);
  assert.equal(g.state.moves, 0, 'оставшиеся ходы сгорели в бонусе');
  const types = res.steps.map(s => s.type);
  assert.ok(types.includes('bonusStart') && types.includes('bonusEnd'));
  assert.equal(types.at(-1), 'won');
  assert.equal(g.swap([0, 0], [1, 0]).reason, 'over');
});

test('поражение: ходы кончились → isLost; +5 ходов снимает поражение', () => {
  const g = game(['0 0 . . .', '. . 0 . .', '. . . . .', '. . . . .'], { goals: [{ kind: 'col', c: 0, n: 99, left: 99 }], moves: 1 });
  g.swap([2, 1], [2, 0]);
  assert.equal(g.isLost(), true);
  assert.equal(g.state.moves, 0);
  g.addMoves(5);
  assert.equal(g.isLost(), false);
  assert.equal(g.state.moves, 5);
});

test('звёзды по порогам t2/t3', () => {
  const g = game(['. . .', '. . .']);
  assert.equal(g.stars(), 1);
  g.state.score = 1000; assert.equal(g.stars(), 2);
  g.state.score = 2000; assert.equal(g.stars(), 3);
});

test('каждый шаг содержит снимок поля; events:false — без шагов', () => {
  const g = createGame(genLevel(7), makeRng(1));
  const [a, b] = g.findMove();
  const res = g.swap(a, b);
  for (const s of res.steps) assert.ok(s.board && s.board.tiles.length === g.state.h, s.type);
  const q = createGame(genLevel(7), makeRng(1), { events: false });
  const r2 = q.swap(a, b);
  assert.equal(r2.ok, true);
  assert.equal(r2.steps.length, 0);
  assert.equal(q.state.score, g.state.score, 'результат тот же');
});

test('все 120 уровней: стартовое поле без матчей и с ходом, заморозка = цели', () => {
  for (let n = 1; n <= LEVELS; n++) for (let seed = 0; seed < 20; seed++) {
    const cfg = genLevel(n);
    const g = createGame(cfg, makeRng(n * 100 + seed));
    assert.equal(g.hasMatches(), false, `ур.${n}: матчи на старте`);
    assert.ok(g.findMove(), `ур.${n}: нет хода`);
    const locks = g.state.tiles.flat().filter(t => t && t.lock).length;
    const lg = g.state.goals.find(x => x.kind === 'lock');
    if (lg) assert.equal(lg.left, locks);
  }
});

// Пустая клетка допустима только «в тени»: над ней (сквозь дыры маски) ящик, замороженная фишка
// или такая же пустая клетка. Так было и в старой версии — она заполнится, когда препятствие уйдёт.
function noOpenHoles(S) {
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    if (!S.mask[y][x] || S.crate[y][x] || S.tiles[y][x]) continue;
    let sy = y - 1; while (sy >= 0 && !S.mask[sy][x]) sy--;
    if (sy < 0) return false; // верхняя клетка столбца должна была получить новую фишку
    const t = S.tiles[sy][x];
    if (!(S.crate[sy][x] || !t || t.lock)) return false;
  }
  return true;
}

test('каскад всегда завершается: случайная игра на всех уровнях до конца', () => {
  for (let n = 1; n <= LEVELS; n++) {
    for (const seed of [11, 12]) {
      const g = createGame(genLevel(n), makeRng(seed * 1000 + n), { events: false });
      const pick = makeRng(seed + n);
      let guard = 0;
      while (!g.isWon() && !g.isLost() && guard++ < 200) {
        const ms = g.findMoves();
        assert.ok(ms.length, `ур.${n}: после хода нет ходов (должно было перемешаться)`);
        const [a, b] = ms[Math.floor(pick() * ms.length)];
        assert.equal(g.swap(a, b).ok, true);
        assert.equal(g.hasMatches(), false, `ур.${n}: после хода остались матчи`);
        assert.ok(noOpenHoles(g.state), `ур.${n}: пустая клетка, которую можно было заполнить`);
      }
      assert.ok(g.isWon() || g.isLost(), `ур.${n}: игра не закончилась`);
    }
  }
});
