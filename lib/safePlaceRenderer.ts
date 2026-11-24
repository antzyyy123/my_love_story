/**
 * Canvas 2D Renderer for "My Safe Place" (Yellow Planet)
 * Pre-renders static landscape layers (3 overscanned hills, cozy cottage, tree trunk)
 * to an offscreen canvas on resize, and draws all dynamic storm/calm layers
 * (sky, 3 cloud layers, soft cloud lightning, swaying foliage, chimney smoke,
 * puddles, grass, bud path, mushrooms, slanted rain + ripples, windblown petals)
 * at 60fps in one unified pass.
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

interface CloudPuff {
  x: number;
  y: number;
  rx: number;
  ry: number;
  speed: number;
  layer: 0 | 1 | 2;
  alpha: number;
}

interface BgStar {
  x: number; // normalized 0..1
  y: number; // normalized 0..0.62
  r: number;
  phase: number;
  color: string;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface SplashRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
}

interface GrassBlade {
  x: number;
  y: number;
  h: number;
  lean: number;
  phase: number;
  distFromHome: number;
}

interface PathBud {
  x: number;
  y: number;
  stemH: number;
  scale: number;
  color: string;
  phase: number;
  distFromHome: number;
}

interface Mushroom {
  x: number;
  y: number;
  capRx: number;
  capRy: number;
  stemH: number;
  color: string;
}

interface Puddle {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface LoosePetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
}

interface SmokePuff {
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  drift: number;
}

interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  blinkSpeed: number;
  color: string;
}

export interface SafePlaceState {
  w: number;
  h: number;
  dpr: number;
  isPortrait: boolean;
  isMobile: boolean;
  homeX: number;
  homeY: number;
  windowX: number;
  windowY: number;
  chimneyX: number;
  chimneyY: number;
  treeX: number;
  treeY: number;
  homeScale: number;
  staticCanvas: HTMLCanvasElement;
  stars: BgStar[];
  clouds: CloudPuff[];
  rain: RainDrop[];
  splashes: SplashRipple[];
  grass: GrassBlade[];
  buds: PathBud[];
  mushrooms: Mushroom[];
  puddles: Puddle[];
  petals: LoosePetal[];
  fireflies: Firefly[];
  smoke: SmokePuff[];
  smokeTimer: number;
  smokeHeartTime: number;
  lightningCooldown: number;
  lightningElapsed: number;
  lightningActive: boolean;
  lightningX: number;
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): string {
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Main foreground hill surface Y at screen X */
function hillSurfaceY(x: number, w: number, homeY: number, isPortrait: boolean): number {
  const norm = (x - w * 0.5) / Math.max(1, w * 0.5);
  const arch = isPortrait ? 34 : 44;
  return homeY + 28 + norm * norm * arch;
}

/**
 * Pre-renders the 3 overscanned hills, cozy cottage architecture, and tree trunk
 * onto an offscreen canvas so each frame only needs a single drawImage blit.
 */
