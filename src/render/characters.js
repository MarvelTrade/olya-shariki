// Персонажи «Олиных шариков» — SVG-строки (чёткие на любом devicePixelRatio, анимируются CSS).
// Бишоны: Чапа (1 год, высокий, тонкий, прыгучий, красный ошейник) и Пуша (2 года, коренастый,
// старший, мятная бандана). Эмоции: happy | wait | sad | jump.
// Аватары семьи: olya, anton, lenya (футбол), sasha (рисует), masha (младенец).
// Стилизовано, без портретного сходства.

const INK = '#3a2440';
const SKIN = '#ffd9c2', SKIN_SH = '#f2b391', CHEEK = '#ff9fb3';
const FUR = '#ffffff', FUR_SH = '#e7dce6', FUR_CREAM = '#fbf3ea', EAR = '#f7e4d4';

let uid = 0;
const circles = (list, fill, grow = 0, dy = 0) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y + dy}" r="${r + grow}" fill="${fill}"/>`).join('');

/* ===================== бишоны ===================== */
const DOGS = {
  chapa: {
    head: [60, 36, 19], top: [[60, 17, 10], [50, 21, 8], [70, 21, 8], [60, 24, 9]],
    cheeks: [[47, 43, 9], [73, 43, 9]], ears: [[41, 40, 8.5], [39, 52, 8], [41, 61, 6.5], [79, 40, 8.5], [81, 52, 8], [79, 61, 6.5]],
    body: [[60, 66, 15], [52, 74, 11], [68, 74, 11], [60, 58, 11]],
    legs: [[50, 72, 9, 30], [61, 72, 9, 30]], back: [[39, 80, 8, 22], [73, 80, 8, 22]],
    feet: [[54.5, 102, 6.5], [65.5, 102, 6.5], [43, 102, 5.5], [77, 102, 5.5]],
    tail: [[84, 66, 8], [90, 58, 6.5], [87, 52, 5]], tailO: '82px 70px',
    collar: 'M46 53 Q60 60 74 53 L74 58 Q60 65 46 58Z', collarC: '#ff5a7e', tag: [60, 63], ground: 104, gw: 26,
  },
  pusha: {
    head: [60, 50, 23], top: [[60, 27, 11], [47, 31, 9.5], [73, 31, 9.5], [60, 34, 10]],
    cheeks: [[43, 58, 11], [77, 58, 11]], ears: [[36, 52, 10], [33, 64, 9.5], [35, 75, 7], [84, 52, 10], [87, 64, 9.5], [85, 75, 7]],
    body: [[60, 85, 21], [43, 91, 15], [77, 91, 15], [60, 74, 14]],
    legs: [[45, 92, 13, 13], [62, 92, 13, 13]], back: [[28, 94, 11, 10], [81, 94, 11, 10]],
    feet: [[51.5, 106, 8], [68.5, 106, 8], [33, 105, 7], [87, 105, 7]],
    tail: [[93, 82, 9], [99, 73, 7.5]], tailO: '90px 86px',
    collar: 'M42 70 L78 70 Q70 86 60 88 Q50 86 42 70Z', collarC: '#29c39d', tag: null, ground: 110, gw: 38,
  },
};

