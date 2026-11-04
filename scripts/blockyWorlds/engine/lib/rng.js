// Seeded randomness for the engine: a frame must depend only on (timeline, t), so nothing uses Math.random().
// Works in the browser and in Node.
export function rng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  return Object.assign(next, {
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
  });
}
/** A stable number from a string (cast seeds from names). */
export const hashSeed = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
