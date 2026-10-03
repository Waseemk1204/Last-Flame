// Last Flame: the game loop.
//
// You are a flame on a host. Your host burns down. Look at another host in
// reach and leap to it before you go out. Lamps you light stay lit. Light the
// akhand deeps to save your place. Light the temple lamp to finish.

import * as THREE from "three";
import { HOSTS, LEAP, EMBER, HAZARD } from "../shared/rules.js";
import { BUILDINGS, ZONES, KIDS, SECTIONS, START, LAMP_COUNT, canLeap } from "../shared/level.js";
import { World, rand } from "./world.js";
import { buildHosts, FlameFX, glowTexture } from "./hosts.js";
import { Post } from "./post.js";

const SAVE_KEY = "lastflame.save";
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

// Ray against a building block: does the segment a→b pass through it?
function segmentHitsBox(a, b, box) {
  let t0 = 0;
  let t1 = 1;
  const lo = [box.x1, 0, box.z1];
  const hi = [box.x2, box.h, box.z2];
  const A = [a.x, a.y, a.z];
  const D = [b.x - a.x, b.y - a.y, b.z - a.z];
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(D[i]) < 1e-9) {
      if (A[i] < lo[i] || A[i] > hi[i]) return false;
    } else {
      let ta = (lo[i] - A[i]) / D[i];
      let tb = (hi[i] - A[i]) / D[i];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return t1 > 0.02 && t0 < 0.98;
}

const SOLID = BUILDINGS.filter((b) => !b.wall);

export class Game {
  constructor({ renderer, sound, ui, input }) {
    this.renderer = renderer;
    this.sound = sound;
    this.ui = ui;
    this.input = input;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.02, 900);
    this.camera.rotation.order = "YXZ";
    this.post = new Post(renderer);
    this.post.fx.vignette = 0.4;
    this.post.fx.grain = 0.035;
    this.post.fx.desat = 0;
    this.post.fx.bloom = 0.85;
    this.post.fx.aberration = 0.0008;
    this.world = new World(this.scene);
    this.world.fireworks.onBurst = (x, y, z) => this.sound.firework(Math.hypot(x - this.pos.x, y - this.pos.y, z - this.pos.z));
    this.hosts = buildHosts(this.scene);
    this.byId = new Map(this.hosts.map((h) => [h.id, h]));
    this.lampTotal = LAMP_COUNT;

