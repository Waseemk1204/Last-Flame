// The nine levels, as data. Each is built by walking a cursor forward:
// `go(gap, rise, size)` puts the next platform `gap` metres past the edge of
// the last one, `rise` metres higher. Everything on the route is in order,
// and the bot in shared/bot.js plays it hop by hop.

class Course {
  constructor(meta) {
    this.meta = meta;
    this.plats = [];
    this.pickups = [];
    this.drips = [];
    this.winds = [];
    this.dir = [0, 1];
    this.cur = null;
    this.cpAt = null;
    this.goalAt = null;
    this.prompts = [];
    this.at(0, 0, 0, 5, 5);
  }

  at(x, y, z, w, d, opt = {}) {
    const kind = opt.kind ?? "stone";
    const h = opt.h ?? { paper: 0.1, wax: 1.3, water: 0.3 }[kind] ?? 0.8;
    const p = { id: `p${this.plats.length}`, x, y, z, w, d, h, kind, route: opt.route ?? kind !== "water", move: opt.move, blink: opt.blink, roof: !!opt.roof, crumble: !!opt.crumble, bonus: !!opt.bonus };
    this.plats.push(p);
    if (p.route) this.cur = p;
    if (!p.roof && kind !== "water") this.target = p; // where lamps go
    this.last = p;
    return this;
  }

  // The next platform: `gap` metres beyond this one's edge, `rise` up,
  // `side` metres to the right. size: n or [along, across].
  go(gap, rise = 0, size = 2.4, opt = {}) {
    const [along, across] = Array.isArray(size) ? size : [size, size];
    const c = this.cur;
    const [hx, hz] = this.dir;
    const dist = (hx ? c.w : c.d) / 2 + gap + along / 2;
    const side = opt.side ?? 0;
    const x = c.x + hx * dist + hz * side;
    const z = c.z + hz * dist - hx * side;
    return this.at(x, c.y + rise, z, hx ? along : across, hx ? across : along, opt);
  }

  // Shorthands for kinds of platform.
  paper(gap, rise, size, opt = {}) {
    return this.go(gap, rise, size, { ...opt, kind: "paper" });
  }
  wax(gap, rise, size, opt = {}) {
    return this.go(gap, rise, size, { ...opt, kind: "wax" });
  }
  // Swings side to side (across your way) by amp metres.
  sway(gap, rise, size, amp, period, phase = 0, opt = {}) {
    const [hx, hz] = this.dir;
    return this.go(gap, rise, size, { ...opt, move: { ax: [hz, 0, -hx], amp, period, phase } });
  }
  // Rises and falls by amp metres.
  lift(gap, rise, size, amp, period, phase = 0, opt = {}) {
    return this.go(gap, rise, size, { ...opt, move: { ax: [0, 1, 0], amp, period, phase } });
  }
  // Slides toward you and away.
  slide(gap, rise, size, amp, period, phase = 0, opt = {}) {
    const [hx, hz] = this.dir;
    return this.go(gap, rise, size, { ...opt, move: { ax: [hx, 0, hz], amp, period, phase } });
  }
  // Stone that falls away a moment after you touch it.
  crumble(gap, rise, size, opt = {}) {
    return this.go(gap, rise, size, { ...opt, crumble: true });
  }

  // A bonus platform off to the side of this one (side: +1 right, -1 left),
  // `gap` metres past its side edge: off the route, for the lamps on it.
  branch(gap, rise = 0, size = 1.8, side = 1, opt = {}) {
    const c = this.cur;
    const [hx, hz] = this.dir;
    const half = (hx ? c.d : c.w) / 2;
    const dist = half + gap + size / 2;
    return this.at(c.x + hz * dist * side, c.y + rise, c.z - hx * dist * side, size, size, { ...opt, route: false, bonus: true });
  }

