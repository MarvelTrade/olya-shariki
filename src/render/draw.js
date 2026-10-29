// Рисование фишек, спецфишек и препятствий на canvas.
// Всё — кодом: объём даёт радиальный градиент + тёмный обод + блик-«глазурь» сверху.
// Тяжёлое (тени, градиенты) рисуется один раз в спрайт (см. board-view.js → makeSprites).
import { COLORS } from './palette.js';

export const PI = Math.PI, TAU = PI * 2;

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function starPath(ctx, cx, cy, R, ri, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, rad = i % 2 ? ri : R; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  ctx.closePath();
}
/** Многоугольник со скруглёнными углами (для пухлой звезды). */
function roundPoly(ctx, pts, rad) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = mid(p, pts[(i + 1) % n]); ctx.arcTo(p[0], p[1], q[0], q[1], typeof rad === 'function' ? rad(i) : rad); }
  ctx.closePath();
}

/** Контур формы с центром в (0,0); r — «радиус» фишки. Форма различима без цвета. */
export function shapePath(ctx, shape, r) {
  ctx.beginPath();
  switch (shape) {
    case 'heart': { // пухлое сердечко
      const s = r * 1.02;
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 0.3, s * 0.66, -s * 1.02, s * 0.22, -s * 0.99, -s * 0.3);
      ctx.bezierCurveTo(-s * 0.96, -s * 0.88, -s * 0.28, -s * 1.02, 0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.28, -s * 1.02, s * 0.96, -s * 0.88, s * 0.99, -s * 0.3);
      ctx.bezierCurveTo(s * 1.02, s * 0.22, s * 0.3, s * 0.66, 0, s * 0.9);
      ctx.closePath(); break;
    }
    case 'ball': ctx.arc(0, 0, r * 0.9, 0, TAU); break;
    case 'star': { // пухлая звёздочка со скруглёнными лучами
      const pts = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rad = i % 2 ? r * 0.56 : r * 1.06; pts.push([Math.cos(a) * rad, Math.sin(a) * rad + r * 0.07]); }
      roundPoly(ctx, pts, i => (i % 2 ? r * 0.16 : r * 0.2)); break;
    }
    case 'sun': { // солнышко-цветочек: 10 круглых лучей
      const N = 10, Ri = r * 0.8, Ro = r * 1.08;
      ctx.moveTo(Ri, 0);
      for (let i = 0; i < N; i++) {
        const a0 = i * TAU / N, a1 = (i + 1) * TAU / N, am = (a0 + a1) / 2;
        ctx.quadraticCurveTo(Math.cos(am) * Ro * 1.08, Math.sin(am) * Ro * 1.08, Math.cos(a1) * Ri, Math.sin(a1) * Ri);
      }
      ctx.closePath(); break;
    }
    case 'bone': { // высокая тонкая косточка (как Чапа)
      const w = r * 0.21, k = r * 0.3, ky = r * 0.64, kx = r * 0.22;
      ctx.rect(-w, -ky, w * 2, ky * 2);
      for (const sy of [-1, 1]) for (const sx of [-1, 1]) { ctx.moveTo(sx * kx + k, sy * ky); ctx.arc(sx * kx, sy * ky, k, 0, TAU); }
      break;
    }
    case 'cookie': { // широкая коренастая печенька (как Пуша)
      const w = r * 0.96, h = r * 0.74, c = r * 0.5;
      ctx.moveTo(-w + c, -h);
      ctx.quadraticCurveTo(0, -h - r * 0.08, w - c, -h); ctx.quadraticCurveTo(w, -h, w, -h + c);
      ctx.quadraticCurveTo(w + r * 0.06, 0, w, h - c); ctx.quadraticCurveTo(w, h, w - c, h);
      ctx.quadraticCurveTo(0, h + r * 0.08, -w + c, h); ctx.quadraticCurveTo(-w, h, -w, h - c);
      ctx.quadraticCurveTo(-w - r * 0.06, 0, -w, -h + c); ctx.quadraticCurveTo(-w, -h, -w + c, -h);
      ctx.closePath(); break;
    }
  }
}

