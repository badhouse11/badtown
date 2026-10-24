// Deterministic, seedable random numbers. The seed comes from crypto.getRandomValues at
// game start and the running state is persisted with the room, so every shuffle, target
// pick and tie-break is reproducible from the room log and never chosen by the host.

export interface RngHolder {
  rng: number;
}

/** mulberry32: returns a float in [0, 1) and advances the stored state. */
export function next(h: RngHolder): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(h: RngHolder, maxExclusive: number): number {
  return Math.floor(next(h) * maxExclusive);
}

export function pick<T>(h: RngHolder, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick from empty list");
  return items[int(h, items.length)];
}

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(h: RngHolder, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(h, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A random permutation where nobody maps to themselves (requires length >= 2). */
export function derangement(h: RngHolder, ids: readonly string[]): Map<string, string> {
  if (ids.length < 2) throw new Error("derangement needs at least 2 items");
  // Shuffle, then map each person to the next in the shuffled ring: a random single
  // cycle, which is always a derangement.
  const order = shuffle(h, ids);
  const map = new Map<string, string>();
  for (let i = 0; i < order.length; i++) map.set(order[i], order[(i + 1) % order.length]);
  return map;
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] | 0;
}
