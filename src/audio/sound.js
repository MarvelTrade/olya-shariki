// Звук «Олиных шариков»: всё синтезируется WebAudio, без аудиофайлов.
// Рядом может спать Маша (14 дней), поэтому всё мягко: синусы/треугольники, плавные атаки,
// мастер-лимитер, «тихий режим» (низкий потолок громкости, срезаны верха и бас).
//
// Публичный API:
//   initAudio()            — повесить слушатели первого касания и visibilitychange (идемпотентно)
//   unlockAudio()          — создать/разбудить AudioContext (вызывать из обработчика касания, правило iOS)
//   playSfx([name, arg])   — звук по имени (имена приходят из шагов движка step.sfx); неизвестные — тишина
//   setMusicWorld(i|null)  — фоновый генеративный луп мира 0..5 с кроссфейдом; null — тишина
//   getAudioSettings()     — {sfx, music, quiet, sfxVol, musicVol}
//   setAudioSettings(patch)— изменить и сохранить в localStorage['olya-shariki-audio']
//   setSoundEnabled / isSoundEnabled / tone / sfx — старый API (совместимость)
//
// В Node (нет window/AudioContext) модуль импортируется и молча ничего не играет.

const STORE_KEY = 'olya-shariki-audio';
const DEFAULTS = Object.freeze({ sfx: true, music: true, quiet: false, sfxVol: 0.8, musicVol: 0.5 });

const hasWindow = typeof window !== 'undefined';
const AC = hasWindow ? (window.AudioContext || window.webkitAudioContext) : null;

// ───────────────────────── настройки ─────────────────────────

const clamp01 = v => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : null);

function sanitize(src, base) {
  const out = { ...base };
  if (!src || typeof src !== 'object') return out;
  for (const k of ['sfx', 'music', 'quiet']) if (typeof src[k] === 'boolean') out[k] = src[k];
  for (const k of ['sfxVol', 'musicVol']) if (k in src) { const v = clamp01(src[k]); if (v !== null) out[k] = v; }
  return out;
}

function storage() {
  try { return globalThis.localStorage || null; } catch (e) { return null; }
}

function loadSettings() {
  try {
    const ls = storage(); const raw = ls && ls.getItem(STORE_KEY);
    return raw ? sanitize(JSON.parse(raw), DEFAULTS) : { ...DEFAULTS };
  } catch (e) { return { ...DEFAULTS }; }
}

let settings = loadSettings();
let masterOn = true; // старый общий выключатель setSoundEnabled (не сохраняется здесь)

export function getAudioSettings() { return { ...settings }; }

export function setAudioSettings(patch) {
  settings = sanitize(patch, settings);
  try { const ls = storage(); if (ls) ls.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* приватный режим */ }
  applyMix();
  syncMusic();
  return getAudioSettings();
}

/** Старый API: общий выключатель (звуки и музыка). */
export function setSoundEnabled(on) { masterOn = !!on; applyMix(); syncMusic(); }
export function isSoundEnabled() { return masterOn && settings.sfx; }

// ───────────────────────── граф WebAudio ─────────────────────────
// sfxBus ┐
//        ├→ master → bassShelf → lowpass → limiter → destination
// musBus ┘

let ac = null, master = null, shelf = null, lowpass = null, limiter = null, sfxBus = null, musicBus = null;
let unlocked = false, inited = false;

function ctx() {
  if (!AC) return null;
  if (ac) return ac;
  try {
    ac = new AC();
    master = ac.createGain();
    shelf = ac.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 220;
    lowpass = ac.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.Q.value = 0.5;
    limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -20; limiter.knee.value = 12; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.25;
    sfxBus = ac.createGain(); musicBus = ac.createGain();
    sfxBus.connect(master); musicBus.connect(master);
    master.connect(shelf).connect(lowpass).connect(limiter).connect(ac.destination);
    applyMix(true);
  } catch (e) { ac = null; }
  return ac;
}