/** Глянцевая объёмная фишка цвета c с центром (cx,cy) и радиусом r. */
export function drawPiece(ctx, c, cx, cy, r, opts = {}) {
  const C = COLORS[c]; if (!C) return;
  ctx.save(); ctx.translate(cx, cy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // мягкая тень + тёмный обод
  if (!opts.flat) { ctx.shadowColor = 'rgba(80,30,70,.32)'; ctx.shadowBlur = r * 0.22; ctx.shadowOffsetY = r * 0.12; }
  ctx.fillStyle = C.dark; ctx.strokeStyle = C.dark; ctx.lineWidth = r * 0.16;
  shapePath(ctx, C.shape, r); ctx.stroke(); ctx.fill();
  ctx.shadowColor = 'transparent';
  // тело
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.45, r * 0.05, 0, 0, r * 1.15);
  g.addColorStop(0, C.light); g.addColorStop(0.42, C.main); g.addColorStop(1, C.dark);
  ctx.fillStyle = g; shapePath(ctx, C.shape, r); ctx.fill();
  ctx.save(); shapePath(ctx, C.shape, r); ctx.clip();
  // отражённый свет снизу
  const g2 = ctx.createLinearGradient(0, r * 0.2, 0, r * 1.0);
  g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, 'rgba(255,255,255,.28)');
  ctx.fillStyle = g2; ctx.fillRect(-r * 1.2, r * 0.2, r * 2.4, r);
  decorate(ctx, C, r);
  // глазурь-блик сверху
  const g3 = ctx.createLinearGradient(0, -r, 0, -r * 0.05);
  g3.addColorStop(0, 'rgba(255,255,255,.85)'); g3.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g3; ctx.beginPath(); ctx.ellipse(-r * 0.12, -r * 0.5, r * 0.62, r * 0.36, -0.25, 0, TAU); ctx.fill();
  ctx.restore();
  // искорка
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.42, r * 0.1, r * 0.07, -0.7, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Рисунок на фишке (внутри клипа формы). */
function decorate(ctx, C, r) {
  const dk = C.dark;
  switch (C.shape) {
    case 'ball': { // футбольный мяч: тёмный пятиугольник в центре, по краям — кусочки соседних
      const pent = (cx, cy, R, rot) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } ctx.closePath(); };
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; ctx.moveTo(Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24); ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(18,36,100,.62)';
      pent(0, 0, r * 0.24, -PI / 2); ctx.fill();
      for (let i = 0; i < 5; i++) { const a = -PI / 2 + PI / 5 + i * TAU / 5; pent(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.24, a + PI / 5); ctx.fill(); }
      break;
    }
    case 'sun': { // спящее личико Маши
      ctx.strokeStyle = dk; ctx.lineWidth = r * 0.075;
      ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.05, r * 0.11, 0.15, PI - 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.05, r * 0.11, 0.15, PI - 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.13, 0.2, PI - 0.2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,110,120,.45)';
      ctx.beginPath(); ctx.ellipse(-r * 0.45, r * 0.16, r * 0.12, r * 0.08, 0, 0, TAU); ctx.ellipse(r * 0.45, r * 0.16, r * 0.12, r * 0.08, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'cookie': { // кусочки шоколада
      ctx.fillStyle = 'rgba(16,70,58,.7)';
      [[-0.5, -0.3, 0.12], [0.3, -0.38, 0.1], [0.05, 0.08, 0.13], [-0.45, 0.35, 0.1], [0.55, 0.3, 0.12], [0.62, -0.05, 0.07], [-0.1, 0.45, 0.07]]
        .forEach(([x, y, s]) => { ctx.beginPath(); ctx.ellipse(x * r, y * r, s * r, s * r * 0.8, x, 0, TAU); ctx.fill(); });
      break;
    }
    case 'star': { // смайлик-блёстка Саши (она рисует звёздочки)
      ctx.fillStyle = 'rgba(255,255,255,.55)'; starPath(ctx, r * 0.28, r * 0.25, r * 0.16, r * 0.06, 4); ctx.fill();
      break;
    }
    case 'heart': {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.05, r * 0.5, 0.2, 1.4); ctx.stroke();
      break;
    }
    case 'bone': {
      ctx.strokeStyle = 'rgba(140,50,0,.25)'; ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.moveTo(r * 0.06, -r * 0.35); ctx.lineTo(r * 0.06, r * 0.35); ctx.stroke();
      break;
    }
  }
}

/** Статичная часть спецфишки-полосы (в спрайт): белые «леденцовые» полосы вдоль направления. */
export function drawStripes(ctx, c, sp, cx, cy, r) {
  const C = COLORS[c]; if (!C) return;
  ctx.save(); ctx.translate(cx, cy); shapePath(ctx, C.shape, r); ctx.clip();
  if (sp === 'v') ctx.rotate(PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,.78)';
  for (const y of [-0.42, 0.02, 0.46]) { ctx.beginPath(); ctx.rect(-r * 1.3, y * r - r * 0.09, r * 2.6, r * 0.18); ctx.fill(); }
  ctx.restore();
}

