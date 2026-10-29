// Секретная концовка: письмо от Антона Оле. Текст письма — в файле letter.html (блок #letter-body),
// чтобы его было легко отредактировать без программирования.
import { app, persist, modal, closeModal, onTap, sound } from './app.js';
import { avatarSVG, bichonSVG } from '../render/characters.js';
import { confetti } from '../render/confetti.js';

const LAST = 120;
export const letterUnlocked = () => (app.save.stars[LAST] || 0) > 0 || !!app.save.letterSeen;

/** Достать тело письма из letter.html (офлайн — из кеша service worker). */
async function loadBody() {
  try {
    const res = await fetch('letter.html', { cache: 'no-cache' });
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const el = doc.getElementById('letter-body');
    if (el) return el.innerHTML.trim();
  } catch (e) { /* офлайн без кеша */ }
  return '<!-- ТЕКСТ АНТОНА -->';
}

export async function openLetter() {
  const body = await loadBody();
  app.save.letterSeen = true; persist();
  sound.music(null); sound.play('win');
  const m = modal(`
    <div class="envelope" aria-hidden="true"><div class="flap"></div><div class="seal">${heart}</div></div>
    <p class="letter-to">Оле</p>
    <div class="letter-paper"><div class="letter-body" id="letterBody">${body}</div></div>
    <div class="letter-fam" aria-hidden="true">${['anton', 'lenya', 'sasha', 'masha'].map(w => avatarSVG(w, { badge: true })).join('')}${bichonSVG('chapa', 'happy')}${bichonSVG('pusha', 'happy')}</div>
    <div class="btns"><button class="btn" id="letterClose">Обнять всех</button></div>`, { cls: 'letter' });
  onTap(m.querySelector('#letterClose'), () => { closeModal(); confetti(160, 'top'); });
}

const heart = '<svg viewBox="0 0 24 24"><path d="M12 21C4 15 2 11 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3-2 7-10 13z" fill="#fff"/></svg>';
