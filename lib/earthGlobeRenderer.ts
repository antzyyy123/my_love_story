/**
 * Shared 3D Flowering Earth Globe Renderer (Canvas 2D)
 * Reused by both the Solar System's "Our First Date" Earth planet and the huge
 * Earth hanging in the sky of the hidden Lunar Surface scene.
 */

import { clamp, TAU } from "@/lib/math";

export interface EarthGlobeOptions {
  cx: number;
  cy: number;
  radius: number;
  spin: number;
  sunAngle2D: number;
  lx: number;
  ly: number;
  lz: number;
  cosYaw: number;
  sinYaw: number;
  cosElev: number;
  sinElev: number;
  overallAlpha?: number;
  /** Optional 0..1 reply pulse brightening village lights on Earth in rhythm */
  villagePulse?: number;
  /** Optional 0..1 glowing golden heart over the continent in reply to lunar signal */
  heartGlow?: number;
  /** Whether to highlight the tiny warm cafe glow on Earth's night/dusk side */
  showCafeGlow?: boolean;
}

const LAND_CLUSTERS = [
  { lon: 0.3, lat: 0.28, rx: 0.34, ry: 0.22, col: "#2e8b57", bloom: "#f9a8d4" },
  { lon: 0.72, lat: -0.18, rx: 0.26, ry: 0.24, col: "#3f9142", bloom: "#fde68a" },
  { lon: 1.95, lat: 0.14, rx: 0.38, ry: 0.26, col: "#2f7d4d", bloom: "#ddd6fe" },
  { lon: 2.38, lat: 0.36, rx: 0.22, ry: 0.16, col: "#a47c48", bloom: "#fbcfe8" },
  { lon: 3.45, lat: -0.26, rx: 0.32, ry: 0.20, col: "#348a54", bloom: "#fde68a" },
  { lon: 4.55, lat: 0.22, rx: 0.35, ry: 0.25, col: "#2b7a4b", bloom: "#f472b6" },
  { lon: 5.25, lat: -0.12, rx: 0.24, ry: 0.18, col: "#8c6d46", bloom: "#c4b5fd" },
];

const CLOUD_BANDS = [
  { lon: 0.4, lat: 0.35, rx: 0.30, ry: 0.09 },
  { lon: 1.5, lat: -0.05, rx: 0.36, ry: 0.10 },
  { lon: 2.8, lat: 0.22, rx: 0.28, ry: 0.08 },
  { lon: 3.9, lat: -0.32, rx: 0.34, ry: 0.09 },
  { lon: 5.1, lat: 0.10, rx: 0.32, ry: 0.09 },
];

