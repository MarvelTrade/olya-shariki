// Звук: модуль импортируется в Node без window, настройки сохраняются, все звуки и музыка
// проигрываются на мок-AudioContext без исключений и без превышения громкости голоса.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SRC = new URL('../../src/audio/sound.js', import.meta.url).href;
let n = 0;
const fresh = () => import(`${SRC}?v=${++n}`);

function mockStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

test('импорт в Node без window: API на месте, вызовы молча ничего не делают', async () => {
  delete globalThis.localStorage;
  const A = await fresh();
  for (const k of ['initAudio', 'unlockAudio', 'playSfx', 'setMusicWorld', 'getAudioSettings', 'setAudioSettings',
    'setSoundEnabled', 'isSoundEnabled', 'tone']) assert.equal(typeof A[k], 'function', k);
  assert.equal(typeof A.sfx, 'object');
  A.initAudio(); A.unlockAudio(); A.playSfx(['pop', 3]); A.playSfx(['нет-такого']); A.playSfx([]);
  A.sfx.win(); A.tone(440); A.setMusicWorld(2); A.setMusicWorld(null);
  assert.deepEqual(A.getAudioSettings(), { sfx: true, music: true, quiet: false, sfxVol: 0.8, musicVol: 0.5 });
});

test('настройки сохраняются в localStorage и читаются при загрузке', async () => {
  globalThis.localStorage = mockStorage();
  const A = await fresh();
  const r = A.setAudioSettings({ quiet: true, musicVol: 0.2, sfxVol: 7, music: 'да', лишнее: 1 });
  assert.deepEqual(r, { sfx: true, music: true, quiet: true, sfxVol: 1, musicVol: 0.2 });
  const saved = JSON.parse(globalThis.localStorage.getItem('olya-shariki-audio'));
  assert.deepEqual(saved, r);
  const B = await fresh();
  assert.deepEqual(B.getAudioSettings(), r);
  // повреждённые данные — значения по умолчанию
  globalThis.localStorage = mockStorage({ 'olya-shariki-audio': '{битый' });
  assert.equal((await fresh()).getAudioSettings().quiet, false);
  // localStorage бросает — не падаем
  globalThis.localStorage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const C = await fresh();
  assert.equal(C.setAudioSettings({ sfx: false }).sfx, false);
  delete globalThis.localStorage;
});

// ── мок WebAudio ──
function param(v = 0) {
  const p = { value: v, max: v };
  const track = x => { if (x > p.max) p.max = x; };
  for (const m of ['setValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime'])
    p[m] = (x) => { if (m === 'exponentialRampToValueAtTime' && !(x > 0)) throw new RangeError('exp ramp to ' + x); track(x); };
  p.cancelScheduledValues = () => {};
  return p;
}
function makeCtx(log) {
  return class FakeAC {
    constructor() { log.ctx = this; this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 8000; this.destination = { connect() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    node(extra) { const nd = { connect: x => x, disconnect() {}, start() { log.started++; }, stop() {}, ...extra }; return nd; }
    createGain() { const g = this.node({ gain: param(1) }); log.gains.push(g); return g; }
    createOscillator() { return this.node({ type: 'sine', frequency: param(440), detune: param(0) }); }
    createBiquadFilter() { return this.node({ type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }); }
    createDynamicsCompressor() { log.comp++; return this.node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return this.node({ buffer: null }); }
  };
}

test('на мок-AudioContext: все звуки, лимитер, музыка всех миров с кроссфейдом', async () => {
  const log = { started: 0, gains: [], comp: 0 };
  const listeners = {};
  globalThis.window = { AudioContext: makeCtx(log), addEventListener: (e, f) => { listeners[e] = f; } };
  globalThis.document = { hidden: false, addEventListener: (e, f) => { listeners['doc:' + e] = f; } };
  globalThis.localStorage = mockStorage();
  try {
    const A = await fresh();
    A.initAudio();
    assert.ok(listeners.pointerdown && listeners['doc:visibilitychange']);
    listeners.pointerdown();
    assert.equal(log.comp, 1, 'мастер-лимитер создан');
    const names = ['swap', 'bad', 'pop', 'special', 'line', 'bomb', 'rainbow', 'ice', 'crate', 'gift', 'freeze-break', 'freezeBreak',
      'star', 'win', 'lose', 'barkChapa', 'barkPusha', 'woof', 'button', 'choco', 'pacifier', 'teleport', 'bonus', 'masha', 'toggle'];
    const before = log.started;
    for (const nm of names) for (const arg of [undefined, 1, 3, 15]) A.playSfx([nm, arg]);
    A.playSfx(['неизвестный', 1]); A.playSfx(['__proto__']); A.playSfx(['constructor']);
    assert.ok(log.started > before + names.length * 4, 'звуки запускают осцилляторы');
    const tick = () => new Promise(r => setTimeout(r, 70));
    for (let w = 0; w < 6; w++) { A.setMusicWorld(w); for (let i = 0; i < 6; i++) { log.ctx.currentTime += 0.5; await tick(); } }
    A.setMusicWorld(null); A.setMusicWorld(99); A.setMusicWorld('x');
    A.setAudioSettings({ quiet: true }); A.playSfx(['bomb']); A.setMusicWorld(3);
    listeners['doc:visibilitychange'](); globalThis.document.hidden = true; listeners['doc:visibilitychange']();
    // громкость отдельных голосов (кроме шин/мастера) мягкая
    const voiceMax = Math.max(...log.gains.slice(3).map(g => g.gain.max).filter(v => v !== 1));
    assert.ok(voiceMax <= 0.2, 'голос не громче 0.2: ' + voiceMax);
    A.setSoundEnabled(false); assert.equal(A.isSoundEnabled(), false); A.setSoundEnabled(true);
    A.setMusicWorld(null); log.ctx.currentTime += 5; await tick();
  } finally {
    delete globalThis.window; delete globalThis.document; delete globalThis.localStorage;
  }
});
