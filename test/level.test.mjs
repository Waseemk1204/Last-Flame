import { test } from "node:test";
import assert from "node:assert/strict";
import { HOSTS_DATA, START, canLeap, LAMP_COUNT } from "../shared/level.js";
import { HOSTS } from "../shared/rules.js";

const byId = new Map(HOSTS_DATA.map((h) => [h.id, h]));

// Where you can go from a host (rockets go to their target; kandeels can be
// left from anywhere along their rise).
function next(h) {
  if (h.type === "rocket") return [byId.get(h.to)];
  const range = HOSTS[h.type].range;
  const froms = [h];
  if (h.rise) for (let t = 0.25; t <= 1; t += 0.25) froms.push({ x: h.x + (h.rise[0] - h.x) * t, y: h.y + (h.rise[1] - h.y) * t, z: h.z + (h.rise[2] - h.z) * t });
  return HOSTS_DATA.filter((o) => o !== h && froms.some((f) => canLeap(f, o, range)));
}

test("ids are unique and rockets point at real hosts", () => {
  assert.equal(byId.size, HOSTS_DATA.length);
  for (const h of HOSTS_DATA) if (h.type === "rocket") assert.ok(byId.get(h.to), h.id);
});

test("the temple lamp can be reached from the start", () => {
  const seen = new Set([START]);
  const queue = [byId.get(START)];
  while (queue.length) {
    const h = queue.shift();
    for (const o of next(h)) if (!seen.has(o.id)) {
      seen.add(o.id);
      queue.push(o);
    }
  }
  assert.ok(seen.has("great"), "great lamp unreachable");
  const unreached = HOSTS_DATA.filter((h) => !seen.has(h.id)).map((h) => h.id);
  assert.deepEqual(unreached, [], `unreachable: ${unreached.join(", ")}`);
});

test("every checkpoint leads on to the next", () => {
  const order = ["cp1", "cp2", "cp3", "cp4", "great"];
  for (let i = 0; i < order.length - 1; i += 1) {
    const seen = new Set([order[i]]);
    const queue = [byId.get(order[i])];
    while (queue.length) {
      const h = queue.shift();
      for (const o of next(h)) if (!seen.has(o.id)) {
        seen.add(o.id);
        queue.push(o);
      }
    }
    assert.ok(seen.has(order[i + 1]), `${order[i]} can't reach ${order[i + 1]}`);
  }
});

test("no dead ends: every host (but the temple lamp) has somewhere to go", () => {
  for (const h of HOSTS_DATA) {
    if (h.type === "great") continue;
    assert.ok(next(h).length > 0, `${h.id} at ${h.x},${h.y},${h.z} is a dead end`);
  }
});

test("there are plenty of lamps to light", () => {
  assert.ok(LAMP_COUNT >= 40, `only ${LAMP_COUNT}`);
});