function applyMix(immediate) {
  if (!ac) return;
  const t = ac.currentTime, q = settings.quiet;
  const set = (p, v) => { try { immediate ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.08); } catch (e) { p.value = v; } };
  set(master.gain, q ? 0.32 : 0.85);       // общий потолок
  set(lowpass.frequency, q ? 2400 : 9000); // без высоких резких частот в тихом режиме
  set(shelf.gain, q ? -9 : 0);             // бас приглушён
  set(sfxBus.gain, masterOn && settings.sfx ? settings.sfxVol : 0);
  set(musicBus.gain, masterOn && settings.music ? settings.musicVol * 0.55 : 0);
}

function canPlaySfx() { return masterOn && settings.sfx && settings.sfxVol > 0; }

// ───────────────────────── iOS: разблокировка и сворачивание ─────────────────────────

export function unlockAudio() {
  const a = ctx(); if (!a) return;
  try {
    if (a.state !== 'running') a.resume().catch(() => {});
    if (!unlocked) {
      // тихий пустой буфер — классический «ключ» для iOS Safari
      const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource();
      s.buffer = b; s.connect(a.destination); s.start(0);
      unlocked = true;
    }
  } catch (e) { /* молча */ }
  syncMusic();
}

export function initAudio() {
  if (inited || !hasWindow || !AC) return;
  inited = true;
  const onGesture = () => unlockAudio(); // не снимаем: iOS может «прервать» контекст (звонок, Siri)
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, onGesture, { passive: true, capture: true });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) { try { ac.suspend(); } catch (e) {} }
      else if (unlocked) { try { ac.resume().catch(() => {}); } catch (e) {} resyncScheduler(); }
    });
  }
  window.addEventListener('pageshow', () => { if (ac && unlocked) { try { ac.resume().catch(() => {}); } catch (e) {} resyncScheduler(); } });
}

// ───────────────────────── синтез-примитивы ─────────────────────────

/**
 * Одна мягкая нота. f→f2 — глиссандо, attack/дуга — экспоненциальные (без щелчков).
 * filter — частота lowpass на голосе (смягчает пилу/квадрат).
 */
function voice({ f, f2, type = 'sine', dur = 0.15, vol = 0.1, delay = 0, attack = 0.01, filter = 0, bus, at, detune = 0 }) {
  const a = ac; if (!a) return;
  try {
    const t = (at ?? a.currentTime) + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f, t);
    if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filter; node = g.connect(lp); }
    node.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* молча */ }
}

let noiseBuf = null;
function noise({ dur = 0.15, vol = 0.05, delay = 0, type = 'bandpass', freq = 2000, freq2, q = 1, attack = 0.005, bus, at }) {
  const a = ac; if (!a) return;
  try {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = (at ?? a.currentTime) + delay;
    const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; bp.type = type; bp.Q.value = q;
    bp.frequency.setValueAtTime(freq, t);
    if (freq2) bp.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  } catch (e) { /* молча */ }
}

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

/** Старый API: простой тон (теперь через мастер-цепочку и лимитер). */
export function tone(f, d = 0.12, type = 'sine', vol = 0.1, delay = 0) {
  if (!canPlaySfx() || !ctx()) return;
  if (ac.state === 'suspended' && unlocked) ac.resume().catch(() => {});
  voice({ f, f2: f * 1.4, type, dur: d, vol: Math.min(vol, 0.2), delay, attack: 0.012, filter: type === 'square' || type === 'sawtooth' ? 1800 : 0 });
}

// ───────────────────────── звуковые эффекты ─────────────────────────

// Мажорная пентатоника от до второй октавы — каскад «поднимается» по ней.
const PENTA = [0, 2, 4, 7, 9];
const popNote = k => { const i = Math.max(0, Math.min(k | 0, 12)); return 72 + 12 * Math.floor(i / 5) + PENTA[i % 5]; };

function bark(high) {
  // «Гав»: пила через полосовой фильтр с падающим тоном + шумовой выдох. Чапа — звонкий, Пуша — басовитый.
  const base = high ? 620 : 210, form = high ? 1400 : 600, len = high ? 0.09 : 0.16;
  const n = high ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const d = i * (high ? 0.14 : 0);
    voice({ f: base * 1.25, f2: base * 0.75, type: 'sawtooth', dur: len, vol: high ? 0.05 : 0.08, delay: d, attack: 0.012, filter: form });
    voice({ f: base * 0.5, f2: base * 0.4, type: 'sine', dur: len, vol: high ? 0.03 : 0.07, delay: d, attack: 0.01 });
    noise({ dur: len * 0.8, vol: 0.015, delay: d, freq: form, q: 2 });
  }
}