/** Стрелки полосы (каждый кадр, «дышат» наружу). k — фаза 0..1. */
export function drawStripeArrows(ctx, sp, cx, cy, s, k) {
  ctx.save(); ctx.translate(cx, cy); if (sp === 'v') ctx.rotate(PI / 2);
  const off = s * (0.4 + 0.05 * k), a = s * 0.13;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(67,38,74,.55)'; ctx.lineWidth = s * 0.03; ctx.lineJoin = 'round';
  for (const d of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(d * (off + a), 0); ctx.lineTo(d * off, -a * 0.85); ctx.lineTo(d * off, a * 0.85); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  ctx.restore();
}

/** Бомба: тёплое сияние вокруг + фитиль с искрой (каждый кадр). */
export function drawBombAura(ctx, c, cx, cy, s, T, back) {
  const C = COLORS[c] || COLORS[0];
  if (back) {
    const k = 0.5 + 0.5 * Math.sin(T * 5);
    const g = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 0.62);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, C.light); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalAlpha = 0.55 + 0.35 * k; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, TAU); ctx.fill(); ctx.restore();
    return;
  }
  // ромбик-рамка (бомба бьёт ромбом) — вращающиеся точки
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) { const a = T * 1.6 + i * TAU / 8, R = s * 0.46; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 6 + i); ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, s * 0.035, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // фитиль
  ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s * 0.18, -s * 0.3); ctx.quadraticCurveTo(s * 0.3, -s * 0.46, s * 0.36, -s * 0.38); ctx.stroke();
  const fl = 0.8 + 0.4 * Math.sin(T * 22);
  ctx.fillStyle = '#fff3a0'; starPath(ctx, s * 0.37, -s * 0.39, s * 0.11 * fl, s * 0.04, 5); ctx.fill();
  ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(s * 0.37, -s * 0.39, s * 0.035, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Радужный шар: вращающиеся дольки всех цветов + глянец. */
export function drawRainbow(ctx, cx, cy, s, T) {
  const r = s * 0.4;
  ctx.save(); ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(80,30,70,.3)'; ctx.shadowBlur = r * 0.25; ctx.shadowOffsetY = r * 0.1;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.08, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.rotate(T * 1.4);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * PI / 3, (i + 1) * PI / 3); ctx.closePath();
    ctx.fillStyle = COLORS[i].main; ctx.fill();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.05, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.5, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(60,20,80,.25)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // белое сердечко в центре
  ctx.save(); ctx.scale(0.36, 0.36); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(80,30,70,.35)'; ctx.shadowBlur = r * 0.3; shapePath(ctx, 'heart', r); ctx.fill(); ctx.restore();
  // лучики
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const a = -T * 2 + i * PI / 2, k = 0.5 + 0.5 * Math.sin(T * 5 + i); ctx.globalAlpha = k; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); ctx.lineTo(Math.cos(a) * r * 1.38, Math.sin(a) * r * 1.38); ctx.stroke(); }
  ctx.restore();
}

/* ---------- препятствия ---------- */

/** Лёд под фишкой: 1 слой — тонкий голубой, 2 слоя — толстый, с инеем и трещинами. */
export function drawIce(ctx, x, y, s, l) {
  const m = s * 0.05;
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  if (l > 1) { g.addColorStop(0, '#d6f0ff'); g.addColorStop(1, '#79bff0'); } else { g.addColorStop(0, '#eef9ff'); g.addColorStop(1, '#b4def8'); }
  rr(ctx, x + m, y + m, s - m * 2, s - m * 2, s * 0.2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.strokeStyle = l > 1 ? 'rgba(80,150,215,.7)' : 'rgba(130,190,235,.6)'; ctx.stroke();
  // блики-полоски
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.beginPath(); ctx.moveTo(x + s * 0.18, y + s * 0.36); ctx.lineTo(x + s * 0.36, y + s * 0.18); ctx.moveTo(x + s * 0.2, y + s * 0.54); ctx.lineTo(x + s * 0.3, y + s * 0.44); ctx.stroke();
  if (l > 1) { // трещины + иней по краю
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath(); ctx.moveTo(x + s * 0.62, y + s * 0.88); ctx.lineTo(x + s * 0.7, y + s * 0.7); ctx.lineTo(x + s * 0.86, y + s * 0.64); ctx.moveTo(x + s * 0.7, y + s * 0.7); ctx.lineTo(x + s * 0.66, y + s * 0.58); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const [a, b] of [[0.82, 0.18], [0.14, 0.84], [0.88, 0.4]]) { ctx.beginPath(); ctx.arc(x + s * a, y + s * b, s * 0.035, 0, TAU); ctx.fill(); }
  }
}

