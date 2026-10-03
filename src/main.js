// Last Flame: the host page. Title, intro, settings, pause, the HUD, and the
// frame loop.

import * as THREE from "three";
import { Game } from "./game.js";
import { Sound } from "./audio.js";

const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- settings
const KEY = "lastflame.settings";
const settings = { sens: 0.0022, vol: 0.9, quality: "high" };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || "{}"));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
};

// --------------------------------------------------------------------- UI
const ui = {
  hintT: 0,
  sectionT: 0,
  toastT: 0,
  fuelEl: $("#fuel"),
  fuel(f, ember, forever) {
    this.fuelEl.style.strokeDashoffset = String(150.8 * (1 - Math.max(0, Math.min(1, f))));
    this.fuelEl.classList.toggle("low", f < 0.3 && !ember);
    this.fuelEl.classList.toggle("ember", ember);
    this.fuelEl.classList.toggle("forever", !!forever);
  },
  target(text) {
    const el = $("#target");
    if (el.textContent !== text) el.textContent = text;
  },
  lamps(n, total) {
    const b = $("#lamp-n");
    if (b.textContent !== String(n) && n > Number(b.textContent)) {
      $("#lamps").classList.remove("bump");
      void $("#lamps").offsetWidth;
      $("#lamps").classList.add("bump");
    }
    b.textContent = n;
    $("#lamp-t").textContent = total;
  },
  section(name, sub) {
    $("#section h2").textContent = name;
    $("#section p").textContent = sub;
    $("#section").classList.add("on");
    this.sectionT = 3.5;
  },
  hint(text, s = 4) {
    $("#hint").textContent = text;
    $("#hint").classList.add("on");
    this.hintT = s;
  },
  toast(text) {
    $("#toast").textContent = text;
    $("#toast").classList.add("on");
    this.toastT = 1.8;
  },
  fade(on) {
    $("#fade").classList.toggle("on", on);
  },
  showHud() {
    $("#hud").classList.remove("hidden");
  },
  hideHud() {
    $("#hud").classList.add("hidden");
  },
  update(dt) {
    for (const [k, sel] of [
      ["hintT", "#hint"],
      ["sectionT", "#section"],
      ["toastT", "#toast"],
    ]) {
      if (this[k] > 0) {
        this[k] -= dt;
        if (this[k] <= 0) $(sel).classList.remove("on");
      }
    }
  },
};

// ------------------------------------------------------------------ input
const input = {
  pressed: false,
  get leap() {
    const p = this.pressed;
    this.pressed = false;
    return p;
  },
};
window.addEventListener("keydown", (e) => {
  if (e.key === " ") {
    e.preventDefault();
    if (!e.repeat) input.pressed = true;
  }
  if (e.key === "Escape" && game.state !== "idle" && $("#pause").classList.contains("hidden") && running) pause();
  else if (e.key === "Escape" && !$("#pause").classList.contains("hidden")) resume();
});

// ------------------------------------------------------------------ setup
const canvas = $("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const sound = new Sound();
const game = new Game({ renderer, sound, ui, input });
window.__lf = { game, THREE };
let running = false;

function applySettings() {
  sound.setVolume(settings.vol);
  game.setQuality(settings.quality);
}
applySettings();

// Mouse: pointer lock to look; a click leaps. If the page refuses pointer
// lock (some embeds), drag to look instead.
let lockRefused = false;
let dragging = false;
canvas.addEventListener("mousedown", (e) => {
  if (!running) return;
  dragging = true;
  if (document.pointerLockElement !== canvas && !lockRefused) {
    Promise.resolve(canvas.requestPointerLock?.()).catch(() => (lockRefused = true));
    return;
  }
  if (e.button === 0) input.pressed = true;
});
window.addEventListener("mouseup", () => (dragging = false));
document.addEventListener("pointerlockerror", () => (lockRefused = true));
document.addEventListener("mousemove", (e) => {
  if (!running) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !(lockRefused && dragging)) return;
  game.look(e.movementX * settings.sens, e.movementY * settings.sens);
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas && running && game.state !== "done" && game.state !== "ending") pause();
});

// ---------------------------------------------------------------- screens
const screens = ["#title", "#intro", "#settings", "#pause", "#end"];
function show(id) {
  for (const s of screens) $(s).classList.toggle("hidden", s !== id);
}
let settingsBack = "#title";
if (Game.saved()) $("#btn-continue").classList.remove("hidden");

$("#btn-start").addEventListener("click", () => {
  sound.begin();
  Game.forget();
  intro(() => begin(false));
});
$("#btn-continue").addEventListener("click", () => {
  sound.begin();
  begin(true);
});