  // A key prompt floating over the gap after this platform.
  prompt(text) {
    const c = this.cur;
    const [hx, hz] = this.dir;
    const e = (hx ? c.w : c.d) / 2 + 1.2;
    this.prompts.push({ text, x: c.x + hx * e, y: c.y + 1.9, z: c.z + hz * e });
    return this;
  }

  // There for `on` seconds, gone for `off`.
  blink(gap, rise, size, on, off, phase = 0, opt = {}) {
    return this.go(gap, rise, size, { ...opt, blink: { on, off, phase } });
  }

  // A pool of water filling the next `len` metres (jump it).
  water(len, width = 3) {
    const c = this.cur;
    const [hx, hz] = this.dir;
    const dist = (hx ? c.w : c.d) / 2 + len / 2;
    this.at(c.x + hx * dist, c.y - 0.35, c.z + hz * dist, hx ? len : width, hx ? width : len, { kind: "water", route: false });
    return this;
  }

  turn(d) {
    this.dir = { n: [0, 1], e: [1, 0], s: [0, -1], w: [-1, 0] }[d];
    return this;
  }

  pick(type, ox = 0, oz = 0) {
    this.pickups.push({ type, on: this.target.id, ox, oz, bonus: this.target.bonus });
    return this;
  }
  diya(ox, oz) {
    return this.pick("diya", ox, oz);
  }
  candle(ox, oz) {
    return this.pick("candle", ox, oz);
  }
  lantern(ox, oz) {
    return this.pick("lantern", ox, oz);
  }

  cp() {
    const c = this.cur;
    this.cpAt = { x: c.x, y: c.y, z: c.z, on: c.id };
    return this;
  }
  goal() {
    const c = this.cur;
    this.goalAt = { x: c.x, y: c.y, z: c.z, on: c.id };
    return this;
  }

  // A drop of water falling on this platform every `period` seconds.
  drip(ox = 0, oz = 0, period = 2, phase = 0, height = 9) {
    const c = this.cur;
    this.drips.push({ x: c.x + ox, z: c.z + oz, top: c.y + height, floor: c.y, period, phase });
    return this;
  }

  // Wind across your way over the next `len` metres: gusts of `on` seconds
  // every `period`. sign: +1 pushes right, -1 left.
  wind(len, sign = 1, strength = 16, period = 4, on = 2, phase = 0, width = 14) {
    const c = this.cur;
    const [hx, hz] = this.dir;
    const a = { x: c.x, z: c.z };
    const b = { x: c.x + hx * len, z: c.z + hz * len };
    const x0 = Math.min(a.x, b.x) - (hx ? 0 : width / 2);
    const x1 = Math.max(a.x, b.x) + (hx ? 0 : width / 2);
    const z0 = Math.min(a.z, b.z) - (hz ? 0 : width / 2);
    const z1 = Math.max(a.z, b.z) + (hz ? 0 : width / 2);
    this.winds.push({ x0, x1, z0, z1, y0: c.y - 4, y1: c.y + 8, dx: hz * sign, dz: -hx * sign, strength, period, on, phase });
    return this;
  }

  // A roof over this platform, `height` above it: shelter from rain.
  roof(height = 3, extra = 0.6) {
    const c = this.cur;
    this.at(c.x, c.y + height + 0.3, c.z, c.w + extra, c.d + extra, { route: false, h: 0.3, roof: true });
    return this;
  }

  done() {
    const m = this.meta;
    const ys = this.plats.map((p) => p.y);
    const killY = Math.min(...ys) - 7;
    for (const d of this.drips) {
      // Drops stop at the first thing below them.
      let floor = killY;
      for (const p of this.plats) {
        if (p.kind === "water" || p.y >= d.top) continue;
        if (Math.abs(d.x - p.x) < p.w / 2 && Math.abs(d.z - p.z) < p.d / 2) floor = Math.max(floor, p.y);
      }
      d.floor = floor;
    }
    return {
      ...m,
      can: m.can ?? {},
      cpLife: m.cpLife ?? m.life,
      max: m.max ?? m.life * 1.6,
      start: [0, 0.05, 0],
      plats: this.plats,
      pickups: this.pickups,
      drips: this.drips,
      winds: this.winds,
      prompts: this.prompts,
      cp: this.cpAt,
      goal: this.goalAt,
      killY,
    };
  }
}

