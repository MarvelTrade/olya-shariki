# Движок «Олиных шариков»

Чистая логика match-3: без DOM, без таймеров и `await`. Работает в браузере и в Node.
Любое действие выполняется **синхронно до конца** (каскады, бонус, автоперемешивание)
и возвращает список **шагов** — рендер проигрывает их с анимациями.

Поведение совпадает со старым `index.html` при одинаковом rng — это проверяет
`tests/engine/legacy-diff.test.mjs`. Единственное намеренное отличие: если заморозка на старте
не оставила ходов, поле сразу перемешивается (раньше игра «зависала»).

## Быстрый старт (бот)

```js
import { createGame } from './src/engine/index.js';
import { genLevel, makeRng } from './src/levels/index.js';

const game = createGame(genLevel(17), makeRng(1), { events: false }); // events:false — быстрее, без шагов
while (!game.isWon() && !game.isLost()) {
  const moves = game.findMoves();          // [[ [x,y], [x,y] ], ...]
  game.swap(...moves[0]);
}
console.log(game.isWon(), game.stars(), game.state.score, game.state.moves);
```

## API

`createGame(cfg, rng = Math.random, opts?)` → `game`

- `cfg` — конфиг уровня: `genLevel(n)` или свой объект того же вида
  (`w, h, mask, colors, goals, ice, crate, locks, lockDouble, moves, t1, t2, t3`).
- `rng` — функция `() => [0,1)`. Для воспроизводимости — `makeRng(seed)`.
- `opts.events` (по умолчанию `true`) — записывать шаги со снимками поля.
- `opts.board` — своё поле вместо случайного (для тестов): `[y][x]` = цвет | `{c, sp, lock}` | `null`.

| Метод | Что делает |
|---|---|
| `swap(a, b)` | Ход: обменять соседние `[x,y]`. → `{ok, reason?, steps}`. `reason`: `notAdjacent`, `immovable`, `noMatch` (фишки вернулись, ход не потрачен), `over`. |
| `findMoves()` | Все ходы. `findMove()` — первый или `null`. |
| `hammer(x, y)` | Бустер Чапы: взорвать клетку. Ход не тратит. |
| `shuffle()` | Бустер Пуши: перемешать. Ход не тратит. |
| `addMoves(k)` | +k ходов (Маша +3, «Пуша принёс +5»); снимает поражение. |
| `ensureMoves()` | Перемешать, если ходов нет (вызывается автоматически после хода). |
| `isWon()` / `isLost()` / `status` | `'play' \| 'won' \| 'lost'`. Победа — после бонуса за оставшиеся ходы. |
| `goalsDone()` | Все цели выполнены. |
| `stars()` | 1–3 звезды по `cfg.t2/t3`. |
| `movable(x, y)`, `hasMatches()`, `snapshot()` | Вспомогательное. |
| `state` | Живое состояние (только читать): `tiles[y][x]={id,c,sp,lock}`, `ice`, `crate`, `mask`, `score`, `moves`, `goals[]`. |

Спецфишки `sp`: `'h'` / `'v'` — полосы, `'b'` — бомба (ромб радиуса 2), `'c'` — радуга.
4 в ряд по горизонтали даёт `'v'`, по вертикали — `'h'`; L/T — `'b'`; 5 в ряд — `'c'`.
Цели `goals[]`: `{kind:'col'|'ice'|'crate'|'lock'|'score', c?, n, left}`.

## Шаги (для рендера)

Каждый шаг: `{ type, board, wait?, delay?, ...эффекты }`.
`board` — снимок **после** шага: `{tiles, ice, crate, score, moves, goals, status}`; фишки узнаются по `id`.

Проигрывание: применить шаг → если `wait`, дождаться, пока фишки долетят → если `delay`, пауза (мс).
См. `src/render/board-view.js → play()`.

| `type` | Когда |
|---|---|
| `swap` / `swapBack` / `bad` | обмен / возврат / нельзя двигать |
| `hud` | потрачен ход |
| `blast` | взрыв (`chain` — номер каскада) |
| `fall` | гравитация и новые фишки |
| `mark` | радуга + спецфишка: фишки цвета стали спецфишками |
| `shuffle` | перемешивание |
| `bonusStart` / `bonusMark` / `bonusEnd` | бонус после победы |
| `won` / `lost` | конец уровня |

Эффекты (массивы, могут быть пустыми):
- `removed: [{id, x, y, c, sp}]` — убранные фишки;
- `created: [{id, x, y, sp}]` — появившиеся спецфишки;
- `spawn: [{id, x, ry}]` — новые фишки и откуда (строка `ry`, может быть < 0) они падают;
- `slide: [id]` — фишки, которые едут, а не падают (обмен, перемешивание);
- `pop: [[id, scale]]` — «выпрыгивание» фишки;
- `hits: [{kind:'tile'|'ice'|'lock'|'crate', x, y, c?, left?, opened?}]` — куда сыпать частицы;
- `fx: [{type:'h'|'v', i} | {type:'ring', x, y, r, rainbow?}]` — вспышки полос и кольца;
- `popups: [{text, x, y}]` — «+60» (в клетках);
- `banner` — текст («Супер!», «Бабах!»…), `sfx: [[имя, арг?]]` — звуки (`src/audio/sound.js`).
