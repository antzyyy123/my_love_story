"use client";

import { useEffect, useRef, type RefObject } from "react";
import { SITE_CONTENT } from "@/lib/content";
import {
  COSMIC_PALETTES,
  createFlowerSprite,
  type FlowerPalette,
  type FlowerSprite,
  type FlowerType,
} from "@/lib/flowers";
import {
  CAMERA_ELEVATION,
  clamp,
  createSeededRandom,
  easeInOutCubic,
  GALAXY_BRIGHTNESS,
  GALAXY_SCALE,
  gaussianRandom,
  pickRandom,
  randomRange,
  TAU,
} from "@/lib/math";

interface GalaxyCanvasProps {
  /**
   * Optional 0 -> 1 ref driven by GalaxyTransition for the cinematic warp fly-in.
   */
  warpProgressRef?: RefObject<number>;
}

interface BgStar {
  nx: number;
  ny: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
  sparkle: boolean;
  depth: number; // 3 layers: far (~0.25), mid (~0.65), near (~1.25)
}

interface DustPuff {
  rNorm: number;
  angle: number;
  sizeFactor: number;
  alpha: number;
  omega: number;
}

interface ArmNebula {
  rNorm: number;
  angle: number;
  sizeFactor: number;
  spriteIdx: number;
  omega: number;
  phase: number;
}

interface TinyBloom {
  rNorm: number;
  angle: number;
  omega: number;
  spriteIdx: number;
  size: number;
  rot: number;
  spinSpeed: number;
  alpha: number;
  twinklePhase: number;
}

interface ForegroundBloom {
  nx: number;
  ny: number;
  vx: number;
  vy: number;
  spriteIdx: number;
  size: number;
  rot: number;
  spinSpeed: number;
  alpha: number;
  depth: number;
}

interface TrailPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  colorIdx: number;
  rot: number;
  spin: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  tailLength: number;
  colorRgb: string;
  headSize: number;
  isPetal: boolean;
  petalColorIdx: number;
  bloomSpriteIdx: number;
  spawnAccum: number;
}

// Varied star colors: white, pale blue, pale gold, faint pink
const STAR_COLORS = [
  "248, 250, 252",
  "248, 250, 252",
  "186, 230, 253",
  "254, 240, 138",
  "251, 207, 232",
];

// Deeper, richer, more saturated colors (no pure white tips in arms)
// 0..3: Core (warm cream-gold, rich gold, deep amber, dusty rose-pink)
// 4..6: Inner arms (deep magenta, rich crimson-pink, deep violet)
// 7..9: Outer arms (deep sapphire blue, rich indigo, deep ocean teal)
const PETAL_COLORS = [
  { fill: "#fde68a", tip: "#fef3c7", edge: "#d97706", glow: "rgba(253, 224, 71, 0.34)" }, // 0 warm gold-cream
  { fill: "#eab308", tip: "#fde047", edge: "#b45309", glow: "rgba(234, 179, 8, 0.34)" },  // 1 rich gold
  { fill: "#ea580c", tip: "#fb923c", edge: "#9a3412", glow: "rgba(234, 88, 12, 0.32)" },  // 2 deep amber
  { fill: "#ec4899", tip: "#f9a8d4", edge: "#9d174d", glow: "rgba(236, 72, 153, 0.32)" }, // 3 soft rose-pink
  { fill: "#db2777", tip: "#f472b6", edge: "#831843", glow: "rgba(219, 39, 119, 0.32)" }, // 4 deep magenta
  { fill: "#e11d48", tip: "#fb7185", edge: "#881337", glow: "rgba(225, 29, 72, 0.30)" },  // 5 rich rose
  { fill: "#7c3aed", tip: "#a78bfa", edge: "#4c1d95", glow: "rgba(124, 58, 237, 0.32)" }, // 6 deep violet
  { fill: "#2563eb", tip: "#60a5fa", edge: "#1e3a8a", glow: "rgba(37, 99, 235, 0.32)" },  // 7 sapphire blue
  { fill: "#4f46e5", tip: "#818cf8", edge: "#312e81", glow: "rgba(79, 70, 229, 0.32)" },  // 8 rich indigo
  { fill: "#0d9488", tip: "#2dd4bf", edge: "#115e59", glow: "rgba(13, 148, 136, 0.30)" }, // 9 deep teal
];

const PETAL_SIZES = [3.4, 7.0, 12.2];
const ANGLE_BUCKETS = 8;

/**
 * Pre-renders a richly colored petal sprite with a subtle, restrained glow halo
 * so thousands of overlapping petals never blow out to pure white.
 */
function createPetalSprite(
  colorSpec: (typeof PETAL_COLORS)[number],
  length: number,
  angle: number
): HTMLCanvasElement {
  const pad = Math.ceil(length * 1.15) + 2;
  const dim = pad * 2;
  const c = document.createElement("canvas");
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  ctx.translate(pad, pad);

  // Restrained, compact color-matched halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, pad * 0.78);
  halo.addColorStop(0, colorSpec.glow);
  halo.addColorStop(0.5, colorSpec.glow.replace(/[\d.]+\)$/, "0.08)"));
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, pad * 0.78, 0, TAU);
  ctx.fill();

  ctx.rotate(angle);
  const w = length * 0.44;
  const h = length * 0.64;
  const grad = ctx.createLinearGradient(0, h, 0, -h);
  grad.addColorStop(0, colorSpec.edge);
  grad.addColorStop(0.55, colorSpec.fill);
  grad.addColorStop(1, colorSpec.tip);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(-w, h * 0.25, -w * 0.85, -h * 0.8, 0, -h);
  ctx.bezierCurveTo(w * 0.85, -h * 0.8, w, h * 0.25, 0, h);
  ctx.closePath();
  ctx.fill();

  return c;
}