function dogFace(D, emo) {
  const [hx, hy, hr] = D.head, k = hr / 20, ex = 7.5 * k, ey = hy - 1 * k;
  let eyes, mouth = '', brows = '', extra = '';
  const nose = `<ellipse cx="${hx}" cy="${hy + 6 * k}" rx="${4.2 * k}" ry="${3.2 * k}" fill="${INK}"/><ellipse cx="${hx - 1.2 * k}" cy="${hy + 5 * k}" rx="${1.3 * k}" ry="${0.8 * k}" fill="#fff" opacity=".7"/>`;
  if (emo === 'happy' || emo === 'jump') {
    eyes = [-1, 1].map(s => `<path d="M${hx + s * ex - 3.6 * k} ${ey + 1 * k} Q${hx + s * ex} ${ey - 4.5 * k} ${hx + s * ex + 3.6 * k} ${ey + 1 * k}" fill="none" stroke="${INK}" stroke-width="${2.4 * k}" stroke-linecap="round"/>`).join('');
    mouth = `<path d="M${hx - 5 * k} ${hy + 9.5 * k} Q${hx} ${hy + 19 * k} ${hx + 5 * k} ${hy + 9.5 * k} Z" fill="#7a2c45"/><path d="M${hx - 3 * k} ${hy + 13 * k} Q${hx} ${hy + 18.5 * k} ${hx + 3 * k} ${hy + 13 * k} Q${hx} ${hy + 11.5 * k} ${hx - 3 * k} ${hy + 13 * k}Z" fill="#ff8fa8"/>`;
  } else if (emo === 'sad') {
    eyes = [-1, 1].map(s => `<circle cx="${hx + s * ex}" cy="${ey + 1 * k}" r="${3 * k}" fill="${INK}"/><circle cx="${hx + s * ex + 0.9 * k}" cy="${ey}" r="${1 * k}" fill="#fff"/>`).join('');
    brows = [-1, 1].map(s => `<path d="M${hx + s * (ex - 3.5 * k)} ${ey - 5.5 * k} L${hx + s * (ex + 3.5 * k)} ${ey - 3.5 * k}" stroke="${INK}" stroke-width="${1.6 * k}" stroke-linecap="round" opacity=".7"/>`).join('');
    mouth = `<path d="M${hx - 4 * k} ${hy + 13 * k} Q${hx} ${hy + 9.5 * k} ${hx + 4 * k} ${hy + 13 * k}" fill="none" stroke="${INK}" stroke-width="${1.8 * k}" stroke-linecap="round"/>`;
    extra = `<path class="tear" d="M${hx + ex + 1 * k} ${ey + 4 * k} q${-2.2 * k} ${4 * k} 0 ${5.5 * k} q${2.2 * k} ${-1.5 * k} 0 ${-5.5 * k}Z" fill="#8fd0ff"/>`;
  } else { // wait — круглые блестящие глаза
    eyes = [-1, 1].map(s => `<circle cx="${hx + s * ex}" cy="${ey}" r="${3.6 * k}" fill="${INK}"/><circle cx="${hx + s * ex + 1.2 * k}" cy="${ey - 1.3 * k}" r="${1.3 * k}" fill="#fff"/>`).join('');
    mouth = `<path d="M${hx - 4 * k} ${hy + 10 * k} q${2 * k} ${2.6 * k} ${4 * k} 0 q${2 * k} ${2.6 * k} ${4 * k} 0" fill="none" stroke="${INK}" stroke-width="${1.6 * k}" stroke-linecap="round"/><ellipse cx="${hx}" cy="${hy + 14 * k}" rx="${2 * k}" ry="${2.4 * k}" fill="#ff8fa8"/>`;
  }
  const cheeks = `<ellipse cx="${hx - 12 * k}" cy="${hy + 6 * k}" rx="${3.6 * k}" ry="${2.3 * k}" fill="${CHEEK}" opacity=".55"/><ellipse cx="${hx + 12 * k}" cy="${hy + 6 * k}" rx="${3.6 * k}" ry="${2.3 * k}" fill="${CHEEK}" opacity=".55"/>`;
  return cheeks + brows + eyes + nose + mouth + extra;
}

/**
 * SVG бишона. who: 'chapa'|'pusha'; emo: 'happy'|'wait'|'sad'|'jump'.
 * Анимации — CSS-классами (.pet-tail виляет, .emo-jump подпрыгивает).
 */