function buildStaticLayer(state: SafePlaceState) {
  const { w, h, dpr, homeX, homeY, homeScale, isPortrait, treeX, treeY } = state;
  const off = state.staticCanvas;
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // 1. Back Hill Silhouette (overscanned past screen edges)
  const backGrad = ctx.createLinearGradient(0, homeY - 70, 0, h);
  backGrad.addColorStop(0, "#121d33");
  backGrad.addColorStop(1, "#080d1a");
  ctx.fillStyle = backGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, homeY - 8);
  ctx.quadraticCurveTo(w * 0.22, homeY - 68, w * 0.52, homeY - 18);
  ctx.quadraticCurveTo(w * 0.82, homeY - 56, w * 1.15, homeY - 4);
  ctx.lineTo(w * 1.15, h + 10);
  ctx.lineTo(-w * 0.15, h + 10);
  ctx.closePath();
  ctx.fill();

  // 2. Mid Hill Silhouette
  const midGrad = ctx.createLinearGradient(0, homeY - 25, 0, h);
  midGrad.addColorStop(0, "#0e1629");
  midGrad.addColorStop(1, "#060a14");
  ctx.fillStyle = midGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, homeY + 26);
  ctx.quadraticCurveTo(w * 0.28, homeY - 18, w * 0.56, homeY + 12);
  ctx.quadraticCurveTo(w * 0.85, homeY - 12, w * 1.15, homeY + 32);
  ctx.lineTo(w * 1.15, h + 10);
  ctx.lineTo(-w * 0.15, h + 10);
  ctx.closePath();
  ctx.fill();

  // 3. Foreground Main Hill cradling the cottage, path, puddles & grass
  const fgGrad = ctx.createLinearGradient(0, homeY + 18, 0, h);
  fgGrad.addColorStop(0, "#0c1324");
  fgGrad.addColorStop(0.45, "#070c19");
  fgGrad.addColorStop(1, "#04060e");
  ctx.fillStyle = fgGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, hillSurfaceY(-w * 0.15, w, homeY, isPortrait));
  const steps = 28;
  for (let i = 1; i <= steps; i++) {
    const px = lerp(-w * 0.15, w * 1.15, i / steps);
    ctx.lineTo(px, hillSurfaceY(px, w, homeY, isPortrait));
  }
  ctx.lineTo(w * 1.15, h + 10);
  ctx.lineTo(-w * 0.15, h + 10);
  ctx.closePath();
  ctx.fill();

  // Subtle rim highlight along the main hill crest
  ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-w * 0.1, hillSurfaceY(-w * 0.1, w, homeY, isPortrait));
  for (let i = 1; i <= steps; i++) {
    const px = lerp(-w * 0.1, w * 1.1, i / steps);
    ctx.lineTo(px, hillSurfaceY(px, w, homeY, isPortrait));
  }
  ctx.stroke();

  // 4. Winding Stepping-Stone Path leading from foreground up to the cottage door
  const s = homeScale;
  const doorX = homeX - 18 * s;
  const doorY = homeY + 26 * s;
  ctx.save();
  ctx.fillStyle = "rgba(148, 163, 184, 0.12)";
  for (let i = 0; i < 8; i++) {
    const f = (i + 0.5) / 8;
    const px = doorX + Math.sin(f * Math.PI * 1.15) * 26 * s - f * 18 * s;
    const py = doorY + f * (h - doorY) * 0.66;
    ctx.beginPath();
    ctx.ellipse(px, py, (8 + f * 9) * s, (3 + f * 3.5) * s, 0.1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 5. Big Sheltering Tree Trunk & Boughs (beside the cottage on the left)
  ctx.save();
  ctx.translate(treeX, treeY);
  ctx.fillStyle = "#080d18";
  ctx.strokeStyle = "#162238";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(-16 * s, 8 * s);
  ctx.quadraticCurveTo(-8 * s, -34 * s, -7 * s, -84 * s);
  ctx.lineTo(7 * s, -84 * s);
  ctx.quadraticCurveTo(9 * s, -34 * s, 18 * s, 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sheltering boughs arching slightly toward the cottage
  ctx.strokeStyle = "#0b1220";
  ctx.lineCap = "round";
  ctx.lineWidth = 7 * s;
  ctx.beginPath();
  ctx.moveTo(-2 * s, -68 * s);
  ctx.quadraticCurveTo(-34 * s, -96 * s, -54 * s, -108 * s);
  ctx.moveTo(2 * s, -74 * s);
  ctx.quadraticCurveTo(32 * s, -104 * s, 56 * s, -110 * s);
  ctx.moveTo(0, -80 * s);
  ctx.quadraticCurveTo(-6 * s, -112 * s, 4 * s, -132 * s);
  ctx.stroke();
  ctx.restore();

  // 6. Cozy Procedural Cottage (walls, pitched roof, chimney, arched door, round window frame)
  ctx.save();
  ctx.translate(homeX, homeY);

  // Soft warm ground spill right under the cottage
  const baseGlow = ctx.createRadialGradient(0, 22 * s, 4, 0, 22 * s, 96 * s);
  baseGlow.addColorStop(0, "rgba(251, 191, 36, 0.24)");
  baseGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = baseGlow;
  ctx.beginPath();
  ctx.ellipse(0, 26 * s, 96 * s, 26 * s, 0, 0, TAU);
  ctx.fill();

  // Chimney on the right roof slope
  ctx.fillStyle = "#172033";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  ctx.rect(24 * s, -62 * s, 14 * s, 36 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(21 * s, -65 * s, 20 * s, 5 * s);

  // Cottage main walls
  const wallGrad = ctx.createLinearGradient(-48 * s, -24 * s, 48 * s, 28 * s);
  wallGrad.addColorStop(0, "#141e33");
  wallGrad.addColorStop(0.55, "#1c2740");
  wallGrad.addColorStop(1, "#101829");
  ctx.fillStyle = wallGrad;
  ctx.strokeStyle = "rgba(203, 213, 225, 0.16)";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.roundRect(-48 * s, -22 * s, 96 * s, 50 * s, 4 * s);
  ctx.fill();
  ctx.stroke();

  // Cozy curved pitched roof with eaves
  const roofGrad = ctx.createLinearGradient(0, -68 * s, 0, -14 * s);
  roofGrad.addColorStop(0, "#1e293b");
  roofGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(-62 * s, -16 * s);
  ctx.quadraticCurveTo(-24 * s, -48 * s, 0, -66 * s);
  ctx.quadraticCurveTo(24 * s, -48 * s, 62 * s, -16 * s);
  ctx.lineTo(54 * s, -12 * s);
  ctx.quadraticCurveTo(0, -22 * s, -54 * s, -12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(254, 240, 138, 0.18)";
  ctx.lineWidth = 1.2 * s;
  ctx.stroke();

  // Arched wooden door (left-center)
  ctx.fillStyle = "#2b1d19";
  ctx.strokeStyle = "rgba(253, 224, 71, 0.28)";
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  ctx.moveTo(-30 * s, 28 * s);
  ctx.lineTo(-30 * s, 4 * s);
  ctx.arc(-18 * s, 4 * s, 12 * s, Math.PI, 0);
  ctx.lineTo(-6 * s, 28 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Tiny brass doorknob
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.arc(-11 * s, 13 * s, 1.8 * s, 0, TAU);
  ctx.fill();

  // Warm Glowing Round Window (right-center)
  const wx = 19 * s;
  const wy = 2 * s;
  const wr = 14.5 * s;
  const winGrad = ctx.createRadialGradient(wx - 2 * s, wy - 2 * s, 2, wx, wy, wr);
  winGrad.addColorStop(0, "#fffbeb");
  winGrad.addColorStop(0.55, "#fde047");
  winGrad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = winGrad;
  ctx.beginPath();
  ctx.arc(wx, wy, wr, 0, TAU);
  ctx.fill();

  // Window wooden frame & crossbars
  ctx.strokeStyle = "#3b2314";
  ctx.lineWidth = 2.1 * s;
  ctx.beginPath();
  ctx.arc(wx, wy, wr, 0, TAU);
  ctx.moveTo(wx - wr, wy);
  ctx.lineTo(wx + wr, wy);
  ctx.moveTo(wx, wy - wr);
  ctx.lineTo(wx, wy + wr);
  ctx.stroke();

  ctx.restore();
}

export function createSafePlaceState(
  cssW: number,
  cssH: number,
  dpr: number,
  seed = 20261124
): SafePlaceState {
  const rng = createSeededRandom(seed);
  const w = Math.max(320, cssW);
  const h = Math.max(320, cssH);
  const isPortrait = w / h <= 1.2;
  const isMobile = w < 768;

  const homeScale = isPortrait
    ? clamp(w / 460, 0.72, 1.15)
    : clamp(Math.min(w / 1180, h / 720), 0.78, 1.22);
  const homeX = w * 0.5 + (isPortrait ? 12 : 24) * homeScale;
  const homeY = h * (isPortrait ? 0.56 : 0.58);
  const windowX = homeX + 19 * homeScale;
  const windowY = homeY + 2 * homeScale;
  const chimneyX = homeX + 31 * homeScale;
  const chimneyY = homeY - 65 * homeScale;
  const treeX = homeX - 96 * homeScale;
  const treeY = hillSurfaceY(treeX, w, homeY, isPortrait) + 4;

  const stars: BgStar[] = Array.from({ length: isMobile ? 55 : 95 }, (_, i) => ({
    x: randomRange(rng, 0.02, 0.98),
    y: randomRange(rng, 0.03, 0.56),
    r: randomRange(rng, 0.6, 1.7),
    phase: randomRange(rng, 0, TAU),
    color: i % 4 === 0 ? "#fde68a" : i % 3 === 0 ? "#fbcfe8" : "#f8fafc",
  }));

  // 3 parallax layers of dark storm clouds
  const clouds: CloudPuff[] = [];
  const layerCounts = isMobile ? [5, 5, 4] : [7, 7, 6];
  layerCounts.forEach((count, layerIdx) => {
    const layer = layerIdx as 0 | 1 | 2;
    for (let i = 0; i < count; i++) {
      clouds.push({
        x: (i / count) * (w + 320) - 160 + randomRange(rng, -50, 50),
        y: h * (0.07 + layer * 0.11) + randomRange(rng, -24, 24),
        rx: randomRange(rng, 110, 210) * (1 + layer * 0.15),
        ry: randomRange(rng, 34, 62) * (1 + layer * 0.1),
        speed: (14 + layer * 10) * randomRange(rng, 0.85, 1.2),
        layer,
        alpha: 0.45 + layer * 0.15,
      });
    }
  });

  // Slanted silver rain particles (460 desktop, 190 mobile)
  const rainCount = isMobile ? 190 : 460;
  const rain: RainDrop[] = Array.from({ length: rainCount }, () => ({
    x: randomRange(rng, -120, w + 120),
    y: randomRange(rng, -80, h),
    len: randomRange(rng, 14, 28),
    speed: randomRange(rng, 420, 660),
    alpha: randomRange(rng, 0.18, 0.48),
  }));

  // Foreground grass blades across the lower hill
  const grassCount = isMobile ? 58 : 118;
  const grass: GrassBlade[] = Array.from({ length: grassCount }, (_, i) => {
    const gx = (i / (grassCount - 1)) * (w + 40) - 20 + randomRange(rng, -8, 8);
    const surfY = hillSurfaceY(gx, w, homeY, isPortrait);
    const gy = surfY + randomRange(rng, 2, Math.max(40, h - surfY - 8));
    return {
      x: gx,
      y: gy,
      h: randomRange(rng, 16, 36) * (0.85 + 0.35 * ((gy - surfY) / Math.max(1, h - surfY))),
      lean: randomRange(rng, -8, 8),
      phase: randomRange(rng, 0, TAU),
      distFromHome: Math.hypot(gx - windowX, gy - windowY),
    };
  });

  // Dim buds lining the path & hill (ready to bloom in Step 3)
  const budColors = ["#fde047", "#f472b6", "#c084fc", "#5eead4", "#fb923c"];
  const budCount = isMobile ? 14 : 24;
  const buds: PathBud[] = Array.from({ length: budCount }, (_, i) => {
    const isPathSide = i < 10;
    let bx = 0;
    let by = 0;
    if (isPathSide) {
      const f = ((i % 5) + 0.4) / 5;
      const side = i < 5 ? -1 : 1;
      const doorX = homeX - 18 * homeScale;
      const doorY = homeY + 26 * homeScale;
      bx = doorX + Math.sin(f * Math.PI * 1.15) * 26 * homeScale - f * 18 * homeScale + side * (22 + f * 24) * homeScale;
      by = doorY + f * (h - doorY) * 0.65;
    } else {
      bx = randomRange(rng, w * 0.06, w * 0.94);
      const surf = hillSurfaceY(bx, w, homeY, isPortrait);
      by = surf + randomRange(rng, 16, Math.max(55, (h - surf) * 0.72));
    }
    return {
      x: bx,
      y: by,
      stemH: randomRange(rng, 18, 34) * homeScale,
      scale: randomRange(rng, 0.85, 1.2),
      color: budColors[i % budColors.length],
      phase: randomRange(rng, 0, TAU),
      distFromHome: Math.hypot(bx - windowX, by - windowY),
    };
  });

  // Small glowing mushrooms nestled near tree roots & foreground edges
  const mushXs = isMobile
    ? [treeX - 24, treeX + 18, w * 0.14, w * 0.84, w * 0.9]
    : [treeX - 28, treeX + 20, w * 0.08, w * 0.18, w * 0.78, w * 0.86, w * 0.93];
  const mushrooms: Mushroom[] = mushXs.map((mx, i) => {
    const surf = hillSurfaceY(mx, w, homeY, isPortrait);
    return {
      x: mx,
      y: surf + randomRange(rng, 18, Math.max(40, (h - surf) * 0.62)),
      capRx: randomRange(rng, 7, 11) * homeScale,
      capRy: randomRange(rng, 4, 6) * homeScale,
      stemH: randomRange(rng, 9, 15) * homeScale,
      color: i % 2 === 0 ? "#5eead4" : "#c084fc",
    };
  });

  // 3 reflective puddles in the lower foreground
  const puddles: Puddle[] = [
    {
      x: homeX + 44 * homeScale,
      y: hillSurfaceY(homeX + 44 * homeScale, w, homeY, isPortrait) + (h - homeY) * 0.28,
      rx: 46 * homeScale,
      ry: 10 * homeScale,
    },
    {
      x: homeX - 58 * homeScale,
      y: hillSurfaceY(homeX - 58 * homeScale, w, homeY, isPortrait) + (h - homeY) * 0.44,
      rx: 56 * homeScale,
      ry: 12 * homeScale,
    },
    {
      x: homeX + 128 * homeScale,
      y: hillSurfaceY(homeX + 128 * homeScale, w, homeY, isPortrait) + (h - homeY) * 0.48,
      rx: 38 * homeScale,
      ry: 8.5 * homeScale,
    },
  ];

  // Windblown loose petals
  const petalCount = isMobile ? 10 : 18;
  const petals: LoosePetal[] = Array.from({ length: petalCount }, (_, i) => ({
    x: randomRange(rng, 0, w),
    y: randomRange(rng, h * 0.1, h * 0.85),
    vx: randomRange(rng, 85, 165),
    vy: randomRange(rng, 18, 46),
    rot: randomRange(rng, 0, TAU),
    vRot: randomRange(rng, 1.5, 4.0),
    size: randomRange(rng, 4.5, 8.5),
    color: i % 3 === 0 ? "#fbcfe8" : i % 3 === 1 ? "#cbd5e1" : "#ddd6fe",
  }));

  // Fireflies appearing from w >= 0.5
  const fireflyCount = isMobile ? 18 : 38;
  const fireflies: Firefly[] = Array.from({ length: fireflyCount }, (_, i) => ({
    x: randomRange(rng, w * 0.05, w * 0.95),
    y: randomRange(rng, h * 0.24, h * 0.88),
    vx: randomRange(rng, -12, 12),
    vy: randomRange(rng, -9, 9),
    r: randomRange(rng, 1.4, 2.9),
    phase: randomRange(rng, 0, TAU),
    blinkSpeed: randomRange(rng, 1.3, 2.5),
    color: i % 3 === 0 ? "#fef08a" : i % 3 === 1 ? "#fbcfe8" : "#99f6e4",
  }));

  const state: SafePlaceState = {
    w,
    h,
    dpr,
    isPortrait,
    isMobile,
    homeX,
    homeY,
    windowX,
    windowY,
    chimneyX,
    chimneyY,
    treeX,
    treeY,
    homeScale,
    staticCanvas: document.createElement("canvas"),
    stars,
    clouds,
    rain,
    splashes: [],
    grass,
    buds,
    mushrooms,
    puddles,
    petals,
    fireflies,
    smoke: [],
    smokeTimer: 0,
    smokeHeartTime: 0,
    lightningCooldown: 4.5,
    lightningElapsed: 0,
    lightningActive: false,
    lightningX: w * 0.3,
  };

  buildStaticLayer(state);
  return state;
}

export function renderSafePlaceFrame(
  ctx: CanvasRenderingContext2D,
  state: SafePlaceState,
  dt: number,
  elapsed: number,
  warmth = 0
) {
  const { w, h, homeScale, windowX, windowY, chimneyX, chimneyY, treeX, treeY, homeY, isPortrait } =
    state;

  const wClamped = clamp(warmth, 0, 1);
  const wEased = easeInOutCubic(wClamped);
  const storm = 1 - wEased;

  // Expanding golden glow bubble radiating outward from the cottage round window
  const maxBubbleR = Math.hypot(w, h) * 0.96;
  const bubbleR = wClamped > 0.002 ? lerp(95 * homeScale, maxBubbleR, easeOutCubic(wClamped)) : 0;

  // Wind gusts soften continuously from storm surge to gentle calm breeze
  const rawGust = 0.65 + 0.35 * Math.sin(elapsed * 0.9) + 0.25 * Math.sin(elapsed * 2.15);
  const gust = lerp(0.14, rawGust, storm);
  const windSlant = 0.34 * gust;

  // 1. Sky shifts continuously from cold blue-gray storm -> warm amber/violet starry night
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  skyGrad.addColorStop(0, lerpRgb([7, 12, 26], [10, 8, 28], wEased));
  skyGrad.addColorStop(0.48, lerpRgb([15, 25, 45], [34, 21, 64], wEased));
  skyGrad.addColorStop(1, lerpRgb([24, 36, 59], [74, 37, 72], wEased));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle warm amber horizon twilight wash as warmth grows
  if (wEased > 0.05) {
    const horGrad = ctx.createRadialGradient(
      windowX,
      homeY,
      20,
      windowX,
      homeY,
      Math.max(w, h) * 0.75
    );
    horGrad.addColorStop(0, `rgba(251, 191, 36, ${(wEased * 0.22).toFixed(3)})`);
    horGrad.addColorStop(0.45, `rgba(192, 132, 252, ${(wEased * 0.14).toFixed(3)})`);
    horGrad.addColorStop(1, "rgba(192, 132, 252, 0)");
    ctx.fillStyle = horGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Stars: faint behind storm clouds, brightening richly from w = 0.45 -> 1.0
  const starVis = lerp(0.14, 0.95, easeInOutCubic(clamp((wClamped - 0.3) / 0.65, 0, 1)));
  for (const st of state.stars) {
    const tw = 0.45 + 0.55 * Math.sin(elapsed * 1.4 + st.phase);
    ctx.globalAlpha = starVis * tw;
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r * lerp(0.85, 1.15, wEased), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 2b. Soft Pale Moon fades in cleanly from w = 0.70 -> 1.0
  const moonG = easeInOutCubic(clamp((wClamped - 0.68) / 0.32, 0, 1));
  if (moonG > 0.005) {
    const moonX = w * (isPortrait ? 0.76 : 0.8);
    const moonY = h * (isPortrait ? 0.15 : 0.19);
    const moonR = (isPortrait ? 34 : 42) * clamp(homeScale, 0.85, 1.15);

    const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.4, moonX, moonY, moonR * 3.2);
    halo.addColorStop(0, `rgba(254, 249, 195, ${(moonG * 0.34).toFixed(3)})`);
    halo.addColorStop(0.45, `rgba(196, 181, 253, ${(moonG * 0.15).toFixed(3)})`);
    halo.addColorStop(1, "rgba(196, 181, 253, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3.2, 0, TAU);
    ctx.fill();

    const disc = ctx.createRadialGradient(
      moonX - moonR * 0.25,
      moonY - moonR * 0.25,
      moonR * 0.1,
      moonX,
      moonY,
      moonR
    );
    disc.addColorStop(0, `rgba(255, 251, 235, ${(moonG * 0.95).toFixed(3)})`);
    disc.addColorStop(0.65, `rgba(226, 232, 240, ${(moonG * 0.8).toFixed(3)})`);
    disc.addColorStop(1, `rgba(196, 181, 253, ${(moonG * 0.45).toFixed(3)})`);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fill();
  }

  // 3. Distant Soft Cloud Lightning (stops cleanly as warmth rises)
  const lightningMult = clamp(1 - wClamped / 0.35, 0, 1);
  if (lightningMult > 0.02) {
    if (!state.lightningActive) {
      state.lightningCooldown -= dt;
      if (state.lightningCooldown <= 0 && wClamped < 0.22) {
        state.lightningActive = true;
        state.lightningElapsed = 0;
        state.lightningX = w * (0.2 + ((Math.sin(elapsed * 7.3) * 0.5 + 0.5) * 0.6));
        state.lightningCooldown = 6.5 + ((Math.cos(elapsed * 3.9) * 0.5 + 0.5) * 2.2);
      }
    } else {
      state.lightningElapsed += dt;
      const dur = 0.55;
      if (state.lightningElapsed >= dur) {
        state.lightningActive = false;
      } else {
        const env = Math.sin((state.lightningElapsed / dur) * Math.PI) * lightningMult;
        const lGrad = ctx.createRadialGradient(
          state.lightningX,
          h * 0.16,
          10,
          state.lightningX,
          h * 0.16,
          Math.max(w, h) * 0.42
        );
        lGrad.addColorStop(0, `rgba(199, 210, 254, ${(env * 0.18).toFixed(3)})`);
        lGrad.addColorStop(0.5, `rgba(129, 140, 248, ${(env * 0.08).toFixed(3)})`);
        lGrad.addColorStop(1, "rgba(129, 140, 248, 0)");
        ctx.fillStyle = lGrad;
        ctx.fillRect(0, 0, w, h * 0.65);
      }
    }
  } else {
    state.lightningActive = false;
  }

  // 4. Three Layers of Storm Clouds (thin out and part away from center as w rises)
  const cloudFade = clamp(1 - wClamped / 0.85, 0, 1);
  if (cloudFade > 0.01) {
    for (const cl of state.clouds) {
      cl.x += cl.speed * gust * dt;
      if (cl.x - cl.rx > w + 120) {
        cl.x = -cl.rx - 80;
      }
      const partSign = cl.x < w * 0.5 ? -1 : 1;
      const drawX = cl.x + partSign * wEased * 150;
      const a = cl.alpha * cloudFade;
      const cGrad = ctx.createRadialGradient(drawX, cl.y, cl.ry * 0.2, drawX, cl.y, cl.rx);
      const baseShade = cl.layer === 0 ? "18, 28, 48" : cl.layer === 1 ? "13, 21, 38" : "9, 15, 29";
      cGrad.addColorStop(0, `rgba(${baseShade}, ${a.toFixed(3)})`);
      cGrad.addColorStop(0.6, `rgba(${baseShade}, ${(a * 0.55).toFixed(3)})`);
      cGrad.addColorStop(1, `rgba(${baseShade}, 0)`);
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(drawX, cl.y, cl.rx, cl.ry, 0, 0, TAU);
      ctx.fill();
    }
  }

  // 5. Chimney Smoke drifting downwind (softens as storm calms)
  state.smokeTimer -= dt;
  if (state.smokeTimer <= 0) {
    state.smokeTimer = 0.42;
    state.smoke.push({
      x: chimneyX,
      y: chimneyY,
      r: 4.5 * homeScale,
      life: 0,
      maxLife: 3.4,
      drift: (Math.sin(elapsed * 5.1) * 0.5 + 0.5) * 14,
    });
  }
  for (let i = state.smoke.length - 1; i >= 0; i--) {
    const sp = state.smoke[i];
    sp.life += dt;
    if (sp.life >= sp.maxLife) {
      state.smoke.splice(i, 1);
      continue;
    }
    const p = sp.life / sp.maxLife;
    sp.x += (28 * gust + sp.drift * storm) * dt;
    sp.y -= (24 - p * 8) * dt;
    const rad = sp.r * (1 + p * 3.1);
    const alpha = Math.sin(p * Math.PI) * lerp(0.24, 0.16, wEased);
    ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rad, 0, TAU);
    ctx.fill();
  }

  // 5b. Calm Chimney-Smoke Heart: curls gently upward and forms a soft repeating heart above the chimney
  if (wClamped >= 0.98) {
    state.smokeHeartTime = (state.smokeHeartTime + dt) % 7.5;
    const ht = state.smokeHeartTime;
    const formG = easeInOutCubic(clamp(ht / 2.6, 0, 1));
    const fadeOut = ht > 5.2 ? clamp(1 - (ht - 5.2) / 2.1, 0, 1) : 1;
    const heartAlpha = clamp(ht / 1.1, 0, 1) * fadeOut * 0.34;
    if (heartAlpha > 0.005) {
      const hCx = chimneyX + 24 * homeScale + Math.sin(ht * 0.9) * 5 * homeScale;
      const hCy = chimneyY - lerp(18, 92, easeOutCubic(clamp(ht / 7.5, 0, 1))) * homeScale;
      const hScale = lerp(0.55, 1.35, formG) * homeScale * (1 + (ht / 7.5) * 0.28);
      const puffCount = state.isMobile ? 16 : 24;
      for (let i = 0; i < puffCount; i++) {
        const u = (i / puffCount) * TAU;
        const s = Math.sin(u);
        const hx = 16 * s * s * s;
        const hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
        const px = lerp(chimneyX, hCx + hx * hScale, formG);
        const py = lerp(chimneyY - 12 * homeScale, hCy + hy * hScale, formG);
        const pr = (3.8 + (ht / 7.5) * 4.5) * homeScale;
        ctx.fillStyle = `rgba(254, 243, 199, ${heartAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
      }
    }
  } else {
    state.smokeHeartTime = 0;
  }

  // 6. Blit Pre-Rendered Static Hills, Cottage & Tree Trunk
  ctx.drawImage(state.staticCanvas, 0, 0, w, h);

  // 7. Swaying Tree Canopy Foliage Clusters (soften sway & warm slightly with w)
  ctx.save();
  ctx.translate(treeX, treeY - 94 * homeScale);
  const treeSway = Math.sin(elapsed * 2.2) * 5.5 * gust + 7 * gust * storm;
  const canopyOffsets = [
    { x: -34, y: -12, r: 34 },
    { x: 32, y: -16, r: 32 },
    { x: 0, y: -38, r: 40 },
    { x: -16, y: 4, r: 28 },
    { x: 18, y: 2, r: 28 },
  ];
  for (let i = 0; i < canopyOffsets.length; i++) {
    const co = canopyOffsets[i];
    const cx = co.x * homeScale + treeSway * (0.7 + i * 0.08);
    const cy = co.y * homeScale + Math.cos(elapsed * 2.1 + i) * 1.6 * (0.3 + 0.7 * storm);
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, co.r * homeScale);
    grad.addColorStop(0, lerpRgb([18, 30, 52], [32, 48, 68], wEased));
    grad.addColorStop(1, lerpRgb([8, 13, 24], [14, 22, 38], wEased));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, co.r * homeScale, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 8. Expanding Golden Glow Bubble & Steady Warm Window Beacon
  const flicker = 0.94 + 0.06 * Math.sin(elapsed * 3.2);
  const winGlowR = lerp(135 * homeScale, 240 * homeScale, wEased) * flicker;
  const winGlow = ctx.createRadialGradient(windowX, windowY, 4, windowX, windowY, winGlowR);
  winGlow.addColorStop(0, `rgba(254, 240, 138, ${lerp(0.42, 0.58, wEased).toFixed(3)})`);
  winGlow.addColorStop(0.35, `rgba(251, 191, 36, ${lerp(0.2, 0.3, wEased).toFixed(3)})`);
  winGlow.addColorStop(0.7, `rgba(245, 158, 11, ${lerp(0.06, 0.12, wEased).toFixed(3)})`);
  winGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = winGlow;
  ctx.beginPath();
  ctx.arc(windowX, windowY, winGlowR, 0, TAU);
  ctx.fill();

  // Expanding golden warmth bubble wave while holding (0 < w < 0.99)
  if (wClamped > 0.005 && wClamped < 0.995) {
    const bubbleAlpha = Math.sin(wClamped * Math.PI) * 0.26;
    const bGrad = ctx.createRadialGradient(
      windowX,
      windowY,
      Math.max(2, bubbleR * 0.72),
      windowX,
      windowY,
      bubbleR
    );
    bGrad.addColorStop(0, "rgba(253, 224, 71, 0)");
    bGrad.addColorStop(0.85, `rgba(253, 224, 71, ${(bubbleAlpha * 0.65).toFixed(3)})`);
    bGrad.addColorStop(0.96, `rgba(254, 249, 195, ${(bubbleAlpha * 1.25).toFixed(3)})`);
    bGrad.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(windowX, windowY, bubbleR, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 9. Puddles Reflecting Window Light -> Turning Into Starry Sky Mirrors as w -> 1
  for (let pIdx = 0; pIdx < state.puddles.length; pIdx++) {
    const pd = state.puddles[pIdx];
    const pGrad = ctx.createRadialGradient(
      pd.x - pd.rx * 0.15,
      pd.y,
      2,
      pd.x,
      pd.y,
      pd.rx
    );
    pGrad.addColorStop(0, `rgba(253, 224, 71, ${lerp(0.28, 0.45, wEased).toFixed(3)})`);
    pGrad.addColorStop(
      0.45,
      wEased > 0.3
        ? `rgba(168, 85, 247, ${lerp(0.14, 0.32, wEased).toFixed(3)})`
        : "rgba(96, 165, 250, 0.16)"
    );
    pGrad.addColorStop(1, "rgba(15, 23, 42, 0.35)");
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.ellipse(pd.x, pd.y, pd.rx, pd.ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(254, 240, 138, ${lerp(0.12, 0.3, wEased).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Star reflections inside calm mirror puddles
    if (wEased > 0.45) {
      const refA = clamp((wEased - 0.45) / 0.55, 0, 1);
      ctx.fillStyle = `rgba(255, 251, 235, ${(refA * 0.72).toFixed(3)})`;
      for (let s = 0; s < 3; s++) {
        const sx = pd.x + (s - 1) * pd.rx * 0.42;
        const sy = pd.y + Math.sin(elapsed * 2 + pIdx + s) * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  // 10. Small Glowing Mushrooms (brighten softly with warmth)
  for (const m of state.mushrooms) {
    ctx.fillStyle = "rgba(226, 232, 240, 0.65)";
    ctx.fillRect(m.x - 1.4, m.y - m.stemH, 2.8, m.stemH);
    ctx.fillStyle = m.color;
    ctx.globalAlpha = lerp(0.62, 0.95, wEased);
    ctx.beginPath();
    ctx.ellipse(m.x, m.y - m.stemH, m.capRx, m.capRy, 0, Math.PI, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 11. Buds Along the Path & Hill: straighten and BLOOM outward by distance from home!
  ctx.lineCap = "round";
  for (const bd of state.buds) {
    const localW =
      wClamped >= 0.99
        ? 1
        : clamp((bubbleR - bd.distFromHome) / 150, 0, 1) * clamp(wClamped * 2.4, 0, 1);
    const localBloom = easeInOutCubic(localW);
    const localStorm = 1 - localBloom;

    const bend = (10 * localStorm + 5 * Math.sin(elapsed * 2.2 + bd.phase)) * lerp(0.22, gust, localStorm);
    const tipX = bd.x + bend;
    const tipY = bd.y - bd.stemH * lerp(0.92, 1.08, localBloom);

    ctx.strokeStyle = lerpRgb([51, 88, 92], [45, 212, 191], localBloom);
    ctx.lineWidth = 1.65 * bd.scale;
    ctx.beginPath();
    ctx.moveTo(bd.x, bd.y);
    ctx.quadraticCurveTo(bd.x + bend * 0.4, bd.y - bd.stemH * 0.55, tipX, tipY);
    ctx.stroke();

    if (localBloom < 0.12) {
      // Closed dim bud
      ctx.fillStyle = "rgba(148, 163, 184, 0.48)";
      ctx.beginPath();
      ctx.ellipse(tipX, tipY - 2, 3.2 * bd.scale, 5.2 * bd.scale, 0.35 * gust, 0, TAU);
      ctx.fill();
    } else {
      // Blooming 5-petal glowing cosmic flower!
      ctx.save();
      ctx.translate(tipX, tipY);
      const pLen = lerp(4.5, 11.5, localBloom) * bd.scale;
      const pW = lerp(2.2, 4.8, localBloom) * bd.scale;
      ctx.fillStyle = bd.color;
      ctx.globalAlpha = lerp(0.55, 0.95, localBloom);
      for (let p = 0; p < 5; p++) {
        const ang = (p / 5) * TAU + bd.phase * 0.2;
        ctx.save();
        ctx.rotate(ang * localBloom);
        ctx.beginPath();
        ctx.ellipse(0, -pLen * 0.55, pW, pLen * 0.58, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // Warm golden flower center
      ctx.globalAlpha = localBloom;
      ctx.fillStyle = "#fffbeb";
      ctx.beginPath();
      ctx.arc(0, 0, 2.6 * bd.scale * localBloom, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // 12. Grass Blades: straighten & turn warm glowing teal outward from home
  ctx.lineWidth = 1.35;
  for (const gb of state.grass) {
    const localW =
      wClamped >= 0.99
        ? 1
        : clamp((bubbleR - gb.distFromHome) / 140, 0, 1) * clamp(wClamped * 2.2, 0, 1);
    const localStorm = 1 - localW;
    const sway = (12 * localStorm + 6 * Math.sin(elapsed * 2.6 + gb.phase)) * lerp(0.24, gust, localStorm);
    const tipX = gb.x + gb.lean * (0.4 + 0.6 * localStorm) + sway;
    const tipY = gb.y - gb.h;
    ctx.strokeStyle = lerpRgb([38, 66, 78], [24, 152, 138], localW);
    ctx.beginPath();
    ctx.moveTo(gb.x, gb.y);
    ctx.quadraticCurveTo(gb.x + sway * 0.35, gb.y - gb.h * 0.55, tipX, tipY);
    ctx.stroke();
  }

  // 13. Loose Petals (slow down & glow warmer gold-pink as storm calms)
  for (const pt of state.petals) {
    pt.x += pt.vx * lerp(0.18, gust, storm) * dt;
    pt.y += (pt.vy * lerp(0.35, 1, storm) + Math.sin(elapsed * 2.4 + pt.rot) * 14) * dt;
    pt.rot += pt.vRot * lerp(0.25, 1, storm) * dt;
    if (pt.x > w + 25) {
      pt.x = -20;
      pt.y = ((pt.y + h * 0.37) % (h * 0.78)) + h * 0.05;
    }
    if (pt.y > h + 20) pt.y = -15;

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.rot);
    ctx.globalAlpha = lerp(0.42, 0.68, wEased);
    ctx.fillStyle = wEased > 0.4 ? "#fde68a" : pt.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, pt.size, pt.size * 0.46, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 14. Fireflies Fading In From w = 0.50 -> 1.0
  const ffVis = easeInOutCubic(clamp((wClamped - 0.48) / 0.45, 0, 1));
  if (ffVis > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ff of state.fireflies) {
      ff.x += (ff.vx + Math.sin(elapsed * 0.8 + ff.phase) * 10) * dt;
      ff.y += (ff.vy + Math.cos(elapsed * 0.7 + ff.phase) * 8) * dt;
      if (ff.x < 20) ff.vx = Math.abs(ff.vx);
      if (ff.x > w - 20) ff.vx = -Math.abs(ff.vx);
      if (ff.y < h * 0.16) ff.vy = Math.abs(ff.vy);
      if (ff.y > h * 0.9) ff.vy = -Math.abs(ff.vy);

      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * ff.blinkSpeed + ff.phase));
      const a = pulse * ffVis * 0.85;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = ff.color;
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, ff.r * 3.1, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = a;
      ctx.fillStyle = "#fffbeb";
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, ff.r * 0.85, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 15. Slanted Silver Rain -> Transforms Into Slow Golden Sparks Inside Bubble & Fades to 0 at w = 1
  const rainDensity = clamp(1 - wClamped / 0.92, 0, 1);
  if (rainDensity > 0.005) {
    const activeCount = Math.floor(state.rain.length * rainDensity);
    ctx.lineWidth = 1.05;
    for (let i = 0; i < activeCount; i++) {
      const rd = state.rain[i];
      const distWin = Math.hypot(rd.x - windowX, rd.y - windowY);
      const insideBubble = bubbleR > 0 && distWin < bubbleR;

      const spd = insideBubble ? rd.speed * 0.24 : rd.speed;
      rd.x += spd * windSlant * (insideBubble ? 0.3 : 1) * dt;
      rd.y += spd * dt;
      const groundY = hillSurfaceY(rd.x, w, homeY, isPortrait) + rd.alpha * 120;
      if (rd.y > Math.min(h, groundY)) {
        if (
          !insideBubble &&
          state.splashes.length < (state.isMobile ? 22 : 48) &&
          rd.x > 0 &&
          rd.x < w
        ) {
          state.splashes.push({
            x: rd.x,
            y: Math.min(h - 6, groundY),
            r: 1.5,
            maxR: 8 + rd.alpha * 14,
            life: 0,
            maxLife: 0.38,
          });
        }
        rd.y = -20 - rd.alpha * 90;
        rd.x = ((rd.x + w * 1.2) % (w + 220)) - 110;
      }

      if (insideBubble) {
        // Transformed into slow golden sparks & tiny petals inside the warmth bubble!
        ctx.fillStyle = i % 3 === 0 ? "rgba(251, 207, 232, 0.72)" : "rgba(254, 240, 138, 0.78)";
        ctx.beginPath();
        ctx.arc(rd.x, rd.y, 1.8, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = `rgba(203, 213, 225, ${(rd.alpha * rainDensity * 0.95).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(rd.x, rd.y);
        ctx.lineTo(rd.x - rd.len * windSlant, rd.y - rd.len);
        ctx.stroke();
      }
    }
  }

  // Expanding Rain Ripples on Ground & Puddles
  for (let i = state.splashes.length - 1; i >= 0; i--) {
    const sp = state.splashes[i];
    sp.life += dt;
    if (sp.life >= sp.maxLife) {
      state.splashes.splice(i, 1);
      continue;
    }
    const p = sp.life / sp.maxLife;
    const rx = lerp(1.5, sp.maxR, p);
    const ry = rx * 0.28;
    ctx.strokeStyle = `rgba(203, 213, 225, ${((1 - p) * 0.34 * rainDensity).toFixed(3)})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }
}