const chord = (notes, opts) => notes.forEach((m, i) => voice({ f: midi(m), ...opts, delay: (opts.delay || 0) + (opts.strum || 0) * i }));

export const sfx = {
  /** свап двух фишек — мягкий «вжух» */
  swap: () => { voice({ f: 392, f2: 523, type: 'sine', dur: 0.09, vol: 0.05 }); noise({ dur: 0.08, vol: 0.012, freq: 1200, freq2: 2400, q: 0.8 }); },
  /** неверный ход — тёплое «бум-бум» вниз, не «ошибка» */
  bad: () => { voice({ f: 220, f2: 196, type: 'triangle', dur: 0.1, vol: 0.06 }); voice({ f: 196, f2: 165, type: 'triangle', dur: 0.14, vol: 0.05, delay: 0.1 }); },
  /** лопнувший шарик; k — номер каскада, тон растёт по пентатонике */
  pop: k => {
    const f = midi(popNote((k || 1) - 1));
    voice({ f: f * 0.8, f2: f, type: 'sine', dur: 0.1, vol: 0.08, attack: 0.004 });
    voice({ f: f * 2, type: 'triangle', dur: 0.06, vol: 0.015, attack: 0.003 });
  },
  /** создание спецфишки — искорка вверх */
  special: () => { chord([72, 76, 79, 84], { type: 'triangle', dur: 0.22, vol: 0.045, strum: 0.05 }); },
  /** ракета-полоса — мягкий «фьюить» */
  line: () => { voice({ f: 330, f2: 1320, type: 'triangle', dur: 0.22, vol: 0.05, filter: 3000 }); noise({ dur: 0.22, vol: 0.02, freq: 800, freq2: 4000, q: 1.5 }); },
  /** бомба — круглое «бумф», без треска */
  bomb: () => { voice({ f: 150, f2: 55, type: 'sine', dur: 0.35, vol: 0.14, attack: 0.008 }); noise({ dur: 0.3, vol: 0.03, type: 'lowpass', freq: 900, freq2: 200, q: 0.7 }); },
  /** радуга — арпеджио-перелив */
  rainbow: () => { [72, 76, 79, 83, 86, 88, 91].forEach((m, i) => voice({ f: midi(m), type: 'sine', dur: 0.25, vol: 0.04, delay: i * 0.045 })); },
  /** треск льда — короткие стеклянные щелчки (мягко, через фильтр) */
  ice: () => { for (let i = 0; i < 3; i++) noise({ dur: 0.05, vol: 0.03, freq: 3000 + i * 700, q: 6, delay: i * 0.035 }); voice({ f: 1568, type: 'sine', dur: 0.12, vol: 0.02, delay: 0.02 }); },
  /** ящик/подарок открылся — «тук» и колокольчик */
  crate: () => { voice({ f: 180, f2: 120, type: 'triangle', dur: 0.08, vol: 0.07 }); noise({ dur: 0.06, vol: 0.02, freq: 700, q: 1 }); chord([79, 84], { type: 'sine', dur: 0.3, vol: 0.04, strum: 0.07, delay: 0.06 }); },
  /** заморозка снята — тающий перелив вниз-вверх */
  freezeBreak: () => { noise({ dur: 0.12, vol: 0.025, freq: 4000, freq2: 1500, q: 3 }); chord([84, 79, 88], { type: 'sine', dur: 0.2, vol: 0.035, strum: 0.05, delay: 0.04 }); },
  /** шоколад разъеден — мягкое «чмок» */
  choco: () => { voice({ f: 260, f2: 160, type: 'sine', dur: 0.1, vol: 0.07 }); noise({ dur: 0.07, vol: 0.015, type: 'lowpass', freq: 600, q: 1 }); },
  /** соска — «пип» резинки */
  pacifier: () => { voice({ f: 700, f2: 950, type: 'sine', dur: 0.07, vol: 0.04 }); voice({ f: 950, f2: 700, type: 'sine', dur: 0.09, vol: 0.035, delay: 0.08 }); },
  /** телепорт — «вуу-ип» с вибрато-переливом */
  teleport: () => { voice({ f: 880, f2: 330, type: 'sine', dur: 0.18, vol: 0.04 }); voice({ f: 330, f2: 990, type: 'sine', dur: 0.2, vol: 0.04, delay: 0.16 }); },
  /** звезда n (1..3) — каждая выше */
  star: n => { const m = [76, 79, 84][Math.max(1, Math.min(3, n | 0 || 1)) - 1]; voice({ f: midi(m), type: 'triangle', dur: 0.4, vol: 0.06 }); voice({ f: midi(m + 12), type: 'sine', dur: 0.5, vol: 0.02, delay: 0.02 }); },
  /** победа — мягкая фанфара */
  win: () => {
    [72, 76, 79, 84].forEach((m, i) => voice({ f: midi(m), type: 'triangle', dur: 0.3, vol: 0.06, delay: i * 0.12 }));
    chord([72, 76, 79, 84], { type: 'sine', dur: 1.2, vol: 0.03, attack: 0.05, delay: 0.5 });
  },
  /** поражение — сочувственное «ну-у» вниз, не грустно-страшное */
  lose: () => { [79, 76, 72].forEach((m, i) => voice({ f: midi(m), type: 'sine', dur: 0.35, vol: 0.05, delay: i * 0.18, attack: 0.03 })); voice({ f: midi(67), type: 'sine', dur: 0.8, vol: 0.04, delay: 0.54, attack: 0.05 }); },
  barkChapa: () => bark(true),
  barkPusha: () => bark(false),
  /** обе собаки (старое имя из движка) */
  woof: () => { bark(true); setTimeout(() => bark(false), 260); },
  /** кнопка интерфейса */
  button: () => voice({ f: 660, f2: 700, type: 'sine', dur: 0.06, vol: 0.04, attack: 0.004 }),
  /** тик бонуса после победы (guard — номер залпа) */
  bonus: guard => { const g = guard | 0; voice({ f: midi(popNote(g % 10) ), type: 'triangle', dur: 0.12, vol: 0.05 }); },
  /** улыбка Маши (+3 хода) */
  masha: () => chord([81, 85, 88], { type: 'sine', dur: 0.5, vol: 0.04, strum: 0.09, attack: 0.03 }),
  /** клик по переключателю звука */
  toggle: () => voice({ f: 660, f2: 880, type: 'triangle', dur: 0.1, vol: 0.05 }),
};
// синонимы имён
sfx.gift = sfx.crate;
sfx.freeze = sfx.freezeBreak;
sfx['freeze-break'] = sfx.freezeBreak;

