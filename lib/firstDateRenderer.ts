/**
 * Canvas 2D Renderer for "Our First Date" — Lantern Festival by a Calm Lake
 * Pre-renders static backdrop (sky, aurora haze, moon, 3 layered hills, lake base,
 * wooden dock with table & basket) AND 3x3 lantern sprites to offscreen canvases
 * for steady 60fps on laptops and 30+ on phones.
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

interface BgStar {
  x: number;
  y: number;
  r: number;
  phase: number;
  color: string;
}

interface AmbientLantern {
  x: number;
  y: number;
  vy: number;
  vx: number;
  scale: number;
  phase: number;
  tintIdx: number;
}

interface ShoreFirefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  blinkSpeed: number;
}

interface WaterRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
}

interface IgniteBurst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ReleasedLantern {
  id: number;
  kind: "sky" | "water";
  x: number;
  y: number;
  vx: number;
  vy: number;
  sizeIdx: 0 | 1 | 2;
  tintIdx: 0 | 1 | 2;
  age: number;
  phase: number;
  scale: number;
  memoryText: string | null;
  memoryAge: number;
  // Heart finale targeting
  inHeart: boolean;
  heartStartX: number;
  heartStartY: number;
  heartTargetX: number;
  heartTargetY: number;
  heartDelay: number;
}

export interface FirstDateState {
  w: number;
  h: number;
  dpr: number;
  isPortrait: boolean;
  isMobile: boolean;
  horizonY: number;
  moonX: number;
  moonY: number;
  moonR: number;
  dockX: number;
  dockY: number;
  candleX: number;
  candleY: number;
  basketX: number;
  basketY: number;
  staticCanvas: HTMLCanvasElement;
  lanternSprites: HTMLCanvasElement[][]; // [sizeIdx 0..2][tintIdx 0..2]
  stars: BgStar[];
  ambientLanterns: AmbientLantern[];
  fireflies: ShoreFirefly[];
  lanterns: ReleasedLantern[];
  ripples: WaterRipple[];
  bursts: IgniteBurst[];
  nextId: number;
  finaleActive: boolean;
  finaleElapsed: number;
}

const LANTERN_TINTS: Array<{ top: string; mid: string; core: string; halo: string }> = [
  { top: "#d97706", mid: "#f59e0b", core: "#fffbeb", halo: "rgba(253, 224, 71, 0.34)" }, // warm amber
  { top: "#be185d", mid: "#f472b6", core: "#fff1f2", halo: "rgba(244, 114, 182, 0.32)" }, // lantern rose
  { top: "#c2410c", mid: "#fb923c", core: "#fef3c7", halo: "rgba(251, 146, 60, 0.34)" }, // peach flame
];

/**
 * Pre-renders a single rounded paper lantern sprite with translucent vertical ribs,
 * warm amber-to-rose gradient, inner flame, soft halo, and thin wooden base.
 */
