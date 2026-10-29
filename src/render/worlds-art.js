// Оформление 6 миров карты: фон (CSS) + декор вдоль тропинки (маленькие SVG).
// Индекс мира = индекс в WORLDS (src/levels/worlds.js). Декор чисто декоративный (aria-hidden).

const svg = (body, vb = '0 0 60 60') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
// одинарные кавычки (и %27 внутри) — чтобы фон можно было вставить в style="…" атрибут
const enc = s => `url('data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27')}')`;

/* ---------- маленькие картинки ---------- */
const D = {
  cloud: () => svg('<path d="M14 42c-7 0-10-9-4-13 0-8 10-11 15-6 3-7 15-7 17 2 8-1 11 10 4 14-1 2-3 3-5 3z" fill="#fff" opacity=".95"/><path d="M14 42h27" stroke="#f1dbe6" stroke-width="2" stroke-linecap="round"/>'),
  moon: () => svg('<path d="M38 10a20 20 0 1 0 12 30A16 16 0 0 1 38 10z" fill="#ffe39a"/><circle cx="26" cy="34" r="2.5" fill="#f5c96a"/><circle cx="33" cy="44" r="1.8" fill="#f5c96a"/>'),
  starS: (c = '#ffd76a') => svg(`<path d="M30 8l6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z" fill="${c}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>`),
  rattle: () => svg('<circle cx="24" cy="22" r="14" fill="#ffb3c8" stroke="#fff" stroke-width="3"/><circle cx="19" cy="17" r="4" fill="#fff" opacity=".7"/><rect x="31" y="31" width="8" height="22" rx="4" transform="rotate(-40 35 42)" fill="#ffd66b"/><circle cx="46" cy="50" r="6" fill="#9fd8ff"/>'),
  duck: () => svg('<ellipse cx="30" cy="40" rx="20" ry="12" fill="#ffd34d"/><circle cx="40" cy="24" r="11" fill="#ffd34d"/><path d="M49 24l9 3-9 3z" fill="#ff8d47"/><circle cx="42" cy="21" r="2" fill="#3a2440"/><path d="M18 38q8 8 18 0" stroke="#f0b400" stroke-width="3" fill="none" stroke-linecap="round"/>'),
  mobile: () => svg('<path d="M30 2v10M10 12h40" stroke="#c9a6e0" stroke-width="2.5" stroke-linecap="round"/><path d="M10 12v14M30 12v20M50 12v12" stroke="#c9a6e0" stroke-width="1.5"/><circle cx="10" cy="30" r="5" fill="#ff9fb3"/><path d="M30 34l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="#ffd34d"/><path d="M47 28a6 6 0 1 0 6 6 5 5 0 0 1-6-6z" fill="#9fd8ff"/>'),
  fence: () => svg('<g fill="#fff" stroke="#e8d3c1" stroke-width="2"><path d="M6 54V18l6-6 6 6v36z"/><path d="M24 54V18l6-6 6 6v36z"/><path d="M42 54V18l6-6 6 6v36z"/></g><rect x="2" y="26" width="56" height="6" rx="2" fill="#fff" stroke="#e8d3c1" stroke-width="2"/><rect x="2" y="42" width="56" height="6" rx="2" fill="#fff" stroke="#e8d3c1" stroke-width="2"/>'),
  doghouse: () => svg('<path d="M8 28L30 8l22 20v26H8z" fill="#ff9a6b"/><path d="M4 30L30 6l26 24" fill="none" stroke="#d1572a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 54V40a9 9 0 0 1 18 0v14z" fill="#6a3a2a"/><text x="30" y="31" font-family="Nunito,sans-serif" font-weight="900" font-size="8" text-anchor="middle" fill="#fff">Ч+П</text>'),
  bone: () => svg('<g transform="rotate(-25 30 30)"><rect x="14" y="26" width="32" height="8" rx="4" fill="#fff"/><circle cx="14" cy="26" r="6" fill="#fff"/><circle cx="14" cy="34" r="6" fill="#fff"/><circle cx="46" cy="26" r="6" fill="#fff"/><circle cx="46" cy="34" r="6" fill="#fff"/></g>'),
  paw: (c = '#c9e6c0') => svg(`<g fill="${c}"><ellipse cx="30" cy="38" rx="11" ry="9"/><circle cx="17" cy="25" r="5"/><circle cx="25" cy="18" r="5"/><circle cx="35" cy="18" r="5"/><circle cx="43" cy="25" r="5"/></g>`),
  bush: () => svg('<circle cx="18" cy="38" r="14" fill="#7fd08a"/><circle cx="34" cy="30" r="17" fill="#8ddb96"/><circle cx="46" cy="40" r="12" fill="#7fd08a"/><circle cx="26" cy="30" r="3" fill="#ff9fb3"/><circle cx="40" cy="24" r="3" fill="#fff"/><circle cx="44" cy="40" r="3" fill="#ffd34d"/>'),
  goal: () => svg('<path d="M4 50V14h52v36" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M8 18h44M8 26h44M8 34h44M8 42h44M14 14v36M24 14v36M34 14v36M44 14v36" stroke="#fff" stroke-width="1" opacity=".7"/>', '0 0 60 54'),
  flag: () => svg('<path d="M14 6v50" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M15 8h28l-6 8 6 8H15z" fill="#ff5a7e"/>'),
  ball: () => svg('<circle cx="30" cy="30" r="18" fill="#fff" stroke="#3a2440" stroke-width="2.5"/><path d="M30 21l8 6-3 9h-10l-3-9z" fill="#3a2440"/><path d="M30 21v-9M38 27l8-3M35 36l5 8M25 36l-5 8M22 27l-8-3" stroke="#3a2440" stroke-width="2"/>'),
  cup: () => svg('<path d="M18 10h24v10a12 12 0 0 1-24 0z" fill="#ffd34d" stroke="#e0a51c" stroke-width="2"/><path d="M18 14h-6a6 6 0 0 0 6 8M42 14h6a6 6 0 0 1-6 8" fill="none" stroke="#e0a51c" stroke-width="3"/><rect x="26" y="32" width="8" height="10" fill="#ffd34d"/><rect x="18" y="42" width="24" height="7" rx="2" fill="#e0a51c"/>'),
  pencil: (c = '#ff8d47') => svg(`<g transform="rotate(35 30 30)"><rect x="24" y="6" width="12" height="38" rx="2" fill="${c}"/><path d="M24 44h12l-6 12z" fill="#ffd9c2"/><path d="M28.5 52h3l-1.5 4z" fill="#3a2440"/><rect x="24" y="6" width="12" height="6" fill="#ff9fb3"/></g>`),
  dSun: () => svg('<circle cx="30" cy="30" r="11" fill="none" stroke="#ffb400" stroke-width="3"/><path d="M30 8v8M30 44v8M8 30h8M44 30h8M14 14l6 6M40 40l6 6M46 14l-6 6M20 40l-6 6" stroke="#ffb400" stroke-width="3" stroke-linecap="round"/><path d="M25 32q5 4 10 0" stroke="#ffb400" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  dHouse: () => svg('<path d="M12 30L30 12l18 18M16 27v24h28V27" fill="none" stroke="#3f8cff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><rect x="26" y="38" width="8" height="13" fill="none" stroke="#ff5a7e" stroke-width="3"/>'),
  dHeart: () => svg('<path d="M30 50C10 36 10 20 20 17c5-1 8 2 10 6 2-4 5-7 10-6 10 3 10 19-10 33z" fill="none" stroke="#ff5a7e" stroke-width="3" stroke-linejoin="round"/>'),
  dMama: () => svg('<circle cx="30" cy="20" r="9" fill="none" stroke="#a764f4" stroke-width="2.6"/><path d="M30 29v14M30 33l-10 6M30 33l10 6M30 43l-7 11M30 43l7 11M21 14q9-10 18 0" fill="none" stroke="#a764f4" stroke-width="2.6" stroke-linecap="round"/><circle cx="27" cy="19" r="1.2" fill="#a764f4"/><circle cx="33" cy="19" r="1.2" fill="#a764f4"/>'),
  tape: () => svg('<rect x="8" y="22" width="44" height="16" rx="2" transform="rotate(-12 30 30)" fill="#ffe08a" opacity=".75"/>'),
  tulip: (c = '#ff5a7e') => svg(`<path d="M30 56V28" stroke="#4fae6a" stroke-width="3"/><path d="M30 46q-12-2-14-12 10 0 14 10z" fill="#6cc583"/><path d="M20 14q4 6 10 4 6 2 10-4 2 14-10 16-12-2-10-16z" fill="${c}"/><path d="M30 18l-4-10 4 4 4-4z" fill="${c}"/>`),
  daisy: () => svg('<g fill="#fff">' + Array.from({ length: 8 }, (_, i) => `<ellipse cx="30" cy="16" rx="5" ry="10" transform="rotate(${i * 45} 30 28)"/>`).join('') + '</g><circle cx="30" cy="28" r="6" fill="#ffc22e"/>'),
  butterfly: () => svg('<path d="M30 30C18 12 6 18 12 30c-6 10 8 16 18 2zM30 30c12-18 24-12 18 0 6 10-8 16-18 2z" fill="#ffb3c8"/><path d="M30 20v22" stroke="#3a2440" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="26" r="3" fill="#fff"/><circle cx="42" cy="26" r="3" fill="#fff"/>'),
  can: () => svg('<path d="M14 26h24v24H14z" fill="#3fbfa0"/><path d="M38 32l14-10" stroke="#3fbfa0" stroke-width="5" stroke-linecap="round"/><path d="M18 26q8-12 16 0" fill="none" stroke="#2a9a80" stroke-width="3"/><circle cx="54" cy="18" r="2" fill="#8fd0ff"/><circle cx="57" cy="24" r="1.6" fill="#8fd0ff"/>'),
  ladybug: () => svg('<circle cx="30" cy="34" r="14" fill="#ff5a5a"/><path d="M30 20v28" stroke="#3a2440" stroke-width="2"/><circle cx="30" cy="20" r="6" fill="#3a2440"/><circle cx="23" cy="32" r="3" fill="#3a2440"/><circle cx="37" cy="38" r="3" fill="#3a2440"/><circle cx="24" cy="42" r="2" fill="#3a2440"/>'),
  balloon: (c = '#ff5a7e') => svg(`<path d="M30 44q-4 8 2 14" stroke="#c9a6e0" stroke-width="1.5" fill="none"/><ellipse cx="30" cy="24" rx="14" ry="18" fill="${c}"/><path d="M27 42h6l-3 4z" fill="${c}"/><ellipse cx="25" cy="17" rx="4" ry="6" fill="#fff" opacity=".45"/>`),
  gift: () => svg('<rect x="10" y="24" width="40" height="30" rx="4" fill="#a764f4"/><rect x="7" y="18" width="46" height="10" rx="3" fill="#b98cf5"/><rect x="26" y="18" width="8" height="36" fill="#ffd34d"/><path d="M30 18c-10-12-18-4-10 0M30 18c10-12 18-4 10 0" fill="none" stroke="#ffd34d" stroke-width="4" stroke-linecap="round"/>'),
  cake: () => svg('<rect x="10" y="30" width="40" height="22" rx="5" fill="#ffd0db"/><path d="M10 36q5 5 10 0t10 0 10 0 10 0" fill="none" stroke="#fff" stroke-width="4"/><rect x="14" y="20" width="32" height="12" rx="4" fill="#fff3c4"/><rect x="28" y="8" width="4" height="12" rx="2" fill="#3f8cff"/><path d="M30 2q4 4 0 7-4-3 0-7z" fill="#ffb400"/>'),
  bunting: () => svg('<path d="M0 6q60 16 120 0" stroke="#c9a6e0" stroke-width="1.5" fill="none"/>' + ['#ff5a7e', '#ffc22e', '#3f8cff', '#29c39d', '#a764f4', '#ff8d47'].map((c, i) => `<path d="M${6 + i * 19} ${8 + Math.sin((i + 0.5) / 6 * Math.PI) * 6}l14 1-6 13z" fill="${c}"/>`).join(''), '0 0 120 30'),
};

/* ---------- темы миров ---------- */
/** Каждый мир: CSS-фон, набор декора [функция, ширина px] и полупрозрачный узор. */
export const WORLD_ART = [
  { // 0 — Утро с Машей: рассветное небо, облака, звёздочки, погремушки
    grad: ['#fff1d9', '#ffe0ec'], path: '#fff', accent: '#ffb300',
    pattern: enc('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="12" cy="14" r="2" fill="#ffd76a" opacity=".55"/><circle cx="60" cy="50" r="1.6" fill="#ffb3c8" opacity=".6"/><path d="M50 12l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff" opacity=".9"/></svg>'),
    decor: [[D.cloud, 74], [D.moon, 48], [D.rattle, 44], [D.cloud, 60], [D.duck, 46], [D.mobile, 54], [() => D.starS(), 30], [D.cloud, 80]],
  },
  { // 1 — Двор Чапы и Пуши: трава, забор, будка, косточки, следы лап
    grad: ['#e2f6d9', '#d2f0f6'], path: '#fffaf0', accent: '#29c39d',
    pattern: enc('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><g fill="#b9e3ad" opacity=".55"><ellipse cx="20" cy="26" rx="5" ry="4"/><circle cx="14" cy="19" r="2.2"/><circle cx="18" cy="16" r="2.2"/><circle cx="23" cy="16" r="2.2"/><circle cx="27" cy="19" r="2.2"/></g><path d="M64 70q2-8 4 0M70 72q2-6 4 0" stroke="#9fd394" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'),
    decor: [[D.doghouse, 70], [D.bone, 42], [D.fence, 72], [D.bush, 62], [() => D.paw(), 34], [D.bone, 38], [D.fence, 66], [D.bush, 56]],
  },
  { // 2 — Футбол Лёни: полосатое поле, ворота, мячи, кубок
    grad: ['#c9eebf', '#b8e6ad'], path: '#ffffffe6', accent: '#3f8cff',
    stripes: 'repeating-linear-gradient(0deg, rgba(255,255,255,.0) 0 60px, rgba(255,255,255,.18) 60px 120px)',
    decor: [[D.goal, 78], [D.ball, 40], [D.flag, 44], [D.cup, 50], [D.ball, 34], [D.goal, 70], [D.flag, 40], [D.ball, 38]],
  },
  { // 3 — Альбом Саши: тетрадный лист, каракули мелками, карандаши
    grad: ['#fbf7ff', '#f6efff'], path: '#ffffff', accent: '#a764f4',
    stripes: 'repeating-linear-gradient(0deg, transparent 0 27px, rgba(120,160,230,.28) 27px 29px)',
    margin: true,
    decor: [[D.dSun, 58], [() => D.pencil('#3f8cff'), 46], [D.dHouse, 56], [D.dHeart, 50], [D.tape, 54], [D.dMama, 54], [() => D.pencil('#ff5a7e'), 44], [() => D.starS('#ffe08a'), 36]],
  },
  { // 4 — Мамин сад: тюльпаны, ромашки, бабочки, лейка
    grad: ['#ffe5dc', '#fff4cf'], path: '#fffaf3', accent: '#ff5a7e',
    pattern: enc('<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70"><g opacity=".5"><circle cx="15" cy="15" r="3" fill="#ffb3c8"/><circle cx="15" cy="15" r="1.2" fill="#ffd34d"/><circle cx="52" cy="48" r="3" fill="#fff"/><circle cx="52" cy="48" r="1.2" fill="#ffd34d"/></g></svg>'),
    decor: [[() => D.tulip(), 48], [D.butterfly, 44], [D.daisy, 42], [D.can, 52], [() => D.tulip('#a764f4'), 46], [D.ladybug, 34], [D.daisy, 40], [() => D.tulip('#ffb400'), 44]],
  },
  { // 5 — Семейный праздник: шарики, флажки, торт, подарки, конфетти
    grad: ['#ffeaf3', '#ece6ff'], path: '#fff', accent: '#ff8d47',
    pattern: enc('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><g opacity=".6"><rect x="10" y="12" width="6" height="3" rx="1" fill="#ff5a7e" transform="rotate(30 13 13)"/><rect x="56" y="30" width="6" height="3" rx="1" fill="#3f8cff" transform="rotate(-20 59 31)"/><rect x="30" y="62" width="6" height="3" rx="1" fill="#ffc22e" transform="rotate(60 33 63)"/><circle cx="68" cy="68" r="2" fill="#29c39d"/></g></svg>'),
    decor: [[() => D.balloon(), 44], [D.gift, 50], [() => D.balloon('#3f8cff'), 40], [D.cake, 56], [() => D.balloon('#ffc22e'), 42], [D.gift, 44], [() => D.balloon('#29c39d'), 40], [D.cake, 50]],
  },
];

/** CSS-фон секции мира на карте. */
export function worldBackground(wi) {
  const A = WORLD_ART[wi] || WORLD_ART[0];
  const layers = [];
  if (A.margin) layers.push('linear-gradient(90deg, transparent 0 34px, rgba(255,120,150,.35) 34px 36px, transparent 36px)');
  if (A.stripes) layers.push(A.stripes);
  if (A.pattern) layers.push(A.pattern);
  layers.push(`linear-gradient(0deg, ${A.grad[0]}, ${A.grad[1]})`);
  return layers.join(',');
}

/** HTML одного декоративного элемента k мира wi. */
export function decorHTML(wi, k) {
  const A = WORLD_ART[wi] || WORLD_ART[0];
  const [fn, w] = A.decor[k % A.decor.length];
  return { html: fn(), w };
}
export const BUNTING = D.bunting;