/** Проиграть звук по имени из шага движка: ['pop', 3] → sfx.pop(3). Неизвестные имена молча игнорируются. */
export function playSfx(ev) {
  try {
    const [name, arg] = Array.isArray(ev) ? ev : [ev];
    const f = typeof name === 'string' && Object.prototype.hasOwnProperty.call(sfx, name) ? sfx[name] : null;
    if (f) f(arg);
  } catch (e) { /* молча */ }
}
// старые прямые вызовы sfx.win() и т.п. тоже должны уважать настройки и создавать контекст
for (const k of Object.keys(sfx)) {
  const raw = sfx[k];
  sfx[k] = arg => {
    if (!canPlaySfx() || !ctx()) return;
    try { if (ac.state === 'suspended' && unlocked) ac.resume().catch(() => {}); raw(arg); } catch (e) { /* молча */ }
  };
}

// ───────────────────────── фоновая музыка ─────────────────────────
// Генеративный луп: 4 такта аккордов, мелодия из детерминированного ГПСЧ
// (луп узнаётся, но каждый второй проход — вариация). Шаг — восьмая.

const MAJ = [0, 2, 4, 5, 7, 9, 11], LYD = [0, 2, 4, 6, 7, 9, 11];
// аккорды — ступени лада (0 = I)
const WORLDS = [
  // 0 «Утро с Машей» — колыбельная, 3/4, музыкальная шкатулка
  { bpm: 63, beats: 3, root: 65, scale: MAJ, prog: [0, 5, 3, 4], pad: 0.05, padType: 'sine', mel: 0.45, melOct: 12, melType: 'sine', melVol: 0.05, bass: [0], bassVol: 0.06, arp: 0, kick: 0 },
  // 1 «Двор Чапы и Пуши» — игривый, прыгучий бас
  { bpm: 100, beats: 4, root: 60, scale: MAJ, prog: [0, 3, 4, 0], pad: 0.025, padType: 'triangle', mel: 0.5, melOct: 12, melType: 'triangle', melVol: 0.045, bass: [0, 4, 2, 4], bassVol: 0.07, arp: 0, kick: 0, penta: true },
  // 2 «Футбол Лёни» — бодрый, мягкий «бочонок» на долях
  { bpm: 112, beats: 4, root: 67, scale: MAJ, prog: [0, 4, 5, 3], pad: 0.025, padType: 'triangle', mel: 0.4, melOct: 0, melType: 'triangle', melVol: 0.045, bass: [0, 0, 4, 4], bassVol: 0.07, arp: 0.3, kick: 0.09 },
  // 3 «Альбом Саши» — акварельный: лидийский, медленные пады, редкие колокольчики
  { bpm: 72, beats: 4, root: 62, scale: LYD, prog: [0, 1, 0, 4], pad: 0.05, padType: 'sine', mel: 0.25, melOct: 12, melType: 'sine', melVol: 0.04, bass: [0], bassVol: 0.05, arp: 0, kick: 0, seventh: true },
  // 4 «Мамин сад» — спокойный, широкие аккорды, птичьи трели изредка
  { bpm: 60, beats: 4, root: 63, scale: MAJ, prog: [0, 3, 5, 3], pad: 0.055, padType: 'sine', mel: 0.2, melOct: 12, melType: 'sine', melVol: 0.035, bass: [0, 4], bassVol: 0.05, arp: 0, kick: 0, birds: true },
  // 5 «Семейный праздник» — праздничный, аккордовые «стабы» и арпеджио
  { bpm: 108, beats: 4, root: 60, scale: MAJ, prog: [0, 5, 3, 4], pad: 0.02, padType: 'triangle', mel: 0.55, melOct: 12, melType: 'triangle', melVol: 0.045, bass: [0, 2, 4, 2], bassVol: 0.065, arp: 0.5, kick: 0.07, stabs: true },
];

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let wantWorld = null;   // что просили
let players = [];       // активные (в т.ч. затухающие) лупы
let timer = null;
const FADE = 1.6, LOOKAHEAD = 0.35;