export function bichonSVG(who = 'chapa', emo = 'happy', cls = '') {
  const D = DOGS[who] || DOGS.chapa, jump = emo === 'jump', sad = emo === 'sad';
  const legs = (list, dy) => list.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h + dy}" rx="${w / 2}" fill="${FUR}" stroke="${FUR_SH}" stroke-width="2"/>`).join('');
  const ldy = jump ? 6 : 0;
  const feet = D.feet.map(([x, y, r]) => [x, y + ldy, r]);
  const earsDy = sad ? 4 : jump ? -3 : 0;
  const tilt = emo === 'wait' ? `rotate(${who === 'chapa' ? -8 : 7} ${D.head[0]} ${D.head[1] + 10})` : '';
  const tag = D.tag ? `<circle cx="${D.tag[0]}" cy="${D.tag[1]}" r="3.6" fill="#ffd34d" stroke="#e0a51c" stroke-width="1.2"/>` : '';
  const dots = who === 'pusha' ? `<circle cx="52" cy="75" r="1.8" fill="#fff" opacity=".8"/><circle cx="60" cy="80" r="1.8" fill="#fff" opacity=".8"/><circle cx="68" cy="75" r="1.8" fill="#fff" opacity=".8"/>` : '';
  const lines = jump ? `<g stroke="#c9b6d1" stroke-width="2.4" stroke-linecap="round" opacity=".8"><path d="M38 ${D.ground + 2} l-6 6"/><path d="M60 ${D.ground + 5} v7"/><path d="M82 ${D.ground + 2} l6 6"/></g>` : '';
  const id = 'd' + (++uid);
  return `<svg class="pet pet-${who} emo-${emo} ${cls}" viewBox="0 0 120 120" aria-hidden="true">
<ellipse class="pet-shadow" cx="60" cy="${D.ground + 7}" rx="${jump ? D.gw * 0.6 : D.gw}" ry="4" fill="rgba(67,38,74,.16)"/>${lines}
<g class="pet-body" ${jump ? 'transform="translate(0 -12)"' : ''}>
 <g class="pet-tail" style="transform-origin:${D.tailO}">${circles(D.tail, FUR_SH, 2, 1)}${circles(D.tail, FUR)}</g>
 ${legs(D.back, ldy)}${legs(D.legs, ldy)}
 ${circles(feet, FUR_SH, 1.5, 1)}${circles(feet, FUR)}
 ${circles(D.body, FUR_SH, 2, 1.5)}${circles(D.body, FUR)}
 <circle cx="${D.body[0][0] - 6}" cy="${D.body[0][1] + 6}" r="${D.body[0][2] * 0.5}" fill="${FUR_CREAM}"/>
 <path d="${D.collar}" fill="${D.collarC}"/>${dots}${tag}
 <g class="pet-head" ${tilt ? `transform="${tilt}"` : ''}>
  <g transform="translate(0 ${earsDy})">${circles(D.ears, FUR_SH, 2, 1)}${circles(D.ears, EAR)}</g>
  ${circles([D.head, ...D.top, ...D.cheeks], FUR_SH, 2, 1.5)}${circles([D.head, ...D.top, ...D.cheeks], FUR)}
  <clipPath id="${id}"><circle cx="${D.head[0]}" cy="${D.head[1]}" r="${D.head[2] + 6}"/></clipPath>
  <g clip-path="url(#${id})">${dogFace(D, emo)}</g>
 </g>
</g></svg>`;
}

