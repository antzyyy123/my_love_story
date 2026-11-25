/**
 * Canvas 2D Renderer for "Your Smile" — Pre-Dawn Field & Hidden Smile Sunrise
 * - Pre-renders 5 species/color palettes x 8 bloom stages (bud -> full bloom) as offscreen sprites
 * - Pre-renders 2 distant overscanned hills & sloped meadow base on resize
 * - Animates ~250 desktop / ~140 mobile depth-sorted flowers (including ~60 hidden-smile golden blooms)
 * - Continuous pre-dawn -> violet -> rose -> golden sunrise sky driven by bloom fraction f
 * - Pointer light orb with sparkles, smooth head-turning toward light/sun, guide firefly,
 *   rising sun with soft rays, and left-to-right glowing smile reveal with rising golden pollen.
 */

import { clamp, createSeededRandom, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

interface BgStar {
  x: number;
  y: number;
  r: number;
  phase: number;
}

export interface FieldFlower {
  x: number;
  y: number;
  stemH: number;
  scale: number;
  speciesIdx: 0 | 1 | 2 | 3 | 4; // 4 = hidden smile gold
  bloom: number; // 0 (closed bud) -> 1 (fully open)
  headAngle: number; // smooth lagging turn toward light or sun
  shimmer: number; // 0..1 burst when blooming or during smile wave
  phase: number;
  isSmile: boolean;
  smileOrder: number; // 0..1 left-to-right along the hidden smile curve
}

interface PollenSpeck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
}

interface LightSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
}

export interface YourSmileState {
  w: number;
  h: number;
  dpr: number;
  isPortrait: boolean;
  isMobile: boolean;
  horizonY: number;
  hillsCanvas: HTMLCanvasElement;
  sprites: HTMLCanvasElement[][]; // [speciesIdx 0..4][stage 0..7]
  stars: BgStar[];
  flowers: FieldFlower[];
  pollen: PollenSpeck[];
  lightSparkles: LightSparkle[];
  // Pointer light state
  lightX: number;
  lightY: number;
  targetLightX: number;
  targetLightY: number;
  lightActive: boolean;
  lightGlow: number; // 0..1
  idleSec: number;
  autoRoam: boolean;
  roamTime: number;
  // Guide firefly when idle > 3s
  guideX: number;
  guideY: number;
  guidePhase: number;
  // Bloom & Sunrise Finale
  bloomFraction: number; // 0..1
  finaleActive: boolean;
  finaleElapsed: number;
  replaying: boolean;
}

const SPECIES_STYLES: Array<{
  petals: number;
  outer: string;
  inner: string;
  core: string;
  shape: "rose" | "tulip" | "bluebell" | "daisy" | "gold";
}> = [
  { petals: 6, outer: "#ec4899", inner: "#fbcfe8", core: "#fef08a", shape: "rose" },
  { petals: 5, outer: "#a855f7", inner: "#e9d5ff", core: "#fde68a", shape: "tulip" },
  { petals: 5, outer: "#60a5fa", inner: "#dbeafe", core: "#fffbeb", shape: "bluebell" },
  { petals: 8, outer: "#e2e8f0", inner: "#ffffff", core: "#facc15", shape: "daisy" },
  { petals: 7, outer: "#f59e0b", inner: "#fde047", core: "#fffbeb", shape: "gold" },
];

/**
 * Pre-renders one flower head at bloom stage `stage` (0 = closed bud .. 7 = full bloom).
 * Base of flower head sits at center (cx, cy).
 */
