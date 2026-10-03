// The climb: Munni's courtyard → the galli rooftops → the terraces → the
// temple steps. Pure data (no Three.js) so a test can prove every part of
// the route can be leapt.
//
// Axes: +z is "forward" up the street, +y is up. Metres. A building is an
// axis-aligned block; its roof is at y = h.

export const SECTIONS = [
  { id: "doorstep", name: "The Doorstep", sub: "Munni's courtyard" },
  { id: "galli", name: "The Galli", sub: "rooftops of the lane" },
  { id: "terraces", name: "The Terraces", sub: "where the kids are" },
  { id: "temple", name: "The Temple Steps", sub: "up the hill, in the rain" },
];

// Pastel walls, whitewash, turquoise, pink, lime yellow.
export const BUILDINGS = [
  // Munni's house, behind the start.
  { id: "munni", x1: -5, x2: 5, z1: -9, z2: -3.4, h: 5.2, color: 0xd9a7b8 },
  // Courtyard walls.
  { id: "wall-w", x1: -5.4, x2: -5, z1: -3.4, z2: 9, h: 1.8, color: 0xc9c2b0, wall: true },
  { id: "wall-e", x1: 14.5, x2: 15, z1: -3.4, z2: 9, h: 1.8, color: 0xc9c2b0, wall: true },
  // The galli: A and B on the east side, C on the west.
  { id: "A", x1: 6, x2: 14, z1: 9, z2: 17, h: 6, color: 0x8fc7c0 },
  { id: "B", x1: 6, x2: 14, z1: 18, z2: 26, h: 7.5, color: 0xe7d38a },
  { id: "C", x1: -6, x2: 2.2, z1: 14, z2: 30, h: 10, color: 0xe8e1d2 },
  { id: "neighbour", x1: -14, x2: -6.5, z1: 8, z2: 22, h: 7, color: 0xb9c98f },
  // The terraces.
  { id: "D", x1: -7, x2: 1, z1: 32, z2: 40, h: 12, color: 0xd6a072 },
  { id: "E", x1: 4, x2: 12.5, z1: 40, z2: 48, h: 14, color: 0x9fb4d6 },
  { id: "F", x1: -12, x2: -7.5, z1: 34, z2: 44, h: 9, color: 0xc9b6d8 },
  // Behind and around, for the skyline.
  { id: "far1", x1: 16, x2: 24, z1: 6, z2: 18, h: 9, color: 0xb7a99a },
  { id: "far2", x1: 16, x2: 26, z1: 22, z2: 34, h: 11, color: 0xa8b8a4 },
  { id: "far3", x1: -16, x2: -8, z1: 24, z2: 32, h: 8, color: 0xd4c4a0 },
  { id: "far4", x1: 14, x2: 22, z1: 38, z2: 50, h: 12, color: 0xc6a4a4 },
];

// The hill the temple stands on, rising behind building E.
export const HILL = { x1: 2, x2: 20, z1: 48, z2: 70, y0: 14, y1: 20.6 };

let n = 0;
const H = (type, x, y, z, section, extra = {}) => ({ id: extra.id ?? `${type}-${n++}`, type, x, y, z, section, ...extra });

// Hosts evenly spaced along a line (both ends included).
function line(type, a, b, count, section, extra = {}) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    out.push(H(type, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, section, extra));
  }
  return out;
}