function buildLanternSprite(
  baseRadius: number,
  tint: { top: string; mid: string; core: string; halo: string }
): HTMLCanvasElement {
  const pad = Math.ceil(baseRadius * 2.4);
  const cw = pad * 2;
  const ch = pad * 2;
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const cx = pad;
  const cy = pad;
  const rx = baseRadius * 0.72;
  const ry = baseRadius * 0.95;

  // Soft additive-style halo baked into sprite for fast single drawImage
  const haloGrad = ctx.createRadialGradient(cx, cy + ry * 0.1, rx * 0.2, cx, cy, baseRadius * 2.2);
  haloGrad.addColorStop(0, tint.halo);
  haloGrad.addColorStop(0.55, "rgba(251, 191, 36, 0.10)");
  haloGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 2.2, 0, TAU);
  ctx.fill();

  // Rounded paper body
  const bodyGrad = ctx.createRadialGradient(
    cx,
    cy + ry * 0.32,
    rx * 0.12,
    cx,
    cy,
    ry * 1.15
  );
  bodyGrad.addColorStop(0, tint.core);
  bodyGrad.addColorStop(0.45, tint.mid);
  bodyGrad.addColorStop(1, tint.top);

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.52, cy + ry * 0.85);
  ctx.bezierCurveTo(cx - rx * 1.15, cy + ry * 0.2, cx - rx * 1.05, cy - ry * 0.85, cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * 1.05, cy - ry * 0.85, cx + rx * 1.15, cy + ry * 0.2, cx + rx * 0.52, cy + ry * 0.85);
  ctx.closePath();
  ctx.fill();

  // Translucent panel ribs
  ctx.strokeStyle = "rgba(120, 53, 15, 0.26)";
  ctx.lineWidth = Math.max(0.7, baseRadius * 0.045);
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry * 0.96);
  ctx.quadraticCurveTo(cx - rx * 0.45, cy, cx - rx * 0.28, cy + ry * 0.82);
  ctx.moveTo(cx, cy - ry * 0.96);
  ctx.quadraticCurveTo(cx + rx * 0.45, cy, cx + rx * 0.28, cy + ry * 0.82);
  ctx.stroke();

  // Glowing inner flame core
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.38, rx * 0.24, ry * 0.26, 0, 0, TAU);
  ctx.fill();

  // Thin dark wooden base rim
  ctx.strokeStyle = "rgba(69, 26, 3, 0.78)";
  ctx.lineWidth = Math.max(1.1, baseRadius * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.52, cy + ry * 0.86);
  ctx.lineTo(cx + rx * 0.52, cy + ry * 0.86);
  ctx.stroke();

  return c;
}

