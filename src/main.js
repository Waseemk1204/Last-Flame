// Last Flame: the host page. Title, level select, intro, settings, pause,
// the HUD, the level-complete card, the finale, and the frame loop.

import * as THREE from "three";
import { Game } from "./game.js";
import { Sound } from "./audio.js";
import { LEVELS } from "../shared/levels.js";

const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- settings
const KEY = "lastflame.settings";
const settings = { sens: 0.0024, vol: 0.9, quality: "high", invert: false };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || "{}"));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
};

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${r}`;
};

// --------------------------------------------------------------------- UI
const timers = {};
function flashOn(sel, s) {
  $(sel).classList.add("on");
  clearTimeout(timers[sel]);
  timers[sel] = setTimeout(() => $(sel).classList.remove("on"), s * 1000);
}
const ui = {
  life(v, max, low, harsh) {
    $("#life-n").textContent = v.toFixed(1);
    $("#life-bar").style.width = `${Math.min(100, (v / max) * 100)}%`;
    $("#life").classList.toggle("low", low);
    const why = harsh ? (game.run?.inWind ? "wind" : "rain") : "";
    if ($("#life-why").textContent !== why) $("#life-why").textContent = why ? `${why} · burning faster` : "";
  },
  level(n, name, sub) {
    $("#lvl-n").textContent = `${n} / ${LEVELS.length}`;
    $("#lvl-name").textContent = name;
    $("#banner-n").textContent = `Level ${n}`;
    $("#banner-name").textContent = name;
    $("#banner-sub").textContent = sub;
    flashOn("#banner", 3.2);
  },
  abilities(can) {
    $("#ab-double").classList.toggle("on", !!can.double);
    $("#ab-double").classList.toggle("hidden", !can.double);
    $("#ab-dash").classList.toggle("hidden", !can.dash);
    $("#ab-dash").classList.toggle("on", !!can.dash);
  },
  hint(text, s = 5) {
    $("#hint").textContent = text;
    flashOn("#hint", s);
  },
  toast(text) {
    $("#toast").textContent = text;
    flashOn("#toast", 2.4);
  },
  gain(text, kind) {
    const el = document.createElement("div");
    el.className = `pop ${kind}`;
    el.textContent = text;
    $("#pops").appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },
  flash() {
    const f = $("#flash");
    f.classList.add("on");
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove("on")));
  },
  died(why) {
    if (why === "reset") return;
    $("#died").textContent = { water: "The water took you.", fall: "You fell into the dark.", out: "You burned out." }[why] ?? "You went out.";
    flashOn("#died", 1.2);
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
  ending() {
    show("#ending");
    const lines = [...document.querySelectorAll(".end-line")];
    lines.forEach((l) => l.classList.remove("on"));
    lines.forEach((l, i) => setTimeout(() => l.classList.add("on"), 400 + i * 3000));
  },
};

// ------------------------------------------------------------------ input
const keys = new Set();
const input = {
  jump: false,
  dash: false,
  read() {
    const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
    const r = {
      x: k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft"),
      z: k("KeyW", "ArrowUp") - k("KeyS", "ArrowDown"),
      jump: this.jump,
      dash: this.dash,
      held: keys.has("Space"),
    };
    this.jump = false;
    this.dash = false;
    return r;
  },
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (!e.repeat) {
    if (e.code === "Space") input.jump = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.dash = true;
    if (e.code === "KeyR" && running) game.restartCheckpoint();
    if (e.code === "Enter" && !$("#win").classList.contains("hidden")) next();
  }
  keys.add(e.code);
  if (e.code === "Escape") {
    if (running) pause();
    else if (!$("#pause").classList.contains("hidden")) resume();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

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

// Mouse: pointer lock to look. If the page refuses pointer lock (some
// embeds), drag to look instead.
let lockRefused = false;
let dragging = false;
const lock = () => Promise.resolve(canvas.requestPointerLock?.()).catch(() => (lockRefused = true));
canvas.addEventListener("mousedown", () => {
  if (!running) return;
  dragging = true;
  if (document.pointerLockElement !== canvas && !lockRefused) lock();
});
window.addEventListener("mouseup", () => (dragging = false));
document.addEventListener("pointerlockerror", () => (lockRefused = true));
document.addEventListener("mousemove", (e) => {
  if (!running) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !(lockRefused && dragging)) return;
  game.look(e.movementX * settings.sens, e.movementY * settings.sens * (settings.invert ? -1 : 1));
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas && running && !lockRefused) pause();
});

// ---------------------------------------------------------------- screens
const screens = ["#title", "#levels", "#intro", "#settings", "#pause", "#win", "#ending", "#final"];
function show(id) {
  for (const s of screens) $(s).classList.toggle("hidden", s !== id);
}
let settingsBack = "#title";
let levelsBack = "#title";

function refreshTitle() {
  const p = Game.progress();
  const c = $("#btn-continue");
  c.classList.toggle("hidden", !p.resume);
  if (p.resume) c.textContent = `Continue · ${LEVELS[p.resume.level].name}${p.resume.cp ? " (checkpoint)" : ""}`;
  $("#btn-play").textContent = p.resume || p.unlocked > 0 ? "New game" : "Play";
}
refreshTitle();

$("#btn-play").addEventListener("click", () => {
  sound.begin();
  const p = Game.progress();
  p.resume = null;
  Game.saveProgress(p);
  intro(() => begin(0));
});
$("#btn-continue").addEventListener("click", () => {
  sound.begin();
  const r = Game.progress().resume;
  begin(r.level, { fromCp: r.cp });
});
$("#btn-levels").addEventListener("click", () => openLevels("#title"));
$("#btn-levels-back").addEventListener("click", () => show(levelsBack));

function openLevels(back) {
  levelsBack = back;
  const p = Game.progress();
  const grid = $("#level-grid");
  grid.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const b = document.createElement("button");
    const open = i <= p.unlocked;
    b.className = `level-card${open ? "" : " locked"}${L.final ? " final" : ""}`;
    b.type = "button";
    b.disabled = !open;
    b.innerHTML = `<span class="n">${i + 1}</span><span class="name">${open ? L.name : "· · ·"}</span><span class="best">${p.best[i] !== undefined ? `best ${fmt(p.best[i])}` : ""}</span>`;
    if (open)
      b.addEventListener("click", () => {
        sound.begin();
        begin(i);
      });
    grid.appendChild(b);
  });
  show("#levels");
}

function intro(done) {
  show("#intro");
  const lines = [...document.querySelectorAll(".intro-line")];
  lines.forEach((l) => l.classList.remove("on"));
  const ids = lines.map((l, i) => setTimeout(() => l.classList.add("on"), 400 + i * 2100));
  const skip = () => {
    window.removeEventListener("keydown", skip);
    window.removeEventListener("mousedown", skip);
    clearTimeout(timer);
    ids.forEach(clearTimeout);
    done();
  };
  const timer = setTimeout(skip, 400 + lines.length * 2100 + 1600);
  setTimeout(() => {
    window.addEventListener("keydown", skip);
    window.addEventListener("mousedown", skip);
  }, 600);
}

function begin(i, opts = {}) {
  show(null);
  game.start(i, opts);
  ui.showHud();
  running = true;
  keys.clear();
  lock();
}

function pause() {
  running = false;
  show("#pause");
}
function resume() {
  show(null);
  running = true;
  lock();
}
$("#btn-resume").addEventListener("click", resume);
$("#btn-restart-cp").addEventListener("click", () => {
  resume();
  game.restartCheckpoint();
});
$("#btn-restart").addEventListener("click", () => begin(game.index));
$("#btn-pause-levels").addEventListener("click", () => openLevels("#pause"));
$("#btn-quit").addEventListener("click", () => {
  game.state = "idle";
  ui.hideHud();
  refreshTitle();
  show("#title");
});
$("#btn-settings").addEventListener("click", () => openSettings("#title"));
$("#btn-pause-settings").addEventListener("click", () => openSettings("#pause"));
function openSettings(back) {
  settingsBack = back;
  $("#set-sens").value = settings.sens;
  $("#set-vol").value = settings.vol;
  $("#set-quality").value = settings.quality;
  $("#set-invert").checked = settings.invert;
  show("#settings");
}
for (const [id, key, kind] of [
  ["#set-sens", "sens", "num"],
  ["#set-vol", "vol", "num"],
  ["#set-quality", "quality", "str"],
  ["#set-invert", "invert", "bool"],
]) {
  $(id).addEventListener("input", (e) => {
    settings[key] = kind === "num" ? Number(e.target.value) : kind === "bool" ? e.target.checked : e.target.value;
    applySettings();
    saveSettings();
  });
}
$("#btn-settings-back").addEventListener("click", () => show(settingsBack));

// A level done.
game.onWin = (s) => {
  running = false;
  document.exitPointerLock?.();
  ui.hideHud();
  $("#win-n").textContent = `Level ${s.index + 1} of ${LEVELS.length}`;
  $("#win-name").textContent = s.name;
  $("#win-stats").textContent = `${fmt(s.time)} · went out ${s.deaths} time${s.deaths === 1 ? "" : "s"}`;
  $("#win-best").textContent = game.newBest ? "New best time" : `Best ${fmt(Game.progress().best[s.index])}`;
  show("#win");
};
function next() {
  begin(Math.min(LEVELS.length - 1, game.index + 1));
}
$("#btn-next").addEventListener("click", next);
$("#btn-replay").addEventListener("click", () => begin(game.index));
$("#btn-win-levels").addEventListener("click", () => openLevels("#win"));

// The end.
game.onFinale = ({ time, deaths }) => {
  running = false;
  document.exitPointerLock?.();
  $("#final-stats").textContent = `All nine levels · best times ${fmt(time)} · went out ${deaths} time${deaths === 1 ? "" : "s"}`;
  show("#final");
};
$("#btn-final-title").addEventListener("click", () => {
  game.state = "idle";
  refreshTitle();
  show("#title");
});

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
  if (running || game.state === "won" || game.state === "ending") {
    try {
      game.update(dt);
    } catch (err) {
      console.error(err);
    }
  }
  if (game.state !== "idle") game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?level=N jumps straight into a level; ?auto lets the bot play it.
const params = new URLSearchParams(location.search);
if (params.has("level") || params.has("auto")) {
  const n = Math.max(1, Math.min(LEVELS.length, Number(params.get("level") || 1)));
  show(null);
  game.start(n - 1, { auto: params.has("auto"), fromCp: params.has("cp") });
  ui.showHud();
  running = true;
  window.addEventListener("pointerdown", () => sound.begin(), { once: true });
  if (params.has("auto")) {
    game.onWin = (s) => {
      console.log("WON", s);
      if (n < LEVELS.length && params.has("all")) location.search = `?level=${n + 1}&auto&all`;
    };
  }
}
