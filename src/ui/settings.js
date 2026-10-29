// Настройки: звуки, музыка, тихий режим «Маша спит», вибрация, громкость.
import { app, persist, modal, closeModal, sound, onTap } from './app.js';
import { avatarSVG } from '../render/characters.js';

const row = (id, title, sub, on, icon = '') => `
  <label class="set-row" for="${id}">
    ${icon ? `<span class="set-ic" aria-hidden="true">${icon}</span>` : ''}
    <span class="set-txt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" role="switch" id="${id}" ${on ? 'checked' : ''}><span class="switch" aria-hidden="true"></span>
  </label>`;

const ICON = {
  sfx: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ff7aa2"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#ff7aa2" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 17V6l10-2v11" stroke="#a764f4" stroke-width="2.2" fill="none" stroke-linejoin="round"/><circle cx="7" cy="17" r="3" fill="#a764f4"/><circle cx="17" cy="15" r="3" fill="#a764f4"/></svg>',
  vibro: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="18" rx="2.5" fill="#3f8cff"/><path d="M4 8v8M20 8v8" stroke="#3f8cff" stroke-width="2" stroke-linecap="round"/></svg>',
};

/** Открыть настройки. onClose — вернуть то, что было (пауза, карта). */
export function openSettings(onClose) {
  const S = sound.get();
  const m = modal(`
    <h2>Настройки</h2>
    <div class="set-list">
      ${row('setSfx', 'Звуки', 'лопанье шариков и лай', S.sfx, ICON.sfx)}
      ${row('setMusic', 'Музыка', 'своя мелодия в каждом мире', S.music, ICON.music)}
      <div class="set-vol"><span>Громкость звуков</span><input type="range" id="setSfxVol" min="0" max="1" step="0.05" value="${S.sfxVol ?? 0.8}" aria-label="Громкость звуков"></div>
      <div class="set-vol"><span>Громкость музыки</span><input type="range" id="setMusicVol" min="0" max="1" step="0.05" value="${S.musicVol ?? 0.5}" aria-label="Громкость музыки"></div>
      ${row('setQuiet', 'Тихий режим', 'Маша спит — всё звучит шёпотом', S.quiet, `<span class="masha-ic">${avatarSVG('masha')}</span>`)}
      ${row('setVibro', 'Вибрация', 'лёгкие толчки на взрывах', app.save.vibro !== false, ICON.vibro)}
    </div>
    <p class="small set-foot">Сделано с любовью для Оли. Без рекламы, без покупок, без интернета — только семья и шарики.</p>
    <div class="btns"><button class="btn" id="setDone">Готово</button></div>`, { cls: 'settings', onClose });
  const q = s => m.querySelector(s);
  q('#setSfx').onchange = e => { sound.set({ sfx: e.target.checked }); sound.play('toggle'); };
  q('#setMusic').onchange = e => { sound.unlock(); sound.set({ music: e.target.checked }); };
  q('#setQuiet').onchange = e => { sound.set({ quiet: e.target.checked }); sound.play('toggle'); };
  q('#setVibro').onchange = e => { app.save.vibro = e.target.checked; persist(); if (e.target.checked) try { navigator.vibrate?.(30); } catch (_) { /* */ } };
  q('#setSfxVol').onchange = e => { sound.set({ sfxVol: +e.target.value }); sound.play('pop', 2); };
  q('#setMusicVol').oninput = e => sound.set({ musicVol: +e.target.value });
  onTap(q('#setDone'), closeModal);
}
