// Карта уровней: извилистая тропинка снизу вверх, 6 миров по 20 уровней.
import { app, $, persist } from './app.js';
import { LEVELS, WORLDS } from '../levels/index.js';
import { bichonCanvas, starSVG } from '../render/draw.js';
import { setSoundEnabled, sfx } from '../audio/sound.js';
import { openIntro } from './intro.js';

const STEP = 94, TOP_PAD = 170, BOTTOM_PAD = 230;
const mapH = () => TOP_PAD + (LEVELS - 1) * STEP + BOTTOM_PAD;
const posY = i => mapH() - BOTTOM_PAD - (i - 1) * STEP;
const posX = i => 0.5 + 0.3 * Math.sin((i - 1) * 0.62);

export const unlocked = n => n === 1 || (app.save.stars[n - 1] || 0) > 0;
export function currentLevel() { for (let i = 1; i <= LEVELS; i++) if (!app.save.stars[i]) return i; return LEVELS; }

export function buildMap() {
  const save = app.save;
  const inner=$('#mapInner'),H=mapH();inner.innerHTML='';inner.style.height=H+'px';
  WORLDS.forEach((W,wi)=>{
    const top=wi===WORLDS.length-1?0:posY(wi*20+20)-STEP/2,bot=wi===0?H:posY(wi*20+1)+STEP/2;
    const d=document.createElement('div');d.className='world-bg';d.style.top=top+'px';d.style.height=(bot-top)+'px';d.style.background=`linear-gradient(0deg,${W.bg[0]},${W.bg[1]})`;inner.appendChild(d);
  });
  const pts=[];for(let i=1;i<=LEVELS;i++)pts.push([posX(i)*100,posY(i)]);
  let d=`M${pts[0][0]} ${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;d+=` C${p1[0]+(p2[0]-p0[0])/6} ${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6} ${p2[1]-(p3[1]-p1[1])/6} ${p2[0]} ${p2[1]}`;}
  inner.insertAdjacentHTML('beforeend',`<svg id="mapSvg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="22" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="rgba(255,92,138,.18)" stroke-width="8" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`);
  WORLDS.forEach((W,wi)=>{
    const b=document.createElement('div');b.className='banner';b.style.top=(posY(wi*20+1)+48)+'px';
    b.innerHTML=`<b>${W.name}</b><span>${W.note}</span>`;
    if(wi===0){b.style.top=(posY(1)+60)+'px';}
    inner.appendChild(b);
  });
  const fin=document.createElement('div');fin.className='banner';fin.style.top='24px';fin.innerHTML='<b>Финиш: все вместе</b><span>Оля, Антон, Лёня, Саша, Маша, Чапа и Пуша</span>';inner.appendChild(fin);
  const cur=currentLevel();
  for(let i=1;i<=LEVELS;i++){
    const W=WORLDS[Math.floor((i-1)/20)],st=save.stars[i]||0,un=unlocked(i);
    const b=document.createElement('button');b.className='node'+(un?'':' locked')+(i===cur&&un?' cur':'')+(i%10===0?' big':'');
    b.style.left=posX(i)*100+'%';b.style.top=posY(i)+'px';b.style.background=W.node;b.textContent=i;
    b.setAttribute('aria-label','Уровень '+i);
    if(st||un&&i<cur){const s=document.createElement('span');s.className='st';s.innerHTML=[1,2,3].map(k=>starSVG(k<=st)).join('');b.appendChild(s);}
    if(un)b.onclick=()=>openIntro(i);
    inner.appendChild(b);
  }
  const px=posX(cur),pet=bichonCanvas(62,cur%2===1);pet.className='pet';
  pet.style.left=`calc(${(px>.5?px-.17:px+.17)*100}% - 31px)`;pet.style.top=(posY(cur)-40)+'px';inner.appendChild(pet);
  const start=document.createElement('div');start.className='banner';start.style.top=(H-120)+'px';start.style.display='flex';start.style.alignItems='center';start.style.gap='8px';start.style.justifyContent='center';
  start.append(bichonCanvas(56,true));const tx=document.createElement('div');tx.innerHTML='<b style="font-size:16px">Для Оли</b><span>с любовью от Антона, детей и собак</span>';start.append(tx,bichonCanvas(56,false));inner.appendChild(start);
  let total=0;for(const k in save.stars)total+=save.stars[k];
  $('#totalStars').innerHTML=starSVG(true)+`${total} / ${LEVELS*3}`;
  $('#soundBtn').textContent=save.sound?'Звук: вкл':'Звук: выкл';
}

export function scrollToCurrent() { const sc = $('#mapScroll'); sc.scrollTop = posY(currentLevel()) - sc.clientHeight * 0.55; }

export function initMap() {
  $('#soundBtn').addEventListener('click', () => {
    const save = app.save;
    save.sound = !save.sound; setSoundEnabled(save.sound); persist();
    $('#soundBtn').textContent = save.sound ? 'Звук: вкл' : 'Звук: выкл';
    if (save.sound) sfx.toggle();
  });
}
