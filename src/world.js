// The world a level is made of: stone islands floating over a sea of mist
// at the end of the day; paper that burns, wax that melts, glass that comes
// and goes; water, drops, wind, rain, ash; lamps to burn; the checkpoint
// braziers; the goal; and for the last level, the Eternal Fire.

import * as THREE from "three";
import { flameGeometry, flameMaterial, glowSprite, Sparks } from "./player.js";
import { pickupPos } from "../shared/sim.js";

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

// ------------------------------------------------------------- textures
const TEX = {};
function textures() {
  if (TEX.stone) return TEX;
  TEX.stone = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#8a8480";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i += 1) {
        const v = 100 + Math.floor(rand() * 70);
        ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.25 + rand() * 0.3})`;
        ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 4, 1 + rand() * 4);
      }
      // Blocks.
      ctx.strokeStyle = "rgba(30,26,24,0.55)";
      ctx.lineWidth = 2;
      for (let y = 0; y <= h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        for (let x = (y / 64) % 2 ? 0 : 64; x <= w; x += 128) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 64);
          ctx.stroke();
        }
      }
      // Cracks.
      ctx.strokeStyle = "rgba(20,18,16,0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i += 1) {
        let x = rand() * w;
        let y = rand() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k += 1) {
          x += (rand() - 0.5) * 30;
          y += (rand() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    { repeat: true },
  );
  TEX.paper = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#e8dcc0";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i += 1) {
        ctx.strokeStyle = `rgba(150,130,100,${rand() * 0.15})`;
        ctx.beginPath();
        const x = rand() * w;
        const y = rand() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 20, y + (rand() - 0.5) * 6);
        ctx.stroke();
      }
      // Faded writing.
      ctx.strokeStyle = "rgba(60,40,30,0.35)";
      ctx.lineWidth = 2;
      for (let row = 30; row < h - 20; row += 26) {
        let x = 24;
        ctx.beginPath();
        ctx.moveTo(x, row);
        while (x < w - 30) {
          x += 4 + rand() * 8;
          ctx.lineTo(x, row + (rand() - 0.5) * 8);
          if (rand() < 0.12) {
            x += 10;
            ctx.moveTo(x, row);
          }
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(120,100,80,0.35)";
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
    },
    { repeat: true },
  );
  TEX.wax = canvasTex(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#fff4dc");
    g.addColorStop(1, "#d8c8a0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i += 1) {
      const x = rand() * w;
      const len = 30 + rand() * 120;
      ctx.fillStyle = "rgba(255,250,235,0.6)";
      ctx.fillRect(x, 0, 5 + rand() * 6, len);
      ctx.beginPath();
      ctx.arc(x + 5, len, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  TEX.wood = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#4a3222";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        ctx.fillStyle = `rgba(${70 + rand() * 30},${45 + rand() * 20},28,1)`;
        ctx.fillRect(0, y + 1, w, 30);
        ctx.strokeStyle = "rgba(20,12,8,0.4)";
        for (let i = 0; i < 6; i += 1) {
          ctx.beginPath();
          ctx.moveTo(0, y + 4 + rand() * 24);
          ctx.bezierCurveTo(w / 3, y + rand() * 32, (2 * w) / 3, y + rand() * 32, w, y + 4 + rand() * 24);
          ctx.stroke();
        }
      }
    },
    { repeat: true },
  );
  TEX.water = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#0c2a38";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i += 1) {
        ctx.strokeStyle = `rgba(140,200,230,${0.08 + rand() * 0.15})`;
        ctx.lineWidth = 1 + rand() * 2;
        ctx.beginPath();
        ctx.ellipse(rand() * w, rand() * h, 10 + rand() * 30, 3 + rand() * 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    { repeat: true },
  );
  TEX.rune = canvasTex(256, 256, (ctx, w) => {
    ctx.strokeStyle = "rgba(255,200,120,1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(w / 2 + Math.cos(a) * w * 0.4, w / 2 + Math.sin(a) * w * 0.4);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(0, 6);
      ctx.lineTo(6, -6);
      ctx.stroke();
      ctx.restore();
    }
    // A flame mark in the middle.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, w * 0.3);
    ctx.bezierCurveTo(w * 0.62, w * 0.45, w * 0.6, w * 0.62, w / 2, w * 0.66);
    ctx.bezierCurveTo(w * 0.4, w * 0.62, w * 0.38, w * 0.45, w / 2, w * 0.3);
    ctx.stroke();
  });
  TEX.beam = canvasTex(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,200,120,0)");
    g.addColorStop(1, "rgba(255,200,120,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return TEX;
}

// A box whose texture is scaled to its size (so big stones aren't stretched).
function boxGeo(w, h, d, s = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f += 1)
    for (let k = 0; k < 4; k += 1) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (dims[f][0] / s), uv.getY(i) * (dims[f][1] / s));
    }
  return g;
}

const std = (o) => new THREE.MeshStandardMaterial(o);
const SMALL_GEO = flameGeometry(0.38, 16);

// A small flame for lamps: the flame shader and a glow.
export class SmallFlame {
  constructor(parent, size = 0.2, glow = 0.9) {
    this.object = new THREE.Group();
    this.mesh = new THREE.Mesh(SMALL_GEO, flameMaterial({ alpha: 0.95 }));
    this.glow = glowSprite(glow);
    this.glow.position.y = size * 0.5;
    this.object.add(this.mesh, this.glow);
    parent.add(this.object);
    this.size = size;
    this.base = glow;
    this.update(0);
  }
  update(t, k = 1) {
    this.mesh.material.uniforms.uTime.value = t;
    const f = 0.9 + Math.sin(t * 17 + this.size * 40) * 0.05 + Math.random() * 0.06;
    const s = this.size * k * f;
    this.mesh.scale.set(s * 0.8, s, s * 0.8);
    this.glow.scale.setScalar(this.base * k * f);
  }
  set visible(v) {
    this.object.visible = v;
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    textures();
    this.sky();
    this.background();
    this.lights();
    this.level = new THREE.Group();
    scene.add(this.level);
    this.splash = new Sparks(scene, 120, [0.8, 1.4, 2.2]);
    this.ash = new Sparks(scene, 200, [3, 1.2, 0.3]); // paper burning away
    this.weatherFx();
    this.poolLights = [];
    for (let i = 0; i < 4; i += 1) {
      const l = new THREE.PointLight(0xff9a40, 0, 8, 1.6);
      scene.add(l);
      this.poolLights.push(l);
    }
  }

  // ---------------------------------------------------------------- sky
  sky() {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow;
        void main(){
          float h = vP.y;
          vec3 c = mix(uLow, uMid, smoothstep(-0.25, 0.15, h));
          c = mix(c, uTop, smoothstep(0.15, 0.75, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.skyMat = m;
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), m);
    this.scene.add(this.skyDome);
    const n = 1200;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const a = rand() * Math.PI * 2;
      const e = 0.08 + rand() * 1.4;
      p.set([Math.cos(a) * Math.cos(e) * 420, Math.sin(e) * 420, Math.sin(a) * Math.cos(e) * 420], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d0f0, size: 1.2, sizeAttenuation: false, fog: false, transparent: true }));
    this.scene.add(this.stars);
    // The mist far below.
    this.mist = new THREE.Mesh(
      new THREE.CircleGeometry(500, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 } },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vP; uniform vec3 uColor; uniform float uTime;
          float n(vec2 p){ return sin(p.x*0.05+uTime*0.1)*sin(p.y*0.06-uTime*0.07)*0.5+0.5; }
          void main(){ float d = length(vP); float a = 0.9 * (0.75 + 0.25*n(vP)) * smoothstep(500.0, 120.0, d); gl_FragColor = vec4(uColor*(0.8+0.4*n(vP*1.7)), a); }`,
      }),
    );
    this.mist.rotation.x = -Math.PI / 2;
    this.scene.add(this.mist);
  }

  // Far islands and, out in the dark, other flames.
  background() {
    const rock = std({ color: 0x15141a, roughness: 1 });
    this.far = new THREE.Group();
    for (let i = 0; i < 46; i += 1) {
      const a = rand() * Math.PI * 2;
      const r = 70 + rand() * 140;
      const s = 3 + rand() * 12;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.9, s * 0.25, 7), rock);
      const under = new THREE.Mesh(new THREE.ConeGeometry(s * 0.9, s * (1.2 + rand()), 7), rock);
      under.rotation.x = Math.PI;
      under.position.y = -s * 0.8;
      const g = new THREE.Group();
      g.add(top, under);
      g.position.set(Math.cos(a) * r, -25 + rand() * 60, Math.sin(a) * r);
      g.rotation.y = rand() * 6;
      this.far.add(g);
      if (rand() < 0.5) {
        const f = glowSprite(2 + rand() * 3, [1.4, 0.7, 0.25]);
        f.position.set(g.position.x, g.position.y + s * 0.2 + 0.6, g.position.z);
        this.far.add(f);
      }
    }
    this.scene.add(this.far);
  }

  lights() {
    this.hemi = new THREE.HemisphereLight(0x8090c0, 0x302020, 0.5);
    this.scene.add(this.hemi);
    const d = new THREE.DirectionalLight(0xb8c4ff, 0.7);
    d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    const c = d.shadow.camera;
    c.left = c.bottom = -18;
    c.right = c.top = 18;
    c.near = 1;
    c.far = 90;
    d.shadow.bias = -0.0008;
    d.shadow.normalBias = 0.02;
    this.scene.add(d, d.target);
    this.sun = d;
    this.scene.fog = new THREE.FogExp2(0x000000, 0.012);
  }

  weatherFx() {
    // Rain: streaks around the camera.
    const n = 900;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.4, fog: false }));
    this.rain.frustumCulled = false;
    this.rainDrops = Array.from({ length: n }, () => [rand() * 30 - 15, rand() * 20, rand() * 30 - 15]);
    this.scene.add(this.rain);
    // Ash flakes, or embers: one cloud of points, coloured per level.
    const m = 500;
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    this.motes = new THREE.Points(g2, new THREE.PointsMaterial({ size: 0.08, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    this.motes.frustumCulled = false;
    this.moteData = Array.from({ length: m }, () => [rand() * 40 - 20, rand() * 24 - 8, rand() * 40 - 20, rand()]);
    this.scene.add(this.motes);
  }

  // ------------------------------------------------------------ a level
  load(L, index) {
    this.L = L;
    this.index = index;
    this.scene.remove(this.level);
    this.level.traverse((o) => {
      if (o.geometry && o.geometry !== SMALL_GEO && !o.geometry.userData.keep) o.geometry.dispose();
    });
    this.level = new THREE.Group();
    this.scene.add(this.level);
    const P = L.palette;
    this.skyMat.uniforms.uTop.value.setHex(P.top);
    this.skyMat.uniforms.uMid.value.setHex(P.mid);
    this.skyMat.uniforms.uLow.value.setHex(P.low);
    this.scene.fog.color.setHex(P.fog);
    this.scene.fog.density = L.weather === "rain" ? 0.02 : 0.013;
    this.mist.material.uniforms.uColor.value.setHex(P.mist);
    this.mist.position.y = L.killY - 3;
    this.hemi.color.setHex(P.mid).lerp(new THREE.Color(0x9098c0), 0.5);
    this.hemi.groundColor.setHex(P.low).multiplyScalar(0.5);
    this.hemi.intensity = P.amb * 1.6;
    this.sun.color.setHex(P.low).lerp(new THREE.Color(0xc8d0ff), 0.6);
    this.sun.intensity = P.amb * 1.4;
    this.stars.material.opacity = L.weather ? 0.25 : 1;
    this.rain.visible = L.weather === "rain";
    this.motes.visible = L.weather === "ash" || L.weather === "embers";
    if (L.weather === "ash") this.motes.material.color.setRGB(0.55, 0.5, 0.48);
    if (L.weather === "embers") this.motes.material.color.setRGB(3, 1.1, 0.25);

    const T = TEX;
    const stoneTop = std({ color: new THREE.Color(P.stone).multiplyScalar(1.15), map: T.stone, roughness: 0.92 });
    const stoneSide = std({ color: new THREE.Color(P.stone).multiplyScalar(0.7), map: T.stone, roughness: 0.95 });
    const stone = [stoneSide, stoneSide, stoneTop, stoneSide, stoneSide, stoneSide];
    const rockMat = std({ color: new THREE.Color(P.stone).multiplyScalar(0.35), roughness: 1 });
    const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.2, 0.4), fog: false });
    const woodMat = std({ map: T.wood, roughness: 0.85 });
    this.waterMat = std({ color: 0x5a8aa0, map: T.water, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.88, emissive: 0x0a2030, emissiveIntensity: 0.6 });

    this.platViews = new Map();
    for (const d of L.plats) {
      const v = { def: d, group: new THREE.Group(), wasAlive: true };
      const g = v.group;
      g.position.set(d.x, d.y, d.z);
      this.level.add(g);
      if (d.kind === "water") {
        const m = new THREE.Mesh(boxGeo(d.w, d.h, d.d, 3), this.waterMat);
        m.position.y = -d.h / 2;
        g.add(m);
      } else if (d.kind === "paper") {
        const mat = std({ map: T.paper, roughness: 0.95, emissive: new THREE.Color(0, 0, 0), side: THREE.DoubleSide });
        const m = new THREE.Mesh(boxGeo(d.w, d.h, d.d, 2), mat);
        m.position.y = -d.h / 2;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        // The strings it hangs from.
        const str = new THREE.LineBasicMaterial({ color: 0x9a8a70, transparent: true, opacity: 0.4 });
        for (const [sx, sz] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) {
          const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3((sx * d.w) / 2.2, 0, (sz * d.d) / 2.2), new THREE.Vector3((sx * d.w) / 3, 14, (sz * d.d) / 3)]);
          g.add(new THREE.Line(lg, str));
        }
        v.mat = mat;
        v.mesh = m;
        v.flames = [0, 1, 2, 3].map((k) => {
          const f = new SmallFlame(g, 0.35, 1.2);
          f.object.position.set(((k % 2) - 0.5) * d.w * 0.6, 0, (Math.floor(k / 2) - 0.5) * d.d * 0.6);
          f.visible = false;
          return f;
        });
      } else if (d.kind === "wax") {
        const mat = std({ map: T.wax, roughness: 0.55, emissive: new THREE.Color(0.25, 0.16, 0.08), emissiveIntensity: 0.6 });
        const m = new THREE.Mesh(boxGeo(d.w, d.h, d.d, 1.3), mat);
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        v.mesh = m;
        // A stone saucer under it.
        const base = new THREE.Mesh(boxGeo(d.w + 0.4, 0.4, d.d + 0.4), stone);
        base.position.y = -d.h - 0.2;
        base.receiveShadow = true;
        g.add(base);
        const under = this.underside(d.w + 0.4, d.d + 0.4, rockMat);
        under.position.y = -d.h - 0.4;
        g.add(under);
      } else if (d.blink) {
        const mat = std({ color: 0x9ad0ff, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0.15, 0.4, 0.8), emissiveIntensity: 0.8, transparent: true, opacity: 0.8 });
        const m = new THREE.Mesh(boxGeo(d.w, d.h, d.d), mat);
        m.position.y = -d.h / 2;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(d.w, d.h, d.d)), new THREE.LineBasicMaterial({ color: 0x6ab0ff, transparent: true, opacity: 0.25 }));
        ghost.position.y = -d.h / 2;
        g.add(ghost);
        v.mat = mat;
        v.mesh = m;
        v.ghost = ghost;
      } else {
        // Stone (or a roof).
        const roof = !d.route;
        const m = new THREE.Mesh(boxGeo(d.w, d.h, d.d), roof ? woodMat : stone);
        m.position.y = -d.h / 2;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        if (roof) {
          // Posts down to the platform below.
          const below = L.plats.find((p) => p.route && Math.abs(p.x - d.x) < 0.01 && Math.abs(p.z - d.z) < 0.01);
          const drop = below ? d.y - d.h - below.y : 3;
          for (const [sx, sz] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, drop, 0.14), woodMat);
            post.position.set(sx * (d.w / 2 - 0.25), -d.h - drop / 2, sz * (d.d / 2 - 0.25));
            post.castShadow = true;
            g.add(post);
          }
        } else {
          const under = this.underside(d.w, d.d, rockMat);
          under.position.y = -d.h;
          g.add(under);
          if (d.move) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.03, 0.06, d.d + 0.03), runeMat);
            band.position.y = -d.h * 0.45;
            g.add(band);
          }
        }
      }
      this.platViews.set(d.id, v);
    }

    // Lamps.
    this.pickViews = L.pickups.map((p) => {
      const g = this.lamp(p.type);
      this.level.add(g.group);
      return { p, ...g };
    });

    // The checkpoint: a ring of runes and two braziers.
    this.cpView = null;
    if (L.cp) {
      const pl = L.plats.find((p) => p.id === L.cp.on);
      const g = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({ map: T.rune, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      g.add(ring);
      const off = Math.max(pl.w, pl.d) / 2 - 0.35;
      const across = pl.w >= pl.d;
      const braziers = [-1, 1].map((s) => {
        const b = new THREE.Group();
        b.position.set(across ? s * off : 0, 0, across ? 0 : s * off);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8), stoneSide);
        leg.position.y = 0.35;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.18, 12, 1, true), std({ color: 0x3a2a20, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
        bowl.position.y = 0.78;
        b.add(leg, bowl);
        g.add(b);
        const f = new SmallFlame(b, 0.55, 2.6);
        f.object.position.y = 0.8;
        f.visible = false;
        return f;
      });
      this.level.add(g);
      this.cpView = { group: g, ring, braziers };
    }

    // The goal: a ring of flames and a beam of light. Or the Eternal Fire.
    const G = L.goal;
    const gg = new THREE.Group();
    gg.position.set(G.x, G.y, G.z);
    this.level.add(gg);
    this.goalFlames = [];
    this.beam = null;
    if (L.final) {
      const big = new THREE.Mesh(flameGeometry(0.42, 40), flameMaterial({ core: [4, 2.6, 1], edge: [2.4, 0.6, 0.08], tip: [1.6, 0.3, 0.04], alpha: 0.9, wobble: 0.6 }));
      big.scale.set(5.5, 11, 5.5);
      big.position.y = -0.2;
      const inner = new THREE.Mesh(flameGeometry(0.42, 32), flameMaterial({ core: [5, 4, 2.4], edge: [3, 1.4, 0.3], tip: [2, 0.7, 0.1], alpha: 0.7, wobble: 0.4 }));
      inner.scale.set(2.8, 7, 2.8);
      const glow = glowSprite(26, [2.4, 1.1, 0.35]);
      glow.position.y = 4;
      gg.add(big, inner, glow);
      this.eternal = [big, inner];
      this.eternalLight = new THREE.PointLight(0xff8a30, 60, 40, 1.4);
      this.eternalLight.position.y = 3;
      gg.add(this.eternalLight);
    } else {
      this.eternal = null;
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const f = new SmallFlame(gg, 0.3, 1.0);
        f.object.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25);
        this.goalFlames.push(f);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 30, 24, 1, true), new THREE.MeshBasicMaterial({ map: T.beam, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.material.color.setRGB(0.9, 0.55, 0.25);
      beam.position.y = 15;
      gg.add(beam);
      this.beam = beam;
    }
    this.goalGroup = gg;

    // Drops.
    const dropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.4, 2.2), fog: false });
    this.dripViews = L.drips.map(() => {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dropMat);
      drop.scale.set(1, 1.8, 1);
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x0a1830, transparent: true, opacity: 0.5, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      this.level.add(drop, mark);
      return { drop, mark, wasFalling: false };
    });

    // Wind: streaks blowing through each zone.
    this.windViews = L.winds.map((w) => {
      const n = 70;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0.0, fog: false }));
      lines.frustumCulled = false;
      this.level.add(lines);
      const pts = Array.from({ length: n }, () => [w.x0 + rand() * (w.x1 - w.x0), w.y0 + 3 + rand() * 6, w.z0 + rand() * (w.z1 - w.z0)]);
      return { w, lines, pts };
    });
  }

  // The rock hanging under an island.
  underside(w, d, mat) {
    const s = Math.max(w, d);
    const h = Math.min(4.5, 0.9 * s + 0.6);
    const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.7, h, 6), mat);
    c.rotation.x = Math.PI;
    c.scale.set(w / s, 1, d / s);
    c.position.y = -h / 2;
    const g = new THREE.Group();
    g.add(c);
    return g;
  }

  // A lamp to burn: a clay diya, a candle, or a lantern.
  lamp(type) {
    const g = new THREE.Group();
    let fy = 0.2;
    let size = 0.22;
    if (type === "diya") {
      const pts = [
        [0, 0],
        [0.12, 0],
        [0.2, 0.06],
        [0.22, 0.12],
        [0.18, 0.115],
        [0, 0.085],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), std({ color: 0xb5592a, roughness: 0.85 }));
      m.castShadow = true;
      g.add(m);
      fy = 0.14;
    } else if (type === "candle") {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.42, 14), std({ color: 0xf2ead8, roughness: 0.5, emissive: 0x302010 }));
      c.position.y = 0.21;
      c.castShadow = true;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.04, 16), std({ color: 0xc8962e, metalness: 0.8, roughness: 0.3 }));
      plate.position.y = 0.02;
      g.add(c, plate);
      fy = 0.44;
      size = 0.26;
    } else {
      const brass = std({ color: 0xc8962e, metalness: 0.8, roughness: 0.3 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8), brass);
      base.position.y = 0.04;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.36, 8, 1, true), std({ color: 0xffe0a0, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide }));
      glass.position.y = 0.26;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 8), brass);
      cap.position.y = 0.52;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), brass);
      ring.position.y = 0.64;
      g.add(base, glass, cap, ring);
      for (let i = 0; i < 4; i += 1) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.02), brass);
        const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
        bar.position.set(Math.cos(a) * 0.15, 0.26, Math.sin(a) * 0.15);
        g.add(bar);
      }
      fy = 0.16;
      size = 0.24;
    }
    const flame = new SmallFlame(g, size, type === "lantern" ? 1.6 : 1.1);
    flame.object.position.y = fy;
    // A soft halo so you can find it in the dark.
    const halo = glowSprite(type === "lantern" ? 2.6 : 1.8, [0.9, 0.5, 0.2]);
    halo.position.y = fy + 0.1;
    g.add(halo);
    return { group: g, flame, halo, fy };
  }

  // ------------------------------------------------------------ per frame
  sync(run, t, dt, focus) {
    const st = run.st;
    for (const p of st.plats) {
      const v = this.platViews.get(p.def.id);
      const d = p.def;
      v.group.position.set(p.x, p.y, p.z);
      if (d.kind === "paper") {
        v.mesh.visible = p.alive;
        const k = p.burning ? Math.min(1, p.burnT / 0.55) : Math.min(1, p.touch / 0.45) * 0.3;
        v.mat.color.setRGB(1 - k * 0.8, 1 - k * 0.85, 1 - k * 0.9);
        v.mat.emissive.setRGB(k * 2.2, k * 0.7, k * 0.1);
        for (const f of v.flames) {
          f.visible = p.alive && p.burning;
          if (p.alive && p.burning) f.update(t, 0.5 + k);
        }
        if (v.wasAlive && !p.alive) for (let i = 0; i < 40; i += 1) this.ash.emit(p.x + (rand() - 0.5) * d.w, p.y, p.z + (rand() - 0.5) * d.d, (rand() - 0.5) * 2, rand() * 2, (rand() - 0.5) * 2);
        if (!v.wasAlive && p.alive) v.grow = 0;
        if (v.grow !== undefined && v.grow < 1) v.grow = Math.min(1, v.grow + dt * 3);
        const s = (v.grow ?? 1) * (p.burning ? 1 - k * 0.4 : 1);
        v.mesh.scale.set(Math.max(0.01, s), 1, Math.max(0.01, s));
        v.wasAlive = p.alive;
      } else if (d.kind === "wax") {
        const left = Math.max(0.02, d.h - p.melt);
        v.mesh.visible = p.alive;
        v.mesh.scale.y = left / d.h;
        v.mesh.position.y = -p.melt - left / 2;
        v.mesh.material.emissiveIntensity = p.melt > 0 ? 1.2 : 0.6;
      } else if (d.blink) {
        v.mesh.visible = p.alive && !(p.fading && Math.sin(t * 40) > 0);
        v.mat.opacity = p.fading ? 0.4 : 0.8;
        v.ghost.material.opacity = p.alive ? 0.15 : 0.35 + Math.sin(t * 6) * 0.1;
      }
    }
    if (this.waterMat) this.waterMat.map.offset.set(t * 0.02, t * 0.013);

    // Lamps.
    for (const v of this.pickViews) {
      const pos = pickupPos(st, v.p);
      v.group.position.set(pos.x, pos.y - 0.35, pos.z);
      v.flame.visible = !v.p.taken;
      v.halo.visible = !v.p.taken;
      if (!v.p.taken) {
        v.flame.update(t);
        v.halo.material.opacity = 0.6 + Math.sin(t * 3 + pos.x) * 0.2;
      }
    }

    // Checkpoint.
    if (this.cpView) {
      const c = this.cpView;
      const pl = st.byId.get(this.L.cp.on);
      c.group.position.set(pl.x + (this.L.cp.x - pl.def.x), pl.y, pl.z + (this.L.cp.z - pl.def.z));
      const lit = st.cpReached;
      for (const f of c.braziers) {
        f.visible = lit;
        if (lit) f.update(t, 1);
      }
      const k = lit ? 1 : 0.3 + Math.sin(t * 2) * 0.15;
      c.ring.material.color.setRGB(1.6 * k, 0.9 * k, 0.4 * k);
      c.ring.rotation.z = t * 0.2;
    }

    // Goal.
    for (const f of this.goalFlames) f.update(t, 1);
    if (this.beam) this.beam.material.opacity = 0.35 + Math.sin(t * 1.5) * 0.08;
    if (this.eternal) {
      for (const m of this.eternal) m.material.uniforms.uTime.value = t * 0.6;
      this.eternalLight.intensity = 55 + Math.sin(t * 7) * 6 + Math.random() * 6;
    }

    // Drops: the drop, and a shadow on the floor that darkens as it comes.
    st.drips.forEach((d, i) => {
      const v = this.dripViews[i];
      v.drop.visible = !!d.falling;
      v.drop.position.set(d.x, d.y, d.z);
      const near = d.falling ? Math.max(0, 1 - (d.y - d.floor) / (d.top - d.floor)) : 0;
      v.mark.position.set(d.x, d.floor + 0.02, d.z);
      v.mark.material.opacity = 0.15 + near * 0.6;
      v.mark.scale.setScalar(0.5 + near * 0.6);
      if (v.wasFalling && !d.falling) for (let k = 0; k < 14; k += 1) this.splash.emit(d.x, d.floor + 0.05, d.z, (rand() - 0.5) * 3, rand() * 2.5, (rand() - 0.5) * 3);
      v.wasFalling = d.falling;
    });

    // Wind.
    for (const v of this.windViews) {
      const w = v.w;
      const speed = w.active ? 16 : 1.2;
      v.lines.material.opacity += ((w.active ? 0.5 : w.warn ? 0.2 : 0.05) - v.lines.material.opacity) * Math.min(1, dt * 6);
      const a = v.lines.geometry.attributes.position;
      v.pts.forEach((p, k) => {
        p[0] += w.dx * speed * dt;
        p[2] += w.dz * speed * dt;
        if (p[0] < w.x0) p[0] = w.x1;
        if (p[0] > w.x1) p[0] = w.x0;
        if (p[2] < w.z0) p[2] = w.z1;
        if (p[2] > w.z1) p[2] = w.z0;
        const len = w.active ? 0.9 : 0.2;
        const y = p[1] + Math.sin(t * 2 + k) * 0.2;
        a.setXYZ(k * 2, p[0], y, p[2]);
        a.setXYZ(k * 2 + 1, p[0] - w.dx * len, y, p[2] - w.dz * len);
      });
      a.needsUpdate = true;
    }

    this.splash.update(dt);
    this.ash.update(dt);
    this.assignLights(run, focus);
  }

  // Four real lights go to the nearest lit lamps and braziers.
  assignLights(run, focus) {
    const cands = [];
    for (const v of this.pickViews) if (!v.p.taken) cands.push({ p: v.group.position, y: v.fy + 0.2, i: 1.4 });
    if (this.cpView && run.st.cpReached) cands.push({ p: this.cpView.group.position, y: 1.2, i: 4 });
    if (!this.eternal) cands.push({ p: this.goalGroup.position, y: 0.6, i: 5 });
    for (const c of cands) c.d = c.p.distanceToSquared(focus);
    cands.sort((a, b) => a.d - b.d);
    this.poolLights.forEach((l, k) => {
      const c = cands[k];
      if (!c) {
        l.intensity = 0;
        return;
      }
      l.position.set(c.p.x, c.p.y + c.y, c.p.z);
      l.intensity = c.i * (0.9 + Math.random() * 0.15);
    });
  }

  update(dt, t, cam, focus) {
    this.mist.material.uniforms.uTime.value = t;
    this.skyDome.position.copy(cam);
    this.stars.position.copy(cam);
    this.far.rotation.y = t * 0.004;
    // The sun's shadow box follows you.
    this.sun.position.set(focus.x - 20, focus.y + 30, focus.z - 10);
    this.sun.target.position.copy(focus);
    if (this.rain.visible) {
      const a = this.rain.geometry.attributes.position;
      this.rainDrops.forEach((d, k) => {
        d[1] -= dt * 24;
        if (d[1] < -6) {
          d[1] = 14;
          d[0] = rand() * 30 - 15;
          d[2] = rand() * 30 - 15;
        }
        const x = cam.x + d[0];
        const y = cam.y + d[1] - 4;
        const z = cam.z + d[2];
        a.setXYZ(k * 2, x, y, z);
        a.setXYZ(k * 2 + 1, x + 0.05, y + 0.6, z);
      });
      a.needsUpdate = true;
    }
    if (this.motes.visible) {
      const up = this.L.weather === "embers";
      const a = this.motes.geometry.attributes.position;
      this.moteData.forEach((d, k) => {
        d[1] += dt * (up ? 1.2 + d[3] : -0.8 - d[3] * 0.6);
        d[0] += Math.sin(t * 0.7 + d[3] * 9) * dt * 0.6;
        if (d[1] > 16) d[1] = -8;
        if (d[1] < -8) d[1] = 16;
        a.setXYZ(k, focus.x + d[0], focus.y + d[1], focus.z + d[2]);
      });
      a.needsUpdate = true;
    }
  }
}
