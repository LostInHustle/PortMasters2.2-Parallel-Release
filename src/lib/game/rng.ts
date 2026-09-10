// =====================================================================
// Seedable PRNG (mulberry32) so that card / order / boon generation is
// deterministic per (room + round). Every captain in the same room, on
// the same voyage, sees the *same* port market and the *same* trade
// orders, which keeps shared sessions perfectly synchronized, while each
// captain still earns their own gold and reputation independently.
// =====================================================================

// Hash an arbitrary string into a 32-bit unsigned integer (xfnv1a).
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// mulberry32: returns a function producing floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

// Build an RNG from a string seed.
export function createRng(seedStr: string): Rng {
  return mulberry32(hashSeed(seedStr));
}

// Seeded integer in [min, max] inclusive.
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Seeded pick from an array.
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Seeded weighted choice. items: [value, weight][]
export function weightedPick<T>(rng: Rng, items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[0][0];
}
