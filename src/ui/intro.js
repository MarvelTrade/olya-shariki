// Окно «Уровень N» перед стартом.
import { app, modal, closeModal } from './app.js';
import { genLevel, WORLDS } from '../levels/index.js';
import { COLORS } from '../render/palette.js';
import { iconURL, starSVG } from '../render/draw.js';
import { startLevel } from './game-screen.js';

export function goalText(g) {
  if (g.kind === 'col') return `Собери ${COLORS[g.c].name}`;
  if (g.kind === 'ice') return 'Растопи весь лёд';
  if (g.kind === 'crate') return 'Открой все подарки';
  if (g.kind === 'lock') return 'Разморозь шарики';
  return `Набери ${g.n.toLocaleString('ru-RU')} очков`;
}

export function openIntro(n) {
  const save = app.save;
  const cfg = genLevel(n), W = WORLDS[cfg.world], st = save.stars[n] || 0;
  const rows = cfg.goals.map(g => `<div class="goal" style="justify-content:flex-start"><img alt="" src="${iconURL(g.kind, g.c)}"><span style="font-size:14px;font-weight:800;text-align:left">${goalText(g)}${g.kind === 'score' ? '' : ': <b>' + g.n + '</b>'}</span></div>`).join('');
  const m = modal(`<h2>Уровень ${n}</h2><p class="sub">${W.name} · ${cfg.moves} ходов</p>
    <div class="bigstars" style="margin:0 0 6px">${[1, 2, 3].map(i => starSVG(i <= st)).join('')}</div>
    <div class="goals" style="flex-direction:column;align-items:stretch">${rows}</div>
    ${save.best[n] ? `<p class="small">Лучший счёт: ${save.best[n].toLocaleString('ru-RU')}</p>` : ''}
    <div class="btns"><button class="btn" id="mPlay">Играть!</button><button class="btn alt" id="mClose">На карту</button></div>`);
  m.querySelector('#mPlay').onclick = () => { closeModal(); startLevel(n); };
  m.querySelector('#mClose').onclick = closeModal;
}
