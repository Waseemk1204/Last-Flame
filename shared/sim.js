// A level while you play it: platforms that move, burn, melt and blink;
// drops of water; gusts of wind; rain; the things you can burn; the
// checkpoint and the goal; and your life running down. Pure, so the tests
// (and the bot) can play it exactly as the game does.

import { MOVE, LIFE, PICKUPS, PAPER, WAX, BLINK, DRIP } from "./rules.js";
import { makeBody, cloneBody, step, over } from "./physics.js";

const H = MOVE.height;

export class LevelState {
  constructor(level) {
    this.level = level;
    this.t = 0;
    this.plats = level.plats.map((def) => ({ def, alive: true, touch: 0, burning: false, burnT: 0, regrowT: 0, melt: 0, idle: 0, fading: false, x: def.x, y: def.y, z: def.z, mx: 0, my: 0, mz: 0 }));
    this.byId = new Map(this.plats.map((p) => [p.def.id, p]));
    this.pickups = level.pickups.map((p) => ({ ...p, taken: false, banked: false }));
    this.drips = level.drips.map((d) => ({ ...d, hit: -1, y: d.top }));
    this.winds = level.winds.map((w) => ({ ...w, active: false }));
    this.cpReached = false;
    this.place();
    for (const p of this.plats) p.mx = p.my = p.mz = 0;
    this.list = [];
    this.build();
  }

  clone() {
    const c = Object.create(LevelState.prototype);
    c.level = this.level;
    c.t = this.t;
    c.plats = this.plats.map((p) => ({ ...p }));
    c.byId = new Map(c.plats.map((p) => [p.def.id, p]));
    c.pickups = this.pickups.map((p) => ({ ...p }));
    c.drips = this.drips.map((d) => ({ ...d }));
    c.winds = this.winds.map((w) => ({ ...w }));
    c.cpReached = this.cpReached;
    c.list = [];
    c.build();
    return c;
  }

  // Back to how it was when you reached your last checkpoint (or began).
  reset() {
    for (const p of this.plats) Object.assign(p, { alive: true, touch: 0, burning: false, burnT: 0, regrowT: 0, melt: 0, idle: 0, fading: false });
    for (const p of this.pickups) p.taken = p.banked;
    for (const d of this.drips) d.hit = -1;
    this.place();
    for (const p of this.plats) p.mx = p.my = p.mz = 0;
    this.build();
  }

  bank() {
    for (const p of this.pickups) if (p.taken) p.banked = true;
  }

  // Where each platform is at this.t.
  place() {
    for (const p of this.plats) {
      const d = p.def;
      let x = d.x;
      let y = d.y;
      let z = d.z;
      if (d.move) {
        const m = d.move;
        const s = Math.sin(((this.t + (m.phase ?? 0) * m.period) / m.period) * Math.PI * 2) * m.amp;
        x += m.ax[0] * s;
        y += m.ax[1] * s;
        z += m.ax[2] * s;
      }
      p.mx = x - p.x;
      p.my = y - p.y;
      p.mz = z - p.z;
      p.x = x;
      p.y = y;
      p.z = z;
    }
  }

  // The solid boxes, as physics wants them.
  build() {
    const out = this.list;
    out.length = 0;
    for (const p of this.plats) {
      const d = p.def;
      if (!p.alive || d.kind === "water") continue;
      const top = p.y - p.melt;
      out.push({ id: d.id, x0: p.x - d.w / 2, x1: p.x + d.w / 2, z0: p.z - d.d / 2, z1: p.z + d.d / 2, y0: p.y - d.h, y1: top, mx: p.mx, my: p.my - (p.dmelt ?? 0), mz: p.mz });
    }
    return out;
  }

  // Time passes: platforms move, paper burns, wax melts, blinkers blink.
  advance(dt, body) {
    this.t += dt;
    this.place();
    const ev = [];
    for (const p of this.plats) {
      const d = p.def;
      const on = body && body.grounded && body.ground === d.id;
      p.dmelt = 0;
      if (d.kind === "paper") {
        if (p.alive) {
          if (on) p.touch += dt;
          if (!p.burning && p.touch >= PAPER.fuse) {
            p.burning = true;
            ev.push({ type: "ignite", plat: p });
          }
          if (p.burning) {
            p.burnT += dt;
            if (p.burnT >= PAPER.burn) {
              p.alive = false;
              p.regrowT = PAPER.regrow;
              ev.push({ type: "gone", plat: p });
            }
          }
        } else {
          p.regrowT -= dt;
          if (p.regrowT <= 0 && !(body && insideFootprint(body, p))) Object.assign(p, { alive: true, touch: 0, burning: false, burnT: 0 });
        }
      } else if (d.kind === "wax") {
        if (p.alive) {
          if (on) {
            const before = p.melt;
            p.melt = Math.min(d.h, p.melt + WAX.melt * dt);
            p.dmelt = p.melt - before;
            p.idle = 0;
            if (p.melt >= d.h - 0.05) {
              p.alive = false;
              p.regrowT = WAX.regrowDelay * 3;
              ev.push({ type: "gone", plat: p });
            }
          } else {
            p.idle += dt;
            if (p.idle > WAX.regrowDelay) p.melt = Math.max(0, p.melt - WAX.regrow * dt);
          }
        } else {
          p.regrowT -= dt;
          if (p.regrowT <= 0 && !(body && insideFootprint(body, p))) Object.assign(p, { alive: true, melt: 0, idle: 0 });
        }
      } else if (d.blink) {
        const b = d.blink;
        const c = (((this.t + b.phase * (b.on + b.off)) % (b.on + b.off)) + (b.on + b.off)) % (b.on + b.off);
        const was = p.alive;
        p.alive = c < b.on;
        p.fading = p.alive && c > b.on - BLINK.warn;
        if (was && !p.alive) ev.push({ type: "blink", plat: p });
      }
    }
    // Drops.
    for (const d of this.drips) {
      const k = this.t + d.phase * d.period;
      const tc = ((k % d.period) + d.period) % d.period;
      d.cycle = Math.floor(k / d.period);
      d.y = d.top - 0.5 * DRIP.gravity * tc * tc;
      d.falling = d.y > d.floor;
    }
    for (const w of this.winds) {
      const c = (((this.t + w.phase * w.period) % w.period) + w.period) % w.period;
      w.active = c < w.on;
      w.warn = !w.active && c > w.period - 0.8;
    }
    this.build();
    return ev;
  }

