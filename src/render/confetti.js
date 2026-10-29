// Конфетти на весь экран (canvas поверх всего). Кусочки бумаги, сердечки и звёздочки семьи.
import { COLORS } from './palette.js';

let cv = null, ctx = null, parts = [], raf = 0, last = 0, dpr = 1;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas'); cv.id = 'confetti'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv); ctx = cv.getContext('2d');
}
function size() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
}

/** Выстрелить конфетти. n — количество, from — 'top' | 'sides'. */
export function confetti(n = 120, from = 'sides') {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) n = Math.min(n, 24);
  ensure(); size();
  const W = innerWidth, H = innerHeight, cols = [...COLORS.map(c => c.main), '#ffffff', '#ffe08a'];
  for (let i = 0; i < n; i++) {
    const side = from === 'top' ? -1 : (i % 2 ? 0 : 1);
    const x = from === 'top' ? Math.random() * W : side ? W + 10 : -10;
    const y = from === 'top' ? -20 - Math.random() * H * 0.3 : H * (0.45 + Math.random() * 0.2);
    const sp = from === 'top' ? 0 : (8 + Math.random() * 9) * (W / 400 + 0.6) * 60;
    const a = from === 'top' ? Math.PI / 2 : (side ? Math.PI + 0.55 + Math.random() * 0.6 : -0.55 - Math.random() * 0.6) - (side ? 0 : 0);
    parts.push({
      x, y, vx: from === 'top' ? (Math.random() - 0.5) * 60 : Math.cos(a) * sp * (side ? 1 : 1), vy: from === 'top' ? 80 + Math.random() * 120 : -Math.abs(Math.sin(a) * sp),
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 6 + Math.random() * 7, c: cols[i % cols.length],
      kind: i % 9 === 0 ? 'heart' : i % 7 === 0 ? 'star' : 'paper', life: 0, wob: Math.random() * 6,
    });
  }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => {
    p.life += dt; p.vy += 520 * dt; p.vx *= 1 - dt * 1.6; p.vy = Math.min(p.vy, 160 + p.s * 6);
    p.x += (p.vx + Math.sin(p.life * 5 + p.wob) * 30) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    if (p.kind === 'paper') { ctx.scale(1, Math.cos(p.life * 8 + p.wob)); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
    else if (p.kind === 'heart') { const s = p.s * 0.6; ctx.beginPath(); ctx.moveTo(0, s); ctx.bezierCurveTo(-s * 1.4, 0, -s * 0.7, -s * 1.1, 0, -s * 0.4); ctx.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.4, 0, 0, s); ctx.fill(); }
    else { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? p.s * 0.28 : p.s * 0.65; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); }
    ctx.restore();
    return p.y < innerHeight + 30 && p.life < 6;
  });
  if (parts.length) raf = requestAnimationFrame(frame);
  else { raf = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
}

export function stopConfetti() { parts = []; }
