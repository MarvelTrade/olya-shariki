// Движок «Олиных шариков»: чистая логика без DOM и без ожиданий.
// Каждое действие (ход, бустер) выполняется синхронно до конца и возвращает список шагов (steps),
// который рендер проигрывает с анимациями. Порядок вызовов rng совпадает со старым index.html,
// поэтому при одинаковом rng новая и старая версии ведут себя одинаково (см. tests/engine/legacy-diff.test.mjs).
import { TEXT, COMBO_TXT } from './texts.js';

/** Число цветов в палитре (для подсчёта самого частого цвета у радуги). */
export const PALETTE_SIZE = 6;
/** Защита от бесконечного каскада (в старой версии её не было; на практике не достигается). */
const MAX_CHAIN = 500;

const grid = (w, h, v) => Array.from({ length: h }, () => Array(w).fill(v));
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Создать игру по конфигу уровня (результат genLevel или свой объект того же вида).
 * @param {object} cfg  конфиг уровня
 * @param {() => number} [rng=Math.random]  источник случайности [0,1)
 * @param {object} [opts]
 * @param {boolean} [opts.events=true]  записывать шаги со снимками (для бота можно выключить — быстрее)
 * @param {Array<Array<number|object|null>>} [opts.board]  готовое поле вместо случайного заполнения
 *        (число — цвет; объект {c, sp, lock}; null — пусто). Заморозка из cfg.locks тогда не расставляется.
 */
