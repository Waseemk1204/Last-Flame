// Things that can burn: each has a model, a wick (where a flame sits), and a
// flame of its own that burns down while lit.

import * as THREE from "three";
import { HOSTS } from "../shared/rules.js";
import { HOSTS_DATA } from "../shared/level.js";
import { canvasTex } from "./world.js";

const S = 1.7; // hosts are a little larger than life, to read at a distance

function m(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0, ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.ei ?? 1 } : {}), transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
}

const MAT = {
  clay: m(0xb5592a, { r: 0.85 }),
  clayDark: m(0x7a3416, { r: 0.9 }),
  wax: m(0xf2ead8, { r: 0.5 }),
  brass: m(0xc8962e, { m: 0.85, r: 0.3 }),
  stick: m(0xd8b880, { r: 0.8 }),
  head: m(0xb02a1a, { r: 0.6 }),
  dark: m(0x2a2420, { r: 0.8 }),
  wire: m(0x8a8a8a, { m: 0.7, r: 0.4 }),
  glass: m(0x6fa07a, { r: 0.1, transparent: true, opacity: 0.55 }),
  paper: m(0xd84315, { r: 0.9, side: THREE.DoubleSide, emissive: 0x000000 }),
  rocketBody: m(0xd8302a, { r: 0.6 }),
  sand: m(0xc9b07a, { r: 1 }),
  wick: m(0xe8e0cc, { r: 1 }),
};

