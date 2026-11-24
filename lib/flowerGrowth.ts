/**
 * Parameterized Botanical Growth Engine
 * Shared by the Hero Sun-Flower and every Garden Flower so all plants grow
 * literally from a seed -> stem -> leaves -> bud -> bloom using the exact
 * same math and SVG path builders (zero duplicated growth code).
 */

import { clamp, easeInOutCubic, easeOutCubic, lerp } from "@/lib/math";

export const WORLD_W = 1120;
export const WORLD_H = 700;
export const HERO_BASE_X = 560;
export const HERO_BASE_Y = 515;
export const HERO_HEAD_Y = 220;

export interface CurvePt {
  x: number;
  y: number;
}

export type FlowerSpecies = "hero" | "lily" | "rose" | "tulip" | "bluebell" | "daisy";
export type PetalShape = "teardrop" | "lily" | "tulip" | "bell" | "daisy";

export interface StemParams {
  p0: CurvePt;
  p1: CurvePt;
  p2: CurvePt;
  p3: CurvePt;
  baseHalfW: number;
  tipTaper: number; // fraction of baseHalfW removed toward tip (e.g. 0.68)
  sampleCount: number;
  hookAmp: number;
}

export interface StemSampleResult {
  pts: CurvePt[];
  stemG: number;
  tip: CurvePt;
  tipAngleDeg: number;
  taperedOutline: string;
  centerLine: string;
}

export function cubicPoint(
  p0: CurvePt,
  p1: CurvePt,
  p2: CurvePt,
  p3: CurvePt,
  u: number
): CurvePt {
  const inv = 1 - u;
  return {
    x:
      inv * inv * inv * p0.x +
      3 * inv * inv * u * p1.x +
      3 * inv * u * u * p2.x +
      u * u * u * p3.x,
    y:
      inv * inv * inv * p0.y +
      3 * inv * inv * u * p1.y +
      3 * inv * u * u * p2.y +
      u * u * u * p3.y,
  };
}

export function sampleCubic(
  p0: CurvePt,
  p1: CurvePt,
  p2: CurvePt,
  p3: CurvePt,
  steps = 18
): CurvePt[] {
  return Array.from({ length: steps + 1 }, (_, i) =>
    cubicPoint(p0, p1, p2, p3, i / steps)
  );
}

export function windowEase(t: number, start: number, end: number): number {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return easeInOutCubic((t - start) / (end - start));
}

/**
 * Shared rolling wind wave across the wide garden so the hero flower,
 * all 3 garden rows, grass blades, and drifting particles sway together
 * with a natural horizontal phase delay.
 */
export function sampleWindWave(timeSec: number, worldX: number, amp = 1): number {
  const primary = Math.sin(timeSec * 0.85 - worldX * 0.0042);
  const harmonic = Math.sin(timeSec * 1.42 - worldX * 0.0068) * 0.28;
  return (primary + harmonic) * amp;
}

/**
 * Slices a pre-sampled polyline to fraction `g` in [0, 1] and returns an SVG path `d`
 * whose tip literally advances from point 0 to the end.
 */
