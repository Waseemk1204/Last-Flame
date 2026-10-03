// Dev only (?dev): an autopilot that plays the level the way a person would
// (aim, lock on, leap), re-routing whenever it goes out or lands somewhere
// else. Use it to prove the climb works end to end:
//   __lf.autopilot()  then read __lf.auto.log

export function installDev(game) {
  const g = game;
  const auto = { log: [], done: false, stop: false };

  const aim = (id) => {
    const h = g.byId.get(id);
    const p = h.wickPos();
    const f = g.pos.clone();
    f.y += 0.35;
    const d = p.clone().sub(f);
    g.yaw = Math.atan2(-d.x, -d.z);
    g.pitch = Math.max(-1.2, Math.min(0.85, Math.asin(d.y / d.length())));
  };

  // Shortest route from where you are to the temple lamp.
  const route = () => {
    const start = g.host;
    if (!start) return [];
    const prev = new Map([[start.id, null]]);
    const q = [start];
    const reach = (a, b) => {
      if (a.type === "rocket") return b.id === a.data.to;
      const r = a.spec.range;
      const pts = [a === start ? g.pos : a.wickPos()];
      if (a.data.rise) for (let t = 0.25; t <= 1; t += 0.25) pts.push({ x: a.start.x + (a.data.rise[0] - a.start.x) * t, y: a.start.y + (a.data.rise[1] - a.start.y) * t + 0.15, z: a.start.z + (a.data.rise[2] - a.start.z) * t });
      const bp = b.wickPos();
      return pts.some((p) => {
        const d = Math.hypot(bp.x - p.x, bp.y - p.y, bp.z - p.z);
        return d <= r && bp.y - p.y <= r * 0.8 && d > 0.05;
      });
    };
    while (q.length) {
      const a = q.shift();
      if (a.id === "great") break;
      for (const b of g.hosts) if (!prev.has(b.id) && b.usable && reach(a, b)) {
        prev.set(b.id, a.id);
        q.push(b);
      }
    }
    const path = [];
    let c = "great";
    if (!prev.has(c)) return [];
    while (c && c !== start.id) {
      path.unshift(c);
      c = prev.get(c);
    }
    return path;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settled = async () => {
    for (let i = 0; i < 200 && !(g.state === "play" && g.host && g.host.type !== "rocket"); i += 1) {
      if (g.state === "ending" || g.state === "done") return;
      await sleep(40);
    }
  };

  const step = async (id) => {
    let t = null;
    for (let i = 0; i < 50; i += 1) {
      aim(id);
      await sleep(35);
      t = g.findTarget();
      if (t?.id === id) break;
    }
    // Wait on a kandeel until the next host comes into reach.
    if (!t && g.host?.type === "kandeel") return "wait";
    if (!t) return null;
    const want = t.id;
    g.input.pressed = true;
    for (let i = 0; i < 90; i += 1) {
      await sleep(35);
      if (g.state === "ending" || g.state === "done") return "END";
      if (g.state === "play" && g.host?.id === want) return want;
      if (g.state === "play" && g.host?.type === "rocket") return want;
    }
    return null;
  };

  auto.run = async () => {
    auto.log = [];
    auto.done = false;
    let fails = 0;
    while (!auto.stop) {
      await settled();
      if (g.state === "ending" || g.state === "done") {
        auto.log.push("ENDING reached");
        break;
      }
      const path = route();
      if (!path.length) {
        auto.log.push(`no path from ${g.host?.id}`);
        if (g.host?.type === "kandeel") {
          await sleep(500);
          continue;
        }
        break;
      }
      const got = await step(path[0]);
      if (got === "END") {
        auto.log.push("ENDING reached");
        break;
      }
      if (got === "wait") await sleep(400);
      else if (got) auto.log.push(`✓ ${got}`);
      else {
        auto.log.push(`✗ ${path[0]} from ${g.host?.id} (${g.state})`);
        if (++fails > 10) break;
      }
    }
    auto.done = true;
  };

  window.__lf.auto = auto;
  window.__lf.autopilot = () => auto.run();
}