/** Подарок (закрывает клетку): 1 слой — розовая коробка, 2 слоя — сиреневая в горошек. */
export function drawCrate(ctx, x, y, s, l) {
  const m = s * 0.09, bx = x + m, by = y + s * 0.26, bw = s - m * 2, bh = s * 0.66;
  const base = l > 1 ? ['#b98cf5', '#8a58d8', '#6a3cb8'] : ['#ff9cb8', '#ff6f98', '#d9466f'];
  ctx.save();
  ctx.shadowColor = 'rgba(80,30,70,.28)'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetY = s * 0.04;
  const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
  rr(ctx, bx, by, bw, bh, s * 0.1); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = s * 0.035; ctx.strokeStyle = base[2]; ctx.stroke();
  if (l > 1) { ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(bx + bw * (0.18 + (i % 3) * 0.32), by + bh * (0.3 + Math.floor(i / 3) * 0.42), s * 0.035, 0, TAU); ctx.fill(); } }
  // крышка
  const lg = ctx.createLinearGradient(0, y + s * 0.16, 0, y + s * 0.34); lg.addColorStop(0, base[0]); lg.addColorStop(1, base[1]);
  rr(ctx, x + m * 0.6, y + s * 0.17, s - m * 1.2, s * 0.17, s * 0.07); ctx.fillStyle = lg; ctx.fill(); ctx.stroke();
  // лента
  ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#e0a51c'; ctx.lineWidth = s * 0.02;
  ctx.fillRect(x + s * 0.43, y + s * 0.17, s * 0.14, s * 0.75);
  if (l > 1) ctx.fillRect(bx, by + bh * 0.45, bw, s * 0.1);
  // бант
  ctx.beginPath(); ctx.ellipse(x + s * 0.36, y + s * 0.12, s * 0.13, s * 0.08, -0.5, 0, TAU); ctx.ellipse(x + s * 0.64, y + s * 0.12, s * 0.13, s * 0.08, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.15, s * 0.055, 0, TAU); ctx.fill(); ctx.stroke();
  // блик
  ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, bx + bw * 0.08, by + bh * 0.1, bw * 0.18, bh * 0.12, s * 0.04); ctx.fill();
  ctx.restore();
}

/** Заморозка поверх фишки: ледяной кубик; 2 слоя — толще, со снежинкой. */
export function drawLock(ctx, x, y, s, l) {
  const m = s * 0.06;
  ctx.save();
  rr(ctx, x + m, y + m, s - m * 2, s - m * 2, s * 0.2);
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, l > 1 ? 'rgba(235,248,255,.86)' : 'rgba(235,248,255,.6)'); g.addColorStop(1, l > 1 ? 'rgba(160,210,250,.78)' : 'rgba(180,220,250,.5)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2, s * (l > 1 ? 0.07 : 0.045)); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
  // иней по углам
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const [a, b, rad] of [[0.14, 0.14, 0.09], [0.24, 0.1, 0.05], [0.1, 0.25, 0.05], [0.86, 0.86, 0.08], [0.76, 0.9, 0.04]]) { ctx.beginPath(); ctx.arc(x + s * a, y + s * b, s * rad * (l > 1 ? 1.2 : 0.8), 0, TAU); ctx.fill(); }
  // снежинка
  const cx = x + s * 0.76, cy = y + s * 0.24, r = s * (l > 1 ? 0.13 : 0.1);
  ctx.strokeStyle = '#5aa8e8'; ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < 3; i++) { const a = i * PI / 3; ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.stroke();
  ctx.restore();
}

