// Рендер поля на canvas: хранит «визуальные» фишки (позиции rx/ry, скорость, сплющивание),
// проигрывает шаги движка (step) с анимациями и рисует кадр. Логики игры здесь нет.
//
// Game feel: пружинящий свап (easeOutBack), падение с ускорением и отскоком, «дыхание» в покое,
// сочный pop со вспышкой, частицы под каждое препятствие, лучи полос, кольца и тряска на бомбах,
// лучи радуги ко всем целям, баннер комбо. Спрайты фишек кэшируются под devicePixelRatio.
import { COLORS } from './palette.js';
import { PI, TAU, rr, starPath, drawPiece, drawStripes, drawStripeArrows, drawBombAura, drawRainbow, drawIce, drawCrate, drawLock } from './draw.js';
import * as extra from './obstacles-extra.js';

const reducedMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = (a, b) => a + Math.random() * (b - a);
const RAINBOW = COLORS.map(c => c.main);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} hooks  onStep(step) — вызывается после применения каждого шага (HUD, звук)
 */
export function createBoardView(canvas, hooks = {}) {
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let sprites = new Map();
  let bgCache = null;
  let gen = 0;          // поколение: при смене уровня старые анимации «забываются»
  let waiters = [];
  let T = 0;
  let extraWarned = false;

  /** Состояние вида. Поля hint/selected выставляет UI; opts — настройки (вибрация). */
  const V = {
    w: 0, h: 0, cs: 40, mask: null, ice: null, crate: null, board: null,
    cells: null,        // [y][x] → визуальная фишка {id,c,sp,lock,rx,ry,vy,pop,squash,slide,...}
    dying: [], parts: [], pops: [], fx: [], rays: [], flashes: [], banner: null,
    hint: null, selected: null, shake: 0, arrow: null,
    opts: { vibrate: true },
  };
  const reduced = () => reducedMQ.matches;

  const vis = (s, x, ry) => {
    const v = { rx: x, ry, vy: 0, pop: 1, squash: 0, slide: false, bounced: false };
    copyTile(v, s); return v;
  };
  /** Скопировать поля фишки из снимка (включая новые поля движка — шоколад, соски и т.п.). */
  function copyTile(v, s) { for (const k in s) v[k] = s[k]; }

  /** Новый уровень: фишки «влетают» сверху каскадом. */
  function reset(game) {
    gen++; waiters = [];
    const b = game.snapshot();
    V.w = game.state.w; V.h = game.state.h; V.mask = game.state.mask;
    V.ice = b.ice; V.crate = b.crate; V.board = b;
    V.cells = b.tiles.map((row, y) => row.map((s, x) => (s ? Object.assign(vis(s, x, y - V.h - 1.5 - x * 0.12 + y * 0.1), { vy: 2 }) : null)));
    V.dying = []; V.parts = []; V.pops = []; V.fx = []; V.rays = []; V.flashes = []; V.banner = null; V.hint = null; V.selected = null; V.shake = 0;
    bgCache = null;
  }
  /** Остановить все ожидания (уход на карту). */
  function cancel() { gen++; waiters = []; }

  const cellCenter = (x, y) => [(x + 0.5) * V.cs, (y + 0.5) * V.cs];
  function haptic(p) { if (V.opts.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* не поддерживается */ } }
  function shake(a) { if (!reduced()) V.shake = Math.max(V.shake, a); }

  /* ---------- частицы ---------- */
  function part(o) { if (V.parts.length < 420) V.parts.push(Object.assign({ life: 0, rot: rnd(0, TAU), vr: rnd(-8, 8), g: 1, kind: 'dot' }, o)); }
  function burst(x, y, color, n = 7, kind = 'dot', speed = 1) {
    const [px, py] = cellCenter(x, y), cs = V.cs;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rnd(1.4, 3.6) * cs * speed;
      part({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - cs * 1.6, max: rnd(0.45, 0.8), color, r: cs * rnd(0.05, 0.11), kind });
    }
  }
  function sparkles(px, py, n, spread, color = '#fff') {
    for (let i = 0; i < n; i++) part({ x: px + rnd(-spread, spread), y: py + rnd(-spread, spread), vx: rnd(-20, 20), vy: rnd(-60, -10), max: rnd(0.35, 0.7), color, r: V.cs * rnd(0.07, 0.13), kind: 'star', g: 0.1 });
  }
  /** Всплывающая надпись; x,y — в клетках. */
  function popup(text, x, y, size, color) { const [px, py] = cellCenter(x, y); V.pops.push({ text, x: px, y: py, life: 0, size: size || V.cs * 0.42, color: color || '#fff' }); }
  function banner(text) { V.banner = { text, life: 0 }; }
  function flash(x, y, color = '#fff', max = 0.25) { V.flashes.push({ x, y, color, life: 0, max }); }

  /** Эффект попадания по клетке: своё разрушение у каждого препятствия. */
  function onHit(h) {
    const [px, py] = cellCenter(h.x, h.y);
    if (h.kind === 'tile') { const C = COLORS[h.c] || COLORS[0]; burst(h.x, h.y, C.main, 6, 'dot'); burst(h.x, h.y, C.light, 3, 'shard', 0.8); sparkles(px, py, 2, V.cs * 0.25); }
    else if (h.kind === 'ice') { burst(h.x, h.y, '#cdeeff', 7, 'shard', 0.9); burst(h.x, h.y, '#ffffff', 4, 'shard', 0.6); flash(h.x, h.y, '#e8f7ff', 0.3); }
    else if (h.kind === 'lock') { burst(h.x, h.y, '#ffffff', 8, 'shard', 1.1); burst(h.x, h.y, '#a9dcff', 4, 'snow', 0.7); flash(h.x, h.y, '#ffffff', 0.25); }
    else if (h.kind === 'crate') {
      burst(h.x, h.y, '#ffd34d', 5, 'conf'); burst(h.x, h.y, (h.left ?? 1) > 0 ? '#b98cf5' : '#ff7aa2', 5, 'conf');
      if (h.opened) {
        part({ x: px, y: py - V.cs * 0.25, vx: rnd(-60, 60), vy: -V.cs * 6, max: 0.9, color: '#ff7aa2', r: V.cs * 0.42, kind: 'lid', vr: rnd(-6, 6), g: 1.1 });
        for (const c of RAINBOW) burst(h.x, h.y, c, 2, 'conf', 1.3);
        sparkles(px, py, 5, V.cs * 0.4, '#fff6b0');
      }
    } else if (h.kind === 'choco') {
      if (h.grow) { burst(h.x, h.y, '#a0623a', 4, 'dot', 0.5); flash(h.x, h.y, '#c98a5c', 0.3); }
      else { burst(h.x, h.y, '#7a4428', 7, 'shard', 1); burst(h.x, h.y, '#c98a5c', 4, 'dot'); }
    } else if (h.kind === 'pacifier') { sparkles(px, py, 8, V.cs * 0.5, '#ffd0e0'); burst(h.x, h.y, '#ff8fb0', 6, 'conf'); flash(h.x, h.y, '#fff0f6', 0.4); }
    else { burst(h.x, h.y, '#fff', 6); }
  }

  /** Применить шаг движка к виду (без ожидания). */
  function apply(step) {
    const old = new Map();
    for (const row of V.cells) for (const v of row) if (v) old.set(v.id, v);
    const removedPos = [];
    for (const r of step.removed || []) {
      const v = old.get(r.id);
      if (v) { V.dying.push({ t: { ...v, sp: v.sp === 'c' ? 'c' : null }, x: v.rx, y: v.ry, life: 0, delay: 0 }); old.delete(r.id); }
      removedPos.push([r.x, r.y, r.c]);
    }
    for (const h of step.hits || []) onHit(h);
    for (const p of step.popups || []) popup(p.text, p.x, p.y);
    for (const f of step.fx || []) {
      if (f.type === 'h' || f.type === 'v') {
        V.fx.push({ ...f, life: 0, max: 0.5 }); shake(3); haptic(18);
        for (let i = 0; i < (f.type === 'h' ? V.w : V.h); i++) { const [px, py] = f.type === 'h' ? cellCenter(i, f.i) : cellCenter(f.i, i); sparkles(px, py, 1, V.cs * 0.3, '#fffbe0'); }
      } else if (f.rainbow) {
        V.fx.push({ ...f, life: 0, max: 0.7 });
        V.rays.push({ x: f.x, y: f.y, targets: removedPos.filter(([x, y]) => x !== f.x || y !== f.y), life: 0, max: 0.75 });
        shake(5); haptic([20, 30, 20]);
      } else {
        V.fx.push({ ...f, life: 0, max: 0.55 }); shake(f.r > 3 ? 14 : 9); haptic(f.r > 3 ? [40, 30, 60] : 35);
        flash(f.x, f.y, '#fff7d6', 0.3);
      }
    }
    for (const c of step.created || []) { const [px, py] = cellCenter(c.x, c.y); sparkles(px, py, 6, V.cs * 0.35, '#fff6b0'); V.fx.push({ type: 'birth', x: c.x, y: c.y, life: 0, max: 0.45 }); }
    if (step.banner) banner(step.banner);
    if (step.type === 'bad') haptic(10);
    if ((step.removed || []).length && !(step.fx || []).length) haptic(8);
    const spawnY = new Map((step.spawn || []).map(s => [s.id, s.ry]));
    const b = step.board;
    V.ice = b.ice; V.crate = b.crate; V.board = b;
    V.cells = b.tiles.map((row, y) => row.map((s, x) => {
      if (!s) return null;
      let v = old.get(s.id);
      if (!v) { v = vis(s, x, spawnY.has(s.id) ? spawnY.get(s.id) : y); v.vy = 1.5; }
      copyTile(v, s);
      return v;
    }));
    if (step.slide?.length || step.pop?.length) {
      const byId = new Map(), pos = new Map();
      V.cells.forEach((row, y) => row.forEach((v, x) => { if (v) { byId.set(v.id, v); pos.set(v.id, [x, y]); } }));
      for (const id of step.slide || []) {
        const v = byId.get(id); if (!v) continue;
        const [x, y] = pos.get(id), dist = Math.hypot(x - v.rx, y - v.ry);
        v.slide = true; v.sx = v.rx; v.sy = v.ry; v.st = 0; v.sd = Math.min(0.42, 0.15 + dist * 0.05);
      }
      for (const [id, val] of step.pop || []) { const v = byId.get(id); if (v) v.pop = val; }
    }
  }

  const sleep = ms => { const g = gen; return new Promise(res => setTimeout(() => { if (g === gen) res(); }, ms)); };
  const waitSettled = () => new Promise(res => waiters.push(res));

  /** Проиграть шаги по очереди: применить → дождаться падения (wait) → пауза (delay). */
  async function play(steps) {
    const g = gen;
    for (const step of steps) {
      if (g !== gen) return new Promise(() => {}); // уровень сменился — «замираем», как раньше
      apply(step);
      hooks.onStep?.(step);
      if (step.wait) await waitSettled();
      if (step.delay) await sleep(step.delay);
    }
  }

  /* ---------- кадр ---------- */
  const GRAV = 62, VMAX = 22;
  function update(dt) {
    T += dt;
    let moving = false;
    for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) {
      const t = V.cells[y][x]; if (!t) continue;
      if (t.slide) { // пружинящий свап / перемешивание
        t.st += dt / t.sd; const k = t.st >= 1 ? 1 : (reduced() ? t.st : easeOutBack(t.st));
        t.rx = t.sx + (x - t.sx) * k; t.ry = t.sy + (y - t.sy) * k;
        if (t.st >= 1) { t.rx = x; t.ry = y; t.slide = false; } else moving = true;
      } else {
        if (t.ry < y || t.vy < 0) { // падение с ускорением + один отскок
          t.vy = Math.min(t.vy + dt * GRAV, VMAX); t.ry += t.vy * dt; moving = true;
          if (t.ry >= y && t.vy > 0) {
            t.ry = y;
            if (t.vy > 6 && !t.bounced && !reduced()) { t.vy = -t.vy * 0.16; t.bounced = true; t.squash = 1; }
            else { t.vy = 0; t.bounced = false; t.squash = Math.max(t.squash, 0.5); }
          }
        } else if (t.ry > y) { t.ry = Math.max(y, t.ry - dt * 10); moving = true; }
        if (t.rx !== x) { const d = x - t.rx, step = dt * 10; t.rx = Math.abs(d) <= step ? x : t.rx + Math.sign(d) * step; moving = true; }
      }
      if (t.squash > 0) t.squash = Math.max(0, t.squash - dt * 5);
      if (t.pop < 1) t.pop = Math.min(1, t.pop + dt * 4);
    }
    V.dying = V.dying.filter(d => (d.life += dt) < 0.32);
    V.parts = V.parts.filter(p => { p.life += dt; p.vy += V.cs * 9 * p.g * dt; p.vx *= 1 - dt * 1.2; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; return p.life < p.max; });
    V.pops = V.pops.filter(p => (p.life += dt) < 0.95);
    V.fx = V.fx.filter(f => (f.life += dt) < (f.max || 0.35));
    V.rays = V.rays.filter(r => (r.life += dt) < r.max);
    V.flashes = V.flashes.filter(f => (f.life += dt) < f.max);
    if (V.banner && (V.banner.life += dt) > 1.35) V.banner = null;
    V.shake = Math.max(0, V.shake - dt * 40);
    if (!moving && !V.dying.length && waiters.length) { const w = waiters; waiters = []; w.forEach(f => f()); }
  }

  /** Спрайт фишки цвета c (с полосами для h/v) под текущий dpr. */
  function sprite(c, sp) {
    const key = c + (sp === 'h' || sp === 'v' ? sp : '');
    let cv = sprites.get(key); if (cv) return cv;
    cv = document.createElement('canvas'); const S = Math.ceil(V.cs * dpr * 1.1); cv.width = cv.height = S;
    const x = cv.getContext('2d'); drawPiece(x, c, S / 2, S / 2, S * 0.335);
    if (key.length > 1) drawStripes(x, c, sp, S / 2, S / 2, S * 0.335);
    sprites.set(key, cv); return cv;
  }

  function drawTileAt(t, px, py, s) {
    if (t.sp === 'c') { drawRainbow(ctx, px, py, s, T); return; }
    if (t.sp === 'b') drawBombAura(ctx, t.c, px, py, s, T, true);
    const S = s * 1.1; ctx.drawImage(sprite(t.c, t.sp), px - S / 2, py - S / 2, S, S);
    if (t.sp === 'h' || t.sp === 'v') drawStripeArrows(ctx, t.sp, px, py, s, 0.5 + 0.5 * Math.sin(T * 7));
    else if (t.sp === 'b') drawBombAura(ctx, t.c, px, py, s, T, false);
  }

  /** Фон поля (лоток + клетки) кэшируется: маска в уровне не меняется. */
  function background() {
    if (bgCache) return bgCache;
    const cs = V.cs, cv = document.createElement('canvas'); cv.width = Math.round(V.w * cs * dpr); cv.height = Math.round(V.h * cs * dpr);
    const x = cv.getContext('2d'); x.scale(dpr, dpr);
    x.save(); x.shadowColor = 'rgba(120,60,100,.18)'; x.shadowBlur = cs * 0.25; x.shadowOffsetY = cs * 0.06; x.fillStyle = 'rgba(255,255,255,.55)';
    for (let y = 0; y < V.h; y++) for (let xx = 0; xx < V.w; xx++) if (V.mask[y][xx]) { rr(x, xx * cs - 1, y * cs - 1, cs + 2, cs + 2, cs * 0.28); x.fill(); }
    x.restore();
    for (let y = 0; y < V.h; y++) for (let xx = 0; xx < V.w; xx++) {
      if (!V.mask[y][xx]) continue;
      rr(x, xx * cs + 2, y * cs + 2, cs - 4, cs - 4, cs * 0.22);
      x.fillStyle = (xx + y) % 2 ? 'rgba(255,255,255,.92)' : 'rgba(255,246,250,.82)'; x.fill();
      x.strokeStyle = 'rgba(200,160,190,.18)'; x.lineWidth = 1; x.stroke();
    }
    return bgCache = cv;
  }

  function callExtra(fn, ...args) {
    if (typeof fn !== 'function') return false;
    try { return fn(ctx, ...args); } catch (e) { if (!extraWarned) { extraWarned = true; console.warn('obstacles-extra:', e); } return false; }
  }

  function draw() {
    const cs = V.cs, W = V.w, H = V.h, rm = reduced();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W * cs, H * cs);
    canvas.style.transform = V.shake > 0.3 ? `translate(${rnd(-1, 1) * V.shake * 0.5}px,${rnd(-1, 1) * V.shake * 0.5}px)` : '';
    ctx.drawImage(background(), 0, 0, W * cs, H * cs);
    const S = Object.assign({}, V.board, { w: W, h: H, mask: V.mask, cells: V.cells });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!V.mask[y][x]) continue;
      if (V.ice[y][x]) drawIce(ctx, x * cs, y * cs, cs, V.ice[y][x]);
      callExtra(extra.drawCellUnder, S, x, y, x * cs, y * cs, cs, T);
    }
    // подсказка: мягкое золотое свечение
    if (V.hint) {
      const k = 0.5 + 0.5 * Math.sin(T * 5); ctx.save(); ctx.globalAlpha = 0.35 + 0.45 * k; ctx.fillStyle = '#fff1a0';
      V.hint.forEach(([x, y]) => { rr(ctx, x * cs + 2, y * cs + 2, cs - 4, cs - 4, cs * 0.24); ctx.fill(); }); ctx.restore();
    }
    if (V.selected) { const [x, y] = V.selected; ctx.save(); ctx.shadowColor = '#ff5c8a'; ctx.shadowBlur = cs * 0.25; ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 3; rr(ctx, x * cs + 2.5, y * cs + 2.5, cs - 5, cs - 5, cs * 0.24); ctx.stroke(); ctx.restore(); }
    for (const f of V.flashes) { const k = 1 - f.life / f.max; ctx.save(); ctx.globalAlpha = k * 0.9; ctx.fillStyle = f.color; rr(ctx, f.x * cs + 1, f.y * cs + 1, cs - 2, cs - 2, cs * 0.24); ctx.fill(); ctx.restore(); }

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * cs, H * cs); ctx.clip();
    const base = cs * 0.96;
    const hintDir = V.hint ? [V.hint[1][0] - V.hint[0][0], V.hint[1][1] - V.hint[0][1]] : null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = V.cells[y][x]; if (!t) continue;
      let s = base * t.pop; let px = (t.rx + 0.5) * cs, py = (t.ry + 0.5) * cs;
      const still = !t.slide && t.ry === y && t.vy === 0;
      if (still && !rm) s *= 1 + 0.022 * Math.sin(T * 2.3 + t.id * 0.9); // дыхание
      if (V.selected && V.selected[0] === x && V.selected[1] === y) s *= 1.06 + 0.04 * Math.sin(T * 10);
      if (hintDir) { // подсказка: фишки «тянутся» друг к другу
        const i = V.hint.findIndex(([hx, hy]) => hx === x && hy === y);
        if (i >= 0) { const sg = i === 0 ? 1 : -1, k = Math.max(0, Math.sin(T * 6)) * cs * 0.09; px += hintDir[0] * sg * k; py += hintDir[1] * sg * k; }
      }
      if (callExtra(extra.drawTileExtra, t, px, py, s * 0.37, T)) continue;
      if (t.squash) { const q = t.squash * 0.14; ctx.save(); ctx.translate(px, py + s * 0.45); ctx.scale(1 + q, 1 - q); drawTileAt(t, 0, -s * 0.45, s); ctx.restore(); }
      else drawTileAt(t, px, py, s);
    }
    // сочный pop: раздулась → вспыхнула белым → исчезла
    for (const d of V.dying) {
      const k = d.life / 0.32, px = (d.x + 0.5) * cs, py = (d.y + 0.5) * cs;
      const sc = k < 0.3 ? 1 + k / 0.3 * 0.28 : 1.28 * (1 - (k - 0.3) / 0.7);
      ctx.save(); ctx.globalAlpha = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7; drawTileAt(d.t, px, py, base * sc); ctx.restore();
      if (k < 0.5) { ctx.save(); ctx.globalAlpha = (0.5 - k) * 1.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, base * 0.36 * sc, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    ctx.restore();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!V.mask[y][x]) continue;
      const t = V.cells[y][x]; if (t && t.lock) drawLock(ctx, (t.rx) * cs, (t.ry) * cs, cs, t.lock);
      if (V.crate[y][x]) drawCrate(ctx, x * cs, y * cs, cs, V.crate[y][x]);
      callExtra(extra.drawCellOver, S, x, y, x * cs, y * cs, cs, T);
    }
    drawFx(cs, W, H);
    if (V.arrow) drawArrow(cs);
    drawParts();
    drawTexts(cs, W, H);
    ctx.globalAlpha = 1;
  }

  function drawFx(cs, W, H) {
    for (const f of V.fx) {
      const k = f.life / f.max, a = 1 - k;
      ctx.save();
      if (f.type === 'h' || f.type === 'v') { // луч полосы: яркое ядро + цветное свечение
        const horiz = f.type === 'h', c = (f.i + 0.5) * cs, half = cs * (0.5 * (1 - k) + 0.08);
        const g = horiz ? ctx.createLinearGradient(0, c - half, 0, c + half) : ctx.createLinearGradient(c - half, 0, c + half, 0);
        g.addColorStop(0, 'rgba(255,220,240,0)'); g.addColorStop(0.35, 'rgba(255,190,220,.75)'); g.addColorStop(0.5, '#fff'); g.addColorStop(0.65, 'rgba(255,240,180,.75)'); g.addColorStop(1, 'rgba(255,220,240,0)');
        ctx.globalAlpha = a; ctx.fillStyle = g;
        const grow = Math.min(1, k * 4); // луч «выстреливает» из центра
        if (horiz) ctx.fillRect(W * cs / 2 * (1 - grow), c - half, W * cs * grow, half * 2); else ctx.fillRect(c - half, H * cs / 2 * (1 - grow), half * 2, H * cs * grow);
      } else if (f.type === 'birth') {
        ctx.globalAlpha = a; ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = cs * 0.12 * a; ctx.beginPath(); ctx.arc((f.x + 0.5) * cs, (f.y + 0.5) * cs, cs * (0.3 + k * 0.5), 0, TAU); ctx.stroke();
      } else if (f.rainbow) {
        ctx.globalAlpha = a * 0.8; ctx.lineWidth = cs * 0.22 * a;
        const R = f.r * cs * (0.15 + k * 0.85);
        for (let i = 0; i < 6; i++) { ctx.strokeStyle = RAINBOW[i]; ctx.beginPath(); ctx.arc((f.x + 0.5) * cs, (f.y + 0.5) * cs, Math.max(1, R - i * cs * 0.12), 0, TAU); ctx.stroke(); }
      } else { // ударная волна бомбы
        const R = f.r * cs * (0.2 + 0.8 * Math.sqrt(k)), cx = (f.x + 0.5) * cs, cy = (f.y + 0.5) * cs;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, 'rgba(255,250,220,0)'); g.addColorStop(0.75, 'rgba(255,220,150,.35)'); g.addColorStop(1, 'rgba(255,255,255,.9)');
        ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * 0.14 * a; ctx.stroke();
      }
      ctx.restore();
    }
    // лучи радуги от радужного шара ко всем целевым фишкам
    for (const r of V.rays) {
      const k = r.life / r.max, grow = Math.min(1, k * 3), a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const cx = (r.x + 0.5) * cs, cy = (r.y + 0.5) * cs;
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
      r.targets.forEach(([x, y], i) => {
        const tx = cx + ((x + 0.5) * cs - cx) * grow, ty = cy + ((y + 0.5) * cs - cy) * grow;
        ctx.strokeStyle = RAINBOW[(i + Math.floor(T * 10)) % 6]; ctx.lineWidth = cs * 0.14;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * 0.05; ctx.stroke();
        if (grow >= 1) { ctx.fillStyle = '#fff'; starPath(ctx, tx, ty, cs * 0.22 * a, cs * 0.07, 4); ctx.fill(); }
      });
      ctx.restore();
    }
  }

  /** Обучающая стрелка: «поменяй вот эти два шарика». */
  function drawArrow(cs) {
    const [ax, ay] = V.arrow.from, [bx, by] = V.arrow.to, k = rm2() ? 0 : Math.sin(T * 5) * 0.12;
    const x0 = (ax + 0.5) * cs, y0 = (ay + 0.5) * cs, dx = bx - ax, dy = by - ay;
    ctx.save(); ctx.translate(x0 + dx * cs * (0.5 + k), y0 + dy * cs * (0.5 + k)); ctx.rotate(Math.atan2(dy, dx));
    const L = cs * 0.55, w = cs * 0.16;
    ctx.beginPath(); ctx.moveTo(-L, -w); ctx.lineTo(L * 0.25, -w); ctx.lineTo(L * 0.25, -w * 2.3); ctx.lineTo(L, 0); ctx.lineTo(L * 0.25, w * 2.3); ctx.lineTo(L * 0.25, w); ctx.lineTo(-L, w); ctx.closePath();
    ctx.shadowColor = 'rgba(120,30,80,.35)'; ctx.shadowBlur = cs * 0.15; ctx.lineJoin = 'round';
    ctx.lineWidth = cs * 0.1; ctx.strokeStyle = '#ff5c8a'; ctx.stroke(); ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }
  const rm2 = () => reduced();

  function drawParts() {
    for (const p of V.parts) {
      const a = 1 - p.life / p.max; ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = p.color;
      if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, TAU); ctx.fill(); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.kind === 'star') { starPath(ctx, 0, 0, p.r * a + 0.5, p.r * 0.3 * a + 0.2, 4); ctx.fill(); }
      else if (p.kind === 'shard') { ctx.beginPath(); ctx.moveTo(0, -p.r * 1.3); ctx.lineTo(p.r, p.r * 0.8); ctx.lineTo(-p.r * 0.8, p.r * 0.6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(120,180,230,.5)'; ctx.lineWidth = 1; ctx.stroke(); }
      else if (p.kind === 'conf') { ctx.scale(1, Math.cos(p.rot * 2)); ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); }
      else if (p.kind === 'snow') { ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, p.r * 0.35); ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < 3; i++) { const an = i * PI / 3; ctx.moveTo(-Math.cos(an) * p.r, -Math.sin(an) * p.r); ctx.lineTo(Math.cos(an) * p.r, Math.sin(an) * p.r); } ctx.stroke(); }
      else if (p.kind === 'lid') { // крышка подарка улетает
        const w = p.r * 2, h = p.r * 0.5; rr(ctx, -w / 2, -h / 2, w, h, h * 0.4); ctx.fill();
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(-w * 0.08, -h / 2, w * 0.16, h);
        ctx.beginPath(); ctx.ellipse(-w * 0.16, -h * 0.75, w * 0.16, h * 0.45, -0.5, 0, TAU); ctx.ellipse(w * 0.16, -h * 0.75, w * 0.16, h * 0.45, 0.5, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(cs, W, H) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const p of V.pops) {
      const k = p.life / 0.95, sc = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.globalAlpha = 1 - k * k; const size = p.size * sc;
      ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`; ctx.lineWidth = size * 0.24; ctx.strokeStyle = 'rgba(122,44,90,.85)';
      const y = p.y - k * cs * 0.9; ctx.strokeText(p.text, p.x, y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
    if (V.banner) {
      const b = V.banner, t = b.life, inK = Math.min(1, t / 0.28), out = t > 1.05 ? (t - 1.05) / 0.3 : 0;
      const sc = reduced() ? 1 : easeOutBack(inK) * (1 + out * 0.15);
      const size = Math.min(cs * 0.95, W * cs / Math.max(7, b.text.length * 0.6));
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - out); ctx.translate(W * cs / 2, H * cs * 0.46); ctx.rotate(-0.06); ctx.scale(sc, sc);
      ctx.font = `400 ${size}px Pacifico, cursive`;
      ctx.shadowColor = 'rgba(120,30,80,.35)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.08;
      ctx.lineWidth = size * 0.26; ctx.strokeStyle = '#d93a6c'; ctx.strokeText(b.text, 0, 0);
      ctx.shadowColor = 'transparent';
      const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fffbe6'); g.addColorStop(1, '#ffd36b');
      ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
  }

  /** Подогнать размер клетки под контейнер. */
  function layout(wrap) {
    dpr = window.devicePixelRatio || 1;
    const r = wrap.getBoundingClientRect(), style = getComputedStyle(wrap);
    const aw = r.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), ah = r.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const c = Math.max(20, Math.floor(Math.min(aw / V.w, ah / V.h, 78))); V.cs = c;
    canvas.style.width = c * V.w + 'px'; canvas.style.height = c * V.h + 'px'; canvas.width = Math.round(c * V.w * dpr); canvas.height = Math.round(c * V.h * dpr);
    sprites = new Map(); bgCache = null;
  }
  /** Клетка под указателем или null. */
  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / V.cs), y = Math.floor((e.clientY - r.top) / V.cs);
    return x >= 0 && y >= 0 && x < V.w && y < V.h ? [x, y] : null;
  }
  /** Отпечаток лапки Чапы (бустер). */
  function paw(x, y) { const [px, py] = cellCenter(x, y); sparkles(px, py, 6, V.cs * 0.4, '#fff'); burst(x, y, '#ffd0db', 6, 'conf'); shake(5); haptic(25); }

  return { state: V, reset, cancel, apply, play, update, draw, layout, cellAt, popup, banner, waitSettled, sleep, paw, haptic };
}