function buildStaticLayer(state: FirstDateState) {
  const { w, h, dpr, horizonY, moonX, moonY, moonR, dockX, dockY, isPortrait } = state;
  const off = state.staticCanvas;
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // 1. Deep Indigo -> Violet Night Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, "#07071a");
  skyGrad.addColorStop(0.5, "#171133");
  skyGrad.addColorStop(0.84, "#2d1a4a");
  skyGrad.addColorStop(1, "#442254");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY + 2);

  // Gentle Aurora-like Haze Ribbons
  const aur1 = ctx.createLinearGradient(0, horizonY * 0.15, w, horizonY * 0.45);
  aur1.addColorStop(0, "rgba(139, 92, 246, 0)");
  aur1.addColorStop(0.32, "rgba(139, 92, 246, 0.11)");
  aur1.addColorStop(0.65, "rgba(236, 72, 153, 0.10)");
  aur1.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = aur1;
  ctx.beginPath();
  ctx.moveTo(-40, horizonY * 0.36);
  ctx.quadraticCurveTo(w * 0.32, horizonY * 0.12, w * 0.62, horizonY * 0.28);
  ctx.quadraticCurveTo(w * 0.85, horizonY * 0.38, w + 40, horizonY * 0.18);
  ctx.lineTo(w + 40, horizonY * 0.56);
  ctx.quadraticCurveTo(w * 0.5, horizonY * 0.42, -40, horizonY * 0.58);
  ctx.closePath();
  ctx.fill();

  // 2. Large Warm Moon Low on the Horizon
  const moonHalo = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 3.8);
  moonHalo.addColorStop(0, "rgba(254, 240, 138, 0.42)");
  moonHalo.addColorStop(0.35, "rgba(251, 191, 36, 0.16)");
  moonHalo.addColorStop(0.7, "rgba(236, 72, 153, 0.06)");
  moonHalo.addColorStop(1, "rgba(236, 72, 153, 0)");
  ctx.fillStyle = moonHalo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 3.8, 0, TAU);
  ctx.fill();

  const moonDisc = ctx.createRadialGradient(
    moonX - moonR * 0.22,
    moonY - moonR * 0.22,
    moonR * 0.1,
    moonX,
    moonY,
    moonR
  );
  moonDisc.addColorStop(0, "#fffbeb");
  moonDisc.addColorStop(0.62, "#fde68a");
  moonDisc.addColorStop(1, "#f59e0b");
  ctx.fillStyle = moonDisc;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, TAU);
  ctx.fill();

  // 3. Three Overscanned Layered Hill Silhouettes + Mist along Horizon
  const hillLayers = [
    { yOff: -42, peak: 52, color: "#191336" },
    { yOff: -22, peak: 38, color: "#120e29" },
    { yOff: -6, peak: 22, color: "#0b091c" },
  ];
  hillLayers.forEach((hl, idx) => {
    ctx.fillStyle = hl.color;
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, horizonY + 4);
    ctx.quadraticCurveTo(
      w * (0.18 + idx * 0.06),
      horizonY + hl.yOff - hl.peak,
      w * 0.48,
      horizonY + hl.yOff * 0.45
    );
    ctx.quadraticCurveTo(
      w * (0.78 - idx * 0.04),
      horizonY + hl.yOff - hl.peak * 0.78,
      w * 1.15,
      horizonY + 4
    );
    ctx.closePath();
    ctx.fill();
  });

  // Soft horizon mist
  const mistGrad = ctx.createLinearGradient(0, horizonY - 36, 0, horizonY + 12);
  mistGrad.addColorStop(0, "rgba(196, 181, 253, 0)");
  mistGrad.addColorStop(0.65, "rgba(251, 191, 36, 0.08)");
  mistGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = mistGrad;
  ctx.fillRect(-w * 0.1, horizonY - 36, w * 1.2, 48);

  // 4. Calm Lake Base (lower 40% of screen)
  const lakeGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  lakeGrad.addColorStop(0, "#1d1438");
  lakeGrad.addColorStop(0.28, "#120f2c");
  lakeGrad.addColorStop(0.7, "#09081b");
  lakeGrad.addColorStop(1, "#050511");
  ctx.fillStyle = lakeGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY + 4);

  // Soft horizon water-line shimmer
  ctx.strokeStyle = "rgba(254, 240, 138, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(w, horizonY);
  ctx.stroke();

  // 5. Cozy Wooden Dock on the Left Shore with Table for Two (2 cups, candle) & Lantern Basket
  const s = isPortrait ? clamp(w / 430, 0.78, 1.05) : clamp(w / 1200, 0.85, 1.18);
  const dockLen = (isPortrait ? 132 : 185) * s;
  const dockH = 14 * s;

  // Dock water reflection shadow
  ctx.fillStyle = "rgba(4, 4, 14, 0.52)";
  ctx.fillRect(0, dockY + dockH, dockLen * 0.96, 36 * s);

  // Wooden pilings
  ctx.fillStyle = "#18101c";
  const postXs = [dockLen * 0.28, dockLen * 0.62, dockLen * 0.92];
  for (const px of postXs) {
    ctx.fillRect(px - 3.5 * s, dockY + dockH * 0.6, 7 * s, 32 * s);
  }

  // Dock deck planks
  const plankGrad = ctx.createLinearGradient(0, dockY, 0, dockY + dockH);
  plankGrad.addColorStop(0, "#2f1e26");
  plankGrad.addColorStop(1, "#1a1118");
  ctx.fillStyle = plankGrad;
  ctx.beginPath();
  ctx.moveTo(-10, dockY);
  ctx.lineTo(dockLen, dockY + 2 * s);
  ctx.lineTo(dockLen - 4 * s, dockY + dockH);
  ctx.lineTo(-10, dockY + dockH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(253, 224, 71, 0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Small cozy table for two on the dock
  const tblX = dockX + 58 * s;
  const tblY = dockY - 24 * s;
  ctx.strokeStyle = "#261820";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(tblX - 18 * s, dockY + 2 * s);
  ctx.lineTo(tblX - 15 * s, tblY + 2 * s);
  ctx.moveTo(tblX + 18 * s, dockY + 2 * s);
  ctx.lineTo(tblX + 15 * s, tblY + 2 * s);
  ctx.stroke();

  // Table top
  ctx.fillStyle = "#3a252d";
  ctx.beginPath();
  ctx.roundRect(tblX - 24 * s, tblY - 3 * s, 48 * s, 6 * s, 3 * s);
  ctx.fill();

  // Two small warm cups on the table
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(tblX - 16 * s, tblY - 10 * s, 6 * s, 7 * s);
  ctx.fillRect(tblX + 10 * s, tblY - 10 * s, 6 * s, 7 * s);

  // Candle stub at table center (flickering flame drawn dynamically)
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(tblX - 2.2 * s, tblY - 11 * s, 4.4 * s, 8 * s);

  // Woven lantern basket beside the table
  const bskX = dockX + 18 * s;
  const bskY = dockY - 2 * s;
  ctx.fillStyle = "#3b2318";
  ctx.strokeStyle = "rgba(251, 191, 36, 0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bskX - 11 * s, bskY - 13 * s);
  ctx.lineTo(bskX + 11 * s, bskY - 13 * s);
  ctx.lineTo(bskX + 8 * s, bskY + 2 * s);
  ctx.lineTo(bskX - 8 * s, bskY + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Soft folded lantern glowing faintly inside the basket
  ctx.fillStyle = "rgba(253, 224, 71, 0.55)";
  ctx.beginPath();
  ctx.ellipse(bskX, bskY - 14 * s, 7 * s, 4 * s, 0, Math.PI, TAU);
  ctx.fill();
}

export function createFirstDateState(
  cssW: number,
  cssH: number,
  dpr: number,
  seed = 20261124
): FirstDateState {
  const rng = createSeededRandom(seed + 404);
  const w = Math.max(320, cssW);
  const h = Math.max(320, cssH);
  const isPortrait = w / h <= 1.2;
  const isMobile = w < 768;

  const horizonY = h * 0.6;
  const moonR = isPortrait ? clamp(w * 0.11, 34, 52) : clamp(h * 0.085, 42, 66);
  const moonX = w * (isPortrait ? 0.74 : 0.77);
  const moonY = horizonY - moonR * 0.78;

  const s = isPortrait ? clamp(w / 430, 0.78, 1.05) : clamp(w / 1200, 0.85, 1.18);
  const dockX = 0;
  const dockY = horizonY + (h - horizonY) * (isPortrait ? 0.36 : 0.32);
  const candleX = dockX + 58 * s;
  const candleY = dockY - 36 * s;
  const basketX = dockX + 18 * s;
  const basketY = dockY - 18 * s;

  // Pre-render 3 sizes x 3 warm tints lantern sprites
  const sizes = [11, 16, 22];
  const lanternSprites = sizes.map((sz) =>
    LANTERN_TINTS.map((tint) => buildLanternSprite(sz, tint))
  );

  const stars: BgStar[] = Array.from({ length: isMobile ? 55 : 95 }, (_, i) => ({
    x: randomRange(rng, 0.02, 0.98),
    y: randomRange(rng, 0.03, 0.56),
    r: randomRange(rng, 0.55, 1.55),
    phase: randomRange(rng, 0, TAU),
    color: i % 4 === 0 ? "#fde68a" : i % 3 === 0 ? "#fbcfe8" : "#f8fafc",
  }));

  // Distant ambient lanterns already drifting far away
  const ambientCount = isMobile ? 7 : 13;
  const ambientLanterns: AmbientLantern[] = Array.from({ length: ambientCount }, (_, i) => ({
    x: randomRange(rng, w * 0.08, w * 0.92),
    y: randomRange(rng, h * 0.08, horizonY - 24),
    vy: randomRange(rng, 4.5, 9.5),
    vx: randomRange(rng, -4, 6),
    scale: randomRange(rng, 0.24, 0.42),
    phase: randomRange(rng, 0, TAU),
    tintIdx: i % 3,
  }));

  // Fireflies drifting near the left shore & dock
  const ffCount = isMobile ? 12 : 22;
  const fireflies: ShoreFirefly[] = Array.from({ length: ffCount }, () => ({
    x: randomRange(rng, 10, Math.min(w * 0.45, 320)),
    y: randomRange(rng, horizonY - 50, h * 0.88),
    vx: randomRange(rng, -9, 9),
    vy: randomRange(rng, -7, 7),
    r: randomRange(rng, 1.3, 2.5),
    phase: randomRange(rng, 0, TAU),
    blinkSpeed: randomRange(rng, 1.4, 2.6),
  }));

  const state: FirstDateState = {
    w,
    h,
    dpr,
    isPortrait,
    isMobile,
    horizonY,
    moonX,
    moonY,
    moonR,
    dockX,
    dockY,
    candleX,
    candleY,
    basketX,
    basketY,
    staticCanvas: document.createElement("canvas"),
    lanternSprites,
    stars,
    ambientLanterns,
    fireflies,
    lanterns: [],
    ripples: [],
    bursts: [],
    nextId: 1,
    finaleActive: false,
    finaleElapsed: 0,
  };

  buildStaticLayer(state);
  return state;
}

/**
 * Releases a sky or floating water lantern at (x, y) carrying `memoryText`.
 * Enforces the ~40 desktop / 24 mobile cap by recycling the oldest non-heart lantern.
 */
export function releaseLantern(
  state: FirstDateState,
  x: number,
  y: number,
  memoryText: string | null
) {
  const kind: "sky" | "water" = y >= state.horizonY ? "water" : "sky";
  const maxLanterns = state.isMobile ? 26 : 42;

  // Recycle oldest non-heart lantern if at cap
  if (state.lanterns.length >= maxLanterns) {
    const idx = state.lanterns.findIndex((l) => !l.inHeart);
    if (idx !== -1) state.lanterns.splice(idx, 1);
  }

  const id = state.nextId++;
  const sizeIdx = ((id % 3) as 0 | 1 | 2);
  const tintIdx = (((id + 1) % 3) as 0 | 1 | 2);

  state.lanterns.push({
    id,
    kind,
    x: clamp(x, 24, state.w - 24),
    y: kind === "water" ? clamp(y, state.horizonY + 14, state.h - 32) : clamp(y, 44, state.horizonY - 12),
    vx: kind === "water" ? 8 + (id % 5) * 2.2 : (id % 2 === 0 ? 1 : -1) * (4 + (id % 4) * 2),
    vy: kind === "water" ? 0 : -(16 + (id % 5) * 3.5),
    sizeIdx,
    tintIdx,
    age: 0,
    phase: (id * 1.37) % TAU,
    scale: 0.92 + (id % 4) * 0.06,
    memoryText,
    memoryAge: 0,
    inHeart: false,
    heartStartX: x,
    heartStartY: y,
    heartTargetX: x,
    heartTargetY: y,
    heartDelay: 0,
  });

  // Ignite flame burst for sky lanterns, or water ripples for floating lake lanterns
  if (kind === "water") {
    state.ripples.push(
      { x, y: clamp(y, state.horizonY + 14, state.h - 24), r: 4, maxR: 48, life: 0, maxLife: 1.5 },
      { x, y: clamp(y, state.horizonY + 14, state.h - 24), r: 2, maxR: 32, life: -0.25, maxLife: 1.4 }
    );
  } else {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + (id % 3) * 0.3;
      const spd = 22 + (i % 3) * 14;
      state.bursts.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 8,
        life: 0,
        maxLife: 0.65,
        color: i % 2 === 0 ? "#fef08a" : "#fbcfe8",
      });
    }
  }
}