const geo = {
  diya: new THREE.LatheGeometry(
    [
      [0, 0],
      [0.035, 0],
      [0.055, 0.02],
      [0.06, 0.035],
      [0.05, 0.034],
      [0.0, 0.025],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    20,
  ),
};

function mesh(g, mm, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, mm);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// Build a host's model. Returns { group, wick: Object3D }.
function model(type) {
  const g = new THREE.Group();
  const wick = new THREE.Object3D();
  g.add(wick);
  switch (type) {
    case "match": {
      const s = mesh(new THREE.BoxGeometry(0.004, 0.004, 0.05), MAT.stick, 0, 0.003, 0);
      g.add(s);
      g.add(mesh(new THREE.SphereGeometry(0.004, 8, 6), MAT.head, 0, 0.004, -0.026));
      wick.position.set(0, 0.008, -0.028);
      break;
    }
    case "diya": {
      g.add(mesh(geo.diya, MAT.clay));
      // The pinched spout.
      const spout = mesh(new THREE.ConeGeometry(0.014, 0.03, 8), MAT.clay, 0, 0.03, -0.055);
      spout.rotation.x = -Math.PI / 2 + 0.3;
      g.add(spout);
      g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 5), MAT.wick, 0, 0.04, -0.06));
      wick.position.set(0, 0.05, -0.062);
      break;
    }
    case "candle": {
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.015, 16), MAT.brass, 0, 0.008, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.1, 14), MAT.wax, 0, 0.065, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.01, 4), MAT.dark, 0, 0.12, 0));
      wick.position.set(0, 0.125, 0);
      break;
    }
    case "agarbatti": {
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.03, 12), MAT.brass, 0, 0.015, 0));
      const st = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.2, 5), MAT.clayDark, 0, 0.12, 0);
      st.rotation.z = 0.15;
      g.add(st);
      wick.position.set(-0.015, 0.215, 0);
      break;
    }
    case "sparkler": {
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 12), MAT.dark, 0, 0.035, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.005, 12), MAT.sand, 0, 0.07, 0));
      const w = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.24, 4), MAT.wire, 0, 0.18, 0);
      w.rotation.z = 0.12;
      g.add(w);
      g.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6), MAT.dark, -0.012, 0.25, 0));
      wick.position.set(-0.016, 0.3, 0);
      break;
    }
    case "rocket": {
      // A rocket in a glass bottle, the classic way.
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 14), MAT.glass, 0, 0.06, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.04, 14), MAT.glass, 0, 0.14, 0));
      const stick = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.3, 4), MAT.stick, 0, 0.18, 0);
      g.add(stick);
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 10), MAT.rocketBody, 0.014, 0.3, 0));
      g.add(mesh(new THREE.ConeGeometry(0.012, 0.025, 10), MAT.rocketBody, 0.014, 0.35, 0));
      wick.position.set(0.014, 0.26, 0);
      break;
    }
    case "kandeel": {
      // A star kandeel: two stacked pyramids of paper, points all round,
      // a tassel hanging below, lit from inside.
      const star = new THREE.Group();
      star.position.y = 0.2;
      const body = mesh(new THREE.OctahedronGeometry(0.11, 0), MAT.paper);
      body.scale.set(1, 1.15, 1);
      star.add(body);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const point = mesh(new THREE.ConeGeometry(0.035, 0.11, 4), MAT.paper, Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
        point.rotation.z = -Math.PI / 2;
        point.rotation.y = -a;
        star.add(point);
      }
      g.add(star);
      const tassel = mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.14, 6), m(0xfbc02d), 0, 0.02, 0);
      g.add(tassel);
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), MAT.wax, 0, 0.16, 0));
      wick.position.set(0, 0.18, 0);
      g.userData.paper = body;
      g.userData.star = star;
      break;
    }
    case "akhand": {
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 20), MAT.brass, 0, 0.01, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.22, 10), MAT.brass, 0, 0.13, 0));
      const bowl = new THREE.LatheGeometry([[0, 0], [0.09, 0.01], [0.11, 0.04], [0.1, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
      g.add(mesh(bowl, MAT.brass, 0, 0.24, 0));
      // A little ring of petals.
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        g.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), m(i % 2 ? 0xf57c00 : 0xfbc02d), Math.cos(a) * 0.12, 0.012, Math.sin(a) * 0.12));
      }
      wick.position.set(0, 0.3, -0.07);
      break;
    }
    case "great": {
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.06, 28), MAT.brass, 0, 0.03, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.7, 14), MAT.brass, 0, 0.4, 0));
      for (let tier = 0; tier < 3; tier += 1) {
        const r = 0.36 - tier * 0.1;
        g.add(mesh(new THREE.TorusGeometry(r, 0.025, 8, 28), MAT.brass, 0, 0.78 + tier * 0.18, 0)).rotation.x = Math.PI / 2;
      }
      wick.position.set(0, 1.25, 0);
      g.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), MAT.brass, 0, 1.18, 0));
      g.userData.ring = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const w = new THREE.Object3D();
        w.position.set(Math.cos(a) * 0.36, 0.82, Math.sin(a) * 0.36);
        g.add(w);
        g.userData.ring.push(w);
      }
      g.scale.setScalar(1 / S); // already full size
      break;
    }
  }
  return { group: g, wick };
}

// ------------------------------------------------------------------ flame
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,240,210,1)");
    g.addColorStop(0.15, "rgba(255,190,90,0.85)");
    g.addColorStop(0.45, "rgba(255,110,30,0.22)");
    g.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  return glowTex;
}

const flameGeo = new THREE.SphereGeometry(1, 14, 12);
flameGeo.translate(0, 0.9, 0);
flameGeo.scale(1, 2.1, 1);

export class FlameFX {
  constructor(parent, { size = 0.018, glow = 0.16, color = [7, 3.4, 1.2] } = {}) {
    this.size = size;
    this.glowSize = glow;
    this.object = new THREE.Group();
    this.core = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
    this.core.material.color.setRGB(...color);
    this.object.add(this.core);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glow.material.color.setRGB(2.2, 1.2, 0.5);
    this.object.add(this.glow);
    parent.add(this.object);
    this.seed = Math.random() * 10;
    this.lean = new THREE.Vector2();
    this.strength = 1;
  }