export function createGame(cfg, rng = Math.random, opts = {}) {
  const record = opts.events !== false;
  const W = cfg.w, H = cfg.h, mask = cfg.mask;
  const S = {
    n: cfg.n, cfg, w: W, h: H, mask,
    ice: cfg.ice.map(r => r.slice()),
    crate: cfg.crate.map(r => r.slice()),
    tiles: null,
    moves: cfg.moves,
    score: 0,
    goals: cfg.goals.map(g => ({ ...g })),
    chain: 1,
    /** 'play' | 'won' | 'lost' */
    status: 'play',
  };
  let tileId = 0;
  let steps = [];
  let pending = freshPending();

  function freshPending() { return { fx: [], hits: [], sfx: [], pop: [], popups: [], spawn: [], slide: [], created: [], removed: [], banner: null }; }

  /* ---------- запись шагов ---------- */
  function snapshot() {
    return {
      tiles: S.tiles.map(row => row.map(t => (t ? { id: t.id, c: t.c, sp: t.sp, lock: t.lock } : null))),
      ice: S.ice.map(r => r.slice()),
      crate: S.crate.map(r => r.slice()),
      score: S.score,
      moves: S.moves,
      goals: S.goals.map(g => ({ ...g })),
      status: S.status,
    };
  }
  function emit(type, extra = {}) {
    if (record) {
      const p = pending;
      const step = { type, ...extra, board: snapshot() };
      for (const k of Object.keys(p)) if (step[k] === undefined) step[k] = p[k];
      steps.push(step);
    }
    pending = freshPending();
  }
  const sound = (name, arg) => { if (record) pending.sfx.push(arg === undefined ? [name] : [name, arg]); };
  const fx = f => { if (record) pending.fx.push(f); };
  const hit = h => { if (record) pending.hits.push(h); };
  const banner = text => { pending.banner = text; };
  const pop = (t, v) => { if (record) pending.pop.push([t.id, v]); };

  /* ---------- поле ---------- */
  const newTile = c => ({ id: tileId++, c, sp: null, lock: 0, protect: false });
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const movable = (x, y) => inb(x, y) && mask[y][x] && !S.crate[y][x] && S.tiles[y][x] && !S.tiles[y][x].lock;
  function colorAt(x, y) {
    if (!inb(x, y) || !mask[y][x] || S.crate[y][x]) return -1;
    const t = S.tiles[y][x];
    if (!t || t.sp === 'c') return -1;
    return t.c;
  }
  const randColor = () => Math.floor(rng() * cfg.colors);

  function fillBoard() {
    for (let attempt = 0; attempt < 60; attempt++) {
      S.tiles = grid(W, H, null);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!mask[y][x] || S.crate[y][x]) continue;
        let c, guard = 0;
        do { c = randColor(); } while (guard++ < 30 && ((colorAt(x - 1, y) === c && colorAt(x - 2, y) === c) || (colorAt(x, y - 1) === c && colorAt(x, y - 2) === c)));
        S.tiles[y][x] = newTile(c);
      }
      if (findMove()) break;
    }
  }
  function placeLocks() {
    if (!cfg.locks) return;
    const cand = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (S.tiles[y][x]) cand.push(S.tiles[y][x]);
    cand.sort(() => rng() - 0.5);
    let placed = 0;
    for (const t of cand) { if (placed >= cfg.locks) break; t.lock = rng() < cfg.lockDouble ? 2 : 1; placed++; }
    const g = S.goals.find(g => g.kind === 'lock');
    if (g) { g.n = g.left = placed; }
  }
  function loadBoard(board) {
    S.tiles = grid(W, H, null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = board[y][x];
      if (v == null || !mask[y][x] || S.crate[y][x]) continue;
      const t = newTile(typeof v === 'number' ? v : v.c);
      if (typeof v === 'object') { t.sp = v.sp || null; t.lock = v.lock || 0; }
      S.tiles[y][x] = t;
    }
  }

  /* ---------- матчи ---------- */
  function findGroups() {
    const runs = [];
    for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const c = colorAt(x, y); if (c < 0) { x++; continue; } let e = x + 1; while (e < W && colorAt(e, y) === c) e++; if (e - x >= 3) { const cells = []; for (let i = x; i < e; i++) cells.push(y * W + i); runs.push({ dir: 'h', cells }); } x = e; } }
    for (let x = 0; x < W; x++) { let y = 0; while (y < H) { const c = colorAt(x, y); if (c < 0) { y++; continue; } let e = y + 1; while (e < H && colorAt(x, e) === c) e++; if (e - y >= 3) { const cells = []; for (let i = y; i < e; i++) cells.push(i * W + x); runs.push({ dir: 'v', cells }); } y = e; } }
    const cellG = new Map(), groups = [];
    for (const run of runs) {
      const hitG = new Set(); run.cells.forEach(k => { if (cellG.has(k)) hitG.add(cellG.get(k)); });
      let g;
      if (!hitG.size) { g = { cells: new Set(), runs: [] }; groups.push(g); }
      else { const arr = [...hitG]; g = arr[0]; for (let i = 1; i < arr.length; i++) { const o = arr[i]; o.cells.forEach(k => { g.cells.add(k); cellG.set(k, g); }); g.runs.push(...o.runs); groups.splice(groups.indexOf(o), 1); } }
      run.cells.forEach(k => { g.cells.add(k); cellG.set(k, g); }); g.runs.push(run);
    }
    return groups;
  }
  function lineAt(x, y) {
    const c = colorAt(x, y); if (c < 0) return false;
    let n = 1; for (let i = x - 1; colorAt(i, y) === c; i--) n++; for (let i = x + 1; colorAt(i, y) === c; i++) n++; if (n >= 3) return true;
    n = 1; for (let i = y - 1; colorAt(x, i) === c; i--) n++; for (let i = y + 1; colorAt(x, i) === c; i++) n++; return n >= 3;
  }
  /** Все ходы в порядке обхода (первый совпадает со старым findMove). */
  function findMoves(limit = Infinity) {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy; if (!movable(x, y) || !movable(nx, ny)) continue;
      const a = S.tiles[y][x], b = S.tiles[ny][nx];
      let ok = a.sp === 'c' || b.sp === 'c' || (a.sp && b.sp);
      if (!ok) { S.tiles[y][x] = b; S.tiles[ny][nx] = a; ok = lineAt(x, y) || lineAt(nx, ny); S.tiles[y][x] = a; S.tiles[ny][nx] = b; }
      if (ok) { out.push([[x, y], [nx, ny]]); if (out.length >= limit) return out; }
    }
    return out;
  }
  function findMove() { return findMoves(1)[0] || null; }
  function groupSpecial(g) {
    let max = 0, hasH = false, hasV = false, longest = null;
    for (const r of g.runs) { if (r.cells.length > max) { max = r.cells.length; longest = r; } if (r.dir === 'h') hasH = true; else hasV = true; }
    if (max >= 5) return { sp: 'c', run: longest };
    if (hasH && hasV) return { sp: 'b', run: longest };
    if (max === 4) return { sp: longest.dir === 'h' ? 'v' : 'h', run: longest };
    return null;
  }

  /* ---------- взрывы ---------- */
  function goalDec(kind, c) { for (const g of S.goals) { if (g.kind === kind && (kind !== 'col' || g.c === c) && g.left > 0) { g.left--; return; } } }
  function hitCrate(x, y, done) {
    const k = y * W + x; if (done.has(k)) return; done.add(k);
    S.crate[y][x]--; S.score += 50;
    const opened = S.crate[y][x] <= 0;
    if (opened) { S.crate[y][x] = 0; goalDec('crate'); }
    hit({ kind: 'crate', x, y, opened });
  }
  function mostCommonColor() { const cnt = Array(PALETTE_SIZE).fill(0); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = S.tiles[y][x]; if (t && !t.sp && !t.lock) cnt[t.c]++; } let b = 0; cnt.forEach((v, i) => { if (v > cnt[b]) b = i; }); return b; }
  function specialCells(sp, x, y, col) {
    const out = [];
    if (sp === 'h' || sp === 'cross') { for (let i = 0; i < W; i++) out.push([i, y]); fx({ type: 'h', i: y }); }
    if (sp === 'v' || sp === 'cross') { for (let i = 0; i < H; i++) out.push([x, i]); fx({ type: 'v', i: x }); }
    if (sp === 'b') { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) out.push([x + dx, y + dy]); fx({ type: 'ring', x, y, r: 2.5 }); }
    if (sp === 'c') { const c = col ?? mostCommonColor(); for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const t = S.tiles[yy][xx]; if (t && t.c === c && t.sp !== 'c') out.push([xx, yy]); } fx({ type: 'ring', x, y, r: Math.max(W, H), rainbow: true }); }
    return out;
  }
  function blast(cells) {
    const queue = cells.slice(), seen = new Set(), crateDone = new Set(), adj = [];
    const before = S.score, mult = Math.max(1, S.chain || 1); let sx = 0, sy = 0, sn = 0;
    while (queue.length) {
      const [x, y] = queue.shift();
      if (!inb(x, y) || !mask[y][x]) continue;
      const k = y * W + x; if (seen.has(k)) continue; seen.add(k);
      sx += x; sy += y; sn++;
      if (S.crate[y][x] > 0) { hitCrate(x, y, crateDone); continue; }
      if (S.ice[y][x] > 0) { S.ice[y][x]--; S.score += 40; hit({ kind: 'ice', x, y, left: S.ice[y][x] }); if (S.ice[y][x] === 0) goalDec('ice'); }
      const t = S.tiles[y][x]; if (!t) continue;
      adj.push([x, y]);
      if (t.protect) continue;
      if (t.lock > 0) { t.lock--; S.score += 40; hit({ kind: 'lock', x, y, left: t.lock }); if (t.lock === 0) goalDec('lock'); continue; }
      S.tiles[y][x] = null;
      if (record) pending.removed.push({ id: t.id, x, y, c: t.c, sp: t.sp });
      hit({ kind: 'tile', x, y, c: t.c });
      goalDec('col', t.c);
      S.score += 20 * mult;
      if (t.sp) { const sp = t.sp; t.sp = null; S.score += 60; sound('special'); queue.push(...specialCells(sp, x, y, undefined)); }
    }
    for (const [x, y] of adj) for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && mask[ny][nx] && S.crate[ny][nx] > 0) hitCrate(nx, ny, crateDone); }
    const gained = S.score - before;
    if (record && gained > 0 && sn) pending.popups.push({ text: '+' + gained, x: sx / sn, y: sy / sn });
  }
  function clearProtect() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = S.tiles[y][x]; if (t) t.protect = false; } }

  /* ---------- гравитация ---------- */
  function canFall(x, y) { const t = S.tiles[y][x]; return mask[y][x] && t && !t.lock && !S.crate[y][x]; }
  function settle() {
    const spawn = Array(W).fill(0); let moved = true, guard = 0;
    while (moved && guard++ < 400) {
      moved = false;
      for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) {
        if (!mask[y][x] || S.crate[y][x] || S.tiles[y][x]) continue;
        let sy = y - 1; while (sy >= 0 && !mask[sy][x]) sy--;
        if (sy < 0) { spawn[x]++; const t = newTile(randColor()); if (record) pending.spawn.push({ id: t.id, x, ry: y - spawn[x] }); S.tiles[y][x] = t; moved = true; continue; }
        if (canFall(x, sy)) { S.tiles[y][x] = S.tiles[sy][x]; S.tiles[sy][x] = null; moved = true; continue; }
        if (mask[sy][x] && !S.crate[sy][x] && !S.tiles[sy][x]) continue;
        const dirs = rng() < 0.5 ? [-1, 1] : [1, -1];
        for (const dx of dirs) {
          const nx = x + dx, ny = y - 1; if (nx < 0 || nx >= W || ny < 0) continue; if (!canFall(nx, ny)) continue;
          if (mask[y][nx] && !S.crate[y][nx] && !S.tiles[y][nx]) continue;
          S.tiles[y][x] = S.tiles[ny][nx]; S.tiles[ny][nx] = null; moved = true; break;
        }
      }
    }
  }
  /** Взрыв → пауза → падение (общий кусок для всех действий). */
  function blastAndFall(cells, delay) {
    blast(cells);
    emit('blast', { delay });
    settle();
    emit('fall', { wait: true });
  }

  /* ---------- ход ---------- */
  function cascade(swapKeys) {
    let chain = 0;
    while (chain < MAX_CHAIN) {
      const groups = findGroups(); if (!groups.length) break;
      chain++; S.chain = chain;
      const cells = [];
      for (const g of groups) {
        const s = groupSpecial(g);
        if (s) {
          let pos = null;
          const ok = k => { const t = S.tiles[Math.floor(k / W)][k % W]; return t && !t.lock && !t.sp; };
          if (swapKeys) for (const k of swapKeys) if (g.cells.has(k) && ok(k)) { pos = k; break; }
          if (pos == null && s.sp === 'b') { const hk = new Set(), vk = new Set(); g.runs.forEach(r => r.cells.forEach(k => (r.dir === 'h' ? hk : vk).add(k))); for (const k of hk) if (vk.has(k) && ok(k)) { pos = k; break; } }
          if (pos == null) { const m = s.run.cells[Math.floor(s.run.cells.length / 2)]; if (ok(m)) pos = m; else pos = [...g.cells].find(ok) ?? null; }
          if (pos != null) {
            const t = S.tiles[Math.floor(pos / W)][pos % W]; t.sp = s.sp; t.protect = true; pop(t, 0.4); sound('special');
            if (record) pending.created.push({ id: t.id, x: pos % W, y: Math.floor(pos / W), sp: s.sp });
          }
        }
        g.cells.forEach(k => cells.push([k % W, Math.floor(k / W)]));
      }
      blast(cells);
      sound('pop', chain);
      if (chain >= 2) { const txt = COMBO_TXT[Math.min(chain, COMBO_TXT.length - 1)]; if (txt) banner(txt); }
      emit('blast', { chain, delay: 170 });
      clearProtect(); settle();
      emit('fall', { wait: true });
      swapKeys = null;
    }
    S.chain = 1;
  }
  function swapCells(a, b) { const [ax, ay] = a, [bx, by] = b; const t = S.tiles[ay][ax]; S.tiles[ay][ax] = S.tiles[by][bx]; S.tiles[by][bx] = t; if (record) pending.slide.push(S.tiles[ay][ax].id, S.tiles[by][bx].id); }
  function comboSwap(A, pa, B, pb) {
    let cells = []; S.chain = 1;
    if (A.sp === 'c' && B.sp === 'c') {
      A.sp = B.sp = null; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push([x, y]);
      fx({ type: 'ring', x: pa[0], y: pa[1], r: W + H, rainbow: true }); banner(TEXT.rainbowRainbow);
    } else if (A.sp === 'c' || B.sp === 'c') {
      const [C, pc, O, po] = A.sp === 'c' ? [A, pa, B, pb] : [B, pb, A, pa];
      const col = O.c; C.sp = null;
      fx({ type: 'ring', x: pc[0], y: pc[1], r: Math.max(W, H), rainbow: true });
      if (O.sp) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = S.tiles[y][x]; if (t && t.c === col && !t.sp && !t.lock) { t.sp = O.sp === 'b' ? 'b' : (rng() < 0.5 ? 'h' : 'v'); pop(t, 0.3); cells.push([x, y]); } }
        cells.push(po); sound('special'); banner(TEXT.rainbowSpecial);
        emit('mark', { delay: 380 });
      } else { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = S.tiles[y][x]; if (t && t.c === col) cells.push([x, y]); } }
      cells.push(pc);
    } else {
      const s = [A.sp, B.sp]; A.sp = B.sp = null; const [x, y] = pa;
      if (s[0] === 'b' && s[1] === 'b') { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4) cells.push([x + dx, y + dy]); fx({ type: 'ring', x, y, r: 4.5 }); banner(TEXT.bombBomb); }
      else if (s.includes('b')) { for (let i = -1; i <= 1; i++) { cells.push(...specialCells('h', x, y + i), ...specialCells('v', x + i, y)); } banner(TEXT.bombLine); }
      else { cells.push(...specialCells('cross', x, y)); }
      cells.push(pb);
    }
    sound('special');
    blastAndFall(cells, 200);
    cascade(null);
  }
  const goalsDone = () => S.goals.every(g => (g.kind === 'score' ? S.score >= g.n : g.left <= 0));

  function afterMove() {
    if (goalsDone()) { bonusTime(); S.status = 'won'; emit('won'); return; }
    if (S.moves <= 0) { S.status = 'lost'; emit('lost'); return; }
    ensureMoves(TEXT.autoShuffle);
  }
  function ensureMoves(msg = TEXT.autoShuffle) {
    if (!findMove()) shuffleBoard(msg);
  }
  function bonusTime() {
    if (S.moves > 0) { banner(TEXT.bonus); sound('woof'); emit('bonusStart', { delay: 800 }); }
    let guard = 0;
    while (S.moves > 0 && guard++ < 40) {
      const cand = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = S.tiles[y][x]; if (t && !t.sp && !t.lock) cand.push([x, y]); }
      if (!cand.length) break;
      const batch = Math.min(S.moves, 3), fire = [];
      for (let i = 0; i < batch && cand.length; i++) { const [x, y] = cand.splice(Math.floor(rng() * cand.length), 1)[0]; const t = S.tiles[y][x]; t.sp = rng() < 0.5 ? 'h' : 'v'; pop(t, 0.3); fire.push([x, y]); S.moves--; S.score += 100; }
      sound('bonus', guard); emit('bonusMark', { delay: 220 });
      blastAndFall(fire, 140); cascade(null);
    }
    guard = 0;
    while (guard++ < 25) {
      let f = null; for (let y = 0; y < H && !f; y++) for (let x = 0; x < W; x++) { const t = S.tiles[y][x]; if (t && t.sp) { f = [x, y]; break; } }
      if (!f) break; blastAndFall([f], 140); cascade(null);
    }
    emit('bonusEnd', { delay: 300 });
  }
  function shuffleBoard(msg) {
    const pos = [], ts = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (movable(x, y)) { pos.push([x, y]); ts.push(S.tiles[y][x]); }
    for (let a = 0; a < 200; a++) {
      for (let i = ts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ts[i], ts[j]] = [ts[j], ts[i]]; }
      if (a > 80) ts.forEach(t => { if (!t.sp) t.c = randColor(); });
      pos.forEach(([x, y], i) => { S.tiles[y][x] = ts[i]; });
      if (!findGroups().length && findMove()) break;
    }
    if (record) pending.slide.push(...ts.map(t => t.id));
    banner(msg); sound('woof');
    emit('shuffle', { wait: true, delay: 200 });
  }

  /* ---------- публичное API ---------- */
  function begin() { steps = []; pending = freshPending(); }
  const result = (ok, extra) => ({ ok, steps, ...extra });

  if (opts.board) loadBoard(opts.board);
  else {
    fillBoard(); placeLocks();
    // ИСПРАВЛЕНИЕ относительно старой версии: заморозка ставилась после проверки ходов
    // и иногда (≈1 из 50 стартов на уровнях с заморозкой) оставляла поле без ходов — игра «зависала».
    // Теперь в этом случае поле сразу тихо перемешивается. В остальных случаях rng тратится как раньше.
    if (!findMove()) { shuffleBoard(TEXT.autoShuffle); steps = []; pending = freshPending(); }
  }

  const api = {
    /** Живое состояние (только читать!). */
    state: S,
    /** Обменять соседние клетки a=[x,y] и b=[x,y]. Выполняет весь ход: каскад, бонус, автоперемешивание. */
    swap(a, b) {
      begin();
      if (S.status !== 'play') return result(false, { reason: 'over' });
      const [ax, ay] = a, [bx, by] = b;
      if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return result(false, { reason: 'notAdjacent' });
      if (!movable(ax, ay) || !movable(bx, by)) { sound('bad'); emit('bad'); return result(false, { reason: 'immovable' }); }
      const A = S.tiles[ay][ax], B = S.tiles[by][bx];
      swapCells(a, b); sound('swap'); emit('swap', { wait: true });
      if (A.sp === 'c' || B.sp === 'c' || (A.sp && B.sp)) {
        S.moves--; emit('hud'); comboSwap(A, [bx, by], B, [ax, ay]);
      } else if (findGroups().length) {
        S.moves--; emit('hud'); cascade([by * W + bx, ay * W + ax]);
      } else {
        swapCells(a, b); sound('bad'); emit('swapBack', { wait: true });
        return result(false, { reason: 'noMatch' });
      }
      afterMove();
      return result(true);
    },
    /** Бустер Чапы: взорвать одну клетку. */
    hammer(x, y) {
      begin();
      if (S.status !== 'play' || !inb(x, y) || !mask[y][x]) return result(false, { reason: 'invalid' });
      sound('woof'); S.chain = 1;
      blastAndFall([[x, y]], 180); cascade(null); afterMove();
      return result(true);
    },
    /** Бустер Пуши: перемешать поле (ход не тратится, победа/поражение не проверяются — как раньше). */
    shuffle(msg = TEXT.pushaShuffle) {
      begin();
      if (S.status !== 'play') return result(false, { reason: 'over' });
      shuffleBoard(msg); cascade(null);
      return result(true);
    },
    /** Добавить ходы (бустер Маши, «+5 от Пуши» после поражения). Поражение снимается. */
    addMoves(k) {
      S.moves += k;
      if (S.status === 'lost' && S.moves > 0) S.status = 'play';
    },
    /** Если ходов нет — перемешать. Возвращает шаги (пустой список, если ход есть). */
    ensureMoves(msg) { begin(); ensureMoves(msg); return result(true); },
    findMove,
    findMoves: () => findMoves(),
    hasMatches: () => findGroups().length > 0,
    movable,
    goalsDone,
    isWon: () => S.status === 'won',
    isLost: () => S.status === 'lost',
    /** Звёзды за текущий счёт (1..3), как в старой версии. */
    stars: () => (S.score >= cfg.t3 ? 3 : S.score >= cfg.t2 ? 2 : 1),
    snapshot,
  };
  return api;
}
