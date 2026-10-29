// Общее состояние приложения: сохранение и текущий экран.
import { loadSave, writeSave } from '../save.js';

export const $ = s => document.querySelector(s);

export const app = {
  save: loadSave(),
  /** 'map' | 'game' */
  screen: 'map',
};

export function persist() { writeSave(app.save); }

export function show(name) {
  app.screen = name;
  $('#map').hidden = name !== 'map';
  $('#game').hidden = name !== 'game';
}

export function modal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="card" role="dialog">${html}</div>`;
  m.hidden = false;
  return m;
}
export function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
