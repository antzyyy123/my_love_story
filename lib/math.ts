/**
 * Deterministic math, seeded PRNG, golden-angle phyllotaxis,
 * and logarithmic spiral helpers shared across Floral Cosmos canvases.
 */

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.399963 rad
export const TAU = Math.PI * 2;
export const GALAXY_SCALE = 0.64; // Outer disc spans ~60-65% of viewport width
export const CAMERA_ELEVATION = 30; // 30° elevation -> elliptical disc height = 50% of width
export const GALAXY_BRIGHTNESS = 0.55; // Global brightness multiplier for galaxy particles

export type SeededRandom = () => number;

/**
 * Mulberry32 deterministic PRNG so procedural layouts remain stable across reloads.
 */
export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng: SeededRandom, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randomInt(rng: SeededRandom, min: number, max: number): number {
  return Math.floor(randomRange(rng, min, max + 1));
}

export function pickRandom<T>(rng: SeededRandom, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Box-Muller transform for Gaussian (normal) distribution centered at 0 (stdDev = 1).
 * Used for realistic spiral arm density falloff and central galactic bulge.
 */
export function gaussianRandom(rng: SeededRandom): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(TAU * u2);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function easeOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

export function easeInOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function easeOutBack(t: number): number {
  const c = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

export interface PolarPoint {
  x: number;
  y: number;
  r: number;
  angle: number;
}

/**
 * Golden-angle phyllotaxis point inside a circle of `maxRadius`.
 * Used for dense floral planets and the glowing Sun seed core.
 */
export function phyllotaxisPoint(
  index: number,
  total: number,
  maxRadius: number
): PolarPoint {
  const normalized = (index + 0.5) / Math.max(1, total);
  const r = maxRadius * Math.sqrt(normalized);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
    r,
    angle,
  };
}

/**
 * Logarithmic-style spiral ring placement keeping the inner center dark and clear.
 */
export function spiralRingPoint(
  armIndex: number,
  totalArms: number,
  t: number,
  innerRadius: number,
  outerRadius: number,
  spiralTwist: number,
  radialJitter: number,
  angularJitter: number
): PolarPoint {
  const baseAngle = (armIndex / totalArms) * TAU;
  // Subtle logarithmic radial progression for organic galaxy arms
  const logFactor = Math.log1p(t * (Math.E - 1));
  const r = Math.max(innerRadius * 0.92, lerp(innerRadius, outerRadius, logFactor) + radialJitter);
  const angle = baseAngle + t * spiralTwist + angularJitter;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
    r,
    angle,
  };
}