/**
 * Triggers the Heart Finale: all existing sky lanterns glide into a glowing heart
 * above the lake, joined by additional soft festival lanterns to form ~34 lights
 * (24 on mobile) hanging gracefully over the water.
 */
export function triggerHeartFinale(state: FirstDateState) {
  if (state.finaleActive) return;
  state.finaleActive = true;
  state.finaleElapsed = 0;

  const targetCount = state.isMobile ? 24 : 34;
  const heartCx = state.w * 0.5;
  const heartCy = state.horizonY * (state.isPortrait ? 0.44 : 0.46);
  const heartScale = state.isPortrait
    ? clamp(state.w / 46, 5.8, 9.2)
    : clamp(Math.min(state.w / 72, state.horizonY / 38), 7.5, 11.5);

  const skyLanterns = state.lanterns.filter((l) => l.kind === "sky");

  // Spawn warm festival lanterns from the horizon/sides so the heart is lush & complete
  while (skyLanterns.length < targetCount) {
    const id = state.nextId++;
    const sideX = (id % 2 === 0 ? 0.14 : 0.86) * state.w + ((id * 37) % 140) - 70;
    const startY = state.horizonY - 16 - ((id * 29) % Math.max(40, state.horizonY * 0.5));
    const nl: ReleasedLantern = {
      id,
      kind: "sky",
      x: clamp(sideX, 30, state.w - 30),
      y: startY,
      vx: 0,
      vy: 0,
      sizeIdx: (id % 2 === 0 ? 0 : 1) as 0 | 1 | 2,
      tintIdx: (id % 3) as 0 | 1 | 2,
      age: 1,
      phase: (id * 1.13) % TAU,
      scale: 0.72 + (id % 3) * 0.08,
      memoryText: null,
      memoryAge: 99,
      inHeart: true,
      heartStartX: clamp(sideX, 30, state.w - 30),
      heartStartY: startY,
      heartTargetX: heartCx,
      heartTargetY: heartCy,
      heartDelay: 0,
    };
    state.lanterns.push(nl);
    skyLanterns.push(nl);
  }

  // Assign parametric heart targets around (heartCx, heartCy)
  skyLanterns.slice(0, targetCount).forEach((l, i) => {
    const u = (i / targetCount) * TAU;
    const s = Math.sin(u);
    const hx = 16 * s * s * s;
    const hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
    l.inHeart = true;
    l.heartStartX = l.x;
    l.heartStartY = l.y;
    l.heartTargetX = heartCx + hx * heartScale;
    l.heartTargetY = heartCy + hy * heartScale;
    l.heartDelay = (i / targetCount) * 0.45;
  });
}

