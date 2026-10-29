// Экраны победы (конфетти, звёзды по одной, собаки прыгают) и поражения (Пуша грустит, но приносит ходы).
import { modal, closeModal, sound, onTap, reducedMotion } from './app.js';
import { starSVG, iconURL } from '../render/draw.js';
import { bichonSVG, avatarSVG } from '../render/characters.js';
import { confetti } from '../render/confetti.js';
import { WIN_TITLE, LOSE_MSG, BOOSTERS, familyLine, WHO } from './texts.js';
import { openLetter } from './letter.js';

const fmt = n => n.toLocaleString('ru-RU');

/** Победа. info: {n, score, stars, gift, last}; act: {next, again, map}. */
export function showWin(info, act) {
  const line = familyLine();
  const speaker = line.who === 'chapa' || line.who === 'pusha' ? bichonSVG(line.who, 'happy') : avatarSVG(line.who, { badge: true });
  const m = modal(`
    <div class="ribbon"><span>${WIN_TITLE[info.stars] || 'Ура!'}</span></div>
    <div class="bigstars win-stars">${[1, 2, 3].map(i => `<span class="slot" data-i="${i}">${starSVG(false)}</span>`).join('')}</div>
    <p class="score-line"><b id="winScore">0</b> очков</p>
    <div class="pets-row">${bichonSVG('chapa', 'jump', 'hop')}${bichonSVG('pusha', 'happy', 'wag')}</div>
    <div class="speech"><span class="sp-av">${speaker}</span><p><b>${WHO[line.who]}:</b> ${line.text}</p></div>
    ${info.gift ? `<p class="gift">Подарок за три звезды: +1 ${BOOSTERS[info.gift].gift}</p>` : ''}
    ${info.last ? '<p class="msg">Оля, ты прошла все уровни! Семья гордится тобой. А ещё тебя ждёт письмо…</p>' : ''}
    <div class="btns">
      ${info.last ? '<button class="btn gold big" id="mLetter">Открыть письмо</button>' : ''}
      ${act.next ? `<button class="btn big" id="mNext">Дальше</button>` : ''}
      <div class="row"><button class="btn alt" id="mAgain">Ещё раз</button><button class="btn alt" id="mMap">На карту</button></div>
    </div>`, { cls: 'win' });
  sound.play('win');
  confetti(info.stars === 3 ? 170 : 110);
  // звёзды вылетают по одной
  const rm = reducedMotion();
  for (let i = 1; i <= info.stars; i++) {
    setTimeout(() => {
      const slot = m.querySelector(`.slot[data-i="${i}"]`); if (!slot) return;
      slot.innerHTML = starSVG(true); slot.classList.add('pop');
      sound.play('star', i);
      if (i === 3) confetti(60, 'top');
      try { navigator.vibrate?.(15); } catch (_) { /* */ }
    }, rm ? 0 : 450 + (i - 1) * 420);
  }
  // счёт набегает
  const el = m.querySelector('#winScore'), t0 = performance.now(), dur = rm ? 0 : 900;
  const tick = now => { if (!el.isConnected) return; const k = dur ? Math.min(1, (now - t0) / dur) : 1; el.textContent = fmt(Math.round(info.score * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const q = s => m.querySelector(s);
  if (q('#mLetter')) onTap(q('#mLetter'), () => { closeModal(); act.map(); openLetter(); });
  if (q('#mNext')) onTap(q('#mNext'), () => { closeModal(); act.next(); });
  onTap(q('#mAgain'), () => { closeModal(); act.again(); });
  onTap(q('#mMap'), () => { closeModal(); act.map(); });
}

/** Поражение. info: {goals, score, extraUsed}; act: {extra, again, map}. */
export function showLose(info, act) {
  const left = info.goals.filter(g => (g.kind === 'score' ? info.score < g.n : g.left > 0))
    .map(g => `<div class="goal"><img alt="" src="${iconURL(g.kind, g.c)}"><b>${g.kind === 'score' ? fmt(g.n - info.score) : g.left}</b></div>`).join('');
  const msg = LOSE_MSG[Math.floor(Math.random() * LOSE_MSG.length)];
  const speaker = msg.who === 'chapa' || msg.who === 'pusha' ? bichonSVG(msg.who, 'sad') : avatarSVG(msg.who, { badge: true });
  const m = modal(`
    <h2>Ходы кончились</h2><p class="sub">Осталось совсем чуть-чуть:</p>
    <div class="goals">${left}</div>
    <div class="pets-row sad">${bichonSVG('chapa', 'sad')}${bichonSVG('pusha', info.extraUsed ? 'sad' : 'wait')}</div>
    <div class="speech"><span class="sp-av">${speaker}</span><p><b>${WHO[msg.who]}:</b> ${msg.text}</p></div>
    <div class="btns">
      ${info.extraUsed ? '' : '<button class="btn gold big" id="mExtra">Пуша принёс +5 ходов</button>'}
      <div class="row"><button class="btn ${info.extraUsed ? '' : 'alt'}" id="mAgain">Заново</button><button class="btn alt" id="mMap">На карту</button></div>
    </div>`, { cls: 'lose' });
  sound.play('lose');
  const q = s => m.querySelector(s);
  if (q('#mExtra')) onTap(q('#mExtra'), () => { closeModal(); act.extra(); });
  onTap(q('#mAgain'), () => { closeModal(); act.again(); });
  onTap(q('#mMap'), () => { closeModal(); act.map(); });
}
