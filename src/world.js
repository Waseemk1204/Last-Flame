// The neighbourhood on Diwali night, after the storm: pastel houses with dark
// windows, parapets and water tanks on the roofs, saris on the clotheslines,
// dead strings of fairy lights, Munni's rangoli, the hill and the temple, a
// deep blue sky, and the rest of the city celebrating far away.

import * as THREE from "three";
import { BUILDINGS, HILL } from "../shared/level.js";

let seed = 2026;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;

// A wall: plaster in a colour, stains, and a grid of shuttered windows.
function wallTexture(color, floors, bays) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i += 1) {
      ctx.fillStyle = rand() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    // Monsoon streaks from the top.
    for (let i = 0; i < 14; i += 1) {
      const x = rand() * w;
      const g = ctx.createLinearGradient(0, 0, 0, h * (0.3 + rand() * 0.5));
      g.addColorStop(0, "rgba(40,40,30,0.25)");
      g.addColorStop(1, "rgba(40,40,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 3 + rand() * 6, h);
    }
    const fh = h / floors;
    const bw = w / bays;
    for (let f = 0; f < floors; f += 1) {
      for (let b = 0; b < bays; b += 1) {
        const x = b * bw + bw * 0.25;
        const y = f * fh + fh * 0.22;
        const ww = bw * 0.5;
        const wh = fh * 0.52;
        ctx.fillStyle = "#1a1d26";
        ctx.fillRect(x, y, ww, wh);
        // Shutters, sometimes open.
        ctx.fillStyle = ["#2f5d62", "#7a3b2e", "#3a4f7a", "#5e6b3a"][(f + b) % 4];
        if (rand() < 0.6) {
          ctx.fillRect(x - ww * 0.32, y, ww * 0.3, wh);
          ctx.fillRect(x + ww * 1.02, y, ww * 0.3, wh);
        } else ctx.fillRect(x, y, ww, wh);
        // Grille.
        ctx.strokeStyle = "rgba(20,20,20,0.6)";
        for (let k = 1; k < 4; k += 1) {
          ctx.beginPath();
          ctx.moveTo(x + (k * ww) / 4, y);
          ctx.lineTo(x + (k * ww) / 4, y + wh);
          ctx.stroke();
        }
        // A sunshade over it.
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x - 6, y - 6, ww + 12, 5);
      }
    }
  });
}

function rangoliTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const c = w / 2;
    const cols = ["#e8452c", "#f2b628", "#2aa0a8", "#e85c9a", "#ffffff", "#7b3fb8"];
    for (let ring = 6; ring >= 1; ring -= 1) {
      const r = ring * 38;
      const petals = 8 + ring * 2;
      ctx.fillStyle = cols[ring % cols.length];
      for (let p = 0; p < petals; p += 1) {
        const a = (p / petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(c + Math.cos(a) * r * 0.8, c + Math.sin(a) * r * 0.8, r * 0.28, r * 0.12, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c, c, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Dots round the edge.
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * 240, c + Math.sin(a) * 240, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.9, metalness: o.m ?? 0, ...(o.map ? { map: o.map } : {}), ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.ei ?? 1 } : {}), side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
}

function box(parent, m, x, y, z, w, h, d, { shadow = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sky(scene);
    this.ground();
    for (const b of BUILDINGS) this.building(b);
    this.courtyard();
    this.hill();
    this.wires();
    this.city();
    this.fireworks = new Fireworks(scene);
    this.lights(scene);
  }

  // ---------------------------------------------------------------- sky
  sky(scene) {
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = clamp(vP.y, -0.2, 1.0);
          vec3 top = vec3(0.012, 0.02, 0.06);
          vec3 mid = vec3(0.05, 0.06, 0.16);
          vec3 low = vec3(0.16, 0.09, 0.12); // the city's glow on the clouds
          vec3 c = mix(low, mid, smoothstep(-0.05, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.8, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(geo, m));
    // Stars.
    const n = 900;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const a = rand() * Math.PI * 2;
      const e = 0.15 + rand() * 1.3;
      p.set([Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xa8b4d8, size: 1.1, sizeAttenuation: false, fog: false })));
    // The moon, behind thin cloud.
    const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xf2ead2, fog: false }));
    moon.position.set(-120, 150, 260);
    moon.lookAt(0, 0, 0);
    moon.material.color.multiplyScalar(1.6);
    scene.add(moon);
    // Clouds: soft dark sprites.
    const cloudTex = canvasTex(256, 128, (ctx, w, h) => {
      for (let i = 0; i < 30; i += 1) {
        const x = w * (0.15 + rand() * 0.7);
        const y = h * (0.35 + rand() * 0.35);
        const r = 20 + rand() * 40;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(40,40,60,0.55)");
        gr.addColorStop(1, "rgba(40,40,60,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);
      }
    });
    this.clouds = [];
    for (let i = 0; i < 16; i += 1) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
      const a = rand() * Math.PI * 2;
      s.position.set(Math.cos(a) * 220, 70 + rand() * 60, Math.sin(a) * 220);
      s.scale.set(180, 70, 1);
      scene.add(s);
      this.clouds.push({ s, a, speed: 0.004 + rand() * 0.004 });
    }
  }

  ground() {
    const lane = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#3a3632";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) {
        ctx.fillStyle = `rgb(${50 + rand() * 20},${46 + rand() * 18},${42 + rand() * 16})`;
        ctx.fillRect(x + 1, y + 1, 30, 14);
      }
      // Puddles.
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = "rgba(20,26,40,0.6)";
        ctx.beginPath();
        ctx.ellipse(rand() * w, rand() * h, 10 + rand() * 30, 6 + rand() * 14, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, { repeat: true });
    lane.repeat.set(30, 30);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0xffffff, { map: lane, r: 0.6 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(4, 0, 30);
    g.receiveShadow = true;
    this.group.add(g);
  }

  building(b) {
    const w = b.x2 - b.x1;
    const d = b.z2 - b.z1;
    const cx = (b.x1 + b.x2) / 2;
    const cz = (b.z1 + b.z2) / 2;
    if (b.wall) {
      box(this.group, mat(b.color), cx, b.h / 2, cz, w, b.h, d);
      return;
    }
    const floors = Math.max(1, Math.round(b.h / 3));
    const texX = wallTexture(b.color, floors, Math.max(1, Math.round(w / 3)));
    const texZ = wallTexture(b.color, floors, Math.max(1, Math.round(d / 3)));
    const roofM = mat(0x8a8478, { r: 1 });
    const mats = [mat(0xffffff, { map: texZ }), mat(0xffffff, { map: texZ }), roofM, roofM, mat(0xffffff, { map: texX }), mat(0xffffff, { map: texX })];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, d), mats);
    m.position.set(cx, b.h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    // Parapet round the roof.
    const pm = mat(new THREE.Color(b.color).multiplyScalar(0.9).getHex());
    const ph = 0.45;
    box(this.group, pm, cx, b.h + ph / 2, b.z1 + 0.08, w, ph, 0.16);
    box(this.group, pm, cx, b.h + ph / 2, b.z2 - 0.08, w, ph, 0.16);
    box(this.group, pm, b.x1 + 0.08, b.h + ph / 2, cz, 0.16, ph, d);
    box(this.group, pm, b.x2 - 0.08, b.h + ph / 2, cz, 0.16, ph, d);
    // Roof clutter: a black water tank, an antenna, sometimes a clothesline.
    if (w > 5 && d > 5) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 20), mat(0x15171a, { r: 0.5 }));
      tank.position.set(b.x2 - 1.2, b.h + 1.1, b.z2 - 1.3);
      tank.castShadow = true;
      this.group.add(tank);
      box(this.group, mat(0x6a6660), tank.position.x, b.h + 0.25, tank.position.z, 1.2, 0.5, 1.2);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6), mat(0x55585e, { m: 0.6 }));
      ant.position.set(b.x1 + 0.8, b.h + 1.1, cz);
      this.group.add(ant);
      for (let i = 0; i < 4; i += 1) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7 - i * 0.12, 4), ant.material);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(ant.position.x, b.h + 1.5 + i * 0.22, cz);
        this.group.add(bar);
      }
      if (rand() < 0.7) this.clothesline(b.x1 + 1, b.x2 - 2, b.z1 + 1.6 + rand() * (d - 3), b.h);
    }
  }

  clothesline(x1, x2, z, h) {
    const y = h + 1.6;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, x2 - x1, 4), mat(0x333333));
    wire.rotation.z = Math.PI / 2;
    wire.position.set((x1 + x2) / 2, y, z);
    this.group.add(wire);
    for (const x of [x1, x2]) box(this.group, mat(0x4a4a4a), x, h + 0.8, z, 0.06, 1.6, 0.06);
    const cols = [0xc2185b, 0xf9a825, 0x00838f, 0x6a1b9a, 0xe65100, 0x2e7d32];
    for (let x = x1 + 0.4; x < x2 - 0.6; x += 0.9 + rand() * 0.6) {
      const len = 0.6 + rand() * 0.9;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, len, 2, 4), mat(cols[Math.floor(rand() * cols.length)], { side: THREE.DoubleSide }));
      cloth.position.set(x, y - len / 2, z);
      cloth.castShadow = true;
      this.group.add(cloth);
    }
  }

  courtyard() {
    // Munni's doorstep and door.
    box(this.group, mat(0x9a8f80), 0.6, 0.17, -2.9, 3.2, 0.34, 1.0);
    box(this.group, mat(0x5a3a22, { r: 0.6 }), 0, 1.25, -3.38, 1.4, 2.5, 0.06);
    // Rangoli on the courtyard floor.
    const r = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshStandardMaterial({ map: rangoliTexture(), transparent: true, roughness: 0.9 }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(3.4, 0.012, 0.6);
    r.receiveShadow = true;
    this.group.add(r);
    // A stool, a low wall, a tulsi pot.
    box(this.group, mat(0x6a4a2a), 6.3, 0.27, 2.1, 0.5, 0.54, 0.5);
    box(this.group, mat(0xc9c2b0), 7.6, 0.5, 3.6, 2.0, 1.0, 0.3);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.8, 12), mat(0xa0522d));
    pot.position.set(8.4, 0.4, 4.4);
    this.group.add(pot);
    for (let i = 0; i < 8; i += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(0x2f6a2a));
      leaf.position.set(8.4 + (rand() - 0.5) * 0.3, 0.9 + rand() * 0.25, 4.4 + (rand() - 0.5) * 0.3);
      this.group.add(leaf);
    }
    box(this.group, mat(0x8a8070), 8.9, 0.62, 5.4, 0.6, 1.24, 0.6); // a pillar for the diya
    box(this.group, mat(0x6a4a2a), 9.6, 0.22, 6.5, 0.5, 0.44, 0.5); // crate
  }

  hill() {
    const h = HILL;
    // A slope from the back of E up to the temple.
    const w = h.x2 - h.x1;
    const d = h.z2 - h.z1;
    const geo = new THREE.BoxGeometry(w, 1, d, 1, 1, 1);
    const hillM = mat(0x3c4a2e, { r: 1 });
    const slope = new THREE.Mesh(geo, hillM);
    const angle = Math.atan2(h.y1 - h.y0, 14);
    slope.position.set((h.x1 + h.x2) / 2, (h.y0 + h.y1) / 2 - 1.2, h.z1 + d / 2);
    slope.rotation.x = -angle;
    slope.scale.y = 2;
    slope.receiveShadow = true;
    this.group.add(slope);
    // Fill under it.
    box(this.group, hillM, (h.x1 + h.x2) / 2, h.y0 / 2, h.z1 + d / 2, w, h.y0, d, { shadow: false });
    // Stone steps.
    const stone = mat(0x8a8478);
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17;
      box(this.group, stone, 10.3 + Math.sin(i * 0.7) * 0.4, 14 + t * 6.3, 48.4 + t * 13.4, 2.2, 0.25, 0.9);
    }
    // The temple: a platform, a shikhara in white, a saffron flag.
    const white = mat(0xeee6d6);
    box(this.group, white, 10, 20.7, 64.5, 5, 0.6, 5);
    box(this.group, white, 10, 22.2, 66, 3, 2.6, 2.6);
    for (let i = 0; i < 5; i += 1) {
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.25 - i * 0.22, 1.4 - i * 0.22, 0.7, 8), white);
      tier.position.set(10, 23.8 + i * 0.66, 66);
      tier.castShadow = true;
      this.group.add(tier);
    }
    const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xc8962e, { m: 0.8, r: 0.3 }));
    kalash.position.set(10, 27.3, 66);
    this.group.add(kalash);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), mat(0x6a5a40));
    pole.position.set(10.3, 28.1, 66);
    this.group.add(pole);
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5, 6, 2), mat(0xf57c00, { side: THREE.DoubleSide, emissive: 0x3a1a00 }));
    this.flag.position.set(10.75, 28.7, 66);
    this.group.add(this.flag);
    // The temple bell.
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 12, 1, true), mat(0xb8862e, { m: 0.8, r: 0.3 }));
    bell.position.set(8.4, 22.6, 64.2);
    this.group.add(bell);
  }

  // Strings of dead fairy lights across the lane.
  wires() {
    const bulbM = mat(0x3a3a44, { r: 0.3 });
    const wireM = mat(0x222222);
    const strings = [
      [[6, 5.6, 12], [2.2, 8.6, 16]],
      [[6, 7.0, 21], [2.2, 9.4, 24]],
      [[1, 11.4, 33], [4, 13.2, 41]],
    ];
    for (const [a, b] of strings) {
      const A = new THREE.Vector3(...a);
      const B = new THREE.Vector3(...b);
      const mid = A.clone().lerp(B, 0.5);
      mid.y -= 0.7;
      const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.008, 4), wireM));
      for (let i = 1; i < 16; i += 1) {
        const p = curve.getPoint(i / 16);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), bulbM);
        bulb.position.copy(p);
        bulb.position.y -= 0.04;
        this.group.add(bulb);
      }
    }
  }

  // The rest of the city, far off, where the power never went.
  city() {
    const m = new THREE.MeshBasicMaterial({ color: 0x0b0d16, fog: false });
    const winM = new THREE.MeshBasicMaterial({ color: 0xffb04a, fog: false });
    const g = new THREE.Group();
    for (let i = 0; i < 90; i += 1) {
      const a = (i / 90) * Math.PI * 2 + rand() * 0.05;
      const r = 120 + rand() * 60;
      const w = 6 + rand() * 14;
      const h = 8 + rand() * 30;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
      b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r + 30);
      b.lookAt(0, h / 2, 30);
      g.add(b);
      for (let k = 0; k < 6; k += 1) {
        if (rand() < 0.5) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), winM);
        win.position.set((rand() - 0.5) * w * 0.8, (rand() - 0.5) * h * 0.8, w / 2 + 0.05);
        b.add(win);
      }
    }
    this.scene.add(g);
  }

  lights(scene) {
    scene.fog = new THREE.FogExp2(0x0a0d1a, 0.014);
    this.hemi = new THREE.HemisphereLight(0x5a6ea0, 0x2a2224, 1.4);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x9fb0e0, 1.1);
    this.moon.position.set(-12, 30, 26);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const c = this.moon.shadow.camera;
    c.left = -18;
    c.right = 18;
    c.top = 18;
    c.bottom = -18;
    c.near = 1;
    c.far = 90;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.03;
    scene.add(this.moon, this.moon.target);
  }

  // Keep the moon's shadow box around the player.
  follow(p) {
    this.moon.target.position.copy(p);
    this.moon.position.set(p.x - 12, p.y + 30, p.z - 4);
  }

  update(dt, t) {
    for (const c of this.clouds) {
      c.a += c.speed * dt;
      c.s.position.x = Math.cos(c.a) * 220;
      c.s.position.z = Math.sin(c.a) * 220;
    }
    if (this.flag) {
      const p = this.flag.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const x = p.getX(i);
        p.setZ(i, Math.sin(t * 4 + x * 5) * 0.06 * (x + 0.45));
      }
      p.needsUpdate = true;
    }
    this.fireworks.update(dt);
  }
}

