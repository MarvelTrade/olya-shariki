// Рисование фишек, препятствий и бишонов на canvas. Перенесено из старого index.html без изменений вида.
import { COLORS } from './palette.js';

export const PI = Math.PI, TAU = PI * 2;

export function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
export function starPath(ctx,cx,cy,R,ri,n){ctx.beginPath();for(let i=0;i<n*2;i++){const a=-PI/2+i*PI/n,rad=i%2?ri:R;ctx.lineTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad);}ctx.closePath();}
export function shapePath(ctx,shape,r){
  ctx.beginPath();
  switch(shape){
    case 'heart':{const s=r*1.02;ctx.moveTo(0,s*.86);ctx.bezierCurveTo(-s*1.3,s*.02,-s*.72,-s*1.0,0,-s*.4);ctx.bezierCurveTo(s*.72,-s*1.0,s*1.3,s*.02,0,s*.86);ctx.closePath();break;}
    case 'ball':ctx.arc(0,0,r*.88,0,TAU);break;
    case 'star':starPath(ctx,0,r*.06,r*1.0,r*.5,5);break;
    case 'sun':starPath(ctx,0,0,r*.95,r*.74,10);break;
    case 'bone':{const w=r*.2;ctx.rect(-w,-r*.6,w*2,r*1.2);ctx.moveTo(-r*.2+r*.25,-r*.68);ctx.arc(-r*.2,-r*.68,r*.25,0,TAU);ctx.moveTo(r*.2+r*.25,-r*.68);ctx.arc(r*.2,-r*.68,r*.25,0,TAU);ctx.moveTo(-r*.2+r*.25,r*.68);ctx.arc(-r*.2,r*.68,r*.25,0,TAU);ctx.moveTo(r*.2+r*.25,r*.68);ctx.arc(r*.2,r*.68,r*.25,0,TAU);break;}
    case 'cookie':rr(ctx,-r*.88,-r*.74,r*1.76,r*1.5,r*.42);break;
  }
}
export function drawPiece(ctx,c,cx,cy,r){
  const C=COLORS[c];ctx.save();ctx.translate(cx,cy);
  ctx.lineJoin='round';ctx.lineWidth=r*.16;ctx.strokeStyle=C.dark;
  shapePath(ctx,C.shape,r);ctx.stroke();
  const g=ctx.createRadialGradient(-r*.3,-r*.42,r*.08,0,0,r*1.15);
  g.addColorStop(0,C.light);g.addColorStop(.45,C.main);g.addColorStop(1,C.dark);
  ctx.fillStyle=g;shapePath(ctx,C.shape,r);ctx.fill();
  ctx.lineCap='round';
  if(C.shape==='ball'){ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=r*.09;ctx.beginPath();ctx.arc(-r*1.15,0,r*.95,-.6,.6);ctx.stroke();ctx.beginPath();ctx.arc(r*1.15,0,r*.95,PI-.6,PI+.6);ctx.stroke();}
  if(C.shape==='sun'){ctx.fillStyle=C.dark;ctx.beginPath();ctx.arc(-r*.2,-r*.08,r*.08,0,TAU);ctx.arc(r*.2,-r*.08,r*.08,0,TAU);ctx.fill();ctx.strokeStyle=C.dark;ctx.lineWidth=r*.08;ctx.beginPath();ctx.arc(0,r*.08,r*.2,.3,PI-.3);ctx.stroke();ctx.fillStyle='rgba(255,120,120,.45)';ctx.beginPath();ctx.arc(-r*.36,r*.14,r*.09,0,TAU);ctx.arc(r*.36,r*.14,r*.09,0,TAU);ctx.fill();}
  if(C.shape==='cookie'){ctx.fillStyle=C.dark;[[-.4,-.25],[.35,-.3],[0,.15],[-.35,.35],[.4,.3]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x*r,y*r,r*.09,0,TAU);ctx.fill();});}
  ctx.fillStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.ellipse(-r*.26,-r*.4,r*.24,r*.12,-.5,0,TAU);ctx.fill();
  ctx.restore();
}
export function drawIce(ctx,x,y,s,l){
  rr(ctx,x+2,y+2,s-4,s-4,s*.2);ctx.fillStyle=l>1?'rgba(110,180,245,.8)':'rgba(150,210,255,.55)';ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=Math.max(1.5,s*.04);ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(x+s*.2,y+s*.38);ctx.lineTo(x+s*.38,y+s*.2);ctx.moveTo(x+s*.24,y+s*.56);ctx.lineTo(x+s*.56,y+s*.24);ctx.stroke();
  if(l>1){ctx.beginPath();ctx.moveTo(x+s*.62,y+s*.8);ctx.lineTo(x+s*.8,y+s*.62);ctx.stroke();}
}
export function drawCrate(ctx,x,y,s,l){
  const m=s*.08;rr(ctx,x+m,y+m*1.4,s-m*2,s-m*2.2,s*.16);
  ctx.fillStyle=l>1?'#8f5fe0':'#ff7aa2';ctx.fill();ctx.lineWidth=s*.05;ctx.strokeStyle=l>1?'#5d34a8':'#d9467a';ctx.stroke();
  ctx.fillStyle='#ffd34d';ctx.fillRect(x+s*.43,y+m*1.4,s*.14,s-m*2.2);ctx.fillRect(x+m,y+s*.47,s-m*2,s*.12);
  ctx.beginPath();ctx.ellipse(x+s*.38,y+s*.14,s*.12,s*.07,-.4,0,TAU);ctx.ellipse(x+s*.62,y+s*.14,s*.12,s*.07,.4,0,TAU);ctx.fill();
  if(l>1){ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(x+m,y+s*.72,s-m*2,s*.06);}
  ctx.fillStyle='rgba(255,255,255,.35)';rr(ctx,x+s*.14,y+s*.2,s*.2,s*.1,s*.05);ctx.fill();
}
export function drawLock(ctx,x,y,s,l){
  rr(ctx,x+3,y+3,s-6,s-6,s*.22);ctx.fillStyle=l>1?'rgba(205,232,255,.78)':'rgba(220,240,255,.55)';ctx.fill();
  ctx.lineWidth=Math.max(2,s*.05);ctx.strokeStyle='rgba(255,255,255,.95)';ctx.stroke();
  const cx=x+s*.78,cy=y+s*.22,r=s*.11;ctx.strokeStyle='#6fb6ef';ctx.lineWidth=Math.max(1.5,s*.03);ctx.beginPath();
  for(let i=0;i<3;i++){const a=i*PI/3;ctx.moveTo(cx-Math.cos(a)*r,cy-Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}ctx.stroke();
}
export function drawBichon(ctx,cx,cy,s,tall){
  const sx=tall?.82:1.18, legY=tall?.5:.4, headY=tall?-.34:-.24;
  const puffs=[];
  const P=(x,y,r)=>puffs.push([cx+x*s*sx,cy+y*s,r*s]);
  P(-.12,legY,.1);P(.12,legY,.1);
  if(!tall){P(-.3,.24,.2);P(.3,.24,.2);}
  P(0,.18,tall?.26:.33);P(-.16,.1,.2);P(.16,.1,.2);
  P(-.27,headY+.06,.15);P(.27,headY+.06,.15);
  P(0,headY,.29);P(0,headY-.26,.14);P(-.14,headY-.21,.12);P(.14,headY-.21,.12);
  ctx.fillStyle='#d7cfdd';puffs.forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y+s*.02,r+s*.025,0,TAU);ctx.fill();});
  ctx.fillStyle='#fff';puffs.forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();});
  const hy=cy+headY*s, ex=.1*s*sx;
  ctx.fillStyle='#2a1d2e';ctx.beginPath();ctx.arc(cx-ex,hy-s*.03,s*.042,0,TAU);ctx.arc(cx+ex,hy-s*.03,s*.042,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(cx,hy+s*.07,s*.048,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx-ex+s*.014,hy-s*.045,s*.013,0,TAU);ctx.arc(cx+ex+s*.014,hy-s*.045,s*.013,0,TAU);ctx.fill();
  ctx.fillStyle='#ff8fa8';ctx.beginPath();ctx.ellipse(cx,hy+s*.15,s*.035,s*.05,0,0,PI*2);ctx.fill();
  if(!tall){ctx.fillStyle='rgba(255,140,170,.4)';ctx.beginPath();ctx.arc(cx-s*.2,hy+s*.06,s*.05,0,TAU);ctx.arc(cx+s*.2,hy+s*.06,s*.05,0,TAU);ctx.fill();}
}
export function bichonCanvas(px,tall){
  const d=window.devicePixelRatio||1,c=document.createElement('canvas');c.width=px*d;c.height=px*d;c.style.width=px+'px';c.style.height=px+'px';
  const x=c.getContext('2d');x.scale(d,d);drawBichon(x,px/2,px*.52,px*.82,tall);return c;
}
const iconCache={};
export function iconURL(kind,c){
  const key=kind+(c??'');if(iconCache[key])return iconCache[key];
  const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');
  if(kind==='col')drawPiece(x,c,32,33,24);
  else if(kind==='ice'){x.fillStyle='#fff';rr(x,4,4,56,56,12);x.fill();drawIce(x,4,4,56,2);}
  else if(kind==='crate')drawCrate(x,2,2,60,1);
  else if(kind==='lock'){drawPiece(x,1,32,33,20);drawLock(x,2,2,60,1);}
  else if(kind==='score'){starPath(x,32,34,28,13,5);x.fillStyle='#ffc93c';x.fill();x.lineWidth=4;x.strokeStyle='#d9a21c';x.lineJoin='round';x.stroke();}
  return iconCache[key]=cv.toDataURL();
}
export function starSVG(on){return `<svg viewBox="0 0 24 24" class="${on?'on':''}"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="${on?'#ffc93c':'#e4d8ea'}" stroke="${on?'#d9a21c':'#cdbcd6'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;}