function createSparkleSprite(colorRgb: string, size: number, fourPoint: boolean): HTMLCanvasElement {
  const pad = Math.ceil(size * (fourPoint ? 2.3 : 1.7)) + 2;
  const dim = pad * 2;
  const c = document.createElement("canvas");
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  ctx.translate(pad, pad);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pad * 0.8);
  grad.addColorStop(0, `rgba(${colorRgb}, 0.9)`);
  grad.addColorStop(0.35, `rgba(${colorRgb}, 0.45)`);
  grad.addColorStop(1, `rgba(${colorRgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, pad * 0.8, 0, TAU);
  ctx.fill();

  if (fourPoint) {
    ctx.strokeStyle = `rgba(${colorRgb}, 0.75)`;
    ctx.lineWidth = Math.max(0.6, size * 0.24);
    ctx.lineCap = "round";
    const ray = pad * 0.78;
    ctx.beginPath();
    ctx.moveTo(-ray, 0);
    ctx.lineTo(ray, 0);
    ctx.moveTo(0, -ray);
    ctx.lineTo(0, ray);
    ctx.stroke();
  }

  return c;
}

function createRadialPuffSprite(
  stops: Array<[number, string]>,
  size = 256
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, color] of stops) {
    grad.addColorStop(offset, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function pickRadialColorIndex(rNorm: number, rng: () => number): number {
  const jitter = (rng() - 0.5) * 0.12;
  const r = clamp(rNorm + jitter, 0, 1);
  if (r < 0.22) {
    return Math.floor(rng() * 4);
  }
  if (r < 0.58) {
    const roll = rng();
    if (roll < 0.12) return 3;
    return 4 + Math.floor(rng() * 3);
  }
  const roll = rng();
  if (roll < 0.14) return 6;
  return 7 + Math.floor(rng() * 3);
}

export default function GalaxyCanvas({ warpProgressRef }: GalaxyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // =========================================================================
    // 1. PRE-RENDER ALL OFF-SCREEN SPRITES ONCE (ZERO PER-FRAME GRADIENTS)
    // =========================================================================
    const petalSprites: HTMLCanvasElement[][][] = PETAL_COLORS.map((col) =>
      PETAL_SIZES.map((sz) =>
        Array.from({ length: ANGLE_BUCKETS }, (_, aIdx) =>
          createPetalSprite(col, sz, (aIdx / ANGLE_BUCKETS) * Math.PI)
        )
      )
    );

    const sparkleSprites: HTMLCanvasElement[] = [
      createSparkleSprite("254, 240, 138", 1.4, false),
      createSparkleSprite("244, 114, 182", 1.4, false),
      createSparkleSprite("96, 165, 250", 1.4, false),
      createSparkleSprite("167, 139, 250", 1.4, false),
      createSparkleSprite("254, 240, 138", 1.6, true),
      createSparkleSprite("186, 230, 253", 1.5, true),
    ];

    const bloomSpecs: Array<{ type: FlowerType; palette: FlowerPalette }> = [
      { type: "rose", palette: COSMIC_PALETTES.magenta },
      { type: "rose", palette: COSMIC_PALETTES.gold },
      { type: "lily", palette: COSMIC_PALETTES.blue },
      { type: "orchid", palette: COSMIC_PALETTES.purple },
      { type: "hydrangea", palette: COSMIC_PALETTES.violet },
      { type: "filler", palette: COSMIC_PALETTES.pink },
      { type: "filler", palette: COSMIC_PALETTES.teal },
      { type: "lotus", palette: COSMIC_PALETTES.orange },
    ];
    const bloomSprites: FlowerSprite[] = bloomSpecs.map((spec, idx) =>
      createFlowerSprite(spec.type, spec.palette, 22, 500 + idx * 17, dpr)
    );

    // Softened core glow (~40% dimmer): only the very center approaches warm white
    const coreGlowSprite = createRadialPuffSprite([
      [0.0, "rgba(255, 250, 230, 0.72)"],
      [0.14, "rgba(253, 224, 71, 0.44)"],
      [0.34, "rgba(234, 88, 12, 0.24)"],
      [0.56, "rgba(219, 39, 119, 0.14)"],
      [0.80, "rgba(124, 58, 237, 0.05)"],
      [1.0, "rgba(0, 0, 0, 0)"],
    ]);

    // Softened arm nebula glow (~40% dimmer, deeper saturated magenta/violet/blue)
    const armNebulaSprites = [
      createRadialPuffSprite([
        [0, "rgba(219, 39, 119, 0.16)"],
        [0.5, "rgba(190, 24, 93, 0.05)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
      createRadialPuffSprite([
        [0, "rgba(124, 58, 237, 0.16)"],
        [0.5, "rgba(91, 33, 182, 0.05)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
      createRadialPuffSprite([
        [0, "rgba(37, 99, 235, 0.15)"],
        [0.5, "rgba(13, 148, 136, 0.045)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    ];

    const bgNebulaSprites = [
      createRadialPuffSprite([
        [0, "rgba(109, 40, 217, 0.09)"],
        [0.6, "rgba(109, 40, 217, 0.02)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
      createRadialPuffSprite([
        [0, "rgba(29, 78, 216, 0.08)"],
        [0.6, "rgba(15, 118, 110, 0.018)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
      createRadialPuffSprite([
        [0, "rgba(190, 24, 93, 0.08)"],
        [0.6, "rgba(190, 24, 93, 0.018)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    ];

    // Pronounced dark dust lanes
    const dustPuffSprite = createRadialPuffSprite([
      [0, "rgba(3, 3, 12, 0.84)"],
      [0.52, "rgba(5, 4, 16, 0.48)"],
      [1, "rgba(5, 5, 15, 0)"],
    ]);

    // Strengthened dark radial scrim behind title, subtitle, and button
    const textScrimSprite = createRadialPuffSprite([
      [0.0, "rgba(5, 5, 15, 0.90)"],
      [0.42, "rgba(5, 5, 15, 0.68)"],
      [0.74, "rgba(5, 5, 15, 0.28)"],
      [1.0, "rgba(5, 5, 15, 0)"],
    ]);

    // =========================================================================
    // 2. SCENE DATA (SAME SHAPE, SIZE, 30° VIEW; 1200 3-LAYER STARS)
    // =========================================================================
    let width = 0;
    let height = 0;
    let galaxyRadius = 0;

    let particleCount = 0;
    let pRNorm!: Float32Array;
    let pAngle!: Float32Array;
    let pOmega!: Float32Array;
    let pZ!: Float32Array;
    let pColor!: Uint8Array;
    let pSize!: Uint8Array;
    let pSparkleIdx!: Uint8Array;
    let pSpin!: Float32Array;
    let pPhase!: Float32Array;
    let pBaseAlpha!: Float32Array;
    let pDriftRate!: Float32Array;
    let pLife!: Float32Array;

    let bgStars: BgStar[] = [];
    let dustPuffs: DustPuff[] = [];
    let armNebulae: ArmNebula[] = [];
    let tinyBlooms: TinyBloom[] = [];
    let foregroundBlooms: ForegroundBloom[] = [];
    const shootingStars: ShootingStar[] = [];
    const trailPetals: TrailPetal[] = [];
    let nextShootTimer = 1.6;

    const OUTER_OMEGA = TAU / 210;
    const ARM_COUNT = 3;
    const SPIRAL_K = 4.35;

    const keplerOmega = (rNorm: number) =>
      OUTER_OMEGA / Math.pow(Math.max(0.05, rNorm) + 0.14, 0.74);

    const buildGalaxy = (isMobile: boolean) => {
      const rng = createSeededRandom(20260515);

      // ~1,200 background stars across 3 depth layers (far, mid, near) on desktop (~600 mobile)
      const starCount = isMobile ? 600 : 1200;
      bgStars = Array.from({ length: starCount }, () => {
        const layerRoll = rng();
        if (layerRoll < 0.60) {
          // Far layer: tiny and dim
          return {
            nx: randomRange(rng, -0.56, 0.56),
            ny: randomRange(rng, -0.56, 0.56),
            radius: randomRange(rng, 0.3, 0.72),
            baseAlpha: randomRange(rng, 0.14, 0.38),
            twinkleSpeed: randomRange(rng, 0.5, 1.8),
            phase: randomRange(rng, 0, TAU),
            color: pickRandom(rng, STAR_COLORS),
            sparkle: false,
            depth: 0.25,
          };
        }
        if (layerRoll < 0.90) {
          // Mid layer: medium brightness
          return {
            nx: randomRange(rng, -0.56, 0.56),
            ny: randomRange(rng, -0.56, 0.56),
            radius: randomRange(rng, 0.65, 1.15),
            baseAlpha: randomRange(rng, 0.34, 0.64),
            twinkleSpeed: randomRange(rng, 0.8, 2.4),
            phase: randomRange(rng, 0, TAU),
            color: pickRandom(rng, STAR_COLORS),
            sparkle: false,
            depth: 0.65,
          };
        }
        // Near layer: slightly bigger, rare small cross-shaped glint
        const isGlint = rng() < 0.12; // ~1.2% of total 1200 stars (~14 glints)
        return {
          nx: randomRange(rng, -0.56, 0.56),
          ny: randomRange(rng, -0.56, 0.56),
          radius: randomRange(rng, 1.05, 1.75),
          baseAlpha: randomRange(rng, 0.58, 0.88),
          twinkleSpeed: randomRange(rng, 1.1, 3.0),
          phase: randomRange(rng, 0, TAU),
          color: pickRandom(rng, STAR_COLORS),
          sparkle: isGlint,
          depth: 1.25,
        };
      });

      particleCount = isMobile ? 9600 : 25000;
      pRNorm = new Float32Array(particleCount);
      pAngle = new Float32Array(particleCount);
      pOmega = new Float32Array(particleCount);
      pZ = new Float32Array(particleCount);
      pColor = new Uint8Array(particleCount);
      pSize = new Uint8Array(particleCount);
      pSparkleIdx = new Uint8Array(particleCount);
      pSpin = new Float32Array(particleCount);
      pPhase = new Float32Array(particleCount);
      pBaseAlpha = new Float32Array(particleCount);
      pDriftRate = new Float32Array(particleCount);
      pLife = new Float32Array(particleCount);

      const satellites = [
        { r: 1.12, angle: 0.72, spread: 0.055 },
        { r: 1.08, angle: 3.88, spread: 0.048 },
      ];

      for (let i = 0; i < particleCount; i++) {
        const roll = rng();
        let rNorm = 0;
        let angle = 0;
        let baseAlpha = 0.35;
        let zOffset = 0;

        if (roll < 0.25) {
          // Dense warm central bulge (controlled alpha 0.26 - 0.52)
          rNorm = Math.abs(gaussianRandom(rng)) * 0.115;
          angle = rng() * TAU;
          zOffset = gaussianRandom(rng) * 0.045;
          baseAlpha = randomRange(rng, 0.26, 0.52);
        } else if (roll < 0.88) {
          // 3 clear logarithmic spiral arms (alpha 0.22 - 0.48, no white blowout)
          const arm = Math.floor(rng() * ARM_COUNT);
          const armOffset = (arm / ARM_COUNT) * TAU;
          rNorm = 0.07 + Math.pow(rng(), 0.72) * 0.93;
          const armWidth = 0.075 + Math.pow(rNorm, 1.3) * 0.34;
          const scatter = gaussianRandom(rng) * armWidth;
          angle = armOffset + SPIRAL_K * Math.log(rNorm + 0.05) + scatter;
          zOffset = gaussianRandom(rng) * (0.012 + rNorm * 0.02);
          const centerProximity = Math.exp(-(scatter * scatter) / (2 * armWidth * armWidth));
          baseAlpha = (0.20 + 0.28 * centerProximity) * (1 - rNorm * 0.20);
        } else if (roll < 0.93) {
          // Sparse inter-arm space
          rNorm = 0.18 + rng() * 0.80;
          angle = rng() * TAU;
          zOffset = gaussianRandom(rng) * 0.018;
          baseAlpha = randomRange(rng, 0.06, 0.14);
        } else if (roll < 0.98) {
          // Faint outer halo
          rNorm = 0.98 + Math.abs(gaussianRandom(rng)) * 0.15;
          if (rNorm > 1.3) rNorm = 1.0 + rng() * 0.26;
          angle = rng() * TAU;
          zOffset = gaussianRandom(rng) * 0.03;
          baseAlpha = randomRange(rng, 0.05, 0.14);
        } else {
          // Satellite dwarf clusters
          const sat = satellites[i % satellites.length];
          const dx = gaussianRandom(rng) * sat.spread;
          const dy = gaussianRandom(rng) * sat.spread;
          const sx = Math.cos(sat.angle) * sat.r + dx;
          const sy = Math.sin(sat.angle) * sat.r + dy;
          rNorm = Math.hypot(sx, sy);
          angle = Math.atan2(sy, sx);
          zOffset = gaussianRandom(rng) * 0.02;
          baseAlpha = randomRange(rng, 0.18, 0.36);
        }

        const isSparkle = rng() < 0.05;
        pRNorm[i] = rNorm;
        pAngle[i] = angle;
        pOmega[i] = keplerOmega(rNorm);
        pZ[i] = zOffset;
        pColor[i] = pickRadialColorIndex(rNorm, rng);

        if (isSparkle) {
          pSize[i] = 255;
          pSparkleIdx[i] = rng() < 0.24 ? 4 + Math.floor(rng() * 2) : Math.floor(rng() * 4);
        } else {
          const sRoll = rng();
          pSize[i] = sRoll < 0.54 ? 0 : sRoll < 0.87 ? 1 : 2;
        }

        pSpin[i] = randomRange(rng, -2.2, 2.2);
        pPhase[i] = rng() * TAU;
        pBaseAlpha[i] = baseAlpha;

        if (rng() < 0.06 && rNorm > 0.18 && rNorm < 0.96) {
          pDriftRate[i] = randomRange(rng, 0.006, 0.018);
          pLife[i] = rng();
        } else {
          pDriftRate[i] = 0;
          pLife[i] = 1;
        }
      }

      // Dark dust lanes along inner concave edge of the 3 arms
      dustPuffs = [];
      const puffsPerArm = isMobile ? 24 : 38;
      for (let arm = 0; arm < ARM_COUNT; arm++) {
        const armOffset = (arm / ARM_COUNT) * TAU;
        for (let j = 0; j < puffsPerArm; j++) {
          const t = (j + 0.4) / puffsPerArm;
          const rNorm = 0.14 + t * 0.80;
          const angle =
            armOffset +
            SPIRAL_K * Math.log(rNorm + 0.05) -
            0.22 +
            randomRange(rng, -0.04, 0.04);
          dustPuffs.push({
            rNorm,
            angle,
            sizeFactor: 0.065 + t * 0.08,
            alpha: randomRange(rng, 0.55, 0.82) * (1 - t * 0.25),
            omega: keplerOmega(rNorm),
          });
        }
      }

      // Softened nebula patches along the 3 spiral arms
      armNebulae = [];
      const nebPerArm = isMobile ? 9 : 15;
      for (let arm = 0; arm < ARM_COUNT; arm++) {
        const armOffset = (arm / ARM_COUNT) * TAU;
        for (let j = 0; j < nebPerArm; j++) {
          const t = (j + 0.35) / nebPerArm;
          const rNorm = 0.15 + t * 0.80;
          const angle =
            armOffset + SPIRAL_K * Math.log(rNorm + 0.05) + randomRange(rng, -0.08, 0.08);
          armNebulae.push({
            rNorm,
            angle,
            sizeFactor: 0.095 + t * 0.095,
            spriteIdx: t < 0.45 ? 0 : t < 0.72 ? 1 : 2,
            omega: keplerOmega(rNorm),
            phase: rng() * TAU,
          });
        }
      }

      // Recognizable miniature blooms along arms
      tinyBlooms = [];
      const bloomCount = isMobile ? 58 : 135;
      for (let i = 0; i < bloomCount; i++) {
        const arm = i % ARM_COUNT;
        const armOffset = (arm / ARM_COUNT) * TAU;
        const rNorm = 0.14 + Math.pow(rng(), 0.76) * 0.84;
        const armWidth = 0.07 + Math.pow(rNorm, 1.25) * 0.24;
        const angle =
          armOffset + SPIRAL_K * Math.log(rNorm + 0.05) + gaussianRandom(rng) * armWidth;
        const isKnot = rng() < 0.28;
        const size = isKnot ? randomRange(rng, 20, 34) : randomRange(rng, 11, 21);
        const spriteIdx =
          rNorm < 0.26
            ? pickRandom(rng, [0, 1, 7])
            : rNorm < 0.58
              ? pickRandom(rng, [0, 3, 4, 5])
              : pickRandom(rng, [2, 3, 4, 6]);

        tinyBlooms.push({
          rNorm,
          angle,
          omega: keplerOmega(rNorm),
          spriteIdx,
          size,
          rot: rng() * TAU,
          spinSpeed: randomRange(rng, -0.4, 0.4),
          alpha: randomRange(rng, 0.52, 0.82),
          twinklePhase: rng() * TAU,
        });
      }

      // Drifting foreground blooms outside the galaxy
      const fgCount = isMobile ? 5 : 9;
      foregroundBlooms = Array.from({ length: fgCount }, (_, i) => {
        const edgeAngle = (i / fgCount) * TAU + randomRange(rng, -0.3, 0.3);
        const distNorm = randomRange(rng, 0.37, 0.48);
        return {
          nx: Math.cos(edgeAngle) * distNorm,
          ny: Math.sin(edgeAngle) * distNorm,
          vx: randomRange(rng, -0.0035, 0.0035),
          vy: randomRange(rng, -0.0025, 0.0025),
          spriteIdx: i % bloomSprites.length,
          size: randomRange(rng, 20, 34),
          rot: rng() * TAU,
          spinSpeed: randomRange(rng, -0.22, 0.22),
          alpha: randomRange(rng, 0.42, 0.72),
          depth: randomRange(rng, 1.5, 2.3),
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      // Preserve exact galaxy size (~64% of screen width)
      galaxyRadius = width * (GALAXY_SCALE * 0.5);

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildGalaxy(width < 768);
    };

    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    let rafId = 0;
    let lastTimestamp = 0;
    let elapsed = 0;
    let isHidden = document.hidden;

    /**
     * Spawns a shooting star or petal-trailed shooting bloom (up to 3 active at once).
     */
    const spawnShootingStar = () => {
      if (shootingStars.length >= 3) return;
      const fromLeft = Math.random() > 0.45;
      const startX = fromLeft
        ? Math.random() * width * 0.75
        : width * 0.25 + Math.random() * width * 0.75;
      const startY = Math.random() * height * 0.55;
      const speed = 600 + Math.random() * 600; // 600 to 1200 px/s
      const diagAngle = fromLeft
        ? 0.28 + Math.random() * 0.52 // downward-right diagonal
        : Math.PI - (0.28 + Math.random() * 0.52); // downward-left diagonal

      const isPetal = Math.random() < 0.45;
      const colorOptions = ["248, 250, 252", "186, 230, 253", "254, 240, 138", "244, 114, 182"];

      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(diagAngle) * speed,
        vy: Math.sin(diagAngle) * speed,
        life: 0,
        maxLife: 0.65 + Math.random() * 0.48, // < 1.2s
        tailLength: 80 + Math.random() * 120, // 80 to 200px
        colorRgb: colorOptions[Math.floor(Math.random() * colorOptions.length)],
        headSize: 1.8 + Math.random() * 1.4,
        isPetal,
        petalColorIdx: 3 + Math.floor(Math.random() * 5),
        bloomSpriteIdx: Math.floor(Math.random() * bloomSprites.length),
        spawnAccum: 0,
      });
    };

    const drawFrame = (dt: number, animate: boolean) => {
      const cx = width / 2;
      const cy = height / 2;
      const warp = warpProgressRef?.current ?? 0;
      const warpEased = easeInOutCubic(warp);

      if (animate) {
        mouseX += (targetMouseX - mouseX) * 0.045;
        mouseY += (targetMouseY - mouseY) * 0.045;
      }

      // 1. Deep-space near-black navy background
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#05050f";
      ctx.fillRect(0, 0, width, height);

      // 2. Faint Background Nebula Clouds
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const bgNebPositions = [
        { x: 0.20, y: 0.22, r: 0.46, idx: 0 },
        { x: 0.80, y: 0.24, r: 0.42, idx: 1 },
        { x: 0.76, y: 0.78, r: 0.44, idx: 2 },
        { x: 0.22, y: 0.76, r: 0.40, idx: 1 },
      ];
      for (const bn of bgNebPositions) {
        const size = Math.max(width, height) * bn.r * (1 + warpEased * 2.5);
        const bx = width * bn.x + mouseX * -10;
        const by = height * bn.y + mouseY * -10;
        ctx.drawImage(bgNebulaSprites[bn.idx], bx - size / 2, by - size / 2, size, size);
      }
      ctx.restore();

      // 3. 1,200-Star 3-Layer Background Starfield
      ctx.save();
      for (const s of bgStars) {
        const px = cx + s.nx * width + mouseX * 14 * s.depth;
        const py = cy + s.ny * height + mouseY * 14 * s.depth;
        const twinkle = animate
          ? 0.56 + 0.44 * Math.sin(elapsed * s.twinkleSpeed + s.phase)
          : 1;
        const alpha = Math.min(1, s.baseAlpha * twinkle);

        if (warpEased > 0.01) {
          const dx = px - cx;
          const dy = py - cy;
          const streak = 1 + warpEased * 2.8 * s.depth;
          ctx.strokeStyle = `rgba(${s.color}, ${Math.min(1, alpha + warpEased * 0.35)})`;
          ctx.lineWidth = s.radius * (1 + warpEased * 0.9);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx + dx * streak, cy + dy * streak);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, s.radius, 0, TAU);
          ctx.fill();

          if (s.sparkle) {
            const ray = s.radius * (2.2 + twinkle * 1.2);
            ctx.strokeStyle = `rgba(${s.color}, ${alpha * 0.55})`;
            ctx.lineWidth = 0.65;
            ctx.beginPath();
            ctx.moveTo(px - ray, py);
            ctx.lineTo(px + ray, py);
            ctx.moveTo(px, py - ray);
            ctx.lineTo(px, py + ray);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // =======================================================================
      // 4. 30° CAMERA ELEVATION PROJECTION (UNCHANGED SHAPE, SIZE, 30° VIEW)
      // =======================================================================
      const elevRad = ((CAMERA_ELEVATION + mouseY * 4) * Math.PI) / 180;
      const sinElev = Math.sin(elevRad);
      const cosElev = Math.cos(elevRad);
      const rollRad = ((-12 + mouseX * 4) * Math.PI) / 180;
      const cosRoll = Math.cos(rollRad);
      const sinRoll = Math.sin(rollRad);

      const warpScale = 1 + warpEased * 8.5;
      const warpSpinBoost = warpEased * warpEased * 3.0;
      const gcx = cx + mouseX * -16;
      const gcy = cy + mouseY * -16;
      const R = galaxyRadius * warpScale;
      const particleScale = clamp(galaxyRadius / 460, 0.52, 1.2);
      const perspDist = 3.4;

      // 4A. Softened Glowing Arm Nebula Patches ('screen' prevents white blowout)
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const neb of armNebulae) {
        const ang = neb.angle + (animate ? elapsed * neb.omega + warpSpinBoost : 0);
        const gx = Math.cos(ang) * neb.rNorm;
        const gy = Math.sin(ang) * neb.rNorm;

        const ty = gy * sinElev;
        const tz = gy * cosElev;
        const pScale = perspDist / (perspDist - tz * 0.55);

        const rx = (gx * cosRoll - ty * sinRoll) * pScale;
        const ry = (gx * sinRoll + ty * cosRoll) * pScale;
        const sx = gcx + rx * R;
        const sy = gcy + ry * R;

        const pulse = animate ? 0.88 + 0.12 * Math.sin(elapsed * 0.6 + neb.phase) : 1;
        const sz = neb.sizeFactor * R * 1.95 * pScale * pulse;
        ctx.globalAlpha = 0.68;
        ctx.drawImage(armNebulaSprites[neb.spriteIdx], sx - sz / 2, sy - sz / 2, sz, sz);
      }

      // 4B. Softened Warm Core Glow (~40% gentler; only center approaches warm white)
      const corePulse = animate ? 0.94 + 0.06 * Math.sin(elapsed * 0.75) : 1;
      const coreW = R * 0.54 * corePulse;
      const coreH = coreW * (sinElev + 0.16);
      ctx.save();
      ctx.translate(gcx, gcy);
      ctx.rotate(rollRad);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(coreGlowSprite, -coreW / 2, -coreH / 2, coreW, coreH);
      ctx.restore();
      ctx.restore();

      // 4C. Visible Dark Dust Lanes Along Inner Arm Edges
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (const dust of dustPuffs) {
        const ang = dust.angle + (animate ? elapsed * dust.omega + warpSpinBoost : 0);
        const gx = Math.cos(ang) * dust.rNorm;
        const gy = Math.sin(ang) * dust.rNorm;

        const ty = gy * sinElev;
        const tz = gy * cosElev;
        const pScale = perspDist / (perspDist - tz * 0.55);

        const rx = (gx * cosRoll - ty * sinRoll) * pScale;
        const ry = (gx * sinRoll + ty * cosRoll) * pScale;
        const sx = gcx + rx * R;
        const sy = gcy + ry * R;

        const sz = dust.sizeFactor * R * 1.85 * pScale;
        ctx.globalAlpha = dust.alpha;
        ctx.drawImage(dustPuffSprite, sx - sz / 2, sy - sz / 2, sz, sz);
      }
      ctx.restore();

      // 4D. 25,000 Deeply Colored Petals & Sparkles
      // Using 'screen' compositing + GALAXY_BRIGHTNESS (0.55) caps brightness naturally
      // so the arms stay rich violet/magenta/blue/teal and never blow out to pure white!
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const textCenterY = cy + (width < 640 ? 28 : 48);
      const textRx = Math.min(width * 0.34, 340);
      const textRy = Math.min(height * 0.14, 115);
      const invTextRxSq = 1 / (textRx * textRx);
      const invTextRySq = 1 / (textRy * textRy);
      const useScaledBlit = Math.abs(particleScale - 1) > 0.08;

      for (let i = 0; i < particleCount; i++) {
        let rN = pRNorm[i];
        let lifeAlpha = 1;

        const drift = pDriftRate[i];
        if (animate && drift > 0) {
          let life = pLife[i] + dt * 0.11;
          if (life >= 1) life -= 1;
          pLife[i] = life;
          rN += life * drift * 7;
          lifeAlpha = Math.sin(life * Math.PI);
        }

        const ang = pAngle[i] + (animate ? elapsed * pOmega[i] + warpSpinBoost : 0);
        const wobble = animate ? Math.sin(elapsed * 1.8 + pPhase[i]) * 0.004 : 0;

        const gx = Math.cos(ang) * (rN + wobble);
        const gy = Math.sin(ang) * (rN + wobble);

        const ty = gy * sinElev + pZ[i] * cosElev;
        const tz = gy * cosElev;
        const pScale = perspDist / (perspDist - tz * 0.55);

        const rx = (gx * cosRoll - ty * sinRoll) * pScale;
        const ry = (gx * sinRoll + ty * cosRoll) * pScale;

        const sx = gcx + rx * R;
        const sy = gcy + ry * R;

        if (sx < -28 || sx > width + 28 || sy < -28 || sy > height + 28) continue;

        const twinkle = animate
          ? 0.74 + 0.26 * Math.sin(elapsed * 2.1 + pPhase[i])
          : 1;

        let textDim = 1;
        if (warpEased < 0.3) {
          const dxT = sx - cx;
          const dyT = sy - textCenterY;
          const normDistSq = dxT * dxT * invTextRxSq + dyT * dyT * invTextRySq;
          if (normDistSq < 1) {
            textDim = 0.35 + 0.65 * normDistSq;
          }
        }

        // Apply global GALAXY_BRIGHTNESS multiplier and cap max alpha
        const alpha = Math.min(
          0.55,
          pBaseAlpha[i] * GALAXY_BRIGHTNESS * twinkle * lifeAlpha * textDim
        );
        if (alpha <= 0.02) continue;

        ctx.globalAlpha = alpha;

        const sizeBucket = pSize[i];
        if (sizeBucket === 255) {
          const sp = sparkleSprites[pSparkleIdx[i]];
          const half = sp.width * 0.5;
          ctx.drawImage(sp, (sx - half) | 0, (sy - half) | 0);
        } else {
          const rotAngle = pPhase[i] + (animate ? elapsed * pSpin[i] : 0);
          const angleIdx =
            Math.floor((((rotAngle % Math.PI) + Math.PI) % Math.PI) / (Math.PI / ANGLE_BUCKETS)) & 7;
          const sp = petalSprites[pColor[i]][sizeBucket][angleIdx];
          if (useScaledBlit) {
            const drawW = sp.width * particleScale;
            ctx.drawImage(sp, (sx - drawW * 0.5) | 0, (sy - drawW * 0.5) | 0, drawW, drawW);
          } else {
            const half = sp.width * 0.5;
            ctx.drawImage(sp, (sx - half) | 0, (sy - half) | 0);
          }
        }
      }

      // 4E. Recognizable Miniature Flower Blooms Along the 3 Spiral Arms
      ctx.globalCompositeOperation = "source-over";
      for (const b of tinyBlooms) {
        const ang = b.angle + (animate ? elapsed * b.omega + warpSpinBoost : 0);
        const gx = Math.cos(ang) * b.rNorm;
        const gy = Math.sin(ang) * b.rNorm;

        const ty = gy * sinElev;
        const tz = gy * cosElev;
        const pScale = perspDist / (perspDist - tz * 0.55);

        const rx = (gx * cosRoll - ty * sinRoll) * pScale;
        const ry = (gx * sinRoll + ty * cosRoll) * pScale;

        const sx = gcx + rx * R;
        const sy = gcy + ry * R;
        if (sx < -52 || sx > width + 52 || sy < -52 || sy > height + 52) continue;

        const sprite = bloomSprites[b.spriteIdx];
        const drawSz = b.size * particleScale * pScale * (1 + warpEased * 2.8);
        const twinkle = animate ? 0.84 + 0.16 * Math.sin(elapsed * 1.5 + b.twinklePhase) : 1;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(b.rot + (animate ? elapsed * b.spinSpeed : 0));
        ctx.globalAlpha = b.alpha * twinkle * Math.min(1, GALAXY_BRIGHTNESS * 1.35);
        ctx.drawImage(sprite.canvas, -drawSz / 2, -drawSz / 2, drawSz, drawSz);
        ctx.restore();
      }
      ctx.restore();

      // 5. Drifting Foreground Blooms Outside the Galaxy
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (const fg of foregroundBlooms) {
        if (animate) {
          fg.nx += fg.vx * dt;
          fg.ny += fg.vy * dt;
          if (fg.nx > 0.56) fg.nx = -0.56;
          if (fg.nx < -0.56) fg.nx = 0.56;
          if (fg.ny > 0.56) fg.ny = -0.56;
          if (fg.ny < -0.56) fg.ny = 0.56;
        }
        const fx = cx + fg.nx * width + mouseX * 28 * fg.depth;
        const fy = cy + fg.ny * height + mouseY * 28 * fg.depth;
        const sprite = bloomSprites[fg.spriteIdx];
        const drawSz = fg.size * particleScale * (1 + warpEased * 3.5);

        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(fg.rot + (animate ? elapsed * fg.spinSpeed : 0));
        ctx.globalAlpha = fg.alpha * (1 - warpEased * 0.7);
        ctx.drawImage(sprite.canvas, -drawSz / 2, -drawSz / 2, drawSz, drawSz);
        ctx.restore();
      }
      ctx.restore();

      // =======================================================================
      // 6. SHOOTING STARS & PETAL-TRAILED SHOOTING BLOOMS (Across Whole Screen)
      //    Spawn every 1.5 - 4s, up to 3 active; disabled under reduced motion
      // =======================================================================
      if (animate && warpEased < 0.1) {
        nextShootTimer -= dt;
        if (nextShootTimer <= 0) {
          spawnShootingStar();
          nextShootTimer = 1.5 + Math.random() * 2.5; // 1.5 to 4.0s
        }
      }

      if (animate && (shootingStars.length > 0 || trailPetals.length > 0)) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        // Update & draw drifting petal trail particles
        for (let i = trailPetals.length - 1; i >= 0; i--) {
          const tp = trailPetals[i];
          tp.life += dt;
          if (tp.life >= tp.maxLife) {
            trailPetals.splice(i, 1);
            continue;
          }
          tp.x += tp.vx * dt;
          tp.y += tp.vy * dt;
          tp.rot += tp.spin * dt;
          const fade = 1 - tp.life / tp.maxLife;
          const angleIdx =
            Math.floor((((tp.rot % Math.PI) + Math.PI) % Math.PI) / (Math.PI / ANGLE_BUCKETS)) & 7;
          const sp = petalSprites[tp.colorIdx][0][angleIdx];
          const half = sp.width * 0.5;
          ctx.globalAlpha = fade * 0.75;
          ctx.drawImage(sp, (tp.x - half) | 0, (tp.y - half) | 0);
        }

        // Update & draw shooting stars (max 3 active)
        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const st = shootingStars[i];
          st.life += dt;
          if (st.life >= st.maxLife) {
            shootingStars.splice(i, 1);
            continue;
          }

          st.x += st.vx * dt;
          st.y += st.vy * dt;

          const speedMag = Math.hypot(st.vx, st.vy);
          const dirX = st.vx / speedMag;
          const dirY = st.vy / speedMag;
          const tailX = st.x - dirX * st.tailLength;
          const tailY = st.y - dirY * st.tailLength;

          // Smooth fade-in and fade-out over lifetime (<1.2s)
          const tNorm = st.life / st.maxLife;
          const envelope = tNorm < 0.15 ? tNorm / 0.15 : 1 - (tNorm - 0.15) / 0.85;

          // Fading gradient tail (80 - 200px)
          const tailGrad = ctx.createLinearGradient(st.x, st.y, tailX, tailY);
          tailGrad.addColorStop(0, `rgba(${st.colorRgb}, ${(envelope * 0.9).toFixed(3)})`);
          tailGrad.addColorStop(0.35, `rgba(${st.colorRgb}, ${(envelope * 0.42).toFixed(3)})`);
          tailGrad.addColorStop(1, `rgba(${st.colorRgb}, 0)`);

          ctx.globalAlpha = 1;
          ctx.strokeStyle = tailGrad;
          ctx.lineWidth = st.headSize;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(st.x, st.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          if (st.isPetal) {
            // Petal/bloom head + spawn drifting petal trail particles
            const bloom = bloomSprites[st.bloomSpriteIdx];
            const headSz = 16;
            ctx.globalAlpha = envelope * 0.95;
            ctx.drawImage(bloom.canvas, st.x - headSz / 2, st.y - headSz / 2, headSz, headSz);

            st.spawnAccum += dt;
            if (st.spawnAccum >= 0.028) {
              st.spawnAccum = 0;
              trailPetals.push({
                x: st.x + (Math.random() - 0.5) * 6,
                y: st.y + (Math.random() - 0.5) * 6,
                vx: -dirX * (35 + Math.random() * 45) + (Math.random() - 0.5) * 40,
                vy: -dirY * (35 + Math.random() * 45) + (Math.random() - 0.5) * 40,
                life: 0,
                maxLife: 0.45 + Math.random() * 0.35,
                colorIdx: st.petalColorIdx,
                rot: Math.random() * TAU,
                spin: (Math.random() - 0.5) * 6,
              });
            }
          } else {
            // Bright luminous star head
            ctx.fillStyle = `rgba(255, 255, 255, ${envelope})`;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.headSize * 0.95, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 7. Strengthened Dark Radial Scrim Behind Title, Subtitle & Button
      if (warpEased < 0.85) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1 - warpEased;
        const scrimW = Math.min(width * 0.88, 860);
        const scrimH = Math.min(height * 0.46, 340);
        ctx.drawImage(
          textScrimSprite,
          cx - scrimW / 2,
          textCenterY - scrimH / 2,
          scrimW,
          scrimH
        );
        ctx.restore();
      }
    };

    const tick = (timestamp: number) => {
      if (isHidden) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      elapsed += dt;

      drawFrame(dt, true);
      rafId = requestAnimationFrame(tick);
    };

    const startOrRenderStatic = () => {
      cancelAnimationFrame(rafId);
      lastTimestamp = 0;
      if (reducedMotionQuery.matches) {
        shootingStars.length = 0;
        trailPetals.length = 0;
        drawFrame(0, false);
        return;
      }
      if (!isHidden) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (reducedMotionQuery.matches) return;
      targetMouseX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    const handleMouseLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
    };

    const handleVisibilityChange = () => {
      isHidden = document.hidden;
      if (isHidden) {
        cancelAnimationFrame(rafId);
      } else {
        startOrRenderStatic();
      }
    };

    const handleResize = () => {
      resize();
      if (reducedMotionQuery.matches) {
        drawFrame(0, false);
      }
    };

    resize();
    startOrRenderStatic();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", startOrRenderStatic);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", startOrRenderStatic);
    };
  }, [warpProgressRef]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={SITE_CONTENT.home.canvasAriaLabel}
      className="fixed inset-0 block h-full w-full"
    />
  );
}