const course = (meta, build) => {
  const c = new Course(meta);
  build(c);
  return c.done();
};

// Palettes: sky top, horizon, fog, stone, mist below, ambient.
const DUSK = { top: 0x1a1030, mid: 0x5a2e4a, low: 0xc0603a, fog: 0x3a2030, stone: 0x8a7a70, mist: 0x50283a, amb: 0.55 };
const TWILIGHT = { top: 0x0a1028, mid: 0x2a2a58, low: 0x7a4a6a, fog: 0x1e1c38, stone: 0x7a7488, mist: 0x2a2448, amb: 0.5 };
const NIGHT = { top: 0x03050e, mid: 0x0b1430, low: 0x22305a, fog: 0x0a1020, stone: 0x6a7080, mist: 0x101a30, amb: 0.42 };
const STORM = { top: 0x05080a, mid: 0x18242a, low: 0x3a4a4a, fog: 0x141c20, stone: 0x5a6668, mist: 0x18262a, amb: 0.4 };
const ASH = { top: 0x0a0606, mid: 0x2a1a16, low: 0x6a3a26, fog: 0x231512, stone: 0x5a5250, mist: 0x2a1610, amb: 0.4 };
const WILL = { top: 0x080204, mid: 0x3a0a08, low: 0xb0401a, fog: 0x2a0806, stone: 0x4a3a38, mist: 0x5a1a08, amb: 0.45 };