function intro(done) {
  show("#intro");
  const lines = [...document.querySelectorAll(".intro-line")];
  lines.forEach((l) => l.classList.remove("on"));
  lines.forEach((l, i) => setTimeout(() => l.classList.add("on"), 400 + i * 1900));
  const skip = () => {
    window.removeEventListener("keydown", skip);
    window.removeEventListener("mousedown", skip);
    clearTimeout(timer);
    done();
  };
  const timer = setTimeout(skip, 400 + lines.length * 1900 + 1200);
  setTimeout(() => {
    window.addEventListener("keydown", skip);
    window.addEventListener("mousedown", skip);
  }, 600);
}

function begin(fromSave) {
  show(null);
  game.start({ fromSave });
  ui.showHud();
  running = true;
  Promise.resolve(canvas.requestPointerLock?.()).catch(() => (lockRefused = true));
  if (!fromSave) setTimeout(() => ui.hint("Look at the brass lamp. Click to leap to it.", 6), 800);
}

function pause() {
  running = false;
  show("#pause");
}
function resume() {
  show(null);
  running = true;
  Promise.resolve(canvas.requestPointerLock?.()).catch(() => (lockRefused = true));
}
$("#btn-resume").addEventListener("click", resume);
$("#btn-restart-cp").addEventListener("click", () => {
  resume();
  game.die();
});
$("#btn-quit").addEventListener("click", () => location.reload());
$("#btn-settings").addEventListener("click", () => openSettings("#title"));
$("#btn-pause-settings").addEventListener("click", () => openSettings("#pause"));
function openSettings(back) {
  settingsBack = back;
  $("#set-sens").value = settings.sens;
  $("#set-vol").value = settings.vol;
  $("#set-quality").value = settings.quality;
  show("#settings");
}
for (const [id, key, num] of [
  ["#set-sens", "sens", true],
  ["#set-vol", "vol", true],
  ["#set-quality", "quality", false],
]) {
  $(id).addEventListener("input", (e) => {
    settings[key] = num ? Number(e.target.value) : e.target.value;
    applySettings();
    saveSettings();
  });
}
$("#btn-settings-back").addEventListener("click", () => show(settingsBack));

game.onEnd = ({ lamps, total, deaths, time }) => {
  running = false;
  document.exitPointerLock?.();
  $("#end-lamps").textContent = lamps;
  $("#end-total").textContent = total;
  const m = Math.floor(time / 60);
  const s = String(Math.round(time % 60)).padStart(2, "0");
  $("#end-stats").textContent = `${m}:${s} · went out ${deaths} time${deaths === 1 ? "" : "s"}`;
  show("#end");
};
$("#btn-again").addEventListener("click", () => location.reload());

// ------------------------------------------------------------ title flame
const tf = $("#title-flame");
const tctx = tf.getContext("2d");
function drawTitleFlame(t) {
  const w = tf.width;
  const h = tf.height;
  tctx.clearRect(0, 0, w, h);
  const f = 1 + Math.sin(t * 0.011) * 0.04 + Math.sin(t * 0.023) * 0.03 + (Math.random() - 0.5) * 0.03;
  const g = tctx.createRadialGradient(w / 2, h * 0.62, 2, w / 2, h * 0.62, 80 * f);
  g.addColorStop(0, "rgba(255,170,80,0.4)");
  g.addColorStop(1, "rgba(255,120,20,0)");
  tctx.fillStyle = g;
  tctx.fillRect(0, 0, w, h);
  tctx.save();
  tctx.translate(w / 2, h * 0.72);
  tctx.scale(f, f);
  const fl = tctx.createLinearGradient(0, -70, 0, 0);
  fl.addColorStop(0, "rgba(255,230,180,0)");
  fl.addColorStop(0.3, "rgba(255,200,120,0.9)");
  fl.addColorStop(1, "rgba(255,140,40,1)");
  tctx.fillStyle = fl;
  tctx.beginPath();
  tctx.moveTo(0, -72);
  tctx.bezierCurveTo(14, -40, 14, -8, 0, 0);
  tctx.bezierCurveTo(-14, -8, -14, -40, 0, -72);
  tctx.fill();
  tctx.restore();
}

// ------------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!$("#title").classList.contains("hidden")) drawTitleFlame(now);
  if (running || game.state === "ending") {
    try {
      game.update(dt);
    } catch (err) {
      console.error(err);
    }
    ui.update(dt);
  }
  if (game.state !== "idle") game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?dev skips the title.
const params = new URLSearchParams(location.search);
if (params.has("dev")) {
  show(null);
  game.start({});
  ui.showHud();
  running = true;
  window.addEventListener("pointerdown", () => sound.begin(), { once: true });
  import("./dev.js").then((m) => {
    m.installDev(game);
    if (params.has("auto")) window.__lf.autopilot();
  });
}
