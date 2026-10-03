// All the sound, synthesised. A tanpura drone under the night; your crackle;
// a whoosh when you leap and a soft catch when a wick takes; a rising chime
// as you light lamp after lamp; a brass bell at checkpoints; wind, rain,
// kids, crackers, and the city's fireworks far away.

import { AudioEngine } from "./audio-engine.js";

// Pentatonic (Bhupali): Sa Re Ga Pa Dha.
const SCALE = [0, 2, 4, 7, 9];
const SA = 261.63;
const note = (i) => SA * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);

export class Sound extends AudioEngine {
  constructor() {
    super();
    this.streak = 0;
    this.streakT = 0;
    this.next = {};
    this.time = 0;
  }

  begin() {
    this.unlock();
    if (!this.ctx || this.started) return;
    this.started = true;
    const ctx = this.ctx;
    // Night air: wind, crickets.
    this.air = this.loop({ kind: "brown", freq: 300, q: 0.5, gain: 0.12 });
    // Tanpura: Pa, Sa, Sa, low Sa, plucked in a slow cycle, forever.
    this.tanpuraOut = ctx.createGain();
    this.tanpuraOut.gain.value = 0.5;
    this.tanpuraOut.connect(this.master);
    this.tanpuraOut.connect(this.reverbSend);
    this.next = { pluck: 0.5, cricket: 1, dog: 8, cracker: 3 };
    this.pluckIndex = 0;
    // Your crackle.
    this.crackle = this.loop({ kind: "pink", freq: 1600, q: 0.8, type: "bandpass", gain: 0, out: this.sfx });
    this.fizz = this.loop({ kind: "white", freq: 6000, q: 0.6, type: "highpass", gain: 0, out: this.sfx });
    this.rainLoop = this.loop({ kind: "pink", freq: 3000, q: 0.4, type: "lowpass", gain: 0, out: this.sfx });
    this.windLoop = this.loop({ kind: "pink", freq: 600, q: 2, type: "bandpass", gain: 0, out: this.sfx });
  }

  pluck(freq, gain = 0.06) {
    // A bright string with a buzzy jawari: two detuned saws through a falling filter.
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 2.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    for (const d of [-4, 3]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = d;
      o.connect(f);
      o.start(t);
      o.stop(t + 3.8);
    }
    f.connect(g);
    g.connect(this.tanpuraOut);
  }

  // fuel: 0..1 of the body you're in. state: what you're doing.
  update(dt, { fuel = 1, onHost = true, sparkler = false, wind = 0, rain = 0, playing = true } = {}) {
    if (!this.started) return;
    this.time += dt;
    const t = this.time;
    const due = (k, a, b) => {
      if (t < (this.next[k] ?? 0)) return false;
      this.next[k] = t + a + Math.random() * (b - a);
      return true;
    };
    if (due("pluck", 1.1, 1.1)) {
      const seq = [SA * 0.75, SA, SA, SA / 2];
      this.pluck(seq[this.pluckIndex++ % 4], 0.045);
    }
    if (due("cricket", 0.6, 2.4)) for (let i = 0; i < 4; i += 1) this.tone({ freq: 4400, duration: 0.03, gain: 0.008, delay: i * 0.07, out: this.amb });
    if (due("dog", 15, 40)) for (let i = 0; i < 2; i += 1) this.burst({ duration: 0.15, gain: 0.03, freq: 600, q: 4, delay: i * 0.4, out: this.amb });
    if (due("cracker", 2, 7)) this.cracker(0.02 + Math.random() * 0.03);
    // Your flame.
    const low = Math.max(0, 1 - fuel * 2.5);
    this.fade(this.crackle.gain.gain, playing && onHost ? 0.035 + low * 0.08 : 0, 0.15);
    if (playing && onHost && Math.random() < dt * (3 + low * 25)) this.burst({ duration: 0.02, gain: 0.04 + low * 0.06, freq: 2500 + Math.random() * 3000, q: 4 });
    this.fade(this.fizz.gain.gain, sparkler ? 0.05 : 0, 0.1);
    this.fade(this.rainLoop.gain.gain, rain * 0.16, 0.8);
    this.fade(this.windLoop.gain.gain, wind * 0.12, 0.4);
    this.windLoop.filter.frequency.value = 500 + Math.sin(t * 2) * 200;
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
  }

  cracker(gain) {
    // A string of distant bangs.
    const n = 1 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i += 1) this.burst({ duration: 0.12, gain, freq: 300 + Math.random() * 300, q: 0.7, type: "lowpass", delay: i * (0.06 + Math.random() * 0.1), out: this.amb });
  }

  leap(dist) {
    this.burst({ duration: 0.25 + dist * 0.05, gain: 0.12, freq: 900, q: 0.8, slideTo: 2400, attack: 0.02 });
  }

  catch(type) {
    this.burst({ duration: 0.4, gain: 0.14, freq: 700, q: 0.6, type: "lowpass", attack: 0.01, slideTo: 260 });
    if (type === "diya") this.chime();
  }

  // Each lamp in a quick chain rings a step higher.
  chime() {
    const i = 5 + Math.min(this.streak, 9);
    this.streak += 1;
    this.streakT = 6;
    const f = note(i);
    this.tone({ freq: f, type: "sine", duration: 1.6, gain: 0.07 });
    this.tone({ freq: f * 2.01, type: "sine", duration: 0.9, gain: 0.02 });
  }

  bell() {
    for (const [f, g] of [
      [440, 0.12],
      [880 * 1.19, 0.05],
      [440 * 2.76, 0.03],
    ])
      this.tone({ freq: f, type: "sine", duration: 4, gain: g, attack: 0.005 });
  }

  ember() {
    this.burst({ duration: 0.5, gain: 0.08, freq: 5000, q: 1, type: "highpass" });
  }

  die() {
    this.burst({ duration: 0.6, gain: 0.18, freq: 3000, q: 0.5, slideTo: 300 });
    this.tone({ freq: note(2), type: "sine", duration: 1.5, gain: 0.04, slideTo: note(0) / 2 });
  }

  rocket() {
    this.burst({ duration: 1.2, gain: 0.2, freq: 1500, q: 2, slideTo: 5000, attack: 0.05 });
    this.burst({ duration: 0.3, gain: 0.25, freq: 200, q: 0.6, type: "lowpass", delay: 1.15 });
  }

  spray() {
    this.burst({ duration: 0.8, gain: 0.08, freq: 3500, q: 0.8, attack: 0.03 });
  }

  giggle() {
    for (let i = 0; i < 4; i += 1) this.tone({ freq: 720 + Math.random() * 120, type: "triangle", duration: 0.07, gain: 0.03, delay: i * 0.09 });
  }

  firework(dist) {
    const d = Math.min(1.2, dist / 300);
    this.burst({ duration: 0.4, gain: Math.max(0.02, 0.12 - d * 0.08), freq: 250, q: 0.6, type: "lowpass", delay: d });
    for (let i = 0; i < 8; i += 1) this.burst({ duration: 0.04, gain: 0.015, freq: 3000 + Math.random() * 2000, q: 3, delay: d + 0.2 + Math.random() * 0.8 });
  }

  // The finale: a chord on the tanpura's Sa.
  triumph() {
    [0, 2, 4, 5, 7].forEach((i, k) => this.tone({ freq: note(i + 5), type: "sine", duration: 6, gain: 0.05, attack: 0.4, delay: k * 0.18 }));
    this.bell();
  }
}
