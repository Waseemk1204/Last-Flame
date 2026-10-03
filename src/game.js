// The game: one level at a time. Runs the shared simulation at a fixed
// step, turns its events into sound, sparks and HUD, and drives the camera,
// the deaths and respawns, the end of a level, and the finale.

import * as THREE from "three";
import { Post } from "./post.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { LEVELS } from "../shared/levels.js";
import { Run } from "../shared/sim.js";
import { Bot } from "../shared/bot.js";
import { LIFE, PICKUPS } from "../shared/rules.js";

const STEP = 1 / 120;
const KEY = "lastflame.progress";

export class Game {
  constructor({ renderer, sound, ui, input }) {
    this.renderer = renderer;
    this.sound = sound;
    this.ui = ui;
    this.input = input;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 900);
    this.post = new Post(renderer);
    Object.assign(this.post.fx, { vignette: 0.45, grain: 0.03, desat: 0, bloom: 0.9, aberration: 0.0008 });
    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.state = "idle";
    this.time = 0;
    this.acc = 0;
    this.yaw = 0;
    this.pitch = 0.32;
    this.camPos = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.camDist = 5.2;
    this.onWin = () => {};
    this.onFinale = () => {};
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  // ------------------------------------------------------------- progress
  static progress() {
    try {
      return { unlocked: 0, best: {}, deaths: {}, resume: null, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return { unlocked: 0, best: {}, deaths: {}, resume: null };
    }
  }
  static saveProgress(p) {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio, this.quality === "low" ? 1 : 1.5);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, ratio);
  }

  setQuality(q) {
    this.quality = q;
    this.post.fx.bloom = q === "low" ? 0 : 0.9;
    this.renderer.shadowMap.enabled = q !== "low";
    this.resize();
  }

  look(dx, dy) {
    this.lookT = this.time;
    this.yaw -= dx;
    this.pitch = Math.max(-0.25, Math.min(1.25, this.pitch + dy));
  }

  // ------------------------------------------------------------ a level
  start(index, { fromCp = false, auto = false } = {}) {
    const L = LEVELS[index];
    this.index = index;
    this.L = L;
    this.world.load(L, index);
    this.run = new Run(L);
    if (fromCp && L.cp) {
      this.run.st.cpReached = true;
      this.run.spawn = [L.cp.x, L.cp.y + 0.05, L.cp.z];
      this.run.spawnLife = L.cpLife;
      this.run.respawn();
    }
    this.bot = auto ? new Bot(this.run) : null;
    if (this.bot) this.syncBot();
    this.sound.setLevel(index);
    this.state = "play";
    this.acc = 0;
    this.wonT = 0;
    this.dieT = 0;
    this.player.alive = 1;
    // Face the way the level goes.
    const route = L.plats.filter((p) => p.route);
    const b = this.run.body;
    const next = route[1];
    this.yaw = Math.atan2(next.x - b.x, next.z - b.z);
    this.pitch = 0.32;
    this.focus.set(b.x, b.y + 0.9, b.z);
    this.placeCamera(1);
    this.ui.level(index + 1, L.name, L.sub);
    this.ui.abilities(L.can);
    if (L.hint && !fromCp) setTimeout(() => this.state === "play" && this.index === index && this.ui.hint(L.hint, 7), 3400);
    if (L.unlock) setTimeout(() => this.index === index && this.ui.toast(`New: ${L.unlock === "double" ? "double jump (Space in the air)" : "dash (Shift)"}`), 4200);
    const p = Game.progress();
    p.resume = { level: index, cp: fromCp };
    Game.saveProgress(p);
  }

  // The bot starts from the platform you're standing on.
  syncBot() {
    const b = this.run.body;
    const i = this.bot.route.findIndex((p) => Math.abs(b.x - p.x) <= p.w / 2 && Math.abs(b.z - p.z) <= p.d / 2 && Math.abs(b.y - p.y) < 0.3);
    this.bot.i = Math.max(0, i);
    this.bot.planned = false;
  }

  restartCheckpoint() {
    if (this.state !== "play") return;
    this.run.die([], "reset");
    this.state = "dying";
    this.dieT = 0.6;
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    this.time += dt;
    const t = this.time;
    const run = this.run;
    if (!run) return;

    if (this.state === "play") {
      this.acc += dt;
      let first = true;
      const kb = this.input.read();
      while (this.acc >= STEP) {
        this.acc -= STEP;
        let inp;
        if (this.bot) inp = this.bot.input(run, STEP);
        else {
          inp = this.wish(kb);
          inp.jump = first && kb.jump;
          inp.dash = first && kb.dash;
          inp.held = kb.held;
        }
        first = false;
        const ev = run.tick(inp, STEP);
        for (const e of ev) this.event(e);
        if (this.state !== "play") break;
      }
    } else if (this.state === "dying") {
      this.dieT += dt;
      this.player.alive = Math.max(0, 1 - this.dieT * 3);
      if (this.dieT > 1.1) {
        run.respawn();
        if (this.bot) this.syncBot();
        this.state = "play";
        this.player.alive = 0.01;
        this.sound.respawn();
        this.ui.fade(false);
      }
    } else if (this.state === "won") {
      this.wonT += dt;
      run.body.y += dt * Math.min(3, this.wonT * 2);
      this.player.alive = Math.max(0, 1 - this.wonT * 0.5);
      if (this.wonT > 1.8 && !this.reported) {
        this.reported = true;
        this.onWin(this.stats());
      }
    } else if (this.state === "ending") {
      this.updateEnding(dt);
    }
    if (this.state === "play" && this.player.alive < 1) this.player.alive = Math.min(1, this.player.alive + dt * 3);

    // Look and sound.
    const b = run.body;
    const life01 = Math.max(0, run.life) / 10;
    this.player.update(dt, t, b, this.state === "ending" ? 1 : life01, { dashing: b.dashT > 0 });
    this.world.sync(run, t, dt, this.player.root.position);
    if (this.state !== "ending") {
      // Not touching the mouse? The camera drifts round behind you.
      const sp = Math.hypot(b.vx, b.vz);
      if (this.state === "play" && sp > 2 && this.time - (this.lookT ?? -9) > 1.2) {
        const want = Math.atan2(b.vx, b.vz);
        let d = want - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < 2.2) this.yaw += d * Math.min(1, dt * 1.4) * Math.min(1, sp / 6);
      }
      this.placeCamera(dt);
    }
    this.world.update(dt, t, this.camera.position, this.player.root.position);
    const low = run.life < LIFE.low && this.state === "play";
    this.ui.life(Math.max(0, run.life), run.level.max, low, run.drain > 1);
    const near = this.L.final ? Math.max(0, 1 - Math.hypot(b.x - this.L.goal.x, b.z - this.L.goal.z, b.y - this.L.goal.y) / 25) : 0;
    this.sound.update(dt, { life01, playing: this.state === "play", wind: run.inWind ? 1 : 0, rain: this.L.rain ? (run.inRain ? 1 : 0.4) : 0, fire: this.state === "ending" ? 1 : near, low });
    this.sound.listen?.(this.camera.position.x, this.camera.position.y, this.camera.position.z, Math.sin(this.yaw), Math.cos(this.yaw));
    this.post.fx.vignette = 0.45 + (low ? 0.25 + Math.sin(t * 8) * 0.08 : 0);
    this.post.fx.desat = low ? 0.25 : 0;
    this.post.fx.exposure = this.state === "dying" ? 1 - Math.min(0.7, this.dieT) : 1;
  }

  // WASD, relative to where the camera looks.
  wish(kb) {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let x = fx * kb.z - fz * kb.x;
    let z = fz * kb.z + fx * kb.x;
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    return { x, z };
  }

  event(e) {
    const s = this.sound;
    const ui = this.ui;
    const p = this.player;
    switch (e.type) {
      case "jump":
        s.jump();
        p.kick(0.22);
        break;
      case "double":
        s.double();
        p.kick(0.3);
        p.burst(14, 2);
        ui.gain(`−${LIFE.double}s`, "cost");
        break;
      case "dash":
        s.dash();
        ui.gain(`−${LIFE.dash}s`, "cost");
        break;
      case "land":
        s.land(this.run.body.landed);
        break;
      case "pickup": {
        s.pickup(e.p.type);
        ui.gain(`+${PICKUPS[e.p.type].life}s`, "gain");
        p.burst(18, 2.5);
        break;
      }
      case "drip":
        s.hiss();
        ui.gain(`−${LIFE.drip}s`, "cost");
        ui.flash("drip");
        p.kick(-0.3);
        break;
      case "ignite":
        s.ignite();
        break;
      case "gone":
        s.gone();
        break;
      case "blink":
        if (Math.hypot(e.plat.x - this.run.body.x, e.plat.z - this.run.body.z) < 12) s.blink();
        break;
      case "checkpoint": {
        s.checkpoint();
        ui.toast("Checkpoint");
        p.burst(30, 3);
        const pr = Game.progress();
        pr.resume = { level: this.index, cp: true };
        Game.saveProgress(pr);
        break;
      }
      case "die":
        this.state = "dying";
        this.dieT = 0;
        p.burst(40, 3);
        if (e.why !== "reset") s.out(e.why);
        ui.died(e.why);
        break;
      case "goal":
        this.won();
        break;
      default:
    }
  }

  stats() {
    return { index: this.index, name: this.L.name, time: this.run.time, deaths: this.run.deaths, life: this.run.life };
  }

  won() {
    const pr = Game.progress();
    pr.unlocked = Math.max(pr.unlocked, Math.min(LEVELS.length - 1, this.index + 1));
    const prev = pr.best[this.index];
    this.newBest = prev === undefined || this.run.time < prev;
    if (this.newBest) pr.best[this.index] = this.run.time;
    pr.deaths[this.index] = this.run.deaths;
    pr.resume = this.index + 1 < LEVELS.length ? { level: this.index + 1, cp: false } : null;
    Game.saveProgress(pr);
    this.reported = false;
    if (this.L.final) {
      this.state = "ending";
      this.endT = 0;
      this.sound.finale();
      this.ui.hideHud();
      this.endFrom = this.camera.position.clone();
      return;
    }
    this.state = "won";
    this.wonT = 0;
    this.sound.win();
    this.player.burst(50, 4);
  }

  // Your flame walks into the Eternal Fire and is part of it. The camera
  // pulls away until it's one light in the dark among many.
  updateEnding(dt) {
    this.endT += dt;
    const k = this.endT;
    const g = this.L.goal;
    const b = this.run.body;
    b.x += (g.x - b.x) * Math.min(1, dt * 1.5);
    b.z += (g.z - b.z) * Math.min(1, dt * 1.5);
    b.y = g.y + Math.max(0, k - 1.5) * 0.8;
    b.vx = b.vz = 0;
    this.player.alive = Math.max(0, 1 - Math.max(0, k - 2.5) * 0.4);
    const a = this.yaw + k * 0.12;
    const r = 8 + k * 3.2;
    const h = 2 + k * 2.2;
    this.camera.position.set(g.x - Math.sin(a) * r, g.y + h, g.z - Math.cos(a) * r);
    this.camera.lookAt(g.x, g.y + 4 + k * 0.3, g.z);
    if (this.world.eternal) {
      const grow = 1 + Math.min(0.6, Math.max(0, k - 3) * 0.12);
      this.world.eternal[0].scale.set(5.5 * grow, 11 * grow, 5.5 * grow);
    }
    if (k > 4 && !this.toldEnd) {
      this.toldEnd = true;
      this.ui.ending();
    }
    if (k > 19 && !this.reported) {
      this.reported = true;
      this.onFinale(this.totals());
    }
  }

  totals() {
    const p = Game.progress();
    let time = 0;
    let deaths = 0;
    for (let i = 0; i < LEVELS.length; i += 1) {
      time += p.best[i] ?? 0;
      deaths += p.deaths[i] ?? 0;
    }
    return { time, deaths };
  }

  // Over your shoulder, pulled in if something's in the way.
  placeCamera(dt) {
    const b = this.run.body;
    const want = new THREE.Vector3(b.x, b.y + 0.9, b.z);
    this.focus.lerp(want, Math.min(1, dt * 12));
    this.focus.y += (want.y - this.focus.y) * Math.min(1, dt * 4);
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    let dist = this.camDist;
    const solids = this.run.st.list;
    const p = new THREE.Vector3();
    for (let i = 1; i <= 16; i += 1) {
      const d = (i / 16) * this.camDist;
      p.copy(this.focus).addScaledVector(dir, d);
      if (solids.some((s) => p.x > s.x0 - 0.2 && p.x < s.x1 + 0.2 && p.y > s.y0 - 0.2 && p.y < s.y1 + 0.2 && p.z > s.z0 - 0.2 && p.z < s.z1 + 0.2)) {
        dist = Math.max(0.8, ((i - 1) / 16) * this.camDist);
        break;
      }
    }
    this.curDist = this.curDist === undefined ? dist : dist < this.curDist ? dist : this.curDist + (dist - this.curDist) * Math.min(1, dt * 3);
    this.camera.position.copy(this.focus).addScaledVector(dir, this.curDist);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.2, this.focus.z);
  }

  render() {
    this.post.render(this.scene, this.camera, this.time);
  }
}
