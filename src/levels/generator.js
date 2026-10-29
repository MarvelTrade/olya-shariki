// Генератор уровней. Перенесён из старого index.html БЕЗ изменений логики:
// тест tests/engine/levels.test.mjs сверяет его со снапшотом старой версии.
import { makeRng } from './rng.js';

export const LEVELS = 120;

const grid = (w, h, v) => Array.from({ length: h }, () => Array(w).fill(v));

export const TEMPLATES = {
  heart:['.XXX.XXX.','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','.XXXXXXX.','..XXXXX..','...XXX...'],
  bone:['XX.....XX','XXX...XXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','XXX...XXX','XX.....XX'],
  house:['...XX...','..XXXX..','.XXXXXX.','XXXXXXXX','XXXXXXXX','XXXXXXXX','XXXXXXXX','XXXXXXXX'],
  cross:['..XXXXX..','..XXXXX..','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','..XXXXX..','..XXXXX..'],
  window:['XXXXXXXXX','XXXXXXXXX','XX.XXX.XX','XX.XXX.XX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX'],
};

/** Конфиг уровня n: размеры, маска, цвета, цели, лёд, ящики, заморозка, ходы, пороги звёзд. */
export function genLevel(n) {
  const r=makeRng(n*7919+13), pick=a=>a[Math.floor(r()*a.length)];
  let mask;
  if(n%10===0) mask=TEMPLATES.heart.map(s=>[...s].map(ch=>ch==='X'));
  else if(n%10===5&&n>10) mask=TEMPLATES.bone.map(s=>[...s].map(ch=>ch==='X'));
  else if(n>8&&r()<.35) mask=TEMPLATES[pick(['house','cross','window'])].map(s=>[...s].map(ch=>ch==='X'));
  else{
    const w=n<=3?7:7+Math.floor(r()*3), h=n<=3?7:7+Math.floor(r()*3), cut=n>12&&r()<.4?(r()<.5?1:2):0;
    mask=[];for(let y=0;y<h;y++){mask.push([]);for(let x=0;x<w;x++){const cx=Math.min(x,w-1-x),cy=Math.min(y,h-1-y);mask[y].push(!(cut&&cx+cy<cut));}}
  }
  const h=mask.length,w=mask[0].length;
  const colors=n<=6?4:(n<=30?5:(r()<.35?6:5));
  const forced={1:['score'],2:['col'],3:['col'],4:['ice'],5:['score'],9:['crate'],15:['lock']};
  let types;
  if(forced[n]) types=forced[n];
  else{
    const pool=['col','ice','col'];if(n>=7)pool.push('score');if(n>=9)pool.push('crate','crate');if(n>=15)pool.push('lock','lock');
    const cnt=n<12?1:(n<40?(r()<.45?2:1):(r()<.55?2:(r()<.5?3:1)));
    types=[];let g=0;while(types.length<cnt&&g++<60){const t=pick(pool);if(types.includes(t))continue;if(t==='score'&&cnt>1)continue;types.push(t);}
  }
  const scale=types.length>1?.7:1, ice=grid(w,h,0), crate=grid(w,h,0), goals=[];
  const rowCrates=y=>crate[y].filter(v=>v>0).length;
  function place(count,cond,set){let placed=0,tries=0;while(placed<count&&tries++<800){const x=Math.floor(r()*w),y=Math.floor(r()*h);if(!cond(x,y))continue;set(x,y);placed++;const mx=w-1-x;if(mx!==x&&cond(mx,y)){set(mx,y);placed++;}}}
  const crateCond=(x,y)=>mask[y][x]&&y>=2&&!crate[y][x]&&rowCrates(y)<w-4&&mask[y-1][x];
  if(types.includes('crate')){
    const cnt=Math.min(20,Math.round((4+n*.12)*scale)), dbl=n>35?Math.min(.5,(n-35)/120):0;
    place(cnt,crateCond,(x,y)=>{crate[y][x]=r()<dbl?2:1;});
  }else if(n>20&&r()<.4){place(2+Math.floor(r()*4),crateCond,(x,y)=>{crate[y][x]=1;});}
  if(types.includes('ice')){
    const cnt=Math.min(36,Math.round((8+n*.2)*scale)), dbl=n>25?Math.min(.5,(n-25)/150):0;
    place(cnt,(x,y)=>mask[y][x]&&!crate[y][x]&&!ice[y][x],(x,y)=>{ice[y][x]=r()<dbl?2:1;});
  }
  let locks=0;
  for(const t of types){
    if(t==='col'){
      const k=n===3?2:(n<10?1:1+Math.floor(r()*Math.min(3,1+n/30)));
      const cs=[...Array(colors).keys()].sort(()=>r()-.5).slice(0,k);
      const per=Math.round(Math.min(k===1?40:k===2?28:20,(k===1?14+n*.2:k===2?10+n*.12:8+n*.08)*scale));
      cs.forEach(c=>goals.push({kind:'col',c,n:per,left:per}));
    }
    if(t==='ice'){let c=0;ice.forEach(row=>row.forEach(v=>{if(v)c++;}));goals.push({kind:'ice',n:c,left:c});}
    if(t==='crate'){let c=0;crate.forEach(row=>row.forEach(v=>{if(v)c++;}));goals.push({kind:'crate',n:c,left:c});}
    if(t==='lock'){locks=Math.min(18,Math.round((4+n*.1)*scale));goals.push({kind:'lock',n:locks,left:locks});}
  }
  const moves=Math.max(18,Math.round(22+r()*5+(types.length-1)*4+(types.includes('crate')?3:0)+(types.includes('ice')?2:0)+(types.includes('lock')?2:0)-Math.floor(n/40)));
  const r50=v=>Math.round(v/50)*50;
  let t1=0,t2,t3;
  if(types.includes('score')){t1=r50(moves*90);t2=r50(t1*1.45);t3=r50(t1*1.95);goals.push({kind:'score',n:t1,left:t1});}
  else{t2=r50(moves*100);t3=r50(moves*150);}
  return {n,w,h,mask,colors,goals,ice,crate,locks,lockDouble:n>60?.3:0,moves,t1,t2,t3,world:Math.floor((n-1)/20)};
}
