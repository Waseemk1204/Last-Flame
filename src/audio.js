// All the sound, synthesised: a slow drone under each level, your crackle
// (louder and more ragged as you burn low), jumps, landings, dashes, a
// rising chime for each lamp you burn, the checkpoint's bell, the hiss of
// going out, drops, wind, rain, and the Eternal Fire.

import { AudioEngine } from "./audio-engine.js";

// Pentatonic: Sa Re Ga Pa Dha.
const SCALE = [0, 2, 4, 7, 9];
const SA = 220;
const note = (i) => SA * Math.pow(2, (SCALE[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12);

export class Sound extends AudioEngine {
  constructor() {
    super();
    this.streak = 0;
    this.streakT = 0;
    this.next = {};
    this.time = 0;
    this.root = 0;
  }

  begin() {
    this.unlock();
    if (!this.ctx || this.started) return;
    this.started = true;
    this.air = this.loop({ kind: "brown", freq: 260, q: 0.5, gain: 0.1 });
    this.crackle = this.loop({ kind: "pink", freq: 1600, q: 0.8, type: "bandpass", gain: 0, out: this.sfx });
    this.roar = this.loop({ kind: "brown", freq: 180, q: 0.7, gain: 0, out: this.sfx });
    this.rainLoop = this.loop({ kind: "pink", freq: 3000, q: 0.4, type: "lowpass", gain: 0, out: this.sfx });
    this.windLoop = this.loop({ kind: "pink", freq: 600, q: 2, type: "bandpass", gain: 0, out: this.sfx });
    this.padOut = this.ctx.createGain();
    this.padOut.gain.value = 0.5;
    this.padOut.connect(this.master);
    this.padOut.connect(this.reverbSend);
    this.next = { pad: 0.2, star: 2 };
  }

  // Each level sits on its own root, a little higher as you go.
  setLevel(i) {
    this.root = [0, 0, 2, 2, -1, -1, -3, -3, 0][i] ?? 0;
    this.level = i;
  }

  pad(freq, gain = 0.03, dur = 7) {
    for (const d of [-5, 4]) this.tone({ freq, type: "triangle", duration: dur, gain, attack: 2.2, detune: d, out: this.padOut });
  }

  update(dt, { life01 = 1, playing = true, wind = 0, rain = 0, fire = 0, low = false } = {}) {
    if (!this.started) return;
    this.time += dt;
    const t = this.time;
    const due = (k, a, b) => {
      if (t < (this.next[k] ?? 0)) return false;
      this.next[k] = t + a + Math.random() * (b - a);
      return true;
    };
    if (due("pad", 5.5, 5.5)) {
      const r = this.root;
      const chords = [
        [0, 2, 4],
        [-1, 1, 3],
        [0, 3, 5],
        [-2, 1, 4],
      ];
      const c = chords[Math.floor(t / 5.5) % 4];
      for (const k of c) this.pad(note(k + r - 5), 0.022);
    }
    if (due("star", 2, 6)) this.tone({ freq: note(5 + this.root + Math.floor(Math.random() * 6)), duration: 2.5, gain: 0.012, out: this.amb });
    const low01 = Math.max(0, 1 - life01 * 2.5);
    this.fade(this.crackle.gain.gain, playing ? 0.03 + low01 * 0.07 : 0, 0.15);
    if (playing && Math.random() < dt * (4 + low01 * 30)) this.burst({ duration: 0.02, gain: 0.03 + low01 * 0.06, freq: 2500 + Math.random() * 3000, q: 4 });
    if (low && due("tick", 0.5, 0.5)) this.tone({ freq: 1320, type: "square", duration: 0.04, gain: 0.025 });
    this.fade(this.rainLoop.gain.gain, rain * 0.16, 0.8);
    this.fade(this.windLoop.gain.gain, wind * 0.14, 0.3);
    this.fade(this.roar.gain.gain, fire * 0.25, 0.5);
    this.windLoop.filter.frequency.value = 500 + Math.sin(t * 2) * 200;
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
  }

  jump() {
    this.burst({ duration: 0.18, gain: 0.08, freq: 700, q: 0.8, slideTo: 1800, attack: 0.01 });
  }
  double() {
    this.burst({ duration: 0.25, gain: 0.1, freq: 1200, q: 1, slideTo: 3200, attack: 0.01 });
    this.tone({ freq: note(7 + this.root), duration: 0.3, gain: 0.025 });
  }
  dash() {
    this.burst({ duration: 0.3, gain: 0.14, freq: 2400, q: 0.6, slideTo: 600, attack: 0.005 });
  }
  land(v) {
    this.burst({ duration: 0.12, gain: Math.min(0.12, 0.02 + v * 0.006), freq: 300, q: 0.7, type: "lowpass" });
  }

  // Each lamp in a quick chain rings a step higher.
  pickup(type) {
    const i = 5 + this.root + Math.min(this.streak, 9);
    this.streak += 1;
    this.streakT = 4;
    const f = note(i);
    this.tone({ freq: f, duration: 1.4, gain: 0.07 });
    this.tone({ freq: f * 2.01, duration: 0.8, gain: 0.02 });
    this.burst({ duration: 0.35, gain: 0.08, freq: 900, q: 0.6, type: "lowpass", slideTo: 300 });
    if (type === "lantern") this.tone({ freq: f * 1.5, duration: 1.6, gain: 0.04, delay: 0.08 });
  }

  checkpoint() {
    for (const [f, g] of [
      [440, 0.11],
      [880 * 1.19, 0.05],
      [440 * 2.76, 0.03],
    ])
      this.tone({ freq: f, duration: 4, gain: g });
    this.burst({ duration: 0.9, gain: 0.16, freq: 400, q: 0.5, type: "lowpass", slideTo: 1400, attack: 0.05 });
  }

  ignite() {
    this.burst({ duration: 0.5, gain: 0.06, freq: 3000, q: 0.7, attack: 0.05 });
  }
  gone() {
    this.burst({ duration: 0.4, gain: 0.05, freq: 1800, q: 0.5, slideTo: 500 });
  }
  crumble() {
    this.burst({ duration: 0.9, gain: 0.14, freq: 160, q: 0.6, type: "lowpass", slideTo: 60 });
    for (let i = 0; i < 6; i += 1) this.burst({ duration: 0.06, gain: 0.04, freq: 900 + Math.random() * 900, q: 2, delay: Math.random() * 0.5 });
  }
  blink() {
    this.tone({ freq: 1760, duration: 0.25, gain: 0.015, slideTo: 880 });
  }
  hiss() {
    this.burst({ duration: 0.5, gain: 0.14, freq: 5000, q: 0.8, type: "highpass" });
  }
  out(why) {
    this.burst({ duration: 0.9, gain: 0.2, freq: why === "water" ? 6000 : 3000, q: 0.5, slideTo: 300 });
    this.tone({ freq: note(2 + this.root), duration: 1.5, gain: 0.04, slideTo: note(this.root) / 2 });
  }
  respawn() {
    this.burst({ duration: 0.5, gain: 0.08, freq: 300, q: 0.6, type: "lowpass", slideTo: 1200, attack: 0.1 });
  }
  win() {
    [0, 2, 4, 5, 7].forEach((i, k) => this.tone({ freq: note(i + 5 + this.root), duration: 4, gain: 0.05, attack: 0.05, delay: k * 0.12 }));
  }
  finale() {
    [0, 2, 4, 5, 7, 9, 10].forEach((i, k) => this.tone({ freq: note(i + 2), duration: 9, gain: 0.045, attack: 1, delay: k * 0.35 }));
    this.checkpoint();
  }
}