/* ===================== аватары семьи ===================== */
const face = (o = {}) => {
  const ey = o.ey ?? 58, sleep = o.sleep;
  const eyes = sleep
    ? `<path d="M45 ${ey} q5 4 10 0 M65 ${ey} q5 4 10 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<ellipse cx="50" cy="${ey}" rx="3.3" ry="4" fill="${INK}"/><ellipse cx="70" cy="${ey}" rx="3.3" ry="4" fill="${INK}"/><circle cx="51.3" cy="${ey - 1.5}" r="1.3" fill="#fff"/><circle cx="71.3" cy="${ey - 1.5}" r="1.3" fill="#fff"/>`;
  const brows = o.brows ?? `<path d="M45 ${ey - 8} q5 -3 9 -1 M66 ${ey - 9} q5 -2 9 1" fill="none" stroke="${o.browC || INK}" stroke-width="${o.browW || 2}" stroke-linecap="round" opacity=".75"/>`;
  const mouth = o.mouth ?? `<path d="M53 69 Q60 76 67 69" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  return `<ellipse cx="44" cy="67" rx="5.5" ry="3.4" fill="${CHEEK}" opacity=".6"/><ellipse cx="76" cy="67" rx="5.5" ry="3.4" fill="${CHEEK}" opacity=".6"/>${sleep ? '' : brows}${eyes}${mouth}`;
};
const head = (cx = 60, cy = 57, rx = 24, ry = 26) => `<circle cx="${cx - rx}" cy="${cy + 3}" r="5" fill="${SKIN_SH}"/><circle cx="${cx + rx}" cy="${cy + 3}" r="5" fill="${SKIN_SH}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SKIN}"/>`;
const torso = (c, c2) => `<rect x="53" y="76" width="14" height="14" rx="4" fill="${SKIN_SH}"/><path d="M18 121 C18 96 36 86 60 86 C84 86 102 96 102 121Z" fill="${c}"/>${c2 ? `<path d="M48 87 L60 98 L72 87" fill="none" stroke="${c2}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` : ''}`;
const arm = (c, item = '') => `<g class="wave"><path d="M90 104 Q100 92 103 78" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/><circle cx="103.5" cy="73" r="7.5" fill="${SKIN}"/>${item}</g>`;

const AV = {
  olya: o => `
<path d="M34 60 C29 30 44 22 60 22 C79 22 93 32 87 62 C89 80 95 94 100 104 L20 104 C25 92 31 78 34 60Z" fill="#9b5a3c"/>
${torso('#ff7aa2', '#fff')}${head()}
<path d="M35 55 C35 33 50 27 63 28 C78 29 86 40 85 56 C78 47 70 40 58 37 C52 44 43 50 35 55Z" fill="#a8623f"/>
<path d="M46 33 C52 31 58 31 62 33" stroke="#c88360" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M78 33 c-3 -4 -8 -1 -5 3 l5 4 l5 -4 c3 -4 -2 -7 -5 -3z" fill="#ff5a7e" stroke="#fff" stroke-width="1.2"/>
<circle cx="36" cy="66" r="2.2" fill="#ffd34d"/><circle cx="84" cy="66" r="2.2" fill="#ffd34d"/>
${face({ mouth: `<path d="M53 69 Q60 77 67 69" fill="#e8577b" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` })}
${o.wave ? arm('#ff7aa2') : ''}`,
  anton: o => `
${torso('#4f8df5', '#fff')}<path d="M44 108 h10 M66 108 h10" stroke="#3a6fd0" stroke-width="2"/>${head()}
<path d="M38 72 C42 82 52 84 60 84 C68 84 78 82 82 72 C76 77 68 79 60 79 C52 79 44 77 38 72Z" fill="#5a3f30" opacity=".35"/>
<path d="M35 52 C33 30 47 22 62 23 C79 24 89 34 85 54 C83 45 78 40 72 37 C63 41 50 40 42 38 C38 42 36 47 35 52Z" fill="#4b3427"/>
<path d="M58 26 c6 -6 14 -4 16 1" stroke="#4b3427" stroke-width="5" fill="none" stroke-linecap="round"/>
${face({ browW: 3, browC: '#4b3427' })}
${o.wave ? arm('#4f8df5') : ''}`,
  lenya: o => `
${torso('#3f8cff')}<path d="M26 104 C30 96 36 92 42 90 L44 121 L24 121Z M94 104 C90 96 84 92 78 90 L76 121 L96 121Z" fill="#fff" opacity=".9"/>
<path d="M50 87 Q60 94 70 87" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
<text x="60" y="114" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" font-weight="900" font-size="15" fill="#fff">10</text>
${head(60, 58, 23, 25)}
<path d="M36 52 L38 40 L43 44 L46 32 L51 39 L56 28 L60 37 L65 28 L68 38 L74 31 L76 42 L82 38 L84 52 C78 44 70 42 60 42 C50 42 42 45 36 52Z" fill="#b5733e"/>
${face({ ey: 59, mouth: `<path d="M52 69 Q60 78 68 69 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` })}
<g class="ball-bob"><circle cx="24" cy="102" r="12" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M24 96 l5 3.6 -2 6 h-6 l-2 -6z" fill="${INK}"/><path d="M24 96 v-6 M29 99.6 l5.5 -2 M27 105.6 l3.5 5 M21 105.6 l-3.5 5 M19 99.6 l-5.5 -2" stroke="${INK}" stroke-width="1.5"/></g>
${o.wave ? arm('#3f8cff') : ''}`,
  sasha: o => `
<circle cx="31" cy="68" r="11" fill="#c0703f"/><circle cx="89" cy="68" r="11" fill="#c0703f"/>
<path d="M27 74 q4 10 0 18 M93 74 q-4 10 0 18" stroke="#c0703f" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="35" cy="62" r="3.6" fill="#a764f4"/><circle cx="85" cy="62" r="3.6" fill="#a764f4"/>
${torso('#a764f4', '#ead8ff')}<circle cx="40" cy="104" r="3" fill="#ffc22e"/><circle cx="78" cy="110" r="3" fill="#29c39d"/><circle cx="70" cy="100" r="2.4" fill="#ff5a7e"/>
${head(60, 58, 23, 25)}
<path d="M36 56 C35 35 48 29 60 29 C73 29 85 36 84 56 C82 48 76 45 72 44 L70 49 L66 44 L60 49 L55 44 L50 49 L47 44 C42 46 38 50 36 56Z" fill="#c0703f"/>
<ellipse cx="78" cy="71" rx="3" ry="2.2" fill="#3f8cff" opacity=".7"/>
${face({ ey: 59 })}
${o.wave ? arm('#a764f4', '<g transform="rotate(25 103 73)"><rect x="100.5" y="52" width="6" height="22" rx="2" fill="#ffc22e"/><path d="M100.5 52 L103.5 44 L106.5 52Z" fill="#ffd9c2"/><path d="M102.5 47 L103.5 44 L104.5 47Z" fill="#ff5a7e"/></g>') : ''}`,
  masha: o => `
<path d="M24 121 C22 98 38 88 60 88 C82 88 98 98 96 121Z" fill="#fff3c4"/>
<path d="M30 104 q30 -12 60 0" stroke="#ffe08a" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M44 112 l2 -4 2 4 -4 -2.5 h4z M72 114 l2 -4 2 4 -4 -2.5 h4z" fill="#ffc22e"/>
<path d="M30 64 C28 36 44 26 60 26 C76 26 92 36 90 64 C92 76 86 86 80 88 L40 88 C34 86 28 76 30 64Z" fill="#ffd66b"/>
<path d="M30 64 C28 36 44 26 60 26 C76 26 92 36 90 64" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="1 7" stroke-linecap="round"/>
<ellipse cx="60" cy="62" rx="24" ry="23" fill="${SKIN}"/>
<path d="M58 42 q-4 -6 2 -9 q4 2 1 6" fill="none" stroke="#c28a5c" stroke-width="2.4" stroke-linecap="round"/>
${face({ ey: 62, sleep: o.awake ? false : true, mouth: '' })}
<circle cx="60" cy="75" r="6.5" fill="none" stroke="#ff8fb0" stroke-width="3"/><ellipse cx="60" cy="74" rx="8" ry="4" fill="#ffb3c8"/><circle cx="60" cy="74" r="2.2" fill="#fff"/>
${o.awake ? '' : '<g class="zzz" font-family="Nunito,system-ui,sans-serif" font-weight="900" fill="#a58bd0"><text x="88" y="38" font-size="12">z</text><text x="97" y="27" font-size="9">z</text></g>'}`,
};

export const FAMILY = {
  olya: { name: 'Оля', role: 'мама', color: '#ff7aa2' },
  anton: { name: 'Антон', role: 'папа', color: '#4f8df5' },
  lenya: { name: 'Лёня', role: '10 лет, футбол', color: '#3f8cff' },
  sasha: { name: 'Саша', role: '8 лет, рисует', color: '#a764f4' },
  masha: { name: 'Маша', role: '14 дней', color: '#ffc22e' },
  chapa: { name: 'Чапа', role: 'бишон, 1 год', color: '#ff8d47' },
  pusha: { name: 'Пуша', role: 'бишон, 2 года', color: '#29c39d' },
};

/**
 * Аватар члена семьи (бюст). opts: { wave — машет рукой, badge — цветной кружок-фон, awake — для Маши,
 * emo — для собак }. Собаки (chapa/pusha) рисуются через bichonSVG.
 */
export function avatarSVG(who, opts = {}) {
  if (who === 'chapa' || who === 'pusha') return bichonSVG(who, opts.emo || 'happy', opts.badge ? 'badge' : '');
  const f = AV[who] || AV.olya, id = 'a' + (++uid);
  const bg = opts.badge ? `<circle cx="60" cy="60" r="58" fill="${opts.badgeColor || '#fff4f8'}"/>` : '';
  const clip = opts.badge ? `<clipPath id="${id}"><circle cx="60" cy="60" r="58"/></clipPath>` : '';
  return `<svg class="avatar av-${who}${opts.wave ? ' waving' : ''}" viewBox="0 0 120 120" aria-hidden="true">${clip}${bg}<g ${opts.badge ? `clip-path="url(#${id})"` : ''}>${f(opts)}</g></svg>`;
}
