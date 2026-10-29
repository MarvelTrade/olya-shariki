// PWA: все файлы игры перечислены в sw.js (иначе офлайн сломается), manifest и иконки на месте.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SW = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const ASSETS = [...SW.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]);

const walk = d => readdirSync(join(ROOT, d)).flatMap(f => { const p = join(d, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });

test('каждый файл src/, styles/, icons/ есть в кеше service worker', () => {
  for (const f of [...walk('src'), ...walk('styles'), ...walk('icons')].filter(f => !f.endsWith('.md'))) {
    assert.ok(ASSETS.includes(f), `sw.js: нет './${f}' в ASSETS`);
  }
});

test('все пути из ASSETS существуют', () => {
  for (const f of ASSETS) if (f) assert.ok(existsSync(join(ROOT, f)), f);
});

test('manifest.json валиден, иконки существуют', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'));
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, i.src)), i.src);
  assert.ok(existsSync(join(ROOT, 'icons/apple-touch-icon.png')));
});

test('index.html подключает manifest, apple-touch-icon и модуль main.js', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /<script type="module" src="src\/main\.js">/);
});