export const HOSTS_DATA = [
  // ---------------------------------------------------------- 1. Doorstep
  H("match", 0, 0.38, -2.7, 0, { id: "start" }),
  H("akhand", 1.3, 0.38, -2.5, 0, { id: "cp1" }),
  ...line("diya", [2.6, 0.04, -1.5], [5.0, 0.04, 0.9], 3, 0),
  H("candle", 6.3, 0.58, 2.1, 0),
  H("diya", 7.4, 1.05, 3.4, 0, { sheltered: true }),
  H("agarbatti", 8.4, 0.95, 4.2, 0),
  H("diya", 8.9, 1.3, 5.4, 0),
  // A side row along the courtyard wall, for the score.
  ...line("diya", [4.0, 0.04, 2.6], [2.0, 0.04, 5.4], 3, 0),
  H("candle", 9.6, 0.5, 6.5, 0),
  H("rocket", 10.2, 0.45, 7.7, 0, { id: "rocket1", to: "a-first" }),

  // ------------------------------------------------------------- 2. Galli
  H("diya", 7.2, 6.12, 9.8, 1, { id: "a-first" }),
  ...line("diya", [9.0, 6.12, 9.6], [12.8, 6.12, 9.6], 3, 1),
  H("candle", 13.6, 6.3, 11.4, 1, { sheltered: true }),
  ...line("diya", [13.6, 6.12, 13.6], [11.2, 6.12, 16.4], 3, 1),
  H("akhand", 9.0, 6.15, 16.2, 1, { id: "cp2" }),
  // Across the gap to B.
  H("diya", 8.4, 7.62, 18.6, 1),
  H("candle", 9.6, 7.7, 20.1, 1),
  H("diya", 8.4, 7.62, 21.6, 1),
  H("agarbatti", 7.4, 7.7, 22.4, 1),
  // The kandeel: up and over the lane to C's roof.
  H("kandeel", 6.6, 7.9, 23.2, 1, { id: "kandeel1", rise: [4.0, 10.9, 22.8] }),
  ...line("diya", [10.6, 7.62, 21.0], [13.2, 7.62, 24.6], 3, 1),
  // C's roof.
  H("diya", 1.7, 10.12, 22.6, 1),
  H("candle", 0.4, 10.2, 24.0, 1),
  ...line("diya", [-1.2, 10.12, 24.4], [-4.8, 10.12, 26.8], 3, 1),
  H("akhand", -3.2, 10.15, 28.4, 2, { id: "cp3" }),

  // ---------------------------------------------------------- 3. Terraces
  H("sparkler", -1.6, 10.3, 29.4, 2, { id: "sparkler1" }),
  ...line("diya", [-1.8, 12.12, 32.8], [-5.4, 12.12, 34.8], 3, 2),
  H("candle", -5.8, 12.2, 36.6, 2, { sheltered: true }),
  ...line("diya", [-4.4, 12.12, 37.6], [-1.2, 12.12, 38.4], 3, 2),
  H("rocket", 0.2, 12.4, 39.2, 2, { id: "rocket2", to: "e-first" }),
  // A detour west to F, for the lamps.
  H("sparkler", -6.6, 12.3, 38.8, 2),
  ...line("diya", [-8.2, 9.12, 37.0], [-11.2, 9.12, 40.4], 3, 2),
  H("diya", 5.0, 14.12, 40.6, 2, { id: "e-first" }),
  H("candle", 6.4, 14.2, 42.0, 2),
  ...line("diya", [7.8, 14.12, 42.8], [10.6, 14.12, 44.4], 3, 2),
  H("akhand", 10.2, 14.15, 46.4, 3, { id: "cp4" }),

  // -------------------------------------------------------------- 4. Temple
  ...line("diya", [10.8, 14.4, 48.8], [9.8, 20.5, 61.4], 10, 3),
  H("candle", 12.2, 16.1, 52.6, 3),
  H("candle", 8.0, 18.5, 57.4, 3),
  H("great", 10.0, 20.9, 63.0, 3, { id: "great" }),
];

export const START = "start";

export const LAMP_COUNT = HOSTS_DATA.filter((h) => h.type === "diya").length;

// Wind sweeps the open roofs; rain falls over the last stretch.
export const ZONES = [
  { type: "wind", x1: 6, x2: 14.5, z1: 9, z2: 17.5, y1: 5.5, y2: 10, dir: [-1, 0, 0.3] },
  { type: "wind", x1: -7, x2: 2.5, z1: 22, z2: 30, y1: 9.5, y2: 14, dir: [1, 0, 0] },
  { type: "rain", x1: 3, x2: 20, z1: 40, z2: 66, y1: 13, y2: 26 },
];

// Kids with water pistols on D's roof: they spray along a line.
export const KIDS = [{ x: -6.5, y: 12, z: 35.6, to: [0.6, 12.4, 35.6], phase: 0 }];

// Can a flame on `from` leap to `to`?
export function canLeap(from, to, range) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dy, dz);
  return d <= range && dy <= range * 0.8 && d > 0.05;
}