  update(t, strength = 1) {
    this.strength = strength;
    const f = 0.85 + Math.sin((t + this.seed) * 23) * 0.06 + Math.sin((t + this.seed) * 37) * 0.05 + (Math.random() - 0.5) * 0.08;
    const s = this.size * (0.35 + 0.65 * strength) * f;
    this.core.scale.set(s * 0.8, s, s * 0.8);
    this.core.rotation.z = this.lean.x;
    this.core.rotation.x = this.lean.y;
    this.glow.scale.setScalar(this.glowSize * (0.4 + 0.6 * strength) * f);
    this.glow.position.y = s * 0.9;
    this.flicker = f;
  }

  set visible(v) {
    this.object.visible = v;
  }
}

// ------------------------------------------------------------------- host
export class Host {
  constructor(data, scene) {
    this.data = data;
    this.id = data.id;
    this.type = data.type;
    this.spec = HOSTS[data.type];
    this.section = data.section;
    const { group, wick } = model(data.type);
    this.group = group;
    this.wick = wick;
    if (data.type !== "great") group.scale.multiplyScalar(S);
    group.position.set(data.x, data.y, data.z);
    group.rotation.y = (Math.random() - 0.5) * 0.8;
    scene.add(group);
    this.start = new THREE.Vector3(data.x, data.y, data.z);
    this.flame = new FlameFX(wick, data.type === "great" ? { size: 0.09, glow: 1.2 } : data.type === "akhand" ? { size: 0.028, glow: 0.35 } : {});
    if (data.type === "great") {
      this.ringFlames = group.userData.ring.map((w) => new FlameFX(w, { size: 0.05, glow: 0.5 }));
    }
    // A soft marker so you can find it in the dark when it's in reach.
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    this.marker.material.color.setRGB(0.9, 0.75, 0.5);
    this.marker.scale.setScalar(0.35);
    scene.add(this.marker);
    this.worldWick = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.fuel = this.spec.burn;
    this.lit = false;
    this.counted = false; // a lamp lit and left burning
    this.kept = false; // left lit: stays lit for the night
    this.out = false;
    this.group.position.copy(this.start);
    this.flame.visible = false;
    if (this.ringFlames) for (const f of this.ringFlames) f.visible = false;
    if (this.group.userData.paper) this.group.userData.paper.material.emissive.setHex(0x000000);
  }

  get usable() {
    return !this.out;
  }

  get fraction() {
    return this.spec.burn === Infinity ? 1 : Math.max(0, this.fuel / this.spec.burn);
  }

  ignite() {
    this.lit = true;
    this.out = false;
    this.flame.visible = true;
    if (this.group.userData.paper) this.group.userData.paper.material.emissive.setHex(0xff5a10);
  }

  extinguish() {
    this.lit = false;
    this.out = this.spec.burn !== Infinity;
    this.fuel = 0;
    this.flame.visible = false;
    if (this.group.userData.paper) this.group.userData.paper.material.emissive.setHex(0x000000);
  }

  // Where a flame on this host sits, in the world.
  wickPos() {
    this.wick.getWorldPosition(this.worldWick);
    return this.worldWick;
  }

  update(dt, t, { burning = false, rate = 1 } = {}) {
    if (this.lit && !this.kept && this.spec.burn !== Infinity && (burning || !this.kept)) {
      this.fuel -= dt * rate;
      if (this.fuel <= 0) this.extinguish();
    }
    // A kandeel rises as it burns.
    if (this.data.rise && this.lit) {
      const k = 1 - this.fraction;
      const r = this.data.rise;
      this.group.position.set(this.start.x + (r[0] - this.start.x) * k, this.start.y + (r[1] - this.start.y) * k + Math.sin(t * 1.3) * 0.03, this.start.z + (r[2] - this.start.z) * k);
    }
    if (this.group.userData.star) this.group.userData.star.rotation.y = t * 0.5;
    if (this.lit) this.flame.update(t, this.kept ? 0.85 : 0.35 + 0.65 * Math.min(1, this.fraction * 2.5));
    if (this.ringFlames && this.lit) for (const f of this.ringFlames) f.update(t, 1);
  }
}

export function buildHosts(scene) {
  return HOSTS_DATA.map((d) => new Host(d, scene));
}
