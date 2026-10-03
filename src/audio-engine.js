// WebAudio plumbing. The context/limiter setup is adapted from Jugaad Escape's
// audio.js; on top of it: buses (ambience, Kaal, effects, the 1987 bed),
// 3D panners for things in the house, and a duck on the ambience so the house
// can go quiet when Kaal is close.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.9;
    this.noiseBuffers = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // A little room: a short, dark convolution reverb on a send.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.2, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    const bus = (gain = 1, wet = true) => {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(this.master);
      if (wet) g.connect(this.reverbSend);
      return g;
    };
    this.duck = ctx.createGain(); // the house's ambience, ducked near Kaal
    this.duck.connect(this.master);
    this.duck.connect(this.reverbSend);
    this.amb = ctx.createGain();
    this.amb.connect(this.duck);
    this.tab = bus(0); // the muffled 1987 bed, faded with the light
    this.kaal = bus(1);
    this.sfx = bus(1);
    this.dry = bus(1, false); // breath, heartbeat: inside your head
    this.onReady?.();
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(kind = "white", seconds = 2) {
    const key = `${kind}${seconds}`;
    if (this.noiseBuffers[key]) return this.noiseBuffers[key];
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i += 1) {
      const w = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else if (kind === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else d[i] = w;
    }
    this.noiseBuffers[key] = buf;
    return buf;
  }

  // A panner placed in the house.
  panner(x, y, z, { ref = 1, rolloff = 1.2, max = 40 } = {}) {
    const p = this.ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = max;
    this.setPos(p, x, y, z);
    return p;
  }

  setPos(p, x, y, z) {
    const t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setTargetAtTime(x, t, 0.03);
      p.positionY.setTargetAtTime(y, t, 0.03);
      p.positionZ.setTargetAtTime(z, t, 0.03);
    } else p.setPosition(x, y, z);
  }

  listen(x, y, z, fx, fz) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.02);
      l.positionY.setTargetAtTime(y, t, 0.02);
      l.positionZ.setTargetAtTime(z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(0, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  // ---------------------------------------------------------- primitives

  tone({ freq = 440, type = "sine", duration = 0.2, gain = 0.3, attack = 0.005, detune = 0, slideTo, delay = 0, out }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.detune.value = detune;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(out || this.sfx);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  // A burst of filtered noise with an envelope.
  burst({ duration = 0.2, gain = 0.2, delay = 0, freq = 1200, q = 0.7, type = "bandpass", attack = 0.003, kind = "white", out, slideTo }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(kind);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    f.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(f);
    f.connect(amp);
    amp.connect(out || this.sfx);
    src.start(start, Math.random() * 1.5);
    src.stop(start + duration + 0.05);
  }

  // A looping noise bed. Returns { gain, filter, stop() }.
  loop({ kind = "pink", freq = 800, q = 0.5, type = "lowpass", gain = 0.1, out }) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(kind, 4);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(out || this.amb);
    src.start(0, Math.random() * 3);
    return { gain: g, filter, src, stop: () => src.stop() };
  }

  fade(param, value, time = 0.3) {
    if (!this.ctx) return;
    param.cancelScheduledValues(this.ctx.currentTime);
    param.setTargetAtTime(value, this.ctx.currentTime, time / 3);
  }
}