function degNote(W, deg, oct = 0) {
  const n = W.scale.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n;
  return W.root + W.scale[d] + 12 * (o + oct);
}

function makePlayer(i) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(1, ac.currentTime + FADE);
  g.connect(musicBus);
  return { world: i, W: WORLDS[i], gain: g, step: 0, next: ac.currentTime + 0.1, rand: rng(1), dying: false, end: 0 };
}

function schedStep(p, t) {
  const W = p.W, spb = 60 / W.bpm / 2; // секунд на восьмую
  const perBar = W.beats * 2, bar = Math.floor(p.step / perBar), s = p.step % perBar;
  const cycle = Math.floor(bar / W.prog.length);
  if (p.step % (perBar * W.prog.length) === 0) p.rand = rng(1000 * (p.world + 1) + (cycle % 2) * 7);
  const R = p.rand, root = W.prog[bar % W.prog.length];
  const triad = [root, root + 2, root + 4].concat(W.seventh ? [root + 6] : []);
  const bus = p.gain, quiet = settings.quiet;

  // пэд — на первую долю такта, держится весь такт
  if (s === 0 && W.pad) {
    const len = spb * perBar;
    for (const d of triad) {
      const f = midi(degNote(W, d));
      voice({ f, type: W.padType, dur: len * 1.05, vol: W.pad / triad.length * 1.6, attack: len * 0.35, bus, at: t, detune: -6, filter: 1400 });
      voice({ f, type: 'sine', dur: len * 1.05, vol: W.pad / triad.length, attack: len * 0.35, bus, at: t, detune: 6 });
    }
  }
  // аккордовые «стабы» праздника — на слабые доли
  if (W.stabs && s % 4 === 2) for (const d of triad) voice({ f: midi(degNote(W, d, 1)), type: 'triangle', dur: spb * 0.9, vol: 0.018, bus, at: t, filter: 2500 });
  // бас — по шаблону ступеней на долях
  if (s % 2 === 0) {
    const beat = s / 2, pat = W.bass;
    if (pat.length > 1 || beat === 0) {
      const off = pat[beat % pat.length]; // смещение в ступенях от корня аккорда
      voice({ f: midi(degNote(W, root + off, -2)), type: 'triangle', dur: spb * (pat.length === 1 ? perBar * 0.9 : 1.6), vol: W.bassVol * (quiet ? 0.5 : 1), attack: 0.02, bus, at: t, filter: 700 });
    }
  }
  // мягкий «бочонок» — на сильные доли (в тихом режиме не играет)
  if (W.kick && !quiet && s % 4 === 0) voice({ f: 120, f2: 48, type: 'sine', dur: 0.18, vol: W.kick, attack: 0.005, bus, at: t });
  // арпеджио
  if (W.arp && s % 2 === 1 && R() < W.arp) voice({ f: midi(degNote(W, triad[(p.step >> 1) % triad.length], 1)), type: 'sine', dur: spb * 1.5, vol: 0.022, bus, at: t });
  // мелодия: ноты аккорда или соседние ступени
  const strong = s % 2 === 0;
  if (R() < W.mel * (strong ? 1 : 0.5)) {
    let deg = triad[Math.floor(R() * 3)];
    if (!strong && R() < 0.5) deg += R() < 0.5 ? 1 : -1;
    if (W.penta) { const d = ((deg % 7) + 7) % 7; if (d === 3 || d === 6) deg += 1; }
    const len = spb * (R() < 0.3 ? 3 : 1.6);
    voice({ f: midi(degNote(W, deg, W.melOct / 12)), type: W.melType, dur: len, vol: W.melVol, attack: 0.01, bus, at: t, filter: quiet ? 0 : 3500 });
  }
  // птички в саду — редкие короткие трели (не в тихом режиме)
  if (W.birds && !quiet && s === 5 && R() < 0.25) {
    const b = 2200 + R() * 600;
    for (let k = 0; k < 3; k++) voice({ f: b, f2: b * 1.25, type: 'sine', dur: 0.05, vol: 0.012, at: t + k * 0.07, bus });
  }
  p.step++;
  return spb;
}

