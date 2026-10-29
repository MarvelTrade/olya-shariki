// Интро уровня: номер, мир, «хозяин» мира с подсказкой, цели и кнопка «Играть!».
import { app, modal, closeModal, onTap } from './app.js';
import { genLevel, WORLDS } from '../levels/index.js';
import { COLORS } from '../render/palette.js';
import { iconURL, starSVG } from '../render/draw.js';
import { avatarSVG } from '../render/characters.js';
import { WORLD_HOST, INTRO_TIPS } from './texts.js';
import { startLevel } from './game-screen.js';

export function goalText(g) {
  if (g.kind === 'col') return `Собери ${COLORS[g.c]?.name || 'шарики'}`;
  if (g.kind === 'ice') return 'Растопи весь лёд';
  if (g.kind === 'crate') return 'Открой все подарки';
  if (g.kind === 'lock') return 'Разморозь шарики';
  if (g.kind === 'choco') return 'Убери весь шоколад';
  if (g.kind === 'pacifier') return 'Спусти соски Маше вниз';
  if (g.kind === 'score') return `Набери ${g.n.toLocaleString('ru-RU')} очков`;
  return 'Выполни задание';
}

const pick = a => a[Math.floor(Math.random() * a.length)];

export function openIntro(n) {
  const save = app.save;
  const cfg = genLevel(n), wi = cfg.world ?? Math.floor((n - 1) / 20), W = WORLDS[wi] || WORLDS[0], st = save.stars[n] || 0;
  const host = WORLD_HOST[wi] || 'olya';
  const tip = cfg.tutorial?.text || pick(INTRO_TIPS[host] || INTRO_TIPS.olya);
  const rows = cfg.goals.map(g => `<li><img alt="" src="${iconURL(g.kind, g.c)}"><span>${goalText(g)}</span>${g.kind === 'score' ? '' : `<b>${g.n}</b>`}</li>`).join('');
  const hard = cfg.type === 'hard';
  const m = modal(`
    <div class="intro-head" style="--acc:${W.node}">
      <span class="lvl-badge">${n}</span>
      <div><small>${W.name}</small><h2>Уровень ${n}</h2></div>
    </div>
    <div class="bigstars sm">${[1, 2, 3].map(i => starSVG(i <= st)).join('')}</div>
    ${hard ? '<p class="hard-tag">Сложный уровень — Пуша верит в тебя</p>' : ''}
    <ul class="goal-list">${rows}</ul>
    <div class="speech"><span class="sp-av">${avatarSVG(host, { badge: true, emo: 'wait' })}</span><p>${tip}</p></div>
    <p class="small">${cfg.moves} ходов${save.best[n] ? ` · рекорд ${save.best[n].toLocaleString('ru-RU')}` : ''}</p>
    <div class="btns row"><button class="btn alt" id="mClose">Назад</button><button class="btn big" id="mPlay">Играть!</button></div>`, { cls: 'intro' });
  onTap(m.querySelector('#mPlay'), () => { closeModal(); startLevel(n); });
  onTap(m.querySelector('#mClose'), closeModal);
  setTimeout(() => m.querySelector('#mPlay')?.focus({ preventScroll: true }), 30);
}