export const LEVELS = [
  course(
    { name: "Kindling", sub: "Every flame starts small.", life: 12, cpLife: 12, max: 18, palette: DUSK, hint: "WASD to move, Space to jump. Run through lamps to take their flame: they give you time." },
    (c) => {
      c.prompt("Space · jump");
      c.go(1.2, 0, 3).diya();
      c.go(1.5, 0, 3);
      c.go(1.8, 0.6, 2.6).diya(0.5, 0);
      c.go(1.8, 0.6, 2.6);
      c.go(2.0, 0, 2.6).candle();
      c.branch(2.0, 0.6, 1.8, -1).lantern();
      c.turn("e").go(2.0, 0, 2.6);
      c.go(2.2, -0.6, 2.4).diya();
      c.go(2.2, 0, 2.4);
      c.go(2.0, 0, 4).cp();
      c.turn("n").go(2.2, 0.8, 2.4).diya();
      c.go(2.4, 0.8, 2.2);
      c.go(2.4, 0, 2.2).candle();
      c.go(2.6, -1, 2.2);
      c.turn("w").go(2.6, 0, 2.2).diya();
      c.go(2.8, 0.5, 2.2);
      c.go(2.8, 0, 2.2).diya();
      c.turn("n").go(2.5, 0, 5).goal();
    },
  ),
  course(
    { name: "Updraft", sub: "Burn a little brighter to climb.", life: 10, cpLife: 10, max: 16, palette: DUSK, can: { double: true }, hint: "Jump again in the air to double-jump. It burns a second of your life.", unlock: "double" },
    (c) => {
      c.go(1.6, 0, 3).diya();
      c.go(2.0, 1.2, 2.6).prompt("Space in the air · double jump");
      c.go(5.2, 0, 2.6).candle(); // too far for one jump
      c.go(1.6, 2.4, 2.4); // too high for one jump
      c.go(2.4, 0.6, 2.2).diya();
      c.turn("e").go(5.4, -0.5, 2.4);
      c.go(2.0, 2.2, 2.4).candle();
      c.go(3, 0, 4).cp();
      c.branch(3.0, 1.5, 1.6, -1).lantern();
      c.go(5.6, 0, 2.2).diya();
      c.turn("n").go(1.4, 2.5, 2.2);
      c.go(1.4, 2.5, 2.2).candle();
      c.go(5.0, -1, 2.0);
      c.go(3.0, 1.0, 2.0).diya();
      c.turn("w").go(5.6, 0, 2.0).diya();
      c.go(2.0, 2.4, 2.0);
      c.turn("n").go(3.5, 0, 5).goal();
    },
  ),
  course(
    { name: "Paper Bridges", sub: "Whatever you stand on, you burn.", life: 9, cpLife: 9, max: 14, palette: TWILIGHT, can: { double: true, dash: true }, hint: "Paper catches fire under you. Keep moving. Shift to dash: it burns a second too.", unlock: "dash" },
    (c) => {
      c.go(1.6, 0, 3).diya();
      c.paper(1.6, 0, 2.2);
      c.paper(1.6, 0, 2.2).diya();
      c.paper(1.8, 0, 2.2);
      c.go(1.8, 0.6, 2.6).candle().prompt("Jump, jump again, then Shift · dash");
      c.go(7.4, 0, 2.6); // needs a dash
      c.branch(4.0, 0, 1.6, 1).lantern();
      c.paper(1.8, 0, 2);
      c.paper(1.8, 0.4, 2).diya();
      c.paper(1.8, 0.4, 2);
      c.go(2.2, 0, 4).cp();
      c.turn("e").paper(2.2, 0, 2).diya();
      c.paper(2.4, 0.6, 2);
      c.paper(2.4, 0, 2).candle();
      c.go(8.0, 0.4, 2.4); // double and dash
      c.turn("n").paper(2.0, 0, 1.8).diya();
      c.paper(2.0, 0.5, 1.8);
      c.paper(2.0, 0.5, 1.8).diya();
      c.paper(2.4, 0, 1.8);
      c.go(2.4, 0, 5).goal();
    },
  ),
  course(
    { name: "Wax Garden", sub: "Nothing holds you for long.", life: 9, cpLife: 9, max: 14, palette: TWILIGHT, can: { double: true, dash: true }, hint: "Wax melts under you. Moving stones wait for no one." },
    (c) => {
      c.wax(1.6, 0, 2.6).diya();
      c.wax(2.0, 0.3, 2.4);
      c.go(2.0, 0, 2.6).candle();
      c.sway(2.4, 0, 2.4, 2.2, 4);
      c.sway(2.4, 0, 2.4, 2.2, 4, 0.5);
      c.go(2.4, 0, 3).diya();
      c.wax(2.2, 0.5, 2.2);
      c.wax(2.2, 0.5, 2.2).diya();
      c.go(2.4, 0, 4).cp();
      c.branch(3.0, 0.5, 1.6, -1).lantern();
      c.turn("e").lift(2.6, 1, 2.4, 1.4, 3.5).diya();
      c.go(2.6, 1.2, 2.4);
      c.slide(2.2, 0, 2.2, 1.6, 3.2).candle();
      c.wax(2.6, 0, 2.2);
      c.wax(2.6, 0.5, 2.0).diya();
      c.turn("n").sway(2.6, 0, 2.2, 2.6, 3.6);
      c.wax(2.6, 0.5, 2.0).diya();
      c.wax(2.8, 0.5, 2.0);
      c.go(2.6, 0, 5).goal();
    },
  ),
  course(
    { name: "Drip", sub: "Water is patient.", life: 10, cpLife: 10, max: 14, palette: NIGHT, can: { double: true, dash: true }, hint: "Watch for drops falling from the dark: each one costs you four seconds. Never touch the water." },
    (c) => {
      c.water(2.2).go(2.2, 0, 3).diya().drip(0, 0, 2.2, 0);
      c.water(2.4).go(2.4, 0, 2.6).drip(0, 0, 1.8, 0.4);
      c.go(2.4, 0.6, 2.4).candle().drip(0, 0, 2.0, 0.2);
      c.blink(2.4, 0, 2.4, 2.4, 1.6);
      c.blink(2.4, 0, 2.4, 2.4, 1.6, 0.25);
      c.go(2.4, 0, 3).diya();
      c.water(3).go(3, 0, 4).cp().drip(1, 1, 2.5, 0.1).drip(-1, -1, 2.5, 0.6);
      c.branch(3.2, 0, 1.6, -1).lantern();
      c.turn("e").blink(2.6, 0, 2.2, 2.2, 1.6).diya();
      c.water(2.8).go(2.8, 0.4, 2.2).drip(0, 0, 1.6, 0.3);
      c.blink(2.6, 0, 2.2, 2.0, 1.6, 0.4).candle();
      c.go(2.6, 0, 2.4).drip(0, 0, 1.4, 0.7);
      c.turn("n").water(3.2).go(3.2, 0.5, 2.2).diya().drip(0.4, 0, 1.5, 0.2);
      c.blink(2.8, 0, 2.0, 1.8, 1.4, 0.1);
      c.blink(2.8, 0, 2.0, 1.8, 1.4, 0.4).diya();
      c.water(3).go(3, 0, 5).goal();
    },
  ),
  course(
    { name: "Draft", sub: "The wind wants you out.", life: 7, cpLife: 7, max: 12, palette: NIGHT, can: { double: true, dash: true }, hint: "Gusts push you and burn you faster. Watch the dust: it stirs before a gust." },
    (c) => {
      c.go(2, 0, 3).diya();
      c.wind(14, 1, 14, 4, 1.8);
      c.go(2.4, 0, 2.4);
      c.go(2.6, 0.5, 2.4).diya();
      c.go(2.6, 0, 2.4);
      c.go(2.6, 0.5, 2.2).candle();
      c.go(2.4, 0, 4).cp();
      c.branch(3.4, 0.6, 1.6, -1).lantern();
      c.turn("e").wind(18, -1, 18, 3.6, 1.6, 0.3);
      c.paper(2.4, 0, 2.2).diya();
      c.go(2.6, 0.6, 2.2);
      c.sway(2.6, 0, 2.2, 1.6, 3.4).diya();
      c.go(2.8, 0, 2.2);
      c.paper(2.6, 0.5, 2.0).candle();
      c.turn("n").wind(16, 1, 20, 3.2, 1.6, 0.6);
      c.go(2.8, 0.5, 2.0);
      c.blink(2.8, 0, 2.0, 2.0, 1.4).diya();
      c.go(4.6, 0.5, 2.0);
      c.go(2.8, 0, 5).goal();
    },
  ),
  course(
    { name: "Monsoon", sub: "Rain everywhere. Shelter is rare.", life: 8, cpLife: 8, max: 12, palette: STORM, rain: true, weather: "rain", can: { double: true, dash: true }, hint: "In the rain you burn faster. Under a roof, you don't." },
    (c) => {
      c.roof();
      c.go(2.2, 0, 3).diya().drip(0, 0, 2, 0.5);
      c.go(2.4, 0.5, 2.4);
      c.go(2.0, 0, [5, 3]).roof().candle();
      c.wax(2.4, 0, 2.2);
      c.sway(2.6, 0.4, 2.2, 2, 3.8).diya();
      c.go(2.6, 0, 2.4).drip(0, 0, 1.6, 0.2);
      c.go(2.4, 0, 4).roof().cp();
      c.branch(3.0, 0.5, 1.6, 1).lantern();
      c.turn("w").blink(2.6, 0.5, 2.2, 2.0, 1.4).diya();
      c.paper(2.4, 0, 2);
      c.paper(2.4, 0.5, 2).diya();
      c.go(2.4, 0, [5, 2.6]).roof().candle();
      c.turn("n").water(3.4).go(3.4, 0, 2.2).drip(0, 0, 1.4, 0.1);
      c.lift(2.6, 1.2, 2.2, 1.2, 3).diya();
      c.go(5.4, 0, 2.2);
      c.wax(2.4, 0.6, 2.0).diya();
      c.go(2.8, 0, 5).roof(3.4, 1).goal();
    },
  ),
  course(
    { name: "Ashfall", sub: "The world burns down behind you.", life: 10, cpLife: 10, max: 13, palette: ASH, weather: "ash", can: { double: true, dash: true }, hint: "No rest from here on." },
    (c) => {
      c.paper(2.0, 0, 2.2).diya();
      c.blink(2.4, 0.5, 2.0, 1.6, 1.2);
      c.paper(2.4, 0, 2.0).diya();
      c.sway(2.6, 0.5, 2.0, 2.4, 3.0);
      c.crumble(5.6, 0, 2.2).candle();
      c.wax(2.4, 0.6, 2.0);
      c.wind(12, -1, 18, 3.4, 1.6);
      c.paper(2.6, 0, 2.0).diya();
      c.blink(2.8, 0.5, 2.0, 1.5, 1.2, 0.3);
      c.go(2.8, 0, 3.2).cp();
      c.branch(2.8, 0.8, 1.6, -1).lantern();
      c.turn("e").slide(2.6, 0.6, 2.0, 1.8, 2.8).diya();
      c.paper(2.6, 0, 1.8);
      c.crumble(7.0, 1.0, 2.0).candle();
      c.drip(0, 0, 1.3, 0.5);
      c.turn("n").blink(2.8, 0.5, 1.8, 1.4, 1.2).diya();
      c.wax(2.8, 0.5, 1.8);
      c.sway(2.8, 0, 1.8, 2.6, 2.8).diya();
      c.paper(2.8, 0.5, 1.8);
      c.crumble(6.8, 0.5, 2.0).diya();
      c.go(2.8, 0, 5).goal();
    },
  ),
  course(
    { name: "Will of Fire", sub: "Flames go out. Fire does not.", life: 9, cpLife: 9, max: 11, palette: WILL, weather: "embers", can: { double: true, dash: true }, final: true, collapse: { delay: 3, every: 1.4 }, hint: "Climb to the Eternal Fire." },
    (c) => {
      c.go(2.0, 0.8, 2.2).diya();
      c.paper(2.2, 0.8, 2.0);
      c.crumble(2.4, 0.8, 2.0).diya();
      c.turn("e").blink(2.4, 1.0, 2.0, 1.6, 1.2);
      c.wax(2.4, 1.0, 2.0).candle();
      c.lift(2.6, 1.2, 2.0, 1.2, 3.0);
      c.turn("s").go(2.4, 1.6, 2.0).diya().drip(0, 0, 1.4, 0.3);
      c.sway(2.6, 0.8, 1.8, 2.2, 2.8);
      c.paper(2.6, 0.8, 1.8).diya();
      c.go(2.6, 0.8, 3).cp();
      c.branch(3.0, 1.2, 1.4, -1).lantern();
      c.turn("w").wind(12, 1, 18, 3.2, 1.6);
      c.paper(2.6, 0.8, 1.8).diya();
      c.blink(2.6, 1.0, 1.8, 1.4, 1.2, 0.2);
      c.go(6.2, 0.8, 1.8).candle();
      c.turn("n").wax(2.6, 1.0, 1.8);
      c.slide(2.6, 1.0, 1.8, 1.6, 2.6).diya();
      c.paper(2.6, 1.0, 1.6);
      c.crumble(1.6, 2.6, 1.8).diya();
      c.turn("e").blink(2.8, 0.8, 1.6, 1.3, 1.1);
      c.go(2.4, 1.0, 6).goal();
    },
  ),
];

// Par times in seconds: [gold, silver]. Finishing at all is bronze.
const PARS = [[20, 28], [23, 31], [28, 38], [21, 29], [26, 35], [18, 24], [20, 27], [32, 44], [28, 38]];
LEVELS.forEach((L, i) => (L.par = PARS[i]));

export function medal(L, time) {
  return time <= L.par[0] ? "gold" : time <= L.par[1] ? "silver" : "bronze";
}

export const N = LEVELS.length;