function drawWrappedMemoryText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  canvasW: number,
  canvasH: number,
  alpha: number
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.font = "300 13px var(--font-sans), system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const lineH = 17;
  const totalH = lines.length * lineH;
  const safeX = clamp(x, maxWidth * 0.5 + 16, canvasW - maxWidth * 0.5 - 16);
  const safeY = clamp(y, totalH + 54, canvasH - 84);

  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(4, 4, 14, 0.92)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#fef9c3";

  lines.forEach((line, idx) => {
    const ly = safeY - (lines.length - 1 - idx) * lineH;
    ctx.fillText(line, safeX, ly);
  });
  ctx.restore();
}

export function renderFirstDateFrame(
  ctx: CanvasRenderingContext2D,
  state: FirstDateState,
  dt: number,
  elapsed: number,
  reducedMotion: boolean
) {
  const { w, h, horizonY, moonX, moonY, moonR, candleX, candleY } = state;

  if (state.finaleActive) {
    state.finaleElapsed += dt;
  }

  // 1. Blit pre-rendered static sky, aurora, moon, 3 hills, lake base & wooden dock
  ctx.drawImage(state.staticCanvas, 0, 0, w, h);

  // 2. Soft twinkling stars in the sky
  for (const st of state.stars) {
    const tw = 0.4 + 0.6 * Math.sin(elapsed * 1.5 + st.phase);
    ctx.globalAlpha = 0.72 * tw;
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 3. Wavy Moon Reflection on the Calm Lake
  ctx.save();
  const moonRefY = horizonY + (horizonY - moonY) * 0.85;
  const strips = state.isMobile ? 10 : 18;
  for (let i = 0; i < strips; i++) {
    const f = i / strips;
    const ry = horizonY + 8 + f * Math.min(h - horizonY - 14, moonR * 3.4);
    const wave = reducedMotion ? 0 : Math.sin(elapsed * 1.9 + i * 0.7) * (3 + f * 6);
    const rw = moonR * (1.05 - f * 0.55);
    const alpha = (1 - f * 0.72) * 0.24;
    ctx.fillStyle = `rgba(254, 240, 138, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(moonX + wave, ry, rw, 2.2 + f * 1.2, 0, 0, TAU);
    ctx.fill();
  }
  // Subtle moon glow mirror pool
  const mPool = ctx.createRadialGradient(moonX, moonRefY, 4, moonX, moonRefY, moonR * 1.8);
  mPool.addColorStop(0, "rgba(253, 224, 71, 0.16)");
  mPool.addColorStop(1, "rgba(253, 224, 71, 0)");
  ctx.fillStyle = mPool;
  ctx.beginPath();
  ctx.ellipse(moonX, moonRefY, moonR * 1.8, moonR * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 4. Distant Ambient Lanterns Drifting Far Away
  for (const al of state.ambientLanterns) {
    if (!reducedMotion) {
      al.y -= al.vy * dt;
      al.x += (al.vx + Math.sin(elapsed * 0.7 + al.phase) * 4) * dt;
      if (al.y < -20) {
        al.y = horizonY - 12;
        al.x = ((al.x + w * 0.31) % (w * 0.88)) + w * 0.06;
      }
    }
    const spr = state.lanternSprites[0][al.tintIdx];
    const sw = spr.width * al.scale;
    const sh = spr.height * al.scale;
    const fadeTop = clamp(al.y / 65, 0, 1);
    ctx.globalAlpha = 0.42 * fadeTop;
    ctx.drawImage(spr, al.x - sw * 0.5, al.y - sh * 0.5, sw, sh);
  }
  ctx.globalAlpha = 1;

  // 5. Update & Draw Released Lanterns + Their Mirrored Lake Reflections
  for (let i = state.lanterns.length - 1; i >= 0; i--) {
    const l = state.lanterns[i];
    l.age += dt;
    if (l.memoryText) l.memoryAge += dt;

    if (l.inHeart && state.finaleActive) {
      const gRaw = clamp((state.finaleElapsed - l.heartDelay) / 2.6, 0, 1);
      const g = easeInOutCubic(gRaw);
      const swayX = reducedMotion ? 0 : Math.sin(elapsed * 0.95 + l.phase) * 3.5;
      const swayY = reducedMotion ? 0 : Math.cos(elapsed * 0.8 + l.phase) * 2.5;
      l.x = lerp(l.heartStartX, l.heartTargetX, g) + swayX * g;
      l.y = lerp(l.heartStartY, l.heartTargetY, g) + swayY * g;
    } else if (!reducedMotion) {
      if (l.kind === "sky") {
        l.y += l.vy * dt;
        l.x += (l.vx + Math.sin(elapsed * 1.1 + l.phase) * 8) * dt;
        if (l.y < -36) {
          state.lanterns.splice(i, 1);
          continue;
        }
      } else {
        // Floating water lantern drifts gently along the lake
        l.x += l.vx * dt;
        l.y += Math.sin(elapsed * 1.3 + l.phase) * 2.2 * dt;
        if (l.x > w + 40) l.x = -30;
        if (l.x < -40) l.x = w + 30;
      }
    } else if (!l.inHeart && l.age > 6.5) {
      state.lanterns.splice(i, 1);
      continue;
    }

    const spr = state.lanternSprites[l.sizeIdx][l.tintIdx];
    const igniteG = easeOutCubic(clamp(l.age / 0.35, 0, 1));
    const flicker = 0.92 + 0.08 * Math.sin(elapsed * 6.5 + l.phase);
    const heightScale =
      l.kind === "sky" && !l.inHeart
        ? lerp(0.55, 1.0, clamp(l.y / horizonY, 0, 1))
        : 1;
    const drawScale = l.scale * igniteG * heightScale * flicker;
    const sw = spr.width * drawScale;
    const sh = spr.height * drawScale;
    const topFade = l.kind === "sky" && !l.inHeart ? clamp(l.y / 70, 0, 1) : 1;
    const reducedFade =
      reducedMotion && !l.inHeart && l.age > 5.2 ? clamp(1 - (l.age - 5.2) / 1.3, 0, 1) : 1;
    const alpha = igniteG * topFade * reducedFade;

    // Wavy Mirrored Reflection on the Lake Surface (for sky lanterns & heart lanterns!)
    if (l.kind === "sky" && alpha > 0.04) {
      const distAbove = Math.max(4, horizonY - l.y);
      const refY = horizonY + distAbove * 0.72;
      if (refY < h + 20) {
        const wave = reducedMotion ? 0 : Math.sin(elapsed * 2.2 + l.phase + refY * 0.03) * 4.5;
        ctx.save();
        ctx.globalAlpha = alpha * (l.inHeart ? 0.28 : 0.22);
        ctx.translate(l.x + wave, refY);
        ctx.scale(1, -0.65);
        ctx.drawImage(spr, -sw * 0.5, -sh * 0.5, sw, sh);
        ctx.restore();
      }
    }

    // Water Lantern: flower base + immediate reflection below
    if (l.kind === "water") {
      // Soft water reflection right underneath
      ctx.save();
      ctx.globalAlpha = alpha * 0.32;
      ctx.translate(l.x, l.y + sh * 0.26);
      ctx.scale(1, -0.55);
      ctx.drawImage(spr, -sw * 0.5, -sh * 0.5, sw, sh);
      ctx.restore();

      // Delicate glowing lotus flower base
      ctx.save();
      ctx.translate(l.x, l.y + sh * 0.14);
      ctx.globalAlpha = alpha * 0.88;
      ctx.fillStyle = "#fbcfe8";
      const baseR = 8 * drawScale;
      for (let p = 0; p < 6; p++) {
        const ang = (p / 6) * TAU;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(ang) * baseR * 0.9,
          Math.sin(ang) * baseR * 0.32,
          baseR * 0.72,
          baseR * 0.26,
          ang * 0.2,
          0,
          TAU
        );
        ctx.fill();
      }
      ctx.restore();
    }

    // Main Paper Lantern Sprite
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr, l.x - sw * 0.5, l.y - sh * 0.5, sw, sh);
    ctx.globalAlpha = 1;
  }

  // 6. Expanding Water Ripples
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const rp = state.ripples[i];
    rp.life += dt;
    if (rp.life < 0) continue;
    if (rp.life >= rp.maxLife) {
      state.ripples.splice(i, 1);
      continue;
    }
    const p = rp.life / rp.maxLife;
    const rx = lerp(rp.r, rp.maxR, easeOutCubic(p));
    ctx.strokeStyle = `rgba(254, 240, 138, ${((1 - p) * 0.42).toFixed(3)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, rx, rx * 0.26, 0, 0, TAU);
    ctx.stroke();
  }

  // 7. Lantern Ignition Spark Bursts
  if (state.bursts.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = state.bursts.length - 1; i >= 0; i--) {
      const b = state.bursts[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        state.bursts.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const p = b.life / b.maxLife;
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.8 * (1 - p * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 8. Flickering Table Candle on the Left Dock (flares warmly during the Heart Finale!)
  const candleFlare = state.finaleActive
    ? 1 + easeOutCubic(clamp(state.finaleElapsed / 1.4, 0, 1)) * 0.72
    : 1;
  const cFlick = (0.9 + 0.1 * Math.sin(elapsed * 9.5)) * candleFlare;
  const cGlowR = 34 * cFlick;
  const cGlow = ctx.createRadialGradient(candleX, candleY, 1, candleX, candleY, cGlowR);
  cGlow.addColorStop(0, "rgba(255, 251, 235, 0.92)");
  cGlow.addColorStop(0.28, "rgba(253, 224, 71, 0.45)");
  cGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = cGlow;
  ctx.beginPath();
  ctx.arc(candleX, candleY, cGlowR, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fffbeb";
  ctx.beginPath();
  ctx.ellipse(candleX, candleY, 2.2 * cFlick, 4.2 * cFlick, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 9. Shore Fireflies Drifting Near the Dock
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const ff of state.fireflies) {
    if (!reducedMotion) {
      ff.x += (ff.vx + Math.sin(elapsed * 0.8 + ff.phase) * 7) * dt;
      ff.y += (ff.vy + Math.cos(elapsed * 0.7 + ff.phase) * 6) * dt;
      if (ff.x < 8) ff.vx = Math.abs(ff.vx);
      if (ff.x > Math.min(w * 0.48, 340)) ff.vx = -Math.abs(ff.vx);
      if (ff.y < horizonY - 60) ff.vy = Math.abs(ff.vy);
      if (ff.y > h - 36) ff.vy = -Math.abs(ff.vy);
    }
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * ff.blinkSpeed + ff.phase));
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.r * 3.0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = pulse * 0.9;
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.r * 0.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 10. Floating Memory Lines Following Newly Released Lanterns (~4s lifespan, readable & clamped)
  const maxTextW = Math.min(250, w - 36);
  for (const l of state.lanterns) {
    if (!l.memoryText || l.memoryAge > 4.2) continue;
    const fadeIn = clamp(l.memoryAge / 0.55, 0, 1);
    const fadeOut = l.memoryAge > 3.1 ? clamp(1 - (l.memoryAge - 3.1) / 1.1, 0, 1) : 1;
    drawWrappedMemoryText(
      ctx,
      l.memoryText,
      l.x,
      l.y - 24,
      maxTextW,
      w,
      h,
      fadeIn * fadeOut * 0.94
    );
  }
}