  windAt(b) {
    for (const w of this.winds) {
      if (!w.active) continue;
      if (b.x > w.x0 && b.x < w.x1 && b.y + 0.4 > w.y0 && b.y < w.y1 && b.z > w.z0 && b.z < w.z1) return w;
    }
    return null;
  }

  sheltered(b) {
    for (const s of this.list) if (s.y0 > b.y + H - 0.05 && over(b, s, 0)) return true;
    return false;
  }
}

function insideFootprint(b, p) {
  const d = p.def;
  return Math.abs(b.x - p.x) < d.w / 2 + MOVE.radius && Math.abs(b.z - p.z) < d.d / 2 + MOVE.radius && b.y > p.y - d.h - H && b.y < p.y + 0.5;
}

// A whole attempt at a level: the level, you, and your life.
export class Run {
  constructor(level) {
    this.level = level;
    this.st = new LevelState(level);
    this.body = makeBody(...level.start);
    this.life = level.life;
    this.can = level.can;
    this.spawn = [...level.start];
    this.spawnLife = level.life;
    this.dead = false;
    this.won = false;
    this.time = 0;
    this.deaths = 0;
  }

  clone() {
    const c = Object.create(Run.prototype);
    Object.assign(c, this);
    c.st = this.st.clone();
    c.body = cloneBody(this.body);
    return c;
  }

  respawn() {
    this.st.reset();
    this.body = makeBody(...this.spawn);
    this.life = this.spawnLife;
    this.dead = false;
  }

  // One frame. Returns what happened, for the game to show and play.
  tick(inp, dt) {
    const ev = [];
    if (this.dead || this.won) return ev;
    const st = this.st;
    const b = this.body;
    this.time += dt;
    for (const e of st.advance(dt, b)) ev.push(e);
    const w = st.windAt(b);
    inp.push = w ? { x: w.dx * w.strength, z: w.dz * w.strength } : null;
    const can = { double: this.can.double, dash: this.can.dash };
    for (const e of step(b, inp, st.list, dt, can)) {
      ev.push({ type: e });
      if (e === "double") this.life -= LIFE.double;
      if (e === "dash") this.life -= LIFE.dash;
    }
    // Life.
    let drain = 1;
    this.inWind = !!w;
    this.inRain = !!this.level.rain && !st.sheltered(b);
    if (w) drain *= LIFE.wind;
    if (this.inRain) drain *= LIFE.rain;
    this.drain = drain;
    this.life -= dt * drain;
    // Things to burn.
    for (const p of st.pickups) {
      if (p.taken) continue;
      const pos = pickupPos(st, p);
      const dx = b.x - pos.x;
      const dz = b.z - pos.z;
      const dy = b.y + 0.4 - pos.y;
      const r = PICKUPS[p.type].r;
      if (dx * dx + dz * dz < r * r && Math.abs(dy) < 0.9) {
        p.taken = true;
        this.life = Math.min(this.level.max, this.life + PICKUPS[p.type].life);
        ev.push({ type: "pickup", p, pos });
      }
    }
    // Drops of water.
    for (const d of st.drips) {
      if (!d.falling || d.hit === d.cycle) continue;
      if (Math.abs(b.x - d.x) < DRIP.radius && Math.abs(b.z - d.z) < DRIP.radius && d.y > b.y - 0.1 && d.y < b.y + H + 0.2) {
        d.hit = d.cycle;
        this.life -= LIFE.drip;
        ev.push({ type: "drip", d });
      }
    }
    // Water and the void.
    for (const p of st.plats) {
      if (p.def.kind !== "water") continue;
      if (Math.abs(b.x - p.x) < p.def.w / 2 && Math.abs(b.z - p.z) < p.def.d / 2 && b.y < p.y + 0.05 && b.y > p.y - p.def.h - 1) return this.die(ev, "water");
    }
    if (b.y < this.level.killY) return this.die(ev, "fall");
    if (this.life <= 0) return this.die(ev, "out");
    // Checkpoint and goal.
    const cp = this.level.cp;
    if (cp && !st.cpReached && b.grounded && b.ground === cp.on && Math.hypot(b.x - cp.x, b.z - cp.z) < 1.3) {
      st.cpReached = true;
      st.bank();
      this.spawn = [cp.x, cp.y + 0.05, cp.z];
      this.spawnLife = this.level.cpLife;
      this.life = Math.max(this.life, this.level.cpLife);
      ev.push({ type: "checkpoint" });
    }
    const g = this.level.goal;
    if (b.grounded && b.ground === g.on && Math.hypot(b.x - g.x, b.z - g.z) < 1.4) {
      this.won = true;
      ev.push({ type: "goal" });
    }
    return ev;
  }

  die(ev, why) {
    this.dead = true;
    this.deaths += 1;
    ev.push({ type: "die", why });
    return ev;
  }
}

export function pickupPos(st, p) {
  const pl = st.byId.get(p.on);
  return { x: pl.x + p.ox, y: pl.y - pl.melt + 0.35, z: pl.z + p.oz };
}
