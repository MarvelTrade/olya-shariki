// Звук: пока это простой синтезатор tone() из старой версии (WebAudio, без файлов).
// sound-designer заменит/расширит этот модуль. Имена эффектов приходят из шагов движка (step.sfx).
let ac = null;
let enabled = true;

export function setSoundEnabled(on) { enabled = !!on; }
export function isSoundEnabled() { return enabled; }

export function tone(f, d = 0.12, type = 'sine', vol = 0.1, delay = 0) {
  if (!enabled) return;
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
  } catch (e) { /* нет WebAudio — играем молча */ }
}

export const sfx = {
  pop: k => tone(420 * Math.pow(1.12, Math.min(k, 10)), 0.11, 'triangle', 0.09),
  swap: () => tone(330, 0.07, 'sine', 0.05),
  bad: () => tone(170, 0.14, 'square', 0.03),
  special: () => { tone(523, 0.14, 'triangle', 0.08); tone(784, 0.18, 'triangle', 0.06, 0.07); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.09, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.07, i * 0.16)),
  woof: () => { tone(260, 0.09, 'square', 0.04); tone(220, 0.12, 'square', 0.04, 0.12); },
  /** тик бонуса после победы (guard — номер залпа) */
  bonus: guard => tone(660 + guard * 30, 0.1, 'triangle', 0.07),
  /** улыбка Маши (+3 хода) */
  masha: () => { tone(880, 0.2, 'sine', 0.08); tone(1175, 0.25, 'sine', 0.06, 0.1); },
  /** клик по переключателю звука */
  toggle: () => tone(660, 0.12, 'triangle', 0.08),
};

/** Проиграть звук по имени из шага движка: ['pop', 3] → sfx.pop(3). */
export function playSfx([name, arg]) { const f = sfx[name]; if (f) f(arg); }

/** «Разбудить» аудио на iOS первым касанием. */
export function unlockAudio() { tone(1, 0.001, 'sine', 0.0001); }
