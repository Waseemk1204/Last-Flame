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