// Fireworks over the rest of the city: a rising spark, a burst, a fade.
export class Fireworks {
  constructor(scene) {
    this.scene = scene;
    this.max = 1400;
    this.pos = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.next = 1;
    this.cursor = 0;
    this.rockets = [];
    this.rate = 1; // the ending turns this up
    this.near = false;
    this.onBurst = () => {};
  }

  launch(x, z, { near = false } = {}) {
    const y = near ? 30 + rand() * 10 : 40 + rand() * 30;
    this.rockets.push({ x, y: near ? 20 : 0, z, ty: y, t: 0 });
  }

  burst(x, y, z) {
    const palettes = [
      [3, 1.2, 0.2],
      [3, 0.3, 0.5],
      [0.6, 1.8, 3],
      [2.4, 2.4, 2.4],
      [0.6, 3, 0.8],
      [3, 2.2, 0.4],
    ];
    const c = palettes[Math.floor(rand() * palettes.length)];
    const n = 90;
    const speed = 9 + rand() * 6;
    for (let i = 0; i < n; i += 1) {
      const k = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      this.pos.set([x, y, z], k * 3);
      this.vel.set([Math.cos(a) * s * speed, u * speed, Math.sin(a) * s * speed], k * 3);
      this.col.set(c, k * 3);
      this.life[k] = 1.4 + rand() * 0.8;
    }
    this.onBurst(x, y, z);
  }

  update(dt) {
    this.next -= dt * this.rate;
    if (this.next <= 0) {
      this.next = 0.8 + rand() * 2.2;
      const a = rand() * Math.PI * 2;
      const r = 110 + rand() * 60;
      this.launch(Math.cos(a) * r, Math.sin(a) * r + 30);
    }
    for (const r of this.rockets) {
      r.t += dt;
      r.y += 40 * dt;
      if (r.y >= r.ty && !r.done) {
        r.done = true;
        this.burst(r.x, r.y, r.z);
      }
    }
    this.rockets = this.rockets.filter((r) => !r.done);
    for (let i = 0; i < this.max; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= 6 * dt;
      for (let j = 0; j < 3; j += 1) {
        this.vel[k + j] *= 1 - dt * 1.2;
        this.pos[k + j] += this.vel[k + j] * dt;
      }
      const f = Math.max(0, Math.min(1, this.life[i] / 1.2));
      if (this.life[i] <= 0) this.pos[k + 1] = -999;
      this.col[k] *= 0.985 + 0.015 * f;
      this.col[k + 1] *= 0.98 + 0.02 * f;
      this.col[k + 2] *= 0.98 + 0.02 * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
