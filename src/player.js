// You: a little flame with no face. A body of fire that leans into its run
// and trails its tip behind it, two wisps for hands, two embers for feet.
// It shrinks and reddens as your life runs down.

import * as THREE from "three";

const flameVS = /* glsl */ `
  uniform float uTime; uniform vec2 uBend; uniform float uSeed; uniform float uWobble;
  varying float vH; varying vec3 vN; varying vec3 vV;
  void main() {
    vec3 p = position;
    float h = clamp(p.y, 0.0, 1.0);
    float w = sin(uTime * 9.0 + p.y * 7.0 + uSeed) * 0.05 + sin(uTime * 14.0 - p.y * 12.0 + uSeed * 2.0) * 0.03;
    p.x += (w * uWobble + uBend.x * h) * h;
    p.z += (cos(uTime * 8.0 + p.y * 6.0 + uSeed) * 0.035 * uWobble + uBend.y * h) * h;
    vH = h;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const flameFS = /* glsl */ `
  uniform vec3 uCore; uniform vec3 uEdge; uniform vec3 uTip; uniform float uAlpha;
  varying float vH; varying vec3 vN; varying vec3 vV;
  void main() {
    float f = abs(dot(normalize(vN), normalize(vV)));
    vec3 c = mix(uEdge, uCore, pow(f, 1.6));
    c = mix(c, uTip, smoothstep(0.5, 1.0, vH));
    float a = uAlpha * smoothstep(0.0, 0.45, f) * (1.0 - smoothstep(0.75, 1.0, vH) * 0.7);
    gl_FragColor = vec4(c, a);
  }`;

// A teardrop, 1 tall, round at the bottom, pointed at the top.
export function flameGeometry(radius = 0.38, seg = 28) {
  const pts = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    pts.push(new THREE.Vector2(Math.max(0.0001, radius * Math.sin(Math.PI * Math.pow(t, 0.55))), t));
  }
  return new THREE.LatheGeometry(pts, seg);
}

export function flameMaterial({ core = [2.6, 1.7, 0.6], edge = [1.6, 0.42, 0.06], tip = [1.2, 0.2, 0.03], alpha = 0.9, wobble = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBend: { value: new THREE.Vector2() },
      uSeed: { value: Math.random() * 10 },
      uWobble: { value: wobble },
      uCore: { value: new THREE.Vector3(...core) },
      uEdge: { value: new THREE.Vector3(...edge) },
      uTip: { value: new THREE.Vector3(...tip) },
      uAlpha: { value: alpha },
    },
    vertexShader: flameVS,
    fragmentShader: flameFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,240,210,1)");
  g.addColorStop(0.15, "rgba(255,190,90,0.85)");
  g.addColorStop(0.45, "rgba(255,110,30,0.22)");
  g.addColorStop(1, "rgba(255,80,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(size, color = [2.2, 1.2, 0.5]) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.material.color.setRGB(...color);
  s.scale.setScalar(size);
  return s;
}

const GEO = flameGeometry();

export class Player {
  constructor(scene) {
    this.root = new THREE.Group(); // at your feet, turned to face your way
    scene.add(this.root);
    this.body = new THREE.Group(); // squash and stretch, lean
    this.root.add(this.body);
    this.outer = new THREE.Mesh(GEO, flameMaterial());
    this.outer.scale.set(1, 0.95, 1);
    this.inner = new THREE.Mesh(GEO, flameMaterial({ core: [3.2, 2.6, 1.4], edge: [1.8, 0.8, 0.2], tip: [1.4, 0.5, 0.1], alpha: 0.8, wobble: 0.6 }));
    this.inner.scale.set(0.5, 0.55, 0.5);
    this.inner.position.y = 0.02;
    this.body.add(this.outer, this.inner);
    this.glow = glowSprite(1.6, [0.7, 0.32, 0.1]);
    this.glow.position.y = 0.45;
    this.body.add(this.glow);

    // Hands: two small wisps.
    this.hands = [-1, 1].map((s) => {
      const m = new THREE.Mesh(GEO, flameMaterial({ alpha: 0.9, wobble: 1.4 }));
      m.scale.setScalar(0.24);
      m.userData.side = s;
      this.body.add(m);
      return m;
    });
    // Feet: two embers.
    const footMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 0.12), fog: false });
    this.feet = [-1, 1].map((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), footMat);
      m.scale.set(1, 0.6, 1.4);
      m.userData.side = s;
      this.root.add(m);
      return m;
    });

    this.light = new THREE.PointLight(0xff9a40, 6, 9, 1.6);
    this.light.position.y = 0.6;
    this.light.castShadow = false;
    this.root.add(this.light);

    // Your shadow: a dark spot on whatever is below you, so you can see
    // where you'll land.
    const sc = document.createElement("canvas");
    sc.width = sc.height = 64;
    const sx = sc.getContext("2d");
    const sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, "rgba(0,0,0,0.85)");
    sg.addColorStop(0.6, "rgba(0,0,0,0.45)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    // A ring on it while you're in the air.
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 0.3), transparent: true, depthWrite: false, fog: false }));
    this.ring.rotation.x = -Math.PI / 2;
    scene.add(this.ring);

    // Embers that rise off you.
    this.sparks = new Sparks(scene, 160);

    this.yaw = 0;
    this.phase = 0;
    this.squash = 0; // + stretch, - squash
    this.squashV = 0;
    this.size = 1;
    this.alive = 1; // 0 when out
    this.bend = new THREE.Vector2();
    this.dash = 0;
  }

  // b: the physics body. life01: how much of a full flame you are.
  update(dt, t, b, life01, { dashing = false, ground = null } = {}) {
    const r = this.root;
    // Shadow and landing ring.
    const sh = this.shadow;
    sh.visible = ground !== null && this.alive > 0.1;
    this.ring.visible = sh.visible && !b.grounded;
    if (sh.visible) {
      const h = Math.max(0, b.y - ground);
      sh.position.set(b.x, ground + 0.015, b.z);
      sh.scale.setScalar(0.75 + h * 0.06);
      sh.material.opacity = Math.max(0.25, 0.9 - h * 0.08) * this.alive;
      this.ring.position.set(b.x, ground + 0.02, b.z);
      this.ring.material.opacity = Math.min(0.8, h * 0.5);
    }
    r.position.set(b.x, b.y, b.z);
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.3 || dashing) {
      const want = Math.atan2(b.fx, b.fz);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 14);
    }
    r.rotation.y = this.yaw;

    // Spring for squash and stretch.
    const target = b.grounded ? 0 : Math.max(-0.1, Math.min(0.25, b.vy * 0.03));
    this.squashV += ((target - this.squash) * 220 - this.squashV * 16) * dt;
    this.squash += this.squashV * dt;
    if (b.landed > 3) this.kick(-Math.min(0.35, b.landed * 0.025));

    const want = 0.62 + 0.38 * Math.min(1, life01);
    this.size += (want - this.size) * Math.min(1, dt * 4);
    const s = this.size * this.alive;
    const st = 1 + this.squash;
    this.body.scale.set(s / Math.sqrt(st), s * st, s / Math.sqrt(st));
    this.body.rotation.x = Math.min(0.35, sp * 0.045) * (b.grounded ? 1 : 0.6);

    // The tip trails behind: bend against your velocity, in your own frame.
    const c = Math.cos(-this.yaw);
    const sn = Math.sin(-this.yaw);
    const lx = b.vx * c - b.vz * sn;
    const lz = b.vx * sn + b.vz * c;
    this.bend.x += (-lx * 0.05 - this.bend.x) * Math.min(1, dt * 10);
    this.bend.y += (-lz * 0.06 + (b.vy < 0 ? 0 : 0) - this.bend.y) * Math.min(1, dt * 10);
    const low = Math.max(0, 1 - life01 * 2.2);
    for (const m of [this.outer, this.inner, ...this.hands]) {
      const u = m.material.uniforms;
      u.uTime.value = t;
      u.uBend.value.copy(this.bend);
    }
    // Low on life: deeper red, more frantic.
    const ou = this.outer.material.uniforms;
    ou.uEdge.value.set(1.6 - low * 0.3, 0.42 - low * 0.3, 0.06);
    ou.uCore.value.set(2.6, 1.7 - low * 0.9, 0.6 - low * 0.45);
    ou.uWobble.value = 1 + low * 1.5;

    // Hands swing as you run, fly up when you jump.
    this.phase += dt * (b.grounded ? sp * 2.6 : 3);
    for (const h of this.hands) {
      const side = h.userData.side;
      const swing = b.grounded ? Math.sin(this.phase + (side > 0 ? 0 : Math.PI)) * Math.min(1, sp / 5) : 0;
      const up = b.grounded ? 0 : 0.18;
      h.position.set(side * (0.36 + (b.grounded ? 0 : 0.08)), 0.34 + up + Math.sin(t * 5 + side) * 0.03, swing * 0.18);
      h.rotation.z = -side * (b.grounded ? 0.25 : 0.6);
      h.rotation.x = swing * 0.4;
    }
    // Feet step.
    for (const f of this.feet) {
      const side = f.userData.side;
      const ph = this.phase + (side > 0 ? 0 : Math.PI);
      const moving = b.grounded && sp > 0.5;
      f.position.set(side * 0.12 * this.size, moving ? Math.max(0, Math.cos(ph)) * 0.08 : b.grounded ? 0.02 : 0.1, moving ? Math.sin(ph) * 0.16 : b.grounded ? 0 : -0.05);
      f.scale.setScalar(this.alive);
      f.scale.y *= 0.6;
      f.scale.z *= 1.4;
    }
    this.glow.material.opacity = 0.6 * this.alive;
    this.light.intensity = (2.2 + 2.2 * this.size) * this.alive * (0.9 + Math.random() * 0.15);
    this.light.color.setRGB(1, 0.6 - low * 0.25, 0.25 - low * 0.15);

    // Embers: more when you're running, a trail when dashing.
    if (this.alive > 0.5) {
      const rate = 10 + sp * 3 + (dashing ? 120 : 0);
      if (Math.random() < rate * dt) this.sparks.emit(b.x + (Math.random() - 0.5) * 0.3, b.y + 0.5 + Math.random() * 0.4, b.z + (Math.random() - 0.5) * 0.3, -b.vx * 0.1, 0.8 + Math.random(), -b.vz * 0.1);
    }
    this.sparks.update(dt);
  }

  kick(v) {
    this.squash = v;
    this.squashV = 0;
  }

  // A puff of embers along the ground when you land hard.
  dust(power) {
    const p = this.root.position;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      this.sparks.emit(p.x + Math.cos(a) * 0.2, p.y + 0.05, p.z + Math.sin(a) * 0.2, Math.cos(a) * power, 0.3, Math.sin(a) * power);
    }
  }

  // Sparks that stream from a lamp into you.
  streak(from) {
    const p = this.root.position;
    for (let i = 0; i < 18; i += 1) {
      const k = i / 18;
      this.sparks.emit(from.x + (p.x - from.x) * k, from.y + (p.y + 0.5 - from.y) * k + Math.sin(k * Math.PI) * 0.4, from.z + (p.z - from.z) * k, (Math.random() - 0.5) * 0.6, 0.6 + Math.random(), (Math.random() - 0.5) * 0.6);
    }
  }

  burst(n = 30, power = 3) {
    const p = this.root.position;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * power;
      this.sparks.emit(p.x, p.y + 0.4, p.z, Math.cos(a) * s, Math.random() * power, Math.sin(a) * s);
    }
  }
}

// Little rising embers.
export class Sparks {
  constructor(scene, n, color = [3, 1.3, 0.35]) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo = g;
    const m = new THREE.PointsMaterial({ size: 0.07, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    m.color.setRGB(...color);
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let k = 0; k < n; k += 1) this.pos[k * 3 + 1] = -999;
  }

  emit(x, y, z, vx, vy, vz) {
    const k = this.i;
    this.i = (this.i + 1) % this.n;
    this.pos.set([x, y, z], k * 3);
    this.vel.set([vx, vy, vz], k * 3);
    this.life[k] = 0.6 + Math.random() * 0.6;
  }

  update(dt) {
    for (let k = 0; k < this.n; k += 1) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      const j = k * 3;
      this.vel[j + 1] += dt * 1.2;
      this.vel[j] *= 1 - dt * 2;
      this.vel[j + 2] *= 1 - dt * 2;
      this.pos[j] += this.vel[j] * dt + Math.sin(this.life[k] * 9 + k) * dt * 0.3;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.life[k] <= 0) this.pos[j + 1] = -999;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
