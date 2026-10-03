// Every number Last Flame is tuned by. Seconds, metres, metres per second.

// How the flame moves.
export const MOVE = {
  run: 6.2,
  accel: 50, // on the ground
  stop: 40,
  airAccel: 22,
  gravity: 26,
  jump: 9.2, // ~1.6 m high, ~4.4 m long at a run
  double: 8.2,
  cut: 2.4, // gravity multiplier while rising with jump released (short hops)
  maxFall: 22,
  coyote: 0.1, // you can still jump this long after running off an edge
  buffer: 0.14, // a jump pressed this early before landing still happens
  dash: 14,
  dashTime: 0.16,
  dashCooldown: 0.35,
  radius: 0.28,
  height: 0.9,
  step: 0.22, // ledges this low you just walk up
};

// Your life: seconds of flame left. Everything costs it.
export const LIFE = {
  double: 1, // a double jump burns a second
  dash: 1, // so does a dash
  drip: 4, // a drop of water on you
  wind: 2.5, // drain multiplier in a gust
  rain: 1.8, // drain multiplier in the open in rain
  low: 5, // the HUD warns below this
};

// Things you can burn: run through them to take their flame.
export const PICKUPS = {
  diya: { life: 3, label: "Diya", r: 0.65 },
  candle: { life: 5, label: "Candle", r: 0.65 },
  lantern: { life: 8, label: "Lantern", r: 0.75 },
};

export const PAPER = { fuse: 0.45, burn: 0.55, regrow: 5 }; // catches, burns away, grows back
export const WAX = { melt: 0.55, regrow: 0.25, regrowDelay: 1.5 }; // metres per second
export const BLINK = { warn: 0.6 };
export const CRUMBLE = { fuse: 0.9 }; // stone that falls away after you touch it // flickers this long before it vanishes
export const DRIP = { gravity: 18, radius: 0.5 };
export const ABILITY_NAMES = { double: "Double jump", dash: "Dash" };
