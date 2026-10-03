// A bot that plays a level along its route, one platform at a time: run at
// the next one, jump at the edge, double-jump or dash if it would fall
// short, and wait on its platform for moving or blinking ones to come round
// (it plans the wait by playing the next hop ahead in a copy of the level).
// The tests use it to prove every level can be finished in time; ?auto in
// the game lets you watch it.

import { MOVE } from "./rules.js";
import { pickupPos } from "./sim.js";

const DT = 1 / 60;

export class Bot {
  constructor(run, { plan = true } = {}) {
    this.route = run.level.plats.filter((p) => p.route);
    this.i = 0;
    this.wait = 0;
    this.planned = !plan;
    this.canPlan = plan;
    this.failed = false;
  }

  get from() {
    return this.route[this.i];
  }
  get to() {
    return this.route[this.i + 1];
  }

  // Where to head on the next platform: a flame to burn, the checkpoint or
  // goal, or its middle.
  waypoint(run) {
    const B = this.to;
    const st = run.st;
    const p = st.pickups.find((k) => k.on === B.id && !k.taken);
    if (p) return { ...pickupPos(st, p), must: true };
    const L = run.level;
    if (L.goal.on === B.id) return { x: L.goal.x, z: L.goal.z, must: true };
    if (L.cp && L.cp.on === B.id && !st.cpReached) return { x: L.cp.x, z: L.cp.z, must: true };
    const pl = st.byId.get(B.id);
    return { x: pl.x, z: pl.z, must: false };
  }

  input(run, dt) {
    const inp = { x: 0, z: 0, jump: false, held: true, dash: false };
    if (!this.to || run.won) return inp;
    const b = run.body;
    const st = run.st;
    const B = this.to;
    const Bp = st.byId.get(B.id);

    // Done with this hop?
    const W = this.waypoint(run);
    if (b.grounded && b.ground === B.id) {
      const d = Math.hypot(W.x - b.x, W.z - b.z);
      const inner = Math.min(B.w, B.d) / 2 - 0.45;
      const cx = Math.abs(b.x - Bp.x);
      const cz = Math.abs(b.z - Bp.z);
      if ((W.must && d < 0.35) || (!W.must && cx < Math.max(0.2, B.w / 2 - 0.45) && cz < Math.max(0.2, B.d / 2 - 0.45)) || (!W.must && inner < 0.2 && d < 0.3)) {
        this.i += 1;
        this.planned = !this.canPlan;
        return this.input(run, dt);
      }
    }

    if (!this.planned) {
      this.planned = true;
      this.wait = this.plan(run);
      if (this.wait < 0) {
        this.failed = true;
        this.wait = 0;
      }
    }
    if (this.wait > 0) {
      this.wait -= dt;
      return inp;
    }

    let dx = W.x - b.x;
    let dz = W.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    inp.x = dx;
    inp.z = dz;
    if (Bp.alive === false && b.ground !== B.id) {
      // Wait at the edge for it to come back.
    }
    const top = Bp.y - Bp.melt;
    const gap = rectDist(b, Bp, B);
    const onB = b.grounded && b.ground === B.id;
    if (b.grounded && !onB) {
      const px = b.x + dx * 0.12;
      const pz = b.z + dz * 0.12;
      const supported = st.list.some((s) => px > s.x0 && px < s.x1 && pz > s.z0 && pz < s.z1 && Math.abs(s.y1 - b.y) < 0.25);
      if (!supported || (top > b.y + MOVE.step && gap < 0.9)) inp.jump = true;
    } else if (!b.grounded) {
      const short = fallsShort(b, top, gap);
      if (short && b.airJumps > 0 && b.vy < 2) inp.jump = true;
      else if (short && b.airJumps === 0 && b.dashes > 0 && b.vy < 0.5 && b.y > top - 0.1) inp.dash = true;
    }
    return inp;
  }

  // How long to wait before this hop, found by trying it in a copy of the
  // level. -1 if nothing works.
  plan(run) {
    const B = this.to;
    const A = this.from;
    const timed = B.move || B.blink || A.move || A.blink || B.kind === "paper" || run.level.drips.length || run.level.winds.length;
    const max = timed ? 7 : 0.01;
    for (let wait = 0; wait <= max; wait += 0.1) {
      const sim = run.clone();
      const bot = new Bot(sim, { plan: false });
      bot.i = this.i;
      bot.wait = wait;
      const life0 = sim.life;
      let ok = false;
      for (let t = 0; t < wait + 4; t += DT) {
        const ev = sim.tick(bot.input(sim, DT), DT);
        if (sim.dead || ev.some((e) => e.type === "drip")) break;
        if (bot.i > this.i || sim.won) {
          ok = true;
          break;
        }
      }
      if (ok && sim.life > 0.5) return wait;
      void life0;
    }
    return -1;
  }
}

// Horizontal distance from you to a platform's top.
function rectDist(b, p, def) {
  const dx = Math.max(0, Math.abs(b.x - p.x) - def.w / 2);
  const dz = Math.max(0, Math.abs(b.z - p.z) - def.d / 2);
  return Math.hypot(dx, dz);
}

// Will you come down short of a platform `gap` away whose top is at `top`?
function fallsShort(b, top, gap) {
  if (gap <= 0.05) return false;
  const g = MOVE.gravity;
  // Time until you're back down to the top: y + vy t - g t^2 / 2 = top.
  const a = -g / 2;
  const c = b.y - top;
  const disc = b.vy * b.vy - 4 * a * c;
  if (disc < 0) return true;
  const t = (-b.vy - Math.sqrt(disc)) / (2 * a);
  if (t <= 0) return true;
  return MOVE.run * t < gap + 0.15;
}
