// Рендер поля на canvas: хранит «визуальные» фишки (позиции rx/ry, скорость, сплющивание),
// проигрывает шаги движка (step) с анимациями и рисует кадр. Логики игры здесь нет.
import { COLORS } from './palette.js';
import { PI, TAU, rr, shapePath, drawPiece, drawIce, drawCrate, drawLock } from './draw.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} hooks  onStep(step) — вызывается после применения каждого шага (HUD, звук)
 */
export function createBoardView(canvas, hooks = {}) {
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let sprites = [];
  let gen = 0;          // поколение: при смене уровня старые анимации «забываются»
  let waiters = [];
  let T = 0;

  /** Состояние вида. Поля hint/selected выставляет UI. */
  const V = {
    w: 0, h: 0, cs: 40, mask: null, ice: null, crate: null,
    cells: null,        // [y][x] → визуальная фишка {id,c,sp,lock,rx,ry,vy,pop,squash,slide}
    dying: [], parts: [], pops: [], fx: [], banner: null,
    hint: null, selected: null,
  };

  const vis = (s, x, ry) => ({ id: s.id, c: s.c, sp: s.sp, lock: s.lock, rx: x, ry, vy: 0, pop: 1, squash: 0, slide: false });

  /** Новый уровень: фишки «влетают» сверху, как раньше. */
  function reset(game) {
    gen++; waiters = [];
    const b = game.snapshot();
    V.w = game.state.w; V.h = game.state.h; V.mask = game.state.mask;
    V.ice = b.ice; V.crate = b.crate;
    V.cells = b.tiles.map((row, y) => row.map((s, x) => (s ? vis(s, x, y - V.h - 1 + y * 0.15) : null)));
    V.dying = []; V.parts = []; V.pops = []; V.fx = []; V.banner = null; V.hint = null; V.selected = null;
  }
  /** Остановить все ожидания (уход на карту). */
  function cancel() { gen++; waiters = []; }

  const cellCenter = (x, y) => [(x + 0.5) * V.cs, (y + 0.5) * V.cs];
  function burst(x, y, color, n = 7) {
    const [px, py] = cellCenter(x, y);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = (1.5 + Math.random() * 3) * V.cs; V.parts.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - V.cs * 2, life: 0, max: 0.5 + Math.random() * 0.3, color, r: V.cs * (0.05 + Math.random() * 0.06) }); }
  }
  /** Всплывающая надпись; x,y — в клетках. */
  function popup(text, x, y, size, color) { const [px, py] = cellCenter(x, y); V.pops.push({ text, x: px, y: py, life: 0, size: size || V.cs * 0.4, color: color || '#fff' }); }
  function banner(text) { V.banner = { text, life: 0 }; }

  /** Применить шаг движка к виду (без ожидания). */
  function apply(step) {
    const old = new Map();
    for (const row of V.cells) for (const v of row) if (v) old.set(v.id, v);
    for (const r of step.removed || []) {
      const v = old.get(r.id);
      if (v) { V.dying.push({ t: { ...v, sp: null }, x: v.rx, y: v.ry, life: 0 }); old.delete(r.id); }
    }
    for (const h of step.hits || []) {
      if (h.kind === 'tile') burst(h.x, h.y, COLORS[h.c].main);
      else if (h.kind === 'ice') burst(h.x, h.y, '#bfe6ff', 5);
      else if (h.kind === 'lock') burst(h.x, h.y, '#ffffff', 8);
      else if (h.kind === 'crate') { burst(h.x, h.y, '#ffd34d', 6); if (h.opened) burst(h.x, h.y, '#ff7aa2', 10); }
    }
    for (const p of step.popups || []) popup(p.text, p.x, p.y);
    for (const f of step.fx || []) V.fx.push({ ...f, life: 0 });
    if (step.banner) banner(step.banner);
    const spawnY = new Map((step.spawn || []).map(s => [s.id, s.ry]));
    const b = step.board;
    V.ice = b.ice; V.crate = b.crate;
    V.cells = b.tiles.map((row, y) => row.map((s, x) => {
      if (!s) return null;
      let v = old.get(s.id);
      if (!v) v = vis(s, x, spawnY.has(s.id) ? spawnY.get(s.id) : y);
      v.c = s.c; v.sp = s.sp; v.lock = s.lock;
      return v;
    }));
    if (step.slide?.length || step.pop?.length) {
      const byId = new Map();
      for (const row of V.cells) for (const v of row) if (v) byId.set(v.id, v);
      for (const id of step.slide || []) { const v = byId.get(id); if (v) v.slide = true; }
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
  function update(dt) {
    T += dt;
    let moving = false;
    for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) {
      const t = V.cells[y][x]; if (!t) continue;
      if (t.slide) {
        const step = dt * 9;
        if (t.rx !== x) { const d = x - t.rx; t.rx = Math.abs(d) <= step ? x : t.rx + Math.sign(d) * step; }
        if (t.ry !== y) { const d = y - t.ry; t.ry = Math.abs(d) <= step ? y : t.ry + Math.sign(d) * step; }
        if (t.rx === x && t.ry === y) t.slide = false; else moving = true;
      } else {
        if (t.ry < y) { t.vy = Math.min(t.vy + dt * 55, 18); t.ry += t.vy * dt; if (t.ry >= y) { t.ry = y; t.vy = 0; t.squash = 1; } else moving = true; }
        else if (t.ry > y) { t.ry = Math.max(y, t.ry - dt * 10); moving = true; }
        if (t.rx !== x) { const d = x - t.rx, step = dt * 10; t.rx = Math.abs(d) <= step ? x : t.rx + Math.sign(d) * step; moving = true; }
      }
      if (t.squash > 0) t.squash = Math.max(0, t.squash - dt * 6);
      if (t.pop < 1) t.pop = Math.min(1, t.pop + dt * 4);
    }
    V.dying = V.dying.filter(d => (d.life += dt) < 0.25);
    V.parts = V.parts.filter(p => { p.life += dt; p.vy += V.cs * 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life < p.max; });
    V.pops = V.pops.filter(p => (p.life += dt) < 0.9);
    V.fx = V.fx.filter(f => (f.life += dt) < 0.35);
    if (V.banner && (V.banner.life += dt) > 1.3) V.banner = null;
    if (!moving && !V.dying.length && waiters.length) { const w = waiters; waiters = []; w.forEach(f => f()); }
  }
  function makeSprites(cs) {
    sprites = COLORS.map((_, c) => { const cv = document.createElement('canvas'); const S = Math.ceil(cs * dpr); cv.width = cv.height = S; drawPiece(cv.getContext('2d'), c, S / 2, S / 2, S * 0.37); return cv; });
  }
  function drawTileAt(t, px, py, s) {
    if (t.sp === 'c') {
      const r = s * 0.38; ctx.save(); ctx.translate(px, py); ctx.rotate(T * 1.5);
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * PI / 3, (i + 1) * PI / 3); ctx.closePath(); ctx.fillStyle = COLORS[i].main; ctx.fill(); }
      ctx.lineWidth = s * 0.06; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(px, py); ctx.scale(0.42, 0.42); ctx.fillStyle = '#fff'; shapePath(ctx, 'heart', s * 0.5); ctx.fill(); ctx.restore();
      return;
    }
    ctx.drawImage(sprites[t.c], px - s / 2, py - s / 2, s, s);
    if (t.sp === 'h' || t.sp === 'v') {
      ctx.save(); ctx.translate(px, py); if (t.sp === 'v') ctx.rotate(PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; rr(ctx, -s * 0.34, -s * 0.06, s * 0.68, s * 0.12, s * 0.06); ctx.fill();
      const a = s * 0.44, b = s * 0.12; ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a - b, -b * 0.9); ctx.lineTo(a - b, b * 0.9); ctx.closePath(); ctx.moveTo(-a, 0); ctx.lineTo(-a + b, -b * 0.9); ctx.lineTo(-a + b, b * 0.9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (t.sp === 'b') {
      ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 6); ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.07; ctx.setLineDash([s * 0.09, s * 0.07]); ctx.lineDashOffset = -T * s * 0.4;
      ctx.beginPath(); ctx.arc(px, py, s * 0.45, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  function draw() {
    const cs = V.cs, W = V.w, H = V.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W * cs, H * cs);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!V.mask[y][x]) continue;
      rr(ctx, x * cs + 1, y * cs + 1, cs - 2, cs - 2, cs * 0.2); ctx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.62)'; ctx.fill();
      if (V.ice[y][x]) drawIce(ctx, x * cs, y * cs, cs, V.ice[y][x]);
    }
    if (V.hint) { const k = 0.5 + 0.5 * Math.sin(T * 6); ctx.save(); ctx.globalAlpha = 0.35 + 0.4 * k; ctx.fillStyle = '#fff7b0'; V.hint.forEach(([x, y]) => { rr(ctx, x * cs + 2, y * cs + 2, cs - 4, cs - 4, cs * 0.2); ctx.fill(); }); ctx.restore(); }
    if (V.selected) { const [x, y] = V.selected; ctx.save(); ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 3; rr(ctx, x * cs + 2, y * cs + 2, cs - 4, cs - 4, cs * 0.22); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * cs, H * cs); ctx.clip();
    const base = cs * 0.98;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = V.cells[y][x]; if (!t) continue;
      let s = base * t.pop; const px = (t.rx + 0.5) * cs; let py = (t.ry + 0.5) * cs;
      if (V.selected && V.selected[0] === x && V.selected[1] === y) s *= 1 + 0.06 * Math.sin(T * 10);
      if (V.hint && V.hint.some(([hx, hy]) => hx === x && hy === y)) py += Math.sin(T * 8) * cs * 0.04;
      if (t.squash) { ctx.save(); ctx.translate(px, py + s / 2); ctx.scale(1 + t.squash * 0.12, 1 - t.squash * 0.12); drawTileAt(t, 0, -s / 2, s); ctx.restore(); }
      else drawTileAt(t, px, py, s);
    }
    for (const d of V.dying) { const k = 1 - d.life / 0.25; ctx.save(); ctx.globalAlpha = k; const s = base * (1 + 0.4 * (1 - k)); drawTileAt(d.t, (d.x + 0.5) * cs, (d.y + 0.5) * cs, s); ctx.restore(); }
    ctx.restore();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = V.cells[y][x]; if (t && t.lock) drawLock(ctx, x * cs, y * cs, cs, t.lock);
      if (V.crate[y][x]) drawCrate(ctx, x * cs, y * cs, cs, V.crate[y][x]);
    }
    for (const f of V.fx) {
      const k = 1 - f.life / 0.35; ctx.save(); ctx.globalAlpha = k * 0.85;
      if (f.type === 'h') { const g = ctx.createLinearGradient(0, (f.i + 0.1) * cs, 0, (f.i + 0.9) * cs); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, f.i * cs, W * cs, cs); }
      else if (f.type === 'v') { const g = ctx.createLinearGradient((f.i + 0.1) * cs, 0, (f.i + 0.9) * cs, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(f.i * cs, 0, cs, H * cs); }
      else { ctx.lineWidth = cs * 0.25 * k; ctx.strokeStyle = f.rainbow ? COLORS[Math.floor(T * 12) % 6].main : '#fff'; ctx.beginPath(); ctx.arc((f.x + 0.5) * cs, (f.y + 0.5) * cs, f.r * cs * (1 - k * 0.7), 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    for (const p of V.parts) { ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const p of V.pops) { const k = p.life / 0.9; ctx.globalAlpha = 1 - k * k; ctx.font = `900 ${p.size}px Nunito, sans-serif`; ctx.lineWidth = p.size * 0.22; ctx.strokeStyle = 'rgba(67,38,74,.75)'; ctx.strokeText(p.text, p.x, p.y - k * cs * 0.8); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - k * cs * 0.8); }
    if (V.banner) {
      const b = V.banner, k = Math.min(1, b.life * 5), out = b.life > 1.0 ? (b.life - 1.0) / 0.3 : 0; ctx.globalAlpha = 1 - out;
      const size = Math.min(cs * 0.9, W * cs / Math.max(8, b.text.length * 0.62)); ctx.font = `400 ${size * (0.6 + 0.4 * k)}px Pacifico, cursive`;
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#d93a6c'; ctx.strokeText(b.text, W * cs / 2, H * cs / 2); ctx.fillStyle = '#fff'; ctx.fillText(b.text, W * cs / 2, H * cs / 2);
    }
    ctx.globalAlpha = 1;
  }

  /** Подогнать размер клетки под контейнер. */
  function layout(wrap) {
    dpr = window.devicePixelRatio || 1;
    const r = wrap.getBoundingClientRect(), style = getComputedStyle(wrap);
    const aw = r.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), ah = r.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const c = Math.max(20, Math.floor(Math.min(aw / V.w, ah / V.h, 74))); V.cs = c;
    canvas.style.width = c * V.w + 'px'; canvas.style.height = c * V.h + 'px'; canvas.width = Math.round(c * V.w * dpr); canvas.height = Math.round(c * V.h * dpr);
    makeSprites(c);
  }
  /** Клетка под указателем или null. */
  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / V.cs), y = Math.floor((e.clientY - r.top) / V.cs);
    return x >= 0 && y >= 0 && x < V.w && y < V.h ? [x, y] : null;
  }

  return { state: V, reset, cancel, apply, play, update, draw, layout, cellAt, popup, banner, waitSettled, sleep };
}
