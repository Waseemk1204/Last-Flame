// The post pass: the scene renders into an HDR target. Bright things (flames,
// the burning edge of 1987, moonlight on plaster) bloom at quarter size. A
// final shader grades the picture (teal in the shadows, amber in the light),
// then adds film grain, vignette, a little chromatic aberration,
// desaturation, the milky cataract haze of the death, a red-black bleed, and
// a fade to black. Tone mapping and sRGB happen here too.

import * as THREE from "three";

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.fx = {
      grain: 0.07,
      vignette: 0.55,
      aberration: 0.0015,
      desat: 0.15,
      haze: 0,
      fade: 0,
      blood: 0,
      exposure: 1,
      warp: 0,
      bloom: 0.55,
      grade: 1,
    };
    // Bloom: a bright pass, then a wide blur, at quarter size.
    const half = { type: THREE.HalfFloatType };
    this.bloomA = new THREE.WebGLRenderTarget(1, 1, half);
    this.bloomB = new THREE.WebGLRenderTarget(1, 1, half);
    const quadVS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.target.texture }, uThreshold: { value: 1.6 } },
      vertexShader: quadVS,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene; uniform float uThreshold; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tScene, vUv).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold * 2.2, l), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tIn: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: quadVS,
      fragmentShader: /* glsl */ `
        uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tIn, vUv).rgb * 0.227;
          c += texture2D(tIn, vUv + uDir * 1.385).rgb * 0.316;
          c += texture2D(tIn, vUv - uDir * 1.385).rgb * 0.316;
          c += texture2D(tIn, vUv + uDir * 3.231).rgb * 0.07;
          c += texture2D(tIn, vUv - uDir * 3.231).rgb * 0.07;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        tBloom: { value: this.bloomA.texture },
        uBloom: { value: 0.55 },
        uGrade: { value: 1 },
        uTime: { value: 0 },
        uGrain: { value: 0 },
        uVignette: { value: 0 },
        uAberration: { value: 0 },
        uDesat: { value: 0 },
        uHaze: { value: 0 },
        uFade: { value: 0 },
        uBlood: { value: 0 },
        uExposure: { value: 1 },
        uWarp: { value: 0 },
        uAspect: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float uBloom, uGrade;
        uniform float uTime, uGrain, uVignette, uAberration, uDesat, uHaze, uFade, uBlood, uExposure, uWarp, uAspect;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 uv = vUv;
          vec2 c = uv - 0.5;
          // A slow, sick swim (used during the death).
          uv += uWarp * 0.012 * vec2(sin(uv.y * 9.0 + uTime * 1.3), cos(uv.x * 7.0 + uTime * 1.1));
          float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
          vec2 off = c * uAberration * (1.0 + r2 * 6.0);
          vec3 col;
          col.r = texture2D(tScene, uv + off).r;
          col.g = texture2D(tScene, uv).g;
          col.b = texture2D(tScene, uv - off).b;
          // Cataract: blur toward the edges and wash in milk.
          if (uHaze > 0.0) {
            vec3 blur = vec3(0.0);
            float k = uHaze * 0.02 * (0.3 + r2 * 3.0);
            for (int i = 0; i < 8; i++) {
              float a = float(i) * 0.785398;
              blur += texture2D(tScene, uv + vec2(cos(a), sin(a)) * k).rgb;
            }
            col = mix(col, blur / 8.0, clamp(uHaze * 1.5, 0.0, 1.0));
            float milk = smoothstep(0.05, 0.5, r2) * uHaze;
            col = mix(col, vec3(0.75, 0.74, 0.7) * (0.4 + uExposure * 0.2), milk * 0.85);
          }
          col += texture2D(tBloom, uv).rgb * uBloom;
          col *= uExposure;
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          // Grade: cold teal in the shadows, warm amber where the light is.
          float lw = clamp(l * 1.6, 0.0, 1.0);
          vec3 shadowTint = vec3(0.86, 0.97, 1.12);
          vec3 lightTint = vec3(1.08, 0.99, 0.86);
          col *= mix(vec3(1.0), mix(shadowTint, lightTint, smoothstep(0.05, 0.6, lw)), uGrade);
          l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(col, vec3(l), clamp(uDesat, 0.0, 1.0));
          float vig = smoothstep(0.85, 0.15, r2 * (1.0 + uVignette * 1.8));
          col *= mix(1.0, vig, clamp(uVignette, 0.0, 1.0));
          // Blood: a dark red bleed in from the edges.
          col = mix(col, vec3(0.18, 0.0, 0.0) * (0.3 + l), smoothstep(0.02, 0.45, r2) * uBlood);
          float n = hash(uv * vec2(1920.0, 1080.0) + fract(uTime * 7.13) * 100.0) - 0.5;
          col += n * uGrain * (0.35 + l);
          col *= 1.0 - uFade;
          gl_FragColor = vec4(max(col, 0.0), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h, ratio) {
    this.target.setSize(Math.floor(w * ratio), Math.floor(h * ratio));
    const bw = Math.max(1, Math.floor((w * ratio) / 4));
    const bh = Math.max(1, Math.floor((h * ratio) / 4));
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.texel = new THREE.Vector2(1 / bw, 1 / bh);
    this.material.uniforms.uAspect.value = w / h;
  }

  render(scene, camera, time) {
    const u = this.material.uniforms;
    const f = this.fx;
    u.uTime.value = time;
    u.uGrain.value = f.grain;
    u.uVignette.value = f.vignette;
    u.uAberration.value = f.aberration;
    u.uDesat.value = f.desat;
    u.uHaze.value = f.haze;
    u.uFade.value = f.fade;
    u.uBlood.value = f.blood;
    u.uExposure.value = f.exposure;
    u.uWarp.value = f.warp;
    u.uBloom.value = f.bloom;
    u.uGrade.value = f.grade;
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    // Bloom (skipped on low quality).
    if (f.bloom <= 0) {
      r.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.quad.material = this.brightMat;
    r.setRenderTarget(this.bloomA);
    r.render(this.scene, this.camera);
    this.quad.material = this.blurMat;
    for (let i = 0; i < 3; i += 1) {
      const spread = 1 + i * 1.5;
      this.blurMat.uniforms.tIn.value = this.bloomA.texture;
      this.blurMat.uniforms.uDir.value.set(this.texel.x * spread, 0);
      r.setRenderTarget(this.bloomB);
      r.render(this.scene, this.camera);
      this.blurMat.uniforms.tIn.value = this.bloomB.texture;
      this.blurMat.uniforms.uDir.value.set(0, this.texel.y * spread);
      r.setRenderTarget(this.bloomA);
      r.render(this.scene, this.camera);
    }
    this.quad.material = this.material;
    r.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
