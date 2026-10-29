// Загрузчик СТАРОГО кода игры (tests/fixtures/legacy-index.html — копия index.html до рефакторинга).
// Вырезаем из inline-скрипта генератор уровней и игровую логику и исполняем их в node:vm
// с заглушками вместо DOM, звука, частиц и анимаций. Нужен, чтобы сравнивать новый движок со старым.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = readFileSync(new URL('../fixtures/legacy-index.html', import.meta.url), 'utf8');
const SCRIPT = HTML.slice(HTML.indexOf('<script>') + 8, HTML.indexOf('</script>'));

function between(startMarker, endMarker) {
  const s = SCRIPT.indexOf(startMarker);
  const e = SCRIPT.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error('Маркер не найден: ' + startMarker + ' / ' + endMarker);
  return SCRIPT.slice(s, e);
}

const GEN_SRC = between('function makeRng', '/* ================= game state');
// Логика: тайлы, заполнение, матчи, взрывы, гравитация, ход, бонус, перемешивание.
const LOGIC_SRC = [
  between('let tileId=0;', 'function startLevel'),
  between('/* ---------- matching', '/* ---------- boosters'),
  between('async function useChapa', '/* ================= animation loop'),
].join('\n')
  // частицы и всплывающие надписи — визуал, в логике не нужны (и не должны тратить Math.random)
  .replace(/^function burst\(.*$/m, 'function burst(){}')
  .replace(/^function popup\(.*$/m, 'function popup(){}');

/** Старый genLevel(n) */
export function legacyGenLevel() {
  const ctx = vm.createContext({});
  vm.runInContext(`${GEN_SRC}\nthis.genLevel=genLevel;this.makeRng=makeRng;`, ctx);
  return { genLevel: ctx.genLevel, makeRng: ctx.makeRng };
}

/**
 * Старая игра уровня n с подменённым Math.random = rng.
 * Возвращает { G, trySwap, useChapa, shuffle } — все async, но без реальных ожиданий.
 */
export function legacyGame(n, rng) {
  const ctx = vm.createContext({});
  ctx.__rng = rng;
  const stubs = `
    Math.random=()=>__rng();
    const PI=Math.PI,TAU=PI*2;
    const COLORS=Array.from({length:6},()=>({main:'#000'}));
    const COMBO_TXT=['', '', 'Отлично!', 'Супер!', 'Оля, ты чудо!', 'Невероятно!', 'Вау-вау-вау!'];
    const save={boost:{chapa:9,pusha:9,masha:9},sound:false};
    let G=null;
    const sleep=()=>Promise.resolve(), waitSettled=()=>Promise.resolve();
    const tone=()=>{}, updateHUD=()=>{}, persist=()=>{}, updateBoosters=()=>{};
    const sfx={pop(){},swap(){},bad(){},special(){},win(){},lose(){},woof(){}};
    const $=()=>({textContent:''});
    const WORLDS=[{name:''},{name:''},{name:''},{name:''},{name:''},{name:''}];
    let result=null; function win(){result='win';} function lose(){result='lose';}
  `;
  // Инициализация — дословно как в старом startLevel (без DOM).
  const init = `
    const cfg=genLevel(${n});
    G={n:${n},cfg,w:cfg.w,h:cfg.h,mask:cfg.mask,ice:cfg.ice.map(r=>r.slice()),crate:cfg.crate.map(r=>r.slice()),
       tiles:null,moves:cfg.moves,score:0,goals:cfg.goals.map(g=>({...g})),busy:true,over:false,extraUsed:false,
       selected:null,booster:null,idle:0,hint:null,chain:1,dying:[],parts:[],pops:[],fx:[],banner:null,cs:40};
    fillBoard();
    if(cfg.locks){
      const cand=[];for(let y=0;y<G.h;y++)for(let x=0;x<G.w;x++)if(G.tiles[y][x])cand.push(G.tiles[y][x]);
      cand.sort(()=>Math.random()-.5);let placed=0;
      for(const t of cand){if(placed>=cfg.locks)break;t.lock=Math.random()<cfg.lockDouble?2:1;placed++;}
      const g=G.goals.find(g=>g.kind==='lock');if(g){g.n=g.left=placed;}
    }
    G.busy=false;
    this.api={
      get G(){return G;}, get result(){return result;},
      findMove, findGroups,
      async trySwap(a,b){G.busy=false;await trySwap(a,b);},
      async useChapa(x,y){G.busy=false;await useChapa(x,y);},
      async pusha(){G.busy=true;await shuffleBoard('Пуша всё перемешал!');await cascade(null);G.busy=false;},
      addMoves(k){G.moves+=k;},
    };
  `;
  vm.runInContext(stubs + GEN_SRC + LOGIC_SRC + init, ctx);
  return ctx.api;
}

/** Снимок состояния старой игры в нейтральном формате для сравнения. */
export function legacySnapshot(api) {
  const G = api.G;
  return {
    tiles: G.tiles.map(row => row.map(t => (t ? { c: t.c, sp: t.sp || null, lock: t.lock } : null))),
    ice: G.ice.map(r => r.slice()),
    crate: G.crate.map(r => r.slice()),
    score: G.score,
    moves: G.moves,
    goals: G.goals.map(g => g.left),
  };
}
