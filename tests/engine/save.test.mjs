// Миграция сохранений olya-shariki-v1 → olya-shariki-v2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, migrate, SAVE_KEY, SAVE_KEY_V1 } from '../../src/save.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

const V1 = { stars: { 1: 3, 2: 2, 3: 1, 17: 3 }, best: { 1: 5400, 17: 12000 }, boost: { chapa: 1, pusha: 0 }, sound: false };

test('пустое хранилище → значения по умолчанию v2', () => {
  const s = loadSave(memStorage());
  assert.equal(s.version, 2);
  assert.deepEqual(s.stars, {});
  assert.deepEqual(s.boost, { chapa: 3, pusha: 3, masha: 2 });
  assert.equal(s.sound, true);
});

test('v1 → v2: звёзды, рекорды, бустеры и звук сохраняются, v2 записан, v1 не удалён', () => {
  const st = memStorage({ [SAVE_KEY_V1]: JSON.stringify(V1) });
  const s = loadSave(st);
  assert.equal(s.version, 2);
  assert.deepEqual(s.stars, V1.stars);
  assert.deepEqual(s.best, V1.best);
  assert.deepEqual(s.boost, { chapa: 1, pusha: 0, masha: 2 }); // недостающий masha — по умолчанию, как в старом коде
  assert.equal(s.sound, false);
  assert.deepEqual(JSON.parse(st.getItem(SAVE_KEY)), s);
  assert.ok(st.getItem(SAVE_KEY_V1));
});

test('если v2 уже есть — v1 игнорируется', () => {
  const v2 = { version: 2, stars: { 1: 1 }, best: {}, boost: { chapa: 0, pusha: 0, masha: 0 }, sound: true };
  const s = loadSave(memStorage({ [SAVE_KEY_V1]: JSON.stringify(V1), [SAVE_KEY]: JSON.stringify(v2) }));
  assert.deepEqual(s.stars, { 1: 1 });
});

test('битый JSON не ломает игру', () => {
  const s = loadSave(memStorage({ [SAVE_KEY_V1]: '{oops' }));
  assert.equal(s.version, 2);
  assert.deepEqual(s.stars, {});
});

test('writeSave → loadSave туда-обратно', () => {
  const st = memStorage();
  const s = migrate(V1);
  s.stars[5] = 2;
  writeSave(s, st);
  assert.deepEqual(loadSave(st), s);
});

test('хранилище, бросающее исключения, не роняет запись', () => {
  const st = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.doesNotThrow(() => writeSave(migrate(V1), st));
});