function tick() {
  if (!ac) return;
  const now = ac.currentTime;
  for (const p of players) {
    if (p.dying && now > p.end) continue;
    while (p.next < now + LOOKAHEAD) p.next += schedStep(p, p.next);
  }
  for (const p of players) if (p.dying && now > p.end) { try { p.gain.disconnect(); } catch (e) {} }
  players = players.filter(p => !(p.dying && now > p.end));
  if (!players.length) { clearInterval(timer); timer = null; }
}

function resyncScheduler() {
  if (!ac) return;
  const now = ac.currentTime;
  for (const p of players) if (p.next < now) p.next = now + 0.05; // не «догоняем» пропущенные ноты
}

function fadeOut(p) {
  if (p.dying) return;
  p.dying = true; p.end = ac.currentTime + FADE + 0.2;
  try { p.gain.gain.cancelScheduledValues(ac.currentTime); p.gain.gain.setTargetAtTime(0.0001, ac.currentTime, FADE / 4); } catch (e) {}
}

function syncMusic() {
  if (!ac || !unlocked) return;
  const target = masterOn && settings.music && wantWorld !== null ? wantWorld : null;
  for (const p of players) if (!p.dying && p.world !== target) fadeOut(p);
  if (target !== null && !players.some(p => !p.dying && p.world === target)) players.push(makePlayer(target));
  resyncScheduler();
  if (players.length && !timer) { timer = setInterval(tick, 60); if (timer && timer.unref) timer.unref(); }
  if (players.length) tick();
}

/** Фоновая музыка мира 0..5 (кроссфейд ~1.5 с); null — плавная тишина. */
export function setMusicWorld(i) {
  const n = i === null || i === undefined ? null : Number(i);
  wantWorld = n !== null && Number.isInteger(n) && n >= 0 && n < WORLDS.length ? n : null;
  syncMusic();
}

export const MUSIC_WORLDS = WORLDS.length;
