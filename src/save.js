// Сохранения в localStorage.
// v1 (старый index.html): ключ 'olya-shariki-v1', {stars, best, boost, sound} без версии.
// v2: ключ 'olya-shariki-v2', {version: 2, stars, best, boost, sound}. Старый ключ не удаляем — на всякий случай.
export const SAVE_KEY_V1 = 'olya-shariki-v1';
export const SAVE_KEY = 'olya-shariki-v2';
export const SAVE_VERSION = 2;

export function defaultSave() {
  return { version: SAVE_VERSION, stars: {}, best: {}, boost: { chapa: 3, pusha: 3, masha: 2 }, sound: true };
}

/** Привести любой сохранённый объект (v1 или v2) к формату v2. Звёзды и рекорды не теряются. */
export function migrate(raw) {
  const s = defaultSave();
  if (!raw || typeof raw !== 'object') return s;
  // так же, как старый код: Object.assign поверх значений по умолчанию
  if (raw.stars && typeof raw.stars === 'object') s.stars = { ...raw.stars };
  if (raw.best && typeof raw.best === 'object') s.best = { ...raw.best };
  s.boost = Object.assign({ chapa: 3, pusha: 3, masha: 2 }, raw.boost || {});
  if (typeof raw.sound === 'boolean') s.sound = raw.sound;
  // прочие поля (если появятся) сохраняем
  for (const k of Object.keys(raw)) if (!(k in s)) s[k] = raw[k];
  s.version = SAVE_VERSION;
  return s;
}

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch (e) { return null; }
}

/**
 * Загрузить сохранение. Если есть v2 — берём его; иначе мигрируем v1 и сразу пишем v2.
 * @param {Storage} [storage=globalThis.localStorage]
 */
export function loadSave(storage = globalThis.localStorage) {
  if (!storage) return defaultSave();
  const v2 = read(storage, SAVE_KEY);
  if (v2) return migrate(v2);
  const v1 = read(storage, SAVE_KEY_V1);
  const s = migrate(v1);
  if (v1) writeSave(s, storage);
  return s;
}

export function writeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* приватный режим и т.п. */ }
}