export function drawFloweringEarthGlobe(
  ctx: CanvasRenderingContext2D,
  opts: EarthGlobeOptions
): { cafeX: number; cafeY: number } {
  const {
    cx,
    cy,
    radius: r,
    spin,
    sunAngle2D,
    lx,
    ly,
    lz,
    cosYaw,
    sinYaw,
    cosElev,
    sinElev,
    overallAlpha = 1,
    villagePulse = 0,
    heartGlow = 0,
    showCafeGlow = false,
  } = opts;

  let cafeX = cx - r * 0.18;
  let cafeY = cy + r * 0.12;

  // Soft sky-blue atmospheric halo
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const haloR = r * 1.48;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, haloR);
  halo.addColorStop(0, "rgba(96, 165, 250, 0.45)");
  halo.addColorStop(0.55, "rgba(56, 189, 248, 0.16)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.globalAlpha = overallAlpha;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Deep blue ocean sphere base
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  const litX = cx + Math.cos(sunAngle2D) * r * 0.42;
  const litY = cy + Math.sin(sunAngle2D) * r * 0.42;
  const ocean = ctx.createRadialGradient(litX, litY, r * 0.08, cx, cy, r * 1.08);
  ocean.addColorStop(0, "#38bdf8");
  ocean.addColorStop(0.35, "#1d4ed8");
  ocean.addColorStop(0.75, "#0c2d6b");
  ocean.addColorStop(1, "#040d24");
  ctx.globalAlpha = overallAlpha;
  ctx.fillStyle = ocean;
  ctx.fill();
  ctx.clip();

  // Rotating continents, blossoms & night-side village lights
  for (let ci = 0; ci < LAND_CLUSTERS.length; ci++) {
    const lc = LAND_CLUSTERS[ci];
    const lon = lc.lon + spin;
    const cosLat = Math.cos(lc.lat);
    const sx = Math.cos(lon) * cosLat;
    const sy = Math.sin(lon) * cosLat;
    const sz = Math.sin(lc.lat);

    const cxn = sx * cosYaw - sy * sinYaw;
    const cyn = sx * sinYaw + sy * cosYaw;
    const viewZ = cyn * cosElev + sz * sinElev;
    if (viewZ < 0.05) continue;

    const lxPos = cx + cxn * r;
    const lyPos = cy + (cyn * sinElev - sz * cosElev) * r;
    const nDotL = sx * lx + sy * ly + sz * lz;
    const lit = 0.24 + 0.76 * clamp((nDotL + 0.25) / 1.0, 0, 1);

    ctx.globalAlpha = clamp(lit * viewZ * 1.15 * overallAlpha, 0.14, 0.94);
    ctx.fillStyle = lc.col;
    ctx.beginPath();
    ctx.ellipse(lxPos, lyPos, r * lc.rx * (0.28 + 0.72 * viewZ), r * lc.ry, 0.25 * ci, 0, TAU);
    ctx.fill();

    // Sunlit blossom clusters
    if (nDotL > -0.08) {
      ctx.fillStyle = lc.bloom;
      ctx.globalAlpha = clamp(lit * viewZ * 0.9 * overallAlpha, 0.15, 0.9);
      const bR = Math.max(1.2, r * 0.045);
      ctx.beginPath();
      ctx.arc(lxPos - r * 0.07 * viewZ, lyPos - r * 0.04, bR, 0, TAU);
      ctx.arc(lxPos + r * 0.08 * viewZ, lyPos + r * 0.05, bR * 0.85, 0, TAU);
      ctx.arc(lxPos + r * 0.02 * viewZ, lyPos - r * 0.08, bR * 0.75, 0, TAU);
      ctx.fill();
    }

    // Night-side village lights (brightening during lunar signal reply)
    if (nDotL < 0.08 || villagePulse > 0.05) {
      const nightStr = clamp((-nDotL + 0.08) / 0.55, 0, 1);
      const boost = Math.max(nightStr, villagePulse);
      ctx.fillStyle = `rgba(254, 240, 138, ${(boost * (0.75 + villagePulse * 0.25) * overallAlpha).toFixed(3)})`;
      const dotR = Math.max(1.1, r * (0.026 + villagePulse * 0.016));
      ctx.beginPath();
      ctx.arc(lxPos, lyPos, dotR, 0, TAU);
      ctx.arc(lxPos + r * 0.06 * viewZ, lyPos - r * 0.03, dotR * 0.85, 0, TAU);
      ctx.arc(lxPos - r * 0.05 * viewZ, lyPos + r * 0.04, dotR * 0.75, 0, TAU);
      ctx.fill();

      if (ci === 1 || ci === 4) {
        cafeX = lxPos;
        cafeY = lyPos;
      }
    }
  }

  // Polar caps
  ctx.globalAlpha = 0.78 * overallAlpha;
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.90, r * 0.44, r * 0.14, 0, 0, TAU);
  ctx.ellipse(cx, cy + r * 0.92, r * 0.36, r * 0.11, 0, 0, TAU);
  ctx.fill();

  // Faster-rotating translucent cloud layer
  const cloudSpin = spin * 1.28;
  for (const cb of CLOUD_BANDS) {
    const lon = cb.lon + cloudSpin;
    const cosLat = Math.cos(cb.lat);
    const sx = Math.cos(lon) * cosLat;
    const sy = Math.sin(lon) * cosLat;
    const sz = Math.sin(cb.lat);
    const cxn = sx * cosYaw - sy * sinYaw;
    const cyn = sx * sinYaw + sy * cosYaw;
    const viewZ = cyn * cosElev + sz * sinElev;
    if (viewZ < 0.06) continue;
    const nDotL = sx * lx + sy * ly + sz * lz;
    const lit = 0.22 + 0.78 * clamp((nDotL + 0.2) / 1.0, 0, 1);
    ctx.globalAlpha = clamp(lit * viewZ * 0.54 * overallAlpha, 0.08, 0.6);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(
      cx + cxn * r,
      cy + (cyn * sinElev - sz * cosElev) * r,
      r * cb.rx * (0.25 + 0.75 * viewZ),
      r * cb.ry,
      0.12,
      0,
      TAU
    );
    ctx.fill();
  }

  // Soft day/night terminator
  const nightX = cx - Math.cos(sunAngle2D) * r * 0.52;
  const nightY = cy - Math.sin(sunAngle2D) * r * 0.52;
  const term = ctx.createRadialGradient(nightX, nightY, r * 0.05, nightX, nightY, r * 1.25);
  term.addColorStop(0, "rgba(4, 6, 22, 0.62)");
  term.addColorStop(0.55, "rgba(4, 6, 22, 0.22)");
  term.addColorStop(1, "rgba(4, 6, 22, 0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = term;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Tiny warm cafe beacon on Earth's night side (for the Lunar scene)
  if (showCafeGlow) {
    const cg = ctx.createRadialGradient(cafeX, cafeY, 0, cafeX, cafeY, r * 0.14);
    cg.addColorStop(0, "#fffbeb");
    cg.addColorStop(0.35, "rgba(253, 224, 71, 0.75)");
    cg.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cafeX, cafeY, r * 0.14, 0, TAU);
    ctx.fill();
  }

  // Village lights forming a glowing golden HEART over the continent in reply to lunar signal!
  if (heartGlow > 0.02) {
    const hx0 = cx - r * 0.08;
    const hy0 = cy + r * 0.04;
    const hScale = r * 0.021;
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      const hx = hx0 + 16 * Math.pow(Math.sin(a), 3) * hScale;
      const hy = hy0 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * hScale;
      const dotR = Math.max(1.6, r * 0.022);
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, dotR * 3.5);
      hg.addColorStop(0, `rgba(255, 251, 235, ${(heartGlow * 0.95).toFixed(3)})`);
      hg.addColorStop(0.45, `rgba(253, 224, 71, ${(heartGlow * 0.65).toFixed(3)})`);
      hg.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, dotR * 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();

  // Thin sky-blue sunlit atmospheric rim arc
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "#7dd3fc";
  ctx.globalAlpha = 0.68 * overallAlpha;
  ctx.lineWidth = Math.max(1.5, r * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.99, sunAngle2D - 1.15, sunAngle2D + 1.15);
  ctx.stroke();
  ctx.restore();

  return { cafeX, cafeY };
}
