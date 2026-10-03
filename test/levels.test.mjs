// Every level can be finished, in time, without going out: a bot plays each
// one along its route with the game's own physics.

import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../shared/levels.js";
import { Run } from "../shared/sim.js";
import { Bot } from "../shared/bot.js";

const DT = 1 / 60;

export function play(level, { log = false } = {}) {
  const run = new Run(level);
  const bot = new Bot(run);
  let minLife = run.life;
  const used = { double: 0, dash: 0, pickups: 0, cp: false };
  while (!run.won && !run.dead && run.time < 240 && !bot.failed) {
    for (const e of run.tick(bot.input(run, DT), DT)) {
      if (e.type === "double") used.double += 1;
      if (e.type === "dash") used.dash += 1;
      if (e.type === "pickup") used.pickups += 1;
      if (e.type === "checkpoint") used.cp = true;
      if (e.type === "die" && log) console.log("  died:", e.why, "at hop", bot.i, "->", bot.to?.id, run.body);
    }
    minLife = Math.min(minLife, run.life);
  }
  if (bot.failed && log) console.log("  no plan at hop", bot.i, bot.from.id, "->", bot.to?.id);
  return { won: run.won, time: run.time, minLife, life: run.life, used, hop: bot.i, of: bot.route.length - 1 };
}

test("there are nine levels, each with a checkpoint and a goal", () => {
  assert.equal(LEVELS.length, 9);
  for (const L of LEVELS) {
    assert.ok(L.cp, `${L.name} has a checkpoint`);
    assert.ok(L.goal, `${L.name} has a goal`);
    assert.equal(new Set(L.plats.map((p) => p.id)).size, L.plats.length);
  }
});

test("no two solid platforms overlap", () => {
  for (const L of LEVELS) {
    const solid = L.plats.filter((p) => p.kind !== "water" && !p.move);
    for (let i = 0; i < solid.length; i += 1)
      for (let j = i + 1; j < solid.length; j += 1) {
        const a = solid[i];
        const b = solid[j];
        const ox = Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 0.3;
        const oz = Math.abs(a.z - b.z) < (a.d + b.d) / 2 + 0.3;
        const oy = a.y - a.h < b.y + 1 && b.y - b.h < a.y + 1; // and 1 m of headroom
        if (a.roof || b.roof) continue;
        assert.ok(!(ox && oz && oy), `${L.name}: ${a.id} and ${b.id} overlap`);
      }
  }
});

test("every level has bonus lamps off the route", () => {
  for (const L of LEVELS) assert.ok(L.pickups.some((p) => p.bonus), L.name);
});

test("every bonus platform can be reached, and left again", () => {
  for (const L of LEVELS) {
    const route = L.plats.filter((p) => p.route);
    for (const bonus of L.plats.filter((p) => p.bonus)) {
      // Its parent: the route platform it was built off (the nearest one before it).
      const idx = L.plats.indexOf(bonus);
      const parent = [...route].reverse().find((p) => L.plats.indexOf(p) < idx);
      // Back onto the route: the parent if it lasts, else the next one.
      const back = parent.kind === "paper" || parent.crumble || parent.kind === "wax" ? route[route.indexOf(parent) + 1] : parent;
      for (const [from, to] of [[parent, bonus], [bonus, back]]) {
        const run = new Run(L);
        run.body.x = from.x;
        run.body.y = from.y + 0.05;
        run.body.z = from.z;
        run.life = 30;
        const bot = new Bot(run);
        bot.route = [from, to];
        let ok = false;
        for (let t = 0; t < 12 && !run.dead; t += DT) {
          run.tick(bot.input(run, DT), DT);
          if (bot.i > 0) {
            ok = true;
            break;
          }
        }
        assert.ok(ok, `${L.name}: ${from.id} -> ${to.id}`);
      }
    }
  }
});

for (const [i, L] of LEVELS.entries()) {
  test(`${i + 1}. ${L.name} can be finished in time`, () => {
    const r = play(L, { log: true });
    console.log(`  ${i + 1}. ${L.name}: ${r.won ? "WON" : "FAILED"} hop ${r.hop}/${r.of} in ${r.time.toFixed(1)}s, life left ${r.life.toFixed(1)}, lowest ${r.minLife.toFixed(1)}, pickups ${r.used.pickups}, doubles ${r.used.double}, dashes ${r.used.dash}`);
    assert.ok(r.won);
    assert.ok(r.used.cp, "passes the checkpoint");
    assert.ok(r.minLife >= 2, "leaves a human some slack");
    assert.ok(r.time < L.par[0], "gold is possible");
  });
}