function buildFlowerStageSprite(
  speciesIdx: number,
  stage: number
): HTMLCanvasElement {
  const size = 44;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const spec = SPECIES_STYLES[speciesIdx];
  const b = stage / 7; // 0..1
  const cx = size * 0.5;
  const cy = size * 0.54;

  ctx.save();
  ctx.translate(cx, cy);

  if (b < 0.16) {
    // Tight closed pre-dawn bud wrapped in dark teal-green sepals
    ctx.fillStyle = "#115e59";
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-5, 0, -4.5, -9, 0, -13);
    ctx.bezierCurveTo(4.5, -9, 5, 0, 0, 4);
    ctx.closePath();
    ctx.fill();

    // Faint hint of petal color at the bud tip
    ctx.fillStyle = spec.outer;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, -10, 2.2, 3.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return c;
  }

  // Opening -> Full cosmic bloom
  const openE = easeOutCubic(clamp((b - 0.1) / 0.9, 0, 1));
  const pLen = lerp(8, 16.5, openE);
  const pW = lerp(2.8, spec.shape === "daisy" ? 4.4 : 6.4, openE);
  const count = spec.petals;

  // Soft glow behind bloom
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, pLen * 1.25);
  halo.addColorStop(0, spec.inner);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.25 * openE;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, pLen * 1.25, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let i = 0; i < count; i++) {
    const targetAng = (i / count) * TAU - Math.PI * 0.5;
    // Closed petals point upward (-PI/2); as openE -> 1 they fan radially into full bloom
    const ang = lerp(-Math.PI * 0.5, targetAng, openE);
    ctx.save();
    ctx.rotate(ang + Math.PI * 0.5);
    const pg = ctx.createLinearGradient(0, 0, 0, -pLen);
    pg.addColorStop(0, spec.inner);
    pg.addColorStop(0.65, spec.outer);
    pg.addColorStop(1, spec.inner);
    ctx.fillStyle = pg;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-pW, -pLen * 0.32, -pW * 0.72, -pLen * 0.85, 0, -pLen);
    ctx.bezierCurveTo(pW * 0.72, -pLen * 0.85, pW, -pLen * 0.32, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Glowing golden center
  ctx.fillStyle = spec.core;
  ctx.beginPath();
  ctx.arc(0, 0, lerp(1.5, 4.2, openE), 0, TAU);
  ctx.fill();

  ctx.restore();
  return c;
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

/**
 * Multi-stop continuous dawn color interpolation:
 * 0.00 = pre-dawn deep blue -> 0.38 = violet -> 0.72 = rose -> 1.00 = warm sunrise gold
 */
function sampleDawnColor(
  stops: Array<[number, number, number]>,
  f: number
): string {
  const c = clamp(f, 0, 1);
  if (c <= 0.38) return lerpRgb(stops[0], stops[1], c / 0.38);
  if (c <= 0.72) return lerpRgb(stops[1], stops[2], (c - 0.38) / 0.34);
  return lerpRgb(stops[2], stops[3], (c - 0.72) / 0.28);
}

function buildHillsLayer(state: YourSmileState) {
  const { w, h, dpr, horizonY } = state;
  const off = state.hillsCanvas;
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Distant Hill 1 (overscanned past edges)
  ctx.fillStyle = "#161936";
  ctx.beginPath();
  ctx.moveTo(-w * 0.14, horizonY + 8);
  ctx.quadraticCurveTo(w * 0.22, horizonY - 46, w * 0.52, horizonY - 8);
  ctx.quadraticCurveTo(w * 0.82, horizonY - 40, w * 1.14, horizonY + 10);
  ctx.lineTo(w * 1.14, h + 10);
  ctx.lineTo(-w * 0.14, h + 10);
  ctx.closePath();
  ctx.fill();

  // Distant Hill 2
  ctx.fillStyle = "#0f152b";
  ctx.beginPath();
  ctx.moveTo(-w * 0.14, horizonY + 24);
  ctx.quadraticCurveTo(w * 0.3, horizonY - 12, w * 0.62, horizonY + 10);
  ctx.quadraticCurveTo(w * 0.88, horizonY - 8, w * 1.14, horizonY + 22);
  ctx.lineTo(w * 1.14, h + 10);
  ctx.lineTo(-w * 0.14, h + 10);
  ctx.closePath();
  ctx.fill();

  // Sloped Meadow Field Ground filling everything below the horizon
  const fieldGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  fieldGrad.addColorStop(0, "#0b1a29");
  fieldGrad.addColorStop(0.35, "#081522");
  fieldGrad.addColorStop(1, "#040b14");
  ctx.fillStyle = fieldGrad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.12, horizonY + 14);
  ctx.quadraticCurveTo(w * 0.5, horizonY - 4, w * 1.12, horizonY + 14);
  ctx.lineTo(w * 1.12, h + 10);
  ctx.lineTo(-w * 0.12, h + 10);
  ctx.closePath();
  ctx.fill();
}

