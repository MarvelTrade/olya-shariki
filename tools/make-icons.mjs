// Генератор иконок PWA без внешних зависимостей и сервисов.
// Иконка описана набором примитивов (многоугольники с заливкой/градиентом); из них получаем
// и SVG (icons/icon.svg), и PNG (192, 512, maskable 512, apple-touch 180) — свой растеризатор + zlib.
// Запуск: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../icons/', import.meta.url);
const V = 512; // «виртуальный» размер холста, все координаты в нём

/* ---------- геометрия ---------- */
const heart = (cx, cy, s, n = 240) => {
  // классическая параметрическая кривая сердца
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + x * s, cy - y * s]);
  }
  return pts;
};
const ellipse = (cx, cy, rx, ry, rot = 0, n = 128) => {
  const pts = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return pts;
};
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/* ---------- цвета ---------- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const stopsAt = (stops, t) => {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i]; return lerp(hex(c0), hex(c1), (t - t0) / (t1 - t0 || 1)); }
  return hex(stops.at(-1)[1]);
};
// заливки: {solid:'#hex'} | {linear:{x1,y1,x2,y2,stops}} | {radial:{cx,cy,r,stops}}
const paintAt = (p, x, y) => {
  if (p.solid) return hex(p.solid);
  if (p.linear) { const L = p.linear, dx = L.x2 - L.x1, dy = L.y2 - L.y1; return stopsAt(L.stops, ((x - L.x1) * dx + (y - L.y1) * dy) / (dx * dx + dy * dy)); }
  const R = p.radial; return stopsAt(R.stops, Math.hypot(x - R.cx, y - R.cy) / R.r);
};

/* ---------- сама иконка: фон-градиент, сердечко Оли, мячик Лёни и солнышко Маши ---------- */
const H = heart(256, 236, 9.2);
const SHAPES = [
  { pts: rect(0, 0, V, V), paint: { linear: { x1: 0, y1: 0, x2: 0, y2: V, stops: [[0, '#fff1c2'], [0.55, '#ffc0d6'], [1, '#ff8fb3']] } } },
  { pts: heart(256, 252, 9.9), paint: { solid: '#43264a' }, alpha: 0.16 },
  { pts: heart(256, 236, 9.9), paint: { solid: '#ffffff' } },
  { pts: heart(256, 236, 9.6), paint: { solid: '#c9184a' } },
  { pts: H, paint: { radial: { cx: 205, cy: 170, r: 230, stops: [[0, '#ffc2cf'], [0.45, '#ff4d6d'], [1, '#c9184a']] } } },
  { pts: ellipse(196, 168, 52, 24, -0.5), paint: { solid: '#ffffff' }, alpha: 0.6 },
  // мячик
  { pts: ellipse(128, 392, 44, 44), paint: { solid: '#ffffff' } },
  { pts: ellipse(128, 392, 38, 38), paint: { radial: { cx: 116, cy: 378, r: 50, stops: [[0, '#bcd5ff'], [0.45, '#3a86ff'], [1, '#1c4fc4']] } } },
  { pts: ellipse(118, 378, 12, 6, -0.5), paint: { solid: '#ffffff' }, alpha: 0.65 },
  // солнышко
  { pts: ellipse(384, 392, 44, 44), paint: { solid: '#ffffff' } },
  { pts: ellipse(384, 392, 38, 38), paint: { radial: { cx: 372, cy: 378, r: 50, stops: [[0, '#fff2b0'], [0.45, '#ffc300'], [1, '#d98e00']] } } },
  { pts: ellipse(374, 378, 12, 6, -0.5), paint: { solid: '#ffffff' }, alpha: 0.65 },
];

/* ---------- SVG ---------- */
function toSVG() {
  let defs = '', body = '', id = 0;
  const f = n => +n.toFixed(2);
  for (const s of SHAPES) {
    let fill;
    if (s.paint.solid) fill = s.paint.solid;
    else {
      const gid = 'g' + id++;
      const st = (s.paint.linear || s.paint.radial).stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
      if (s.paint.linear) { const L = s.paint.linear; defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${L.x1}" y1="${L.y1}" x2="${L.x2}" y2="${L.y2}">${st}</linearGradient>`; }
      else { const R = s.paint.radial; defs += `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${R.cx}" cy="${R.cy}" r="${R.r}">${st}</radialGradient>`; }
      fill = `url(#${gid})`;
    }
    body += `<path d="M${s.pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L')}Z" fill="${fill}"${s.alpha != null ? ` fill-opacity="${s.alpha}"` : ''}/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${V} ${V}"><defs>${defs}</defs>${body}</svg>\n`;
}

/* ---------- растеризация (scanline, 8 подстрок на пиксель) ---------- */
function render(size) {
  const k = size / V, img = new Float32Array(size * size * 3), SS = 8;
  const cov = new Float32Array(size * size);
  for (const s of SHAPES) {
    cov.fill(0);
    const pts = s.pts.map(([x, y]) => [x * k, y * k]);
    let minY = Infinity, maxY = -Infinity; for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let py = Math.max(0, Math.floor(minY)); py < Math.min(size, Math.ceil(maxY)); py++) {
      for (let sub = 0; sub < SS; sub++) {
        const y = py + (sub + 0.5) / SS, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
          if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const a = Math.max(0, xs[i]), b = Math.min(size, xs[i + 1]); if (b <= a) continue;
          const ia = Math.floor(a), ib = Math.floor(b), row = py * size;
          if (ia === ib) { cov[row + ia] += (b - a) / SS; continue; }
          cov[row + ia] += (ia + 1 - a) / SS;
          for (let x = ia + 1; x < ib; x++) cov[row + x] += 1 / SS;
          if (ib < size) cov[row + ib] += (b - ib) / SS;
        }
      }
    }
    const al = s.alpha ?? 1;
    for (let i = 0; i < size * size; i++) {
      const c = Math.min(1, cov[i]) * al; if (!c) continue;
      const x = (i % size + 0.5) / k, y = (Math.floor(i / size) + 0.5) / k, col = paintAt(s.paint, x, y);
      for (let j = 0; j < 3; j++) img[i * 3 + j] = img[i * 3 + j] * (1 - c) + col[j] * c;
    }
  }
  return img;
}

/* ---------- PNG ---------- */
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const img = render(size), raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size * 3; x++) raw[y * (size * 3 + 1) + 1 + x] = Math.round(Math.max(0, Math.min(255, img[y * size * 3 + x])));
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // RGB, без прозрачности (для iOS)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('icon.svg', OUT), toSVG());
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(name, OUT), png(size));
  console.log('icons/' + name, size + '×' + size);
}
console.log('icons/icon.svg');
