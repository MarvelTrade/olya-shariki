// Общее состояние приложения: сохранение, текущий экран, модальные окна и мост к звуку.
import { loadSave, writeSave } from '../save.js';
import * as audio from '../audio/sound.js';

export const $ = s => document.querySelector(s);

export const app = {
  save: loadSave(),
  /** 'splash' | 'map' | 'game' */
  screen: 'splash',
};
if (app.save.vibro === undefined) app.save.vibro = true;

export function persist() { writeSave(app.save); }

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- звук: всё через проверку, чтобы не падать, если модуль ещё не умеет ---------- */
export const sound = {
  play(name, arg) { try { audio.playSfx?.(arg === undefined ? [name] : [name, arg]); } catch (e) { /* без звука */ } },
  music(i) { try { audio.setMusicWorld?.(i); } catch (e) { /* без музыки */ } },
  unlock() { try { audio.unlockAudio?.(); } catch (e) { /* */ } },
  init() {
    try { audio.initAudio?.(); } catch (e) { /* */ }
    try { audio.setSoundEnabled?.(true); } catch (e) { /* */ }
    // перенос старого флажка «Звук: выкл» из сохранения v1/v2 в настройки звука (один раз)
    if (app.save.sound === false && !app.save.audioMigrated) this.set({ sfx: false, music: false });
    if (!app.save.audioMigrated) { app.save.audioMigrated = true; persist(); }
  },
  get() {
    const d = { sfx: app.save.sound !== false, music: false, quiet: false, sfxVol: 0.8, musicVol: 0.5 };
    try { return Object.assign(d, audio.getAudioSettings?.() || {}); } catch (e) { return d; }
  },
  set(patch) {
    try { if (audio.setAudioSettings) audio.setAudioSettings(patch); else if ('sfx' in patch) audio.setSoundEnabled?.(patch.sfx); } catch (e) { /* */ }
    if ('sfx' in patch) { app.save.sound = !!patch.sfx; persist(); }
  },
};

/* ---------- экраны ---------- */
const SCREENS = ['splash', 'map', 'game'];
export function show(name) {
  app.screen = name;
  for (const s of SCREENS) { const el = $('#' + s); if (el) el.hidden = s !== name; }
}

/* ---------- модальное окно ---------- */
let onModalClose = null;
/**
 * Показать карточку поверх экрана. opts.cls — доп. класс карточки, opts.onClose — при закрытии.
 * Возвращает элемент #modal.
 */
export function modal(html, opts = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="card ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false; onModalClose = opts.onClose || null;
  requestAnimationFrame(() => m.querySelector('button')?.focus({ preventScroll: true }));
  return m;
}
export function closeModal() {
  const m = $('#modal'); m.hidden = true; m.innerHTML = '';
  const f = onModalClose; onModalClose = null; f?.();
}
/** Обёртка для кнопок: звук клика + действие. */
export function onTap(el, fn) { if (el) el.addEventListener('click', e => { sound.play('button'); fn(e); }); }
