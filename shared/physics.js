// How the flame moves: a box that runs, jumps, double-jumps and dashes among
// other boxes. Pure (no three.js), so the tests can run it too.

import { MOVE } from "./rules.js";

export function makeBody(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: false, ground: null, coyote: 0, buffer: 0, airJumps: 0, dashes: 0, dashT: 0, dashCd: 0, ddx: 0, ddz: 1, fx: 0, fz: 1, landed: 0 };
}

export function cloneBody(b) {
  return { ...b };
}

const R = MOVE.radius;
const H = MOVE.height;

function overlaps(b, s) {
  return b.x + R > s.x0 && b.x - R < s.x1 && b.y + H > s.y0 && b.y < s.y1 && b.z + R > s.z0 && b.z - R < s.z1;
}

// One step. inp: { x, z } the direction you want to go (world space, length
// <= 1), jump (pressed this frame), held (jump held), dash (pressed this
// frame), push: { x, z } an outside acceleration (wind). solids: boxes
// { id, x0..x1, y0..y1, z0..z1, mx, my, mz } where m* is how far the box
// moved this step. can: { double, dash }. Returns the events that happened.
export function step(b, inp, solids, dt, can = {}) {
  const M = MOVE;
  const ev = [];
  const was = b.grounded;
  b.landed = 0;

  // Ride whatever you're standing on.
  if (b.grounded && b.ground) {
    const s = solids.find((o) => o.id === b.ground);
    if (s) {
      b.x += s.mx;
      b.y += s.my;
      b.z += s.mz;
    } else {
      b.grounded = false;
      b.ground = null;
    }
  }

  // Jumps.
  b.buffer = inp.jump ? M.buffer : Math.max(0, b.buffer - dt);
  if (b.grounded) {
    b.coyote = M.coyote;
    b.airJumps = can.double ? 1 : 0;
    b.dashes = can.dash ? 1 : 0;
  } else b.coyote -= dt;
  if (b.buffer > 0) {
    if (b.coyote > 0) {
      b.vy = M.jump;
      b.coyote = 0;
      b.buffer = 0;
      b.grounded = false;
      b.ground = null;
      ev.push("jump");
    } else if (b.airJumps > 0) {
      b.vy = M.double;
      b.airJumps -= 1;
      b.buffer = 0;
      ev.push("double");
    }
  }

  // Facing.
  const wl = Math.hypot(inp.x, inp.z);
  if (wl > 0.1) {
    b.fx = inp.x / wl;
    b.fz = inp.z / wl;
  }

  // Dash.
  b.dashCd -= dt;
  if (inp.dash && b.dashes > 0 && b.dashCd <= 0) {
    b.dashes -= 1;
    b.dashT = M.dashTime;
    b.dashCd = M.dashCooldown;
    b.ddx = b.fx;
    b.ddz = b.fz;
    ev.push("dash");
  }

  if (b.dashT > 0) {
    b.dashT -= dt;
    b.vx = b.ddx * M.dash;
    b.vz = b.ddz * M.dash;
    b.vy = 0;
  } else {
    const tx = inp.x * M.run;
    const tz = inp.z * M.run;
    const a = (b.grounded ? (wl > 0.05 ? M.accel : M.stop) : M.airAccel) * dt;
    const dx = tx - b.vx;
    const dz = tz - b.vz;
    const dl = Math.hypot(dx, dz);
    if (dl <= a) {
      b.vx = tx;
      b.vz = tz;
    } else {
      b.vx += (dx / dl) * a;
      b.vz += (dz / dl) * a;
    }
    b.vy -= M.gravity * (b.vy > 0 && !inp.held ? M.cut : 1) * dt;
    if (b.vy < -M.maxFall) b.vy = -M.maxFall;
  }
  if (inp.push) {
    b.vx += inp.push.x * dt;
    b.vz += inp.push.z * dt;
  }

  // Move: up/down first, then across.
  const py = b.y;
  b.y += b.vy * dt;
  b.grounded = false;
  b.ground = null;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (b.vy <= 0 && py + 0.05 + Math.max(0, s.my) >= s.y1) {
      b.y = s.y1;
      if (!was) b.landed = -b.vy;
      b.vy = 0;
      b.grounded = true;
      b.ground = s.id;
    } else if (b.vy > 0 && py + H <= s.y0 + 0.05) {
      b.y = s.y0 - H;
      b.vy = 0;
      ev.push("bump");
    }
  }
  for (const axis of ["x", "z"]) {
    b[axis] += b[`v${axis}`] * dt;
    for (const s of solids) {
      if (!overlaps(b, s)) continue;
      // A low ledge: step up onto it.
      if (s.y1 - b.y <= M.step && (b.grounded || was)) {
        b.y = s.y1;
        b.grounded = true;
        b.ground = s.id;
        continue;
      }
      const lo = s[`${axis}0`];
      const hi = s[`${axis}1`];
      const into = b[axis] + R - lo;
      const out = hi - (b[axis] - R);
      if (into < out) {
        b[axis] -= into;
        if (b[`v${axis}`] > 0) b[`v${axis}`] = 0;
      } else {
        b[axis] += out;
        if (b[`v${axis}`] < 0) b[`v${axis}`] = 0;
      }
    }
  }
  if (b.landed > 0) ev.push("land");
  return ev;
}

// Is a point above the top of this box's footprint (with your radius)?
export function over(b, s, pad = R) {
  return b.x > s.x0 - pad && b.x < s.x1 + pad && b.z > s.z0 - pad && b.z < s.z1 + pad;
}