export function createYourSmileState(
  cssW: number,
  cssH: number,
  dpr: number,
  seed = 20261124
): YourSmileState {
  const rng = createSeededRandom(seed + 777);
  const w = Math.max(320, cssW);
  const h = Math.max(320, cssH);
  const isPortrait = w / h <= 1.2;
  const isMobile = w < 768;

  // Horizon at ~38% landscape, ~30% portrait so the field fills most of the screen
  const horizonY = h * (isPortrait ? 0.3 : 0.38);
  const fieldH = h - horizonY;

  // Pre-render 5 species x 8 bloom stages
  const sprites = Array.from({ length: 5 }, (_, sIdx) =>
    Array.from({ length: 8 }, (_, stg) => buildFlowerStageSprite(sIdx, stg))
  );

  const stars: BgStar[] = Array.from({ length: isMobile ? 48 : 85 }, () => ({
    x: randomRange(rng, 0.02, 0.98),
    y: randomRange(rng, 0.02, isPortrait ? 0.28 : 0.36),
    r: randomRange(rng, 0.5, 1.5),
    phase: randomRange(rng, 0, TAU),
  }));

  const flowers: FieldFlower[] = [];

  // 1. General meadow field flowers in perspective rows (extending past screen edges)
  const bgFlowerCount = isMobile ? 96 : 190;
  for (let i = 0; i < bgFlowerCount; i++) {
    // Non-linear depth bias so far rows are denser and near rows larger
    const depth = Math.pow(rng(), 0.78); // 0 = far horizon, 1 = foreground bottom
    const fx = randomRange(rng, -26, w + 26);
    const fy = horizonY + 16 + depth * (fieldH - 12);
    const scale = lerp(0.42, 1.26, depth) * randomRange(rng, 0.9, 1.12);
    const stemH = lerp(16, 56, depth) * randomRange(rng, 0.88, 1.14);
    const speciesIdx = (i % 4) as 0 | 1 | 2 | 3;

    flowers.push({
      x: fx,
      y: fy,
      stemH,
      scale,
      speciesIdx,
      bloom: 0,
      headAngle: 0,
      shimmer: 0,
      phase: randomRange(rng, 0, TAU),
      isSmile: false,
      smileOrder: 0,
    });
  }

  // 2. THE HIDDEN SMILE: ~60 desktop / ~44 mobile golden flowers along a wide smile curve
  //    across the middle of the field, with a charming dimple cluster at each end!
  const smileArcCount = isMobile ? 36 : 50;
  const smileSpanX = w * (isPortrait ? 0.62 : 0.52);
  const smileCenterX = w * 0.5;
  const smileTopY = horizonY + fieldH * (isPortrait ? 0.4 : 0.38);
  const smileDipY = fieldH * (isPortrait ? 0.16 : 0.21);

  for (let i = 0; i < smileArcCount; i++) {
    const u = i / (smileArcCount - 1); // 0 (left) .. 1 (right)
    const centered = u * 2 - 1; // -1 .. +1
    const sx = smileCenterX + centered * (smileSpanX * 0.5) + randomRange(rng, -6, 6);
    // Smooth parabolic smile curve: higher at both corners, dipping gracefully in the middle
    const sy = smileTopY + (1 - centered * centered) * smileDipY + randomRange(rng, -6, 6);
    const depth = clamp((sy - horizonY) / Math.max(1, fieldH), 0.1, 1);
    const scale = lerp(0.55, 1.22, depth) * randomRange(rng, 0.96, 1.12);
    const stemH = lerp(22, 54, depth);

    flowers.push({
      x: sx,
      y: sy,
      stemH,
      scale,
      speciesIdx: 4, // golden smile flower
      bloom: 0,
      headAngle: 0,
      shimmer: 0,
      phase: randomRange(rng, 0, TAU),
      isSmile: true,
      smileOrder: u,
    });
  }

  // Small dimple cluster at left & right smile corners (4-5 golden flowers each)
  const dimplePerSide = isMobile ? 4 : 5;
  for (const side of [-1, 1]) {
    const cornerX = smileCenterX + side * (smileSpanX * 0.5 + 10);
    const cornerY = smileTopY - 8;
    for (let j = 0; j < dimplePerSide; j++) {
      const ang = (j / dimplePerSide) * TAU;
      const sx = cornerX + Math.cos(ang) * 14 + side * 4;
      const sy = cornerY + Math.sin(ang) * 10;
      const depth = clamp((sy - horizonY) / Math.max(1, fieldH), 0.1, 1);
      flowers.push({
        x: sx,
        y: sy,
        stemH: lerp(20, 48, depth),
        scale: lerp(0.55, 1.12, depth),
        speciesIdx: 4,
        bloom: 0,
        headAngle: 0,
        shimmer: 0,
        phase: randomRange(rng, 0, TAU),
        isSmile: true,
        smileOrder: side < 0 ? 0.02 : 0.98,
      });
    }
  }

  // Sort strictly by row depth (back to front)
  flowers.sort((a, b) => a.y - b.y);

  const state: YourSmileState = {
    w,
    h,
    dpr,
    isPortrait,
    isMobile,
    horizonY,
    hillsCanvas: document.createElement("canvas"),
    sprites,
    stars,
    flowers,
    pollen: [],
    lightSparkles: [],
    lightX: w * 0.5,
    lightY: horizonY + fieldH * 0.45,
    targetLightX: w * 0.5,
    targetLightY: horizonY + fieldH * 0.45,
    lightActive: false,
    lightGlow: 0,
    idleSec: 0,
    autoRoam: false,
    roamTime: 0,
    guideX: w * 0.25,
    guideY: horizonY + fieldH * 0.42,
    guidePhase: 0,
    bloomFraction: 0,
    finaleActive: false,
    finaleElapsed: 0,
    replaying: false,
  };

  buildHillsLayer(state);
  return state;
}