export function buildPartialPolyline(pts: CurvePt[], g: number): string {
  if (g <= 0.002 || pts.length < 2) return "";
  const scaled = clamp(g, 0, 1) * (pts.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i <= idx; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  if (idx < pts.length - 1 && frac > 0.001) {
    const a = pts[idx];
    const b = pts[idx + 1];
    const tx = lerp(a.x, b.x, frac);
    const ty = lerp(a.y, b.y, frac);
    d += ` L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }
  return d;
}

/**
 * Computes a sampled stem centerline + tapered outline for ANY flower (hero or garden),
 * supporting seedling apical hook, base-anchored sway/wind, and optional wilt droop.
 */
export function computeStemCurve(
  params: StemParams,
  stemG: number,
  maturity: number,
  hookFactor: number,
  swayAngle: number,
  wiltG = 0
): StemSampleResult {
  if (stemG <= 0.002) {
    return {
      pts: [params.p0],
      stemG: 0,
      tip: params.p0,
      tipAngleDeg: 0,
      taperedOutline: "",
      centerLine: "",
    };
  }

  const cosS = Math.cos(swayAngle);
  const sinS = Math.sin(swayAngle);
  const count = params.sampleCount;
  const pts: CurvePt[] = [];

  for (let i = 0; i <= count; i++) {
    const frac = i / count; // 0 = base, 1 = current moving tip
    const u = frac * stemG;
    const basePt = cubicPoint(params.p0, params.p1, params.p2, params.p3, u);

    let hx = basePt.x;
    let hy = basePt.y;

    // Botanical seedling apical hook near advancing tip
    if (hookFactor > 0.001 && frac > 0.45 && params.hookAmp > 0) {
      const tipLocal = (frac - 0.45) / 0.55;
      const bend = tipLocal * tipLocal * hookFactor;
      hx += Math.sin(bend * Math.PI * 0.85) * params.hookAmp * hookFactor;
      hy += bend * (params.hookAmp * 1.22) * hookFactor;
    }

    // Optional wilt bend along upper 75% of stem
    if (wiltG > 0.001 && frac > 0.22) {
      const wLocal = (frac - 0.22) / 0.78;
      const bend = wLocal * wLocal * wiltG;
      hx += bend * 72;
      hy += bend * 92;
    }

    // Base-anchored sway around p0
    const dx = hx - params.p0.x;
    const dy = hy - params.p0.y;
    pts.push({
      x: params.p0.x + dx * cosS - dy * sinS,
      y: params.p0.y + dx * sinS + dy * cosS,
    });
  }

  const leftSide: string[] = [];
  const rightSide: string[] = [];
  let centerLine = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  for (let i = 0; i < pts.length; i++) {
    const frac = i / (pts.length - 1);
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;

    const halfW = params.baseHalfW * (1 - frac * params.tipTaper) * maturity;
    leftSide.push(`${(p.x + nx * halfW).toFixed(1)} ${(p.y + ny * halfW).toFixed(1)}`);
    rightSide.unshift(`${(p.x - nx * halfW).toFixed(1)} ${(p.y - ny * halfW).toFixed(1)}`);
    if (i > 0) centerLine += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }

  const tip = pts[pts.length - 1];
  const prevTip = pts[pts.length - 2];
  const tipAngleDeg =
    (Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x) * 180) / Math.PI + 90;

  return {
    pts,
    stemG,
    tip,
    tipAngleDeg,
    taperedOutline: `M ${leftSide.join(" L ")} L ${rightSide.join(" L ")} Z`,
    centerLine,
  };
}

/**
 * Samples exact position and local tangent angle (0 = straight up) at fixed full-stem
 * arc coordinate `nodeU` along the currently grown stem polyline.
 */
export function sampleStemAtU(
  pts: CurvePt[],
  stemG: number,
  nodeU: number
): { pt: CurvePt; tangentDeg: number } | null {
  if (stemG <= nodeU + 0.002 || pts.length < 2) return null;
  const localFrac = clamp(nodeU / stemG, 0, 1);
  const scaled = localFrac * (pts.length - 1);
  const idx = Math.min(pts.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  const a = pts[idx];
  const b = pts[idx + 1];
  const pt = { x: lerp(a.x, b.x, frac), y: lerp(a.y, b.y, frac) };
  const tangentDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
  return { pt, tangentDeg };
}

export function buildCotyledonPath(length: number, width: number): string {
  if (length <= 0.5) return "";
  const w = width.toFixed(1);
  const l = length.toFixed(1);
  return `M 0 0 C -${w} ${(-length * 0.35).toFixed(1)}, -${(width * 0.75).toFixed(1)} ${(-length * 0.92).toFixed(1)}, 0 -${l} C ${(width * 0.75).toFixed(1)} ${(-length * 0.92).toFixed(1)}, ${w} ${(-length * 0.35).toFixed(1)}, 0 0 Z`;
}

export function buildTrueLeafPaths(
  g: number,
  side: -1 | 1,
  maxPetiole: number,
  maxLength: number,
  maxWidth: number,
  wiltG = 0,
  includeVeins = true
): { stalk: string; blade: string; veins: string } {
  if (g <= 0.005) return { stalk: "", blade: "", veins: "" };

  const petioleG = easeOutCubic(clamp(g / 0.45, 0, 1));
  const pLen = maxPetiole * petioleG;

  const lenG = easeInOutCubic(clamp((g - 0.08) / 0.84, 0, 1));
  const widG = easeInOutCubic(clamp((g - 0.2) / 0.78, 0, 1));

  const bladeLen = maxLength * lenG * (1 - 0.14 * wiltG);
  const bladeW = maxWidth * (0.14 + 0.86 * widG) * (1 - 0.28 * wiltG);
  const curveX = side * bladeLen * (0.14 * widG + 0.36 * wiltG);

  const stalk = `M 0 0 Q ${(curveX * 0.12).toFixed(1)} ${(-pLen * 0.5).toFixed(1)}, ${(curveX * 0.18).toFixed(1)} ${(-pLen).toFixed(1)}`;

  if (bladeLen <= 1.2) {
    return { stalk, blade: "", veins: "" };
  }

  const bx = curveX * 0.18;
  const by = -pLen;
  const tipX = bx + curveX;
  const tipY = by - bladeLen;

  const l1x = bx - bladeW * 0.92 + curveX * 0.18;
  const l1y = by - bladeLen * 0.3;
  const l2x = bx - bladeW * 0.56 + curveX * 0.62;
  const l2y = by - bladeLen * 0.76;

  const r1x = bx + bladeW * 0.92 + curveX * 0.18;
  const r1y = by - bladeLen * 0.3;
  const r2x = bx + bladeW * 0.56 + curveX * 0.62;
  const r2y = by - bladeLen * 0.76;

  const blade =
    `M ${bx.toFixed(1)} ${by.toFixed(1)} ` +
    `C ${l1x.toFixed(1)} ${l1y.toFixed(1)}, ${l2x.toFixed(1)} ${l2y.toFixed(1)}, ${tipX.toFixed(1)} ${tipY.toFixed(1)} ` +
    `C ${r2x.toFixed(1)} ${r2y.toFixed(1)}, ${r1x.toFixed(1)} ${r1y.toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)} Z`;

  let veins = "";
  if (includeVeins) {
    const veinG = easeOutCubic(clamp((g - 0.25) / 0.7, 0, 1));
    if (veinG > 0.02) {
      const vTipX = lerp(bx, tipX, 0.88 * veinG);
      const vTipY = lerp(by, tipY, 0.88 * veinG);
      const vMidX = lerp(bx, tipX, 0.44 * veinG) + curveX * 0.08;
      const vMidY = lerp(by, tipY, 0.44 * veinG);
      veins = `M ${bx.toFixed(1)} ${by.toFixed(1)} Q ${vMidX.toFixed(1)} ${vMidY.toFixed(1)}, ${vTipX.toFixed(1)} ${vTipY.toFixed(1)}`;

      const branches = [0.28, 0.52, 0.74];
      for (const u of branches) {
        const bG = clamp((veinG - u) / 0.26, 0, 1);
        if (bG <= 0.02) continue;
        const sx = lerp(bx, tipX, u);
        const sy = lerp(by, tipY, u);
        const span = bladeW * (u === 0.52 ? 0.58 : 0.42) * bG;
        const rise = bladeLen * 0.14 * bG;
        veins += ` M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(sx - span).toFixed(1)} ${(sy - rise).toFixed(1)}`;
        veins += ` M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${(sx + span).toFixed(1)} ${(sy - rise).toFixed(1)}`;
      }
    }
  }

  return { stalk, blade, veins };
}

export function buildThornPath(g: number, side: -1 | 1, maxLength: number): string {
  if (g <= 0.02) return "";
  const len = maxLength * easeOutCubic(g);
  const baseHalf = 3.2 * (0.4 + 0.6 * g);
  const tipX = side * len;
  const tipY = -len * 0.48;
  return `M 0 ${baseHalf.toFixed(1)} Q ${(side * len * 0.42).toFixed(1)} ${(baseHalf * 0.15).toFixed(1)}, ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${(side * len * 0.32).toFixed(1)} ${(-baseHalf * 0.85).toFixed(1)}, 0 ${(-baseHalf).toFixed(1)} Z`;
}

export function buildSepalPath(length: number, width: number, curlX: number): string {
  if (length <= 0.8) return "";
  const l = length;
  const w = width;
  const tipX = curlX;
  const tipY = -l;
  return (
    `M 0 0 ` +
    `C ${(-w + curlX * 0.15).toFixed(1)} ${(-l * 0.32).toFixed(1)}, ${(-w * 0.62 + curlX * 0.55).toFixed(1)} ${(-l * 0.78).toFixed(1)}, ${tipX.toFixed(1)} ${tipY.toFixed(1)} ` +
    `C ${(w * 0.62 + curlX * 0.55).toFixed(1)} ${(-l * 0.78).toFixed(1)}, ${(w + curlX * 0.15).toFixed(1)} ${(-l * 0.32).toFixed(1)}, 0 0 Z`
  );
}

export function buildBudCorePath(length: number, width: number): string {
  if (length <= 0.8) return "";
  return (
    `M 0 0 ` +
    `C ${(-width).toFixed(1)} ${(-length * 0.28).toFixed(1)}, ${(-width * 0.82).toFixed(1)} ${(-length * 0.82).toFixed(1)}, 0 ${(-length).toFixed(1)} ` +
    `C ${(width * 0.82).toFixed(1)} ${(-length * 0.82).toFixed(1)}, ${(width).toFixed(1)} ${(-length * 0.28).toFixed(1)}, 0 0 Z`
  );
}

/**
 * Local-coordinate petal builder supporting 5 botanical species shapes with base at (0,0).
 */
export function buildPetalPaths(
  length: number,
  width: number,
  shape: PetalShape = "teardrop"
): { blade: string; vein: string } {
  if (length <= 1.0) return { blade: "", vein: "" };
  const l = length;
  const w = width;

  let blade = "";
  if (shape === "lily") {
    // Long, slender, gracefully tapered star-lily petal
    blade =
      `M 0 0 ` +
      `C ${(-w * 0.68).toFixed(1)} ${(-l * 0.26).toFixed(1)}, ${(-w * 0.82).toFixed(1)} ${(-l * 0.68).toFixed(1)}, 0 ${(-l).toFixed(1)} ` +
      `C ${(w * 0.82).toFixed(1)} ${(-l * 0.68).toFixed(1)}, ${(w * 0.68).toFixed(1)} ${(-l * 0.26).toFixed(1)}, 0 0 Z`;
  } else if (shape === "tulip") {
    // Broad cupped tulip petal with softly rounded apex
    blade =
      `M 0 0 ` +
      `C ${(-w * 1.15).toFixed(1)} ${(-l * 0.24).toFixed(1)}, ${(-w * 1.05).toFixed(1)} ${(-l * 0.88).toFixed(1)}, 0 ${(-l).toFixed(1)} ` +
      `C ${(w * 1.05).toFixed(1)} ${(-l * 0.88).toFixed(1)}, ${(w * 1.15).toFixed(1)} ${(-l * 0.24).toFixed(1)}, 0 0 Z`;
  } else if (shape === "bell") {
    // Flared bluebell petal
    blade =
      `M 0 0 ` +
      `C ${(-w * 0.55).toFixed(1)} ${(-l * 0.35).toFixed(1)}, ${(-w * 1.08).toFixed(1)} ${(-l * 0.82).toFixed(1)}, 0 ${(-l).toFixed(1)} ` +
      `C ${(w * 1.08).toFixed(1)} ${(-l * 0.82).toFixed(1)}, ${(w * 0.55).toFixed(1)} ${(-l * 0.35).toFixed(1)}, 0 0 Z`;
  } else if (shape === "daisy") {
    // Slender radiant ray petal with rounded tip
    blade =
      `M 0 0 ` +
      `C ${(-w * 0.72).toFixed(1)} ${(-l * 0.28).toFixed(1)}, ${(-w * 0.62).toFixed(1)} ${(-l * 0.92).toFixed(1)}, 0 ${(-l).toFixed(1)} ` +
      `C ${(w * 0.62).toFixed(1)} ${(-l * 0.92).toFixed(1)}, ${(w * 0.72).toFixed(1)} ${(-l * 0.28).toFixed(1)}, 0 0 Z`;
  } else {
    // Hero & Rose teardrop with pointed tip
    blade =
      `M 0 0 ` +
      `C ${(-w * 0.92).toFixed(1)} ${(-l * 0.3).toFixed(1)}, ${(-w * 0.72).toFixed(1)} ${(-l * 0.78).toFixed(1)}, 0 ${(-l).toFixed(1)} ` +
      `C ${(w * 0.72).toFixed(1)} ${(-l * 0.78).toFixed(1)}, ${(w * 0.92).toFixed(1)} ${(-l * 0.3).toFixed(1)}, 0 0 Z`;
  }

  const vein = `M 0 ${(-l * 0.08).toFixed(1)} Q ${(w * 0.06).toFixed(1)} ${(-l * 0.45).toFixed(1)}, 0 ${(-l * 0.84).toFixed(1)}`;
  return { blade, vein };
}

/**
 * Computes a full-bleed SVG viewBox whose aspect ratio ALWAYS matches the live
 * container aspect ratio (`containerAspect = cssW / cssH`), eliminating all
 * letterboxing and dead space on every desktop and phone viewport.
 *
 * Selects between two tailored compositions:
 * - Landscape (`containerAspect > 1.2`): wide 3-row garden, hero ~55% height, ground at ~78%
 * - Portrait (`containerAspect <= 1.2`): tall 4-row stacked garden, hero ~40% height, ground at ~74%
 */
export function computeWideCameraViewBox(
  t: number,
  heroTipY: number,
  gardenPullG = 0,
  containerAspect = 1.6
): { x: number; y: number; w: number; h: number } {
  const safeAspect = clamp(containerAspect || 1.6, 0.38, 2.8);
  const isPortrait = safeAspect <= 1.2;

  // 1. Seed -> Hero Growth Camera (0..12.6s)
  const zoomOutG = windowEase(t, 2.6, 12.2);
  const seedH = isPortrait ? 430 : 320;
  const heroSettledH = isPortrait ? 820 : 610;
  const heroH = lerp(seedH, heroSettledH, zoomOutG);
  const heroW = heroH * safeAspect;

  const seedFocusY = HERO_BASE_Y - 12 - heroH * 0.56;
  const tipTrackY = heroTipY - heroH * 0.36;
  const trackBlend = windowEase(t, 2.8, 5.0);
  const settleHero = windowEase(t, 9.2, 12.6);

  const heroSettledY = isPortrait
    ? HERO_BASE_Y - 0.7 * heroSettledH
    : HERO_BASE_Y - 0.78 * heroSettledH;
  const trackingY = lerp(seedFocusY, tipTrackY, trackBlend);
  const heroY = lerp(trackingY, heroSettledY, settleHero);
  const heroX = HERO_BASE_X - heroW * 0.5;

  // 2. Full Garden Camera Pull-Back (gardenPullG: 0 -> 1)
  const pullEased = easeInOutCubic(clamp(gardenPullG, 0, 1));
  const fullH = isPortrait ? 1015 : 740;
  const fullW = fullH * safeAspect;
  const fullX = HERO_BASE_X - fullW * 0.5;
  const fullY = isPortrait
    ? HERO_BASE_Y - 0.74 * fullH
    : HERO_BASE_Y - 0.78 * fullH;

  return {
    x: lerp(heroX, fullX, pullEased),
    y: lerp(heroY, fullY, pullEased),
    w: lerp(heroW, fullW, pullEased),
    h: lerp(heroH, fullH, pullEased),
  };
}
