// Every number Last Flame is tuned by. Seconds and metres.

// What each kind of host burns for, and how far a flame on it can leap.
export const HOSTS = {
  match: { burn: 5, range: 2.4, label: "Matchstick" },
  diya: { burn: 12, range: 3.1, label: "Diya", lamp: true },
  candle: { burn: 20, range: 2.4, label: "Candle" },
  agarbatti: { burn: 30, range: 1.6, label: "Agarbatti" },
  sparkler: { burn: 4, range: 5.4, label: "Phuljhadi" },
  rocket: { burn: 0.8, range: 0, label: "Rocket" }, // launches you to its target
  kandeel: { burn: 26, range: 3.2, label: "Kandeel" }, // rises while it burns
  akhand: { burn: Infinity, range: 3.2, label: "Akhand deep", checkpoint: true },
  great: { burn: Infinity, range: 0, label: "The temple lamp", final: true },
};

export const LEAP = {
  upFraction: 0.8, // you can leap up at most this fraction of your range
  minTime: 0.38,
  perMetre: 0.07,
  arcHeight: 0.28, // apex above the higher end, per metre of distance
};

export const EMBER = { time: 1.6, range: 1.6, fall: 0.35 };

export const HAZARD = {
  windBurn: 3, // fuel burns this many times faster in a gust, if exposed
  rainBurn: 2,
  gustEvery: 6,
  gustFor: 2.2,
  sprayEvery: 4.2,
  sprayFor: 0.9,
  sprayWarn: 0.7,
  sprayRadius: 0.45,
};