export function renderYourSmileFrame(
  ctx: CanvasRenderingContext2D,
  state: YourSmileState,
  dt: number,
  elapsed: number,
  reducedMotion: boolean,
  onFinaleStart?: () => void
) {
  const { w, h, horizonY } = state;
  const fieldH = h - horizonY;
  const lightRadius = state.isMobile ? 168 : 142;

  // 1. Handle Replay Fade-Back to Pre-Dawn Closed State
  if (state.replaying) {
    let anyOpen = false;
    for (const f of state.flowers) {
      if (f.bloom > 0) {
        f.bloom = Math.max(0, f.bloom - dt * 0.95);
        f.shimmer = Math.max(0, f.shimmer - dt * 2);
        if (f.bloom > 0.01) anyOpen = true;
      }
    }
    if (!anyOpen) {
      state.replaying = false;
      state.finaleActive = false;
      state.finaleElapsed = 0;
    }
  }

  // 2. Update Pointer Light / Auto-Roam / Idle Guide Firefly
  if (state.autoRoam && !state.finaleActive) {
    state.roamTime += dt;
    state.lightActive = true;
    state.idleSec = 0;
    // Sweeping figure-8 pattern covering the whole field smoothly
    const rx = Math.sin(state.roamTime * 0.85) * 0.42 + Math.sin(state.roamTime * 0.33) * 0.08;
    const ry = 0.5 + Math.cos(state.roamTime * 0.62) * 0.36;
    state.targetLightX = w * (0.5 + rx);
    state.targetLightY = horizonY + fieldH * clamp(ry, 0.12, 0.88);
  } else if (!state.lightActive && !state.finaleActive) {
    state.idleSec += dt;
  }

  const lightFollow = Math.min(1, dt * 11);
  state.lightX = lerp(state.lightX, state.targetLightX, lightFollow);
  state.lightY = lerp(state.lightY, state.targetLightY, lightFollow);

  const wantGlow = state.lightActive && !state.finaleActive ? 1 : 0;
  state.lightGlow = lerp(state.lightGlow, wantGlow, Math.min(1, dt * 6));

  // Spawn warm sparkles around the active light orb
  if (state.lightGlow > 0.15 && !reducedMotion && state.lightSparkles.length < 36) {
    if (Math.random() < dt * 24) {
      const ang = Math.random() * TAU;
      const dist = Math.random() * lightRadius * 0.45;
      state.lightSparkles.push({
        x: state.lightX + Math.cos(ang) * dist,
        y: state.lightY + Math.sin(ang) * dist,
        vx: (Math.random() - 0.5) * 24,
        vy: -(12 + Math.random() * 24),
        life: 0,
        maxLife: 0.75 + Math.random() * 0.45,
        r: 1.2 + Math.random() * 1.6,
      });
    }
  }

  // 3. Update Flower Blooming, Head Turning & Bloom Fraction f
  const sunX = w * 0.5;
  const sunRiseG = state.finaleActive ? easeOutCubic(clamp(state.finaleElapsed / 3.0, 0, 1)) : 0;
  const sunY = lerp(horizonY + 46, horizonY - h * 0.12, sunRiseG);

  let openCount = 0;
  for (const f of state.flowers) {
    if (!state.replaying) {
      if (state.finaleActive) {
        // Remaining buds bloom automatically in a wave from center outward
        const distCenter = Math.hypot(f.x - w * 0.5, f.y - (horizonY + fieldH * 0.5)) / Math.max(w, h);
        const waveG = clamp((state.finaleElapsed - distCenter * 1.4) / 0.9, 0, 1);
        if (waveG > 0 && f.bloom < 1) {
          f.bloom = Math.min(1, Math.max(f.bloom, waveG));
          if (f.bloom > 0.85) f.shimmer = Math.max(f.shimmer, 0.65);
        }
      } else if (state.lightGlow > 0.1) {
        const d = Math.hypot(f.x - state.lightX, f.y - f.stemH - state.lightY);
        if (d < lightRadius) {
          const prox = 1 - d / lightRadius;
          if (reducedMotion) {
            f.bloom = 1;
          } else {
            const prev = f.bloom;
            f.bloom = Math.min(1, f.bloom + (0.65 + prox * 1.9) * dt);
            if (prev < 0.95 && f.bloom >= 0.95) {
              f.bloom = 1;
              f.shimmer = 1;
            }
          }
        }
      }
    }

    if (f.bloom >= 0.92) openCount += 1;

    // Smooth head turning toward the pointer light (or toward the rising sun during finale!)
    let desiredTurn = 0;
    if (state.finaleActive) {
      desiredTurn = clamp((sunX - f.x) / (w * 0.55), -1, 1) * 0.34;
    } else if (state.lightGlow > 0.1) {
      const d = Math.hypot(f.x - state.lightX, f.y - state.lightY);
      if (d < lightRadius * 1.35) {
        const infl = 1 - d / (lightRadius * 1.35);
        desiredTurn = clamp((state.lightX - f.x) / 140, -1, 1) * 0.42 * infl;
      }
    }
    f.headAngle = lerp(f.headAngle, desiredTurn, Math.min(1, dt * 4.2));

    // Hidden Smile Left-to-Right Golden Shimmer Wave during Finale (1.6s -> 4.8s)
    if (state.finaleActive && f.isSmile && state.finaleElapsed > 1.5) {
      const waveFront = (state.finaleElapsed - 1.5) / 2.4; // 0..1+ sweeping left to right
      if (waveFront >= f.smileOrder) {
        const pulse = 0.72 + 0.28 * Math.sin(elapsed * 3.2 - f.smileOrder * 6);
        f.shimmer = Math.max(f.shimmer, pulse);
        // Float golden pollen up from the illuminated smile!
        if (!reducedMotion && state.pollen.length < (state.isMobile ? 42 : 85) && Math.random() < dt * 1.1) {
          state.pollen.push({
            x: f.x + (Math.random() - 0.5) * 10,
            y: f.y - f.stemH,
            vx: (Math.random() - 0.5) * 14,
            vy: -(18 + Math.random() * 26),
            life: 0,
            maxLife: 2.0 + Math.random() * 1.2,
            r: 1.4 + Math.random() * 1.6,
            color: "#fef08a",
          });
        }
      }
    } else {
      f.shimmer = Math.max(0, f.shimmer - dt * 1.2);
      // Occasional soft pollen speck from open field flowers
      if (
        !reducedMotion &&
        f.bloom >= 0.95 &&
        state.pollen.length < (state.isMobile ? 28 : 55) &&
        Math.random() < dt * 0.08
      ) {
        state.pollen.push({
          x: f.x,
          y: f.y - f.stemH,
          vx: (Math.random() - 0.5) * 12,
          vy: -(10 + Math.random() * 18),
          life: 0,
          maxLife: 1.8 + Math.random() * 0.9,
          r: 1.2 + Math.random() * 1.1,
          color: f.isSmile ? "#fde047" : "#fbcfe8",
        });
      }
    }
  }

  state.bloomFraction = openCount / Math.max(1, state.flowers.length);
  if (!state.finaleActive && !state.replaying && state.bloomFraction >= 0.85) {
    state.finaleActive = true;
    state.finaleElapsed = 0;
    state.autoRoam = false;
    onFinaleStart?.();
  }
  if (state.finaleActive) {
    state.finaleElapsed += dt;
  }

  // Sky progression combines field bloom fraction f with finale sunrise push
  const skyT = clamp(state.bloomFraction * 0.85 + sunRiseG * 0.25, 0, 1);

  // 4. Continuous Pre-Dawn -> Violet -> Rose -> Warm Gold Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + 24);
  skyGrad.addColorStop(
    0,
    sampleDawnColor(
      [
        [6, 9, 30],
        [18, 16, 52],
        [40, 26, 72],
        [68, 44, 92],
      ],
      skyT
    )
  );
  skyGrad.addColorStop(
    0.58,
    sampleDawnColor(
      [
        [17, 22, 56],
        [48, 30, 82],
        [114, 50, 96],
        [194, 96, 102],
      ],
      skyT
    )
  );
  skyGrad.addColorStop(
    1,
    sampleDawnColor(
      [
        [32, 34, 78],
        [94, 48, 98],
        [204, 102, 118],
        [253, 186, 116],
      ],
      skyT
    )
  );
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY + 30);

  // Fading pre-dawn stars
  const starFade = clamp(1 - skyT * 1.35, 0, 1);
  if (starFade > 0.01) {
    for (const st of state.stars) {
      const tw = 0.4 + 0.6 * Math.sin(elapsed * 1.6 + st.phase);
      ctx.globalAlpha = starFade * tw * 0.8;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(st.x * w, st.y * h, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Horizon Dawn Glow (thin at f=0, radiant warm gold as f -> 1)
  const hGlowR = Math.max(w * 0.55, 360) * lerp(0.55, 1.25, skyT);
  const hGlow = ctx.createRadialGradient(sunX, horizonY, 8, sunX, horizonY, hGlowR);
  hGlow.addColorStop(0, `rgba(254, 240, 138, ${lerp(0.16, 0.65, skyT).toFixed(3)})`);
  hGlow.addColorStop(0.42, `rgba(251, 146, 60, ${lerp(0.06, 0.34, skyT).toFixed(3)})`);
  hGlow.addColorStop(1, "rgba(251, 146, 60, 0)");
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, 0, w, horizonY + 40);

  // 5. Rising Sun Disc, Soft Rotating Rays & Lens Glow during Finale
  if (sunRiseG > 0.005) {
    const sunR = (state.isPortrait ? 38 : 50) * clamp(w / 1000, 0.85, 1.15);
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Soft rotating sunbeams
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(reducedMotion ? 0 : state.finaleElapsed * 0.06);
    const rayCount = 12;
    for (let r = 0; r < rayCount; r++) {
      ctx.rotate(TAU / rayCount);
      const rg = ctx.createLinearGradient(0, 0, 0, -sunR * 4.8);
      rg.addColorStop(0, `rgba(254, 240, 138, ${(sunRiseG * 0.24).toFixed(3)})`);
      rg.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(-sunR * 0.22, 0);
      ctx.lineTo(0, -sunR * 4.8);
      ctx.lineTo(sunR * 0.22, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Sun lens halo & glowing disc
    const lens = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.8);
    lens.addColorStop(0, `rgba(255, 251, 235, ${(sunRiseG * 0.95).toFixed(3)})`);
    lens.addColorStop(0.28, `rgba(253, 224, 71, ${(sunRiseG * 0.62).toFixed(3)})`);
    lens.addColorStop(0.65, `rgba(251, 146, 60, ${(sunRiseG * 0.22).toFixed(3)})`);
    lens.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3.8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#fffbeb";
    ctx.globalAlpha = sunRiseG;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 6. Blit Pre-Rendered 2 Distant Hills & Sloped Field Ground
  ctx.drawImage(state.hillsCanvas, 0, 0, w, h);

  // Continuous Dawn Mist & Warm Meadow Tint over the Horizon
  const mistGrad = ctx.createLinearGradient(0, horizonY - 28, 0, horizonY + 52);
  mistGrad.addColorStop(0, "rgba(254, 240, 138, 0)");
  mistGrad.addColorStop(0.5, `rgba(253, 224, 71, ${lerp(0.06, 0.22, skyT).toFixed(3)})`);
  mistGrad.addColorStop(1, "rgba(254, 240, 138, 0)");
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, horizonY - 28, w, 80);

  // 7. Depth-Sorted Field of Flowers (~250 desktop / ~140 mobile)
  ctx.lineCap = "round";
  const smileLit = state.finaleActive && state.finaleElapsed > 1.5;

  for (const f of state.flowers) {
    const sway = reducedMotion ? 0 : Math.sin(elapsed * 1.45 + f.phase) * 4.5 * f.scale;
    const tipX = f.x + sway + f.headAngle * 14 * f.scale;
    const tipY = f.y - f.stemH;

    // Stem
    ctx.strokeStyle =
      f.bloom > 0.5
        ? f.isSmile && smileLit && f.shimmer > 0.2
          ? "rgba(253, 224, 71, 0.78)"
          : "rgba(20, 130, 118, 0.78)"
        : "rgba(18, 66, 72, 0.72)";
    ctx.lineWidth = Math.max(1.0, 2.0 * f.scale);
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + sway * 0.4, f.y - f.stemH * 0.55, tipX, tipY);
    ctx.stroke();

    // Draw closest pre-rendered bloom stage sprite (0..7)
    const stageIdx = Math.min(7, Math.floor(f.bloom * 7.99));
    const spr = state.sprites[f.speciesIdx][stageIdx];
    const drawSz = spr.width * f.scale * (1 + f.shimmer * 0.14);

    // Extra golden radiance on hidden-smile flowers during the left-to-right smile reveal!
    if (f.isSmile && smileLit && f.shimmer > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gr = 24 * f.scale * (0.85 + f.shimmer * 0.55);
      const gg = ctx.createRadialGradient(tipX, tipY, 2, tipX, tipY, gr);
      gg.addColorStop(0, `rgba(255, 251, 235, ${(f.shimmer * 0.75).toFixed(3)})`);
      gg.addColorStop(0.5, `rgba(253, 224, 71, ${(f.shimmer * 0.42).toFixed(3)})`);
      gg.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(tipX, tipY, gr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(f.headAngle + sway * 0.015);
    ctx.drawImage(spr, -drawSz * 0.5, -drawSz * 0.54, drawSz, drawSz);
    ctx.restore();
  }

  // 8. Floating Pollen Specks (including golden pollen rising from the smile!)
  if (state.pollen.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = state.pollen.length - 1; i >= 0; i--) {
      const p = state.pollen[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        state.pollen.splice(i, 1);
        continue;
      }
      p.x += (p.vx + Math.sin(elapsed * 2.2 + i) * 10) * dt;
      p.y += p.vy * dt;
      const frac = p.life / p.maxLife;
      ctx.globalAlpha = Math.sin(frac * Math.PI) * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 9. Faint Guide Firefly when Pointer is Idle > 3s Before Finale
  if (state.idleSec > 3.0 && !state.finaleActive && !state.autoRoam) {
    state.guidePhase += dt;
    const ga = clamp((state.idleSec - 3.0) / 1.2, 0, 1);
    const gx = w * (0.5 + Math.sin(state.guidePhase * 0.75) * 0.34);
    const gy = horizonY + fieldH * (0.48 + Math.cos(state.guidePhase * 1.1) * 0.22);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gg = ctx.createRadialGradient(gx, gy, 1, gx, gy, 18);
    gg.addColorStop(0, `rgba(255, 251, 235, ${(ga * 0.85).toFixed(3)})`);
    gg.addColorStop(0.5, `rgba(253, 224, 71, ${(ga * 0.38).toFixed(3)})`);
    gg.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(gx, gy, 18, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 10. Pointer Light Orb & Sparkles (additive glow)
  if (state.lightGlow > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lg = ctx.createRadialGradient(
      state.lightX,
      state.lightY,
      4,
      state.lightX,
      state.lightY,
      lightRadius
    );
    lg.addColorStop(0, `rgba(255, 251, 235, ${(state.lightGlow * 0.42).toFixed(3)})`);
    lg.addColorStop(0.35, `rgba(253, 224, 71, ${(state.lightGlow * 0.22).toFixed(3)})`);
    lg.addColorStop(0.75, `rgba(244, 114, 182, ${(state.lightGlow * 0.08).toFixed(3)})`);
    lg.addColorStop(1, "rgba(244, 114, 182, 0)");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(state.lightX, state.lightY, lightRadius, 0, TAU);
    ctx.fill();

    // Soft bright core of her light
    ctx.fillStyle = `rgba(255, 251, 235, ${(state.lightGlow * 0.78).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(state.lightX, state.lightY, 7, 0, TAU);
    ctx.fill();

    for (let i = state.lightSparkles.length - 1; i >= 0; i--) {
      const sp = state.lightSparkles[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        state.lightSparkles.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      const p = sp.life / sp.maxLife;
      ctx.globalAlpha = (1 - p) * state.lightGlow * 0.85;
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r * (1 - p * 0.4), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