    // You: the living flame (drawn over whatever host you're on, a little brighter).
    this.you = new THREE.Group();
    this.scene.add(this.you);
    this.youFlame = new FlameFX(this.you, { size: 0.034, glow: 0.45, color: [9, 5, 2] });
    this.youLight = new THREE.PointLight(0xffa24c, 1, 0, 2);
    this.you.add(this.youLight);
    this.youLight.position.y = 0.32; // off the surface, so it doesn't burn white
    this.sparks = this.makeSparks();
    // Lights for the nearest lamps (a fixed pool, so shaders never recompile).
    this.pool = Array.from({ length: 6 }, () => {
      const l = new THREE.PointLight(0xffa04a, 0, 0, 2);
      this.scene.add(l);
      return l;
    });
    // The leap arc, dotted.
    this.arcDots = Array.from({ length: 16 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.scale.setScalar(0.06);
      s.visible = false;
      this.scene.add(s);
      return s;
    });
    this.targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.9, fog: false, depthTest: false }));
    this.targetRing.visible = false;
    this.targetRing.renderOrder = 10;
    this.scene.add(this.targetRing);
    this.rain = this.makeRain();
    this.windStreaks = this.makeWind();
    this.kids = KIDS.map((k) => this.makeKid(k));

    this.yaw = Math.PI;
    this.pitch = -0.32;
    this.dist = 2.3;
    this.pos = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.time = 0;
    this.state = "idle"; // idle | play | flight | ember | dead | ending | done
    this.stats = { deaths: 0, time: 0 };
    this.hinted = new Set();
    this.section = -1;
    this.onResize();
    window.addEventListener("resize", () => this.onResize());
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = this.quality === "low" ? 1 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, ratio);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.quality = q;
    this.post.fx.bloom = q === "low" ? 0 : 0.85;
    this.world.moon.castShadow = q !== "low";
    this.onResize();
  }

  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.25, Math.min(0.9, this.pitch - dy));
  }

  // --------------------------------------------------------------- flow
  start({ fromSave = false } = {}) {
    for (const h of this.hosts) h.reset();
    this.stats = { deaths: 0, time: 0 };
    let cp = null;
    if (fromSave) {
      const s = Game.saved();
      if (s) {
        cp = s.cp;
        for (const id of s.kept) {
          const h = this.byId.get(id);
          if (h) {
            h.ignite();
            h.kept = true;
            h.counted = h.type === "diya";
          }
        }
        this.stats = s.stats ?? this.stats;
      }
    }
    this.checkpoint = cp;
    if (cp) {
      const h = this.byId.get(cp);
      h.ignite();
      h.kept = true;
      this.land(h, { quiet: true });
    } else {
      const h = this.byId.get(START);
      h.ignite();
      h.fuel = 10; // the very first match gives you time to look around
      this.land(h, { quiet: true });
      this.yaw = Math.PI * 0.8;
    }
    this.state = "play";
    this.section = -1;
    this.updateLamps();
  }

  static saved() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    } catch {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cp: this.checkpoint, kept: this.hosts.filter((h) => h.kept).map((h) => h.id), stats: this.stats }));
    } catch {}
  }

  static forget() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  }

  get lampsLit() {
    return this.hosts.filter((h) => h.type === "diya" && h.counted && h.lit).length;
  }

  updateLamps() {
    this.ui.lamps(this.lampsLit, this.lampTotal);
  }

  hint(key, text, seconds = 4) {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    this.ui.hint(text, seconds);
  }

  // Arrive on a host.
  land(h, { quiet = false } = {}) {
    const prev = this.host;
    this.host = h;
    if (!h.lit) {
      h.ignite();
      h.fuel = h.spec.burn;
    }
    if (h.id === START && !this.checkpoint) h.fuel = Math.max(h.fuel, 10);
    this.state = "play";
    if (!quiet) this.sound.catch(h.type);
    // Sections and their titles.
    if (h.section > this.section) {
      this.section = h.section;
      const s = SECTIONS[h.section];
      this.ui.section(s.name, s.sub);
    }
    if (h.spec.checkpoint && this.checkpoint !== h.id) {
      this.checkpoint = h.id;
      h.kept = true;
      if (!quiet) {
        this.sound.bell();
        this.ui.toast("Checkpoint");
      }
      this.save();
    }
    if (h.type === "rocket") {
      this.fuse = 0.7;
      this.hint("rocket", "Rockets launch you. Hold on.", 3);
    }
    if (h.type === "sparkler") this.hint("sparkler", "Sparklers burn fast, but fling you far.", 3.5);
    if (h.type === "kandeel") this.hint("kandeel", "The kandeel rises as it burns. Ride it up.", 4);
    if (h.type === "agarbatti") this.hint("agarbatti", "Incense smoulders a long time, but you can't leap far from it.", 4);
    if (h.type === "great") this.finish();
    void prev;
  }

  // Leave a host for another.
  leave(h) {
    if (h.type === "diya" && h.lit) {
      // A lamp you light and leave stays lit.
      h.kept = true;
      if (!h.counted) {
        h.counted = true;
        this.hint("lamps", "Lamps you light stay lit. Light as many as you can.", 4);
      }
      this.updateLamps();
    }
  }

  // ------------------------------------------------------------ targets
  rangeNow() {
    if (this.state === "ember") return EMBER.range;
    return this.host ? this.host.spec.range : 0;
  }

  findTarget() {
    if (this.state !== "play" && this.state !== "ember") return null;
    if (this.host?.type === "rocket" || this.host?.type === "great") return null;
    const range = this.rangeNow();
    const from = this.pos;
    const fwd = tmp.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best = null;
    let bestScore = -Infinity;
    for (const h of this.hosts) {
      h.inReach = false;
      if (h === this.host || !h.usable) continue;
      const p = h.wickPos();
      if (!canLeap(from, p, range)) continue;
      if (this.arcBlocked(from, p)) continue;
      h.inReach = true;
      const to = tmp2.copy(p).sub(this.camera.position);
      const dist = to.length();
      to.normalize();
      const dot = to.dot(fwd);
      // Generous for small, far things: about 9°, or 0.4 m around the target.
      const need = Math.cos(Math.max(0.16, Math.atan(0.4 / dist)));
      if (dot < need) continue;
      const score = dot * 3 - from.distanceTo(p) * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best;
  }

  // Does the leap's arc (not a straight line) pass through a building?
  arcBlocked(a, b) {
    const A = this._arcA || (this._arcA = new THREE.Vector3());
    const B = this._arcB || (this._arcB = new THREE.Vector3());
    A.copy(a);
    for (let i = 1; i <= 6; i += 1) {
      this.arcPoint(a, b, i / 6, B);
      for (const box of SOLID) if (segmentHitsBox(A, B, box)) return true;
      A.copy(B);
    }
    return false;
  }

  // A parabola from a to b, lifted by the distance.
  arcPoint(a, b, t, out) {
    const lift = 0.15 + a.distanceTo(b) * LEAP.arcHeight;
    out.lerpVectors(a, b, t);
    out.y += 4 * lift * t * (1 - t);
    return out;
  }

  leapTo(h) {
    const from = this.pos.clone();
    const to = h.wickPos().clone();
    const d = from.distanceTo(to);
    if (this.host) this.leave(this.host);
    this.flight = { from, to, t: 0, dur: LEAP.minTime + d * LEAP.perMetre, target: h };
    this.state = "flight";
    this.host = null;
    this.sound.leap(d);
    this.burstSparks(from, 18);
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.state === "play" || this.state === "flight" || this.state === "ember") this.stats.time += dt;

    // Hazards: the gust cycle and the kids.
    const gustPhase = t % HAZARD.gustEvery;
    this.gust = gustPhase < HAZARD.gustFor;
    const zones = ZONES.filter((z) => this.pos.x > z.x1 && this.pos.x < z.x2 && this.pos.z > z.z1 && this.pos.z < z.z2 && this.pos.y > z.y1 && this.pos.y < z.y2);
    const inWind = zones.some((z) => z.type === "wind") && this.gust;
    const inRain = zones.some((z) => z.type === "rain");
    if (zones.some((z) => z.type === "wind")) this.hint("wind", "Wind! A gust makes an exposed flame burn three times as fast.", 4);
    if (inRain) this.hint("rain", "Rain. Everything out in the open burns down faster.", 4);
    const sheltered = this.host?.data.sheltered;

    // Your body burns.
    if (this.state === "play" && this.host) {
      const h = this.host;
      let rate = 1;
      if (!sheltered && inWind) rate *= HAZARD.windBurn;
      if (!sheltered && inRain) rate *= HAZARD.rainBurn;
      h.kept = false; // while you're on it, it's burning you
      if (h.spec.burn !== Infinity) {
        h.fuel -= dt * rate;
        if (h.fuel <= 0) {
          h.extinguish();
          this.toEmber();
        }
      }
      if (h === this.host) this.pos.copy(h.wickPos());
      if (h.type === "rocket" && this.state === "play") {
        this.fuse -= dt;
        if (this.fuse <= 0) {
          const target = this.byId.get(h.data.to);
          h.extinguish();
          this.flight = { from: this.pos.clone(), to: target.wickPos().clone(), t: 0, dur: 1.3, target, rocket: true };
          this.state = "flight";
          this.host = null;
          this.sound.rocket();
        }
      }
      if (this.state === "play" && h.fraction < 0.3 && h.spec.burn !== Infinity) this.hint("low", "Your body is burning out. Leap!", 2.5);
    }

    // Flight.
    if (this.state === "flight") {
      const f = this.flight;
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      if (f.rocket) {
        // Straight up past the roofline, then arc over onto the target.
        const top = tmp.set(f.from.x, f.to.y + 2.2, f.from.z);
        if (k < 0.5) {
          const u = k / 0.5;
          this.pos.lerpVectors(f.from, top, 1 - (1 - u) * (1 - u));
        } else this.arcPoint(top, f.to, (k - 0.5) / 0.5, this.pos);
        if (Math.random() < 0.8) this.burstSparks(this.pos, 3);
      } else this.arcPoint(f.from, f.to, k, this.pos);
      if (k >= 1) {
        const tgt = f.target;
        if (!tgt.usable) this.toEmber();
        else this.land(tgt);
      }
    }

    // Ember: falling, about to go out.
    if (this.state === "ember") {
      this.emberT -= dt;
      this.pos.y = Math.max(this.emberFloor, this.pos.y - EMBER.fall * dt);
      if (this.emberT <= 0) this.die();
    }

    // Kids with water pistols.
    for (const kid of this.kids) this.updateKid(kid, dt);

    // Aim and leap.
    const target = this.findTarget();
    this.showArc(target);
    if (target && this.input.leap) this.leapTo(target);

    // Hosts burn; lamps you've left glow.
    for (const h of this.hosts) {
      if (h === this.host) {
        h.update(0, t, {});
        continue;
      }
      if (h.lit && !h.kept && h.spec.burn !== Infinity) {
        h.fuel -= dt;
        if (h.fuel <= 0) h.extinguish();
      }
      h.update(0, t, {});
      h.marker.material.opacity += ((h.inReach && h !== target ? 0.55 : 0) - h.marker.material.opacity) * Math.min(1, dt * 8);
      if (h.marker.material.opacity > 0.01) h.marker.position.copy(h.wickPos());
    }

    // You.
    this.you.position.copy(this.pos);
    const strength = this.state === "ember" ? 0.35 * Math.max(0.2, this.emberT / EMBER.time) : this.host ? Math.min(1, 0.45 + this.host.fraction) : 1;
    this.youFlame.update(t, strength);
    this.youFlame.lean.set(inWind ? 0.6 * Math.sin(t * 9) + 0.5 : Math.sin(t * 3) * 0.06, 0);
    this.youLight.intensity = (this.state === "dead" || this.state === "idle" ? 0 : 0.5 + strength * 0.9) * (this.youFlame.flicker ?? 1);
    this.you.visible = this.state !== "dead" && this.state !== "idle";
    this.updateSparks(dt);
    this.assignLights();

    // The camera orbits you, pulled in if a wall is in the way.
    this.updateCamera(dt);
    this.world.follow(this.pos);
    this.world.update(dt, t);
    this.updateRain(dt, inRain);
    this.updateWind(dt, inWind);

    // HUD.
    const fuel = this.state === "ember" ? Math.max(0, this.emberT / EMBER.time) : this.host?.fraction ?? 1;
    this.ui.fuel(fuel, this.state === "ember", this.host && this.host.spec.burn === Infinity);
    this.ui.target(target ? `${target.spec.label}${target.spec.burn !== Infinity ? ` · ${Math.round(target.spec.burn)}s` : ""}` : this.host?.type === "rocket" ? "Hold on…" : "");
    this.sound.update(dt, { fuel, onHost: !!this.host, sparkler: this.host?.type === "sparkler", wind: inWind ? 1 : zones.some((z) => z.type === "wind") ? 0.3 : 0, rain: inRain ? 1 : 0, playing: this.state !== "idle" });

    if (this.state === "ending") this.updateEnding(dt);
  }

  toEmber() {
    if (this.state === "ember" || this.state === "dead") return;
    this.state = "ember";
    this.host = null;
    this.emberT = EMBER.time;
    this.emberFloor = this.pos.y - 0.6;
    this.sound.ember();
    this.hint("ember", "You're an ember! Leap to anything close, now!", 2.5);
  }

  die() {
    this.state = "dead";
    this.stats.deaths += 1;
    this.sound.die();
    this.burstSparks(this.pos, 30);
    this.ui.fade(true);
    setTimeout(() => this.respawn(), 1100);
  }

  // Back to the last checkpoint. Everything after it is as it was.
  respawn() {
    const order = this.hosts.map((h) => h.id);
    const cpIndex = this.checkpoint ? order.indexOf(this.checkpoint) : 0;
    for (let i = cpIndex + 1; i < this.hosts.length; i += 1) this.hosts[i].reset();
    const h = this.byId.get(this.checkpoint ?? START);
    if (!this.checkpoint) h.reset();
    h.ignite();
    this.land(h, { quiet: true });
    this.state = "play";
    this.updateLamps();
    this.ui.fade(false);
  }

  // ------------------------------------------------------------ the kids
  makeKid(k) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x9a6a4a, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: [0xe53935, 0x1e88e5, 0xfdd835][Math.floor(rand() * 3)], roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 4, 10), shirt);
    body.position.y = 0.55;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), skin);
    head.position.y = 1.0;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x15100c }));
    hair.position.y = 1.02;
    g.add(hair);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 8), new THREE.MeshStandardMaterial({ color: 0x2a3550 }));
      leg.position.set(s * 0.08, 0.2, 0);
      g.add(leg);
    }
    const arm = new THREE.Group();
    arm.position.set(0.17, 0.72, 0);
    g.add(arm);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8), skin);
    a.position.y = -0.18;
    arm.add(a);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0x00c853, roughness: 0.4 }));
    gun.position.set(0, -0.38, -0.06);
    arm.add(gun);
    g.position.set(k.x, k.y, k.z);
    g.lookAt(k.to[0], k.y, k.to[2]);
    g.traverse((m) => m.isMesh && (m.castShadow = true));
    this.scene.add(g);
    // The water stream.
    const n = 40;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const water = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false }));
    water.frustumCulled = false;
    water.visible = false;
    this.scene.add(water);
    return { ...k, g, arm, water, phaseT: k.phase, from: new THREE.Vector3(k.x, k.y + 0.8, k.z), to: new THREE.Vector3(...k.to) };
  }

  updateKid(kid, dt) {
    kid.phaseT += dt;
    const cyc = kid.phaseT % HAZARD.sprayEvery;
    const warn = HAZARD.sprayEvery - HAZARD.sprayWarn - HAZARD.sprayFor;
    const spraying = cyc > warn + HAZARD.sprayWarn;
    const raising = cyc > warn;
    kid.arm.rotation.x = raising ? -1.4 : -0.2;
    if (raising && !kid.warned) {
      kid.warned = true;
      if (this.pos.distanceTo(kid.from) < 12) this.sound.giggle();
    }
    if (!raising) kid.warned = false;
    kid.water.visible = spraying;
    if (spraying) {
      if (!kid.sprayed) {
        kid.sprayed = true;
        if (this.pos.distanceTo(kid.from) < 14) this.sound.spray();
        this.hint("kids", "Kids with water pistols! Don't be in the stream.", 3);
      }
      const p = kid.water.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const s = (i / p.count + this.time * 2) % 1;
        tmp.lerpVectors(kid.from, kid.to, s);
        tmp.y -= s * s * 0.4;
        p.setXYZ(i, tmp.x + (Math.random() - 0.5) * 0.05, tmp.y + (Math.random() - 0.5) * 0.05, tmp.z + (Math.random() - 0.5) * 0.05);
      }
      p.needsUpdate = true;
      // Are you in the stream?
      const line = new THREE.Line3(kid.from, kid.to);
      line.closestPointToPoint(this.pos, true, tmp);
      if (tmp.distanceTo(this.pos) < HAZARD.sprayRadius && (this.state === "play" || this.state === "flight")) {
        if (this.host) this.host.extinguish();
        this.sound.ember();
        this.toEmber();
      }
    } else kid.sprayed = false;
  }

  // -------------------------------------------------------------- lights
  assignLights() {
    const lit = this.hosts.filter((h) => h.lit && h !== this.host);
    lit.sort((a, b) => a.wickPos().distanceToSquared(this.pos) - b.wickPos().distanceToSquared(this.pos));
    this.pool.forEach((l, i) => {
      const h = lit[i];
      if (!h) {
        l.intensity = 0;
        return;
      }
      l.position.copy(h.wickPos());
      l.position.y += 0.25;
      const big = h.type === "great" ? 14 : h.type === "akhand" ? 1.4 : 0.7;
      l.intensity = big * (h.flame.flicker ?? 1) * Math.max(0.3, h.flame.strength ?? 1);
    });
  }

  // -------------------------------------------------------------- camera
  updateCamera(dt) {
    if (this.state === "ending") return;
    const target = tmp2.copy(this.pos);
    target.y += 0.35;
    const dir = tmp.set(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    let d = this.dist;
    const want = target.clone().addScaledVector(dir, d);
    for (const b of SOLID) {
      if (segmentHitsBox(target, want, b)) {
        // Pull in until clear.
        for (let k = 0.9; k > 0.15; k -= 0.1) {
          if (!segmentHitsBox(target, target.clone().addScaledVector(dir, d * k), b)) {
            d *= k * 0.9;
            break;
          }
        }
      }
    }
    want.copy(target).addScaledVector(dir, d);
    if (want.y < 0.1) want.y = 0.1;
    this.camPos.lerp(want, 1 - Math.exp(-dt * 12));
    if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    this.camera.position.copy(this.camPos);
    // Over the shoulder: look past the flame, along where you're aiming, so
    // the crosshair points into the world rather than at yourself.
    const look = target.clone().addScaledVector(dir, -3);
    this.camera.lookAt(look);
  }

  showArc(target) {
    for (const s of this.arcDots) s.visible = false;
    this.targetRing.visible = false;
    if (!target) return;
    const to = target.wickPos();
    for (let i = 0; i < this.arcDots.length; i += 1) {
      const s = this.arcDots[i];
      this.arcPoint(this.pos, to, (i + 1) / (this.arcDots.length + 1), s.position);
      s.visible = true;
      s.material.opacity = 0.35 + 0.5 * Math.sin(this.time * 6 - i * 0.6) ** 2;
    }
    this.targetRing.position.copy(to);
    this.targetRing.position.y += 0.03;
    this.targetRing.lookAt(this.camera.position);
    this.targetRing.scale.setScalar(1 + Math.sin(this.time * 5) * 0.12);
    this.targetRing.visible = true;
  }

  // -------------------------------------------------------------- sparks
  makeSparks() {
    const n = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3).fill(-999);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb060, size: 0.025, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.material.color.setRGB(3, 1.6, 0.6);
    pts.frustumCulled = false;
    this.scene.add(pts);
    return { pts, pos, vel: new Float32Array(n * 3), life: new Float32Array(n), cursor: 0, n };
  }

  burstSparks(at, count) {
    const s = this.sparks;
    for (let i = 0; i < count; i += 1) {
      const k = s.cursor;
      s.cursor = (s.cursor + 1) % s.n;
      s.pos.set([at.x, at.y, at.z], k * 3);
      s.vel.set([(Math.random() - 0.5) * 1.6, Math.random() * 1.6, (Math.random() - 0.5) * 1.6], k * 3);
      s.life[k] = 0.4 + Math.random() * 0.5;
    }
  }

  updateSparks(dt) {
    const s = this.sparks;
    // The sparkler throws sparks all the time.
    if (this.host?.type === "sparkler" && this.state === "play") this.burstSparks(this.pos, 3);
    for (let i = 0; i < s.n; i += 1) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= dt;
      const k = i * 3;
      s.vel[k + 1] -= 3 * dt;
      s.pos[k] += s.vel[k] * dt;
      s.pos[k + 1] += s.vel[k + 1] * dt;
      s.pos[k + 2] += s.vel[k + 2] * dt;
      if (s.life[i] <= 0) s.pos[k + 1] = -999;
    }
    s.pts.geometry.attributes.position.needsUpdate = true;
  }

  // -------------------------------------------------------- rain & wind
  makeRain() {
    const n = 1400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8fa4c8, transparent: true, opacity: 0.35 }));
    lines.frustumCulled = false;
    lines.visible = false;
    this.scene.add(lines);
    const drops = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 16, y: Math.random() * 12, z: (Math.random() - 0.5) * 16 }));
    return { lines, pos, drops };
  }

  updateRain(dt, on) {
    const r = this.rain;
    r.lines.visible = on;
    if (!on) return;
    for (let i = 0; i < r.drops.length; i += 1) {
      const d = r.drops[i];
      d.y -= 14 * dt;
      if (d.y < -4) {
        d.y = 8 + Math.random() * 4;
        d.x = (Math.random() - 0.5) * 16;
        d.z = (Math.random() - 0.5) * 16;
      }
      const x = this.pos.x + d.x;
      const y = this.pos.y + d.y;
      const z = this.pos.z + d.z;
      r.pos.set([x, y, z, x + 0.03, y - 0.35, z], i * 6);
    }
    r.lines.geometry.attributes.position.needsUpdate = true;
  }

  makeWind() {
    const n = 140;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8d0e0, transparent: true, opacity: 0.25 }));
    lines.frustumCulled = false;
    lines.visible = false;
    this.scene.add(lines);
    return { lines, items: Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 12, y: Math.random() * 3 - 0.5, z: (Math.random() - 0.5) * 12 })) };
  }

  updateWind(dt, on) {
    const w = this.windStreaks;
    w.lines.visible = on;
    if (!on) return;
    const zone = ZONES.find((z) => z.type === "wind" && this.pos.x > z.x1 && this.pos.x < z.x2 && this.pos.z > z.z1 && this.pos.z < z.z2);
    const dir = zone ? zone.dir : [1, 0, 0];
    const p = w.lines.geometry.attributes.position;
    w.items.forEach((it, i) => {
      it.x += dir[0] * 9 * dt;
      it.z += dir[2] * 9 * dt;
      if (Math.abs(it.x) > 6 || Math.abs(it.z) > 6) {
        it.x = -dir[0] * 6 + (Math.random() - 0.5) * 4 * (1 - Math.abs(dir[0]));
        it.z = (Math.random() - 0.5) * 12;
        if (dir[0] === 0) it.x = (Math.random() - 0.5) * 12;
      }
      const x = this.pos.x + it.x;
      const y = this.pos.y + it.y;
      const z = this.pos.z + it.z;
      p.setXYZ(i * 2, x, y, z);
      p.setXYZ(i * 2 + 1, x - dir[0] * 0.5, y, z - dir[2] * 0.5);
    });
    p.needsUpdate = true;
  }

  // -------------------------------------------------------------- ending
  finish() {
    this.state = "ending";
    this.endT = 0;
    this.sound.triumph();
    const great = this.byId.get("great");
    great.ignite();
    for (const f of great.ringFlames) f.visible = true;
    this.save();
    Game.forget();
    this.world.fireworks.rate = 6;
    // A flight back down the route, over every lamp you lit.
    const cps = ["great", "cp4", "cp3", "cp2", "cp1"].map((id) => this.byId.get(id).wickPos().clone());
    const pts = cps.map((p, i) => new THREE.Vector3(p.x + 4 + i, p.y + 5 + i * 0.6, p.z - 3));
    this.flyover = new THREE.CatmullRomCurve3([this.camera.position.clone(), ...pts]);
    this.lookCurve = new THREE.CatmullRomCurve3([great.wickPos().clone(), ...cps]);
    this.ui.hideHud();
  }

  updateEnding(dt) {
    this.endT += dt;
    const k = Math.min(1, this.endT / 14);
    const e = k * k * (3 - 2 * k);
    this.camera.position.copy(this.flyover.getPoint(e));
    this.camera.lookAt(this.lookCurve.getPoint(Math.min(1, e * 1.05)));
    if (Math.random() < dt * 2) {
      const a = Math.random() * Math.PI * 2;
      this.world.fireworks.launch(10 + Math.cos(a) * 30, 60 + Math.sin(a) * 20, { near: true });
    }
    if (this.endT > 15 && this.state === "ending") {
      this.state = "done";
      this.onEnd?.({ lamps: this.lampsLit, total: this.lampTotal, deaths: this.stats.deaths, time: this.stats.time });
    }
  }

  render() {
    this.post.render(this.scene, this.camera, this.time);
  }
}