/* ---------- старые бишоны на canvas (оставлены для совместимости; новые — в characters.js) ---------- */
export function drawBichon(ctx, cx, cy, s, tall) {
  const sx = tall ? 0.82 : 1.18, legY = tall ? 0.5 : 0.4, headY = tall ? -0.34 : -0.24, puffs = [];
  const P = (x, y, r) => puffs.push([cx + x * s * sx, cy + y * s, r * s]);
  P(-0.12, legY, 0.1); P(0.12, legY, 0.1); if (!tall) { P(-0.3, 0.24, 0.2); P(0.3, 0.24, 0.2); }
  P(0, 0.18, tall ? 0.26 : 0.33); P(-0.16, 0.1, 0.2); P(0.16, 0.1, 0.2); P(-0.27, headY + 0.06, 0.15); P(0.27, headY + 0.06, 0.15);
  P(0, headY, 0.29); P(0, headY - 0.26, 0.14); P(-0.14, headY - 0.21, 0.12); P(0.14, headY - 0.21, 0.12);
  ctx.fillStyle = '#d7cfdd'; puffs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y + s * 0.02, r + s * 0.025, 0, TAU); ctx.fill(); });
  ctx.fillStyle = '#fff'; puffs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
  const hy = cy + headY * s, ex = 0.1 * s * sx;
  ctx.fillStyle = '#2a1d2e'; ctx.beginPath(); ctx.arc(cx - ex, hy - s * 0.03, s * 0.042, 0, TAU); ctx.arc(cx + ex, hy - s * 0.03, s * 0.042, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, hy + s * 0.07, s * 0.048, 0, TAU); ctx.fill();
}
export function bichonCanvas(px, tall) {
  const d = window.devicePixelRatio || 1, c = document.createElement('canvas'); c.width = px * d; c.height = px * d; c.style.width = px + 'px'; c.style.height = px + 'px';
  const x = c.getContext('2d'); x.scale(d, d); drawBichon(x, px / 2, px * 0.52, px * 0.82, tall); return c;
}

/* ---------- иконки целей (кэш dataURL) ---------- */
const iconCache = {};
export function iconURL(kind, c) {
  const key = kind + (c ?? ''); if (iconCache[key]) return iconCache[key];
  const S = 96, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  if (kind === 'col') drawPiece(x, c, S / 2, S / 2, S * 0.36);
  else if (kind === 'ice') drawIce(x, 8, 8, S - 16, 2);
  else if (kind === 'crate') drawCrate(x, 4, 4, S - 8, 1);
  else if (kind === 'lock') { drawPiece(x, 1, S / 2, S / 2, S * 0.3); drawLock(x, 6, 6, S - 12, 1); }
  else if (kind === 'score') { x.translate(S / 2, S / 2 + 3); x.lineJoin = 'round'; starPath(x, 0, 0, S * 0.42, S * 0.2, 5); x.fillStyle = '#ffc93c'; x.strokeStyle = '#d9a21c'; x.lineWidth = 6; x.stroke(); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-8, -10, 9, 5, -0.5, 0, TAU); x.fill(); }
  else if (kind === 'choco') { rr(x, 12, 12, S - 24, S - 24, 14); x.fillStyle = '#8a4f2e'; x.fill(); x.strokeStyle = '#5e321b'; x.lineWidth = 5; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 3; x.beginPath(); x.moveTo(S / 2, 16); x.lineTo(S / 2, S - 16); x.moveTo(16, S / 2); x.lineTo(S - 16, S / 2); x.stroke(); }
  else if (kind === 'pacifier') { x.fillStyle = '#ffb3c8'; x.beginPath(); x.ellipse(S / 2, S * 0.56, S * 0.34, S * 0.17, 0, 0, TAU); x.fill(); x.strokeStyle = '#ff7aa2'; x.lineWidth = 7; x.beginPath(); x.arc(S / 2, S * 0.3, S * 0.17, 0, TAU); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(S / 2, S * 0.56, S * 0.08, 0, TAU); x.fill(); }
  else { drawPiece(x, 0, S / 2, S / 2, S * 0.36); }
  return iconCache[key] = cv.toDataURL();
}

/** Звезда для HUD/карты/победы (SVG-строка). */
export function starSVG(on) {
  return `<svg viewBox="0 0 24 24" class="star${on ? ' on' : ''}" aria-hidden="true"><path d="M12 2.6c.5 0 .9.3 1.1.7l2.2 4.6 5 .7c1 .1 1.4 1.3.7 2l-3.7 3.5.9 5c.2 1-.9 1.7-1.7 1.2L12 18l-4.5 2.4c-.9.5-1.9-.3-1.7-1.2l.9-5L3 10.6c-.7-.7-.3-1.9.7-2l5-.7 2.2-4.6c.2-.4.6-.7 1.1-.7z" fill="${on ? '#ffc93c' : '#eadff0'}" stroke="${on ? '#e09a12' : '#d6c6de'}" stroke-width="1.4" stroke-linejoin="round"/>${on ? '<path d="M8.6 8.9l1.5-.2 1-2" fill="none" stroke="#fff6c8" stroke-width="1.5" stroke-linecap="round"/>' : ''}</svg>`;
}
