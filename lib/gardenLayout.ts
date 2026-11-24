/**
 * Dual-Composition Cosmic Garden Layout & Ground Flora Definitions
 * - Landscape (`aspect > 1.2`): 3 lush depth rows spread across 95%+ width
 *   with extra edge flowers and tall grass so wide screens have zero empty sides.
 * - Portrait (`aspect <= 1.2`): 4 vertically stacked depth rows tailored for phones
 *   and portrait tablets, spanning ~92% width and ~40%..90% height.
 *
 * Reuses the exact parameterized growth engine from `lib/flowerGrowth.ts`.
 */

import {
  HERO_BASE_X,
  HERO_BASE_Y,
  type FlowerSpecies,
  type PetalShape,
  type StemParams,
} from "@/lib/flowerGrowth";
import { createSeededRandom, randomRange } from "@/lib/math";

export type GardenComposition = "landscape" | "portrait";

export interface GardenLeafSpec {
  nodeU: number;
  side: -1 | 1;
  maxPetiole: number;
  maxLength: number;
  maxWidth: number;
  finalAngleDeg: number;
}

export interface GardenPetalSpec {
  targetAngleDeg: number;
  maxLength: number;
  maxWidth: number;
  stagger: number;
  opacity: number;
  isInner: boolean;
}

export interface GardenFlowerDef {
  id: string;
  species: FlowerSpecies;
  shape: PetalShape;
  row: 0 | 1 | 2 | 3; // landscape uses 0..2; portrait uses 0..3 (row >= 2 renders in front of hero roots)
  baseX: number;
  baseY: number;
  scale: number;
  rowOpacity: number;
  gradId: string;
  coreColor: string;
  coreR: number;
  startSec: number;
  durationSec: number;
  stem: StemParams;
  leaves: GardenLeafSpec[];
  petals: GardenPetalSpec[];
  windPhase: number;
}

export interface GrassBladeDef {
  id: string;
  baseX: number;
  baseY: number;
  height: number;
  lean: number;
  startSec: number;
  color: string;
  isSprout: boolean;
}

export interface MushroomDef {
  id: string;
  x: number;
  y: number;
  capRx: number;
  capRy: number;
  stemH: number;
  startSec: number;
  color: string;
}

export interface MossTuftDef {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  startSec: number;
  color: string;
}

/**
 * Gently curved horizon ground elevation across the full overscanned width [-420..1540].
 */
export function groundYAt(x: number): number {
  const norm = Math.max(-1.4, Math.min(1.4, (x - HERO_BASE_X) / 620));
  return HERO_BASE_Y + 6 + norm * norm * 32;
}

const SPECIES_STYLE: Record<
  Exclude<FlowerSpecies, "hero">,
  {
    shape: PetalShape;
    gradId: string;
    coreColor: string;
    petalCount: number;
    innerCount: number;
    baseLen: number;
    baseW: number;
    coreR: number;
  }
> = {
  lily: {
    shape: "lily",
    gradId: "sbsGardenLilyGrad",
    coreColor: "#fef08a",
    petalCount: 6,
    innerCount: 0,
    baseLen: 44,
    baseW: 13,
    coreR: 5.5,
  },
  rose: {
    shape: "teardrop",
    gradId: "sbsGardenRoseGrad",
    coreColor: "#fde047",
    petalCount: 7,
    innerCount: 4,
    baseLen: 38,
    baseW: 16,
    coreR: 6.0,
  },
  tulip: {
    shape: "tulip",
    gradId: "sbsGardenTulipGrad",
    coreColor: "#fed7aa",
    petalCount: 5,
    innerCount: 0,
    baseLen: 40,
    baseW: 17,
    coreR: 5.0,
  },
  bluebell: {
    shape: "bell",
    gradId: "sbsGardenBellGrad",
    coreColor: "#e0f2fe",
    petalCount: 5,
    innerCount: 0,
    baseLen: 36,
    baseW: 14,
    coreR: 4.8,
  },
  daisy: {
    shape: "daisy",
    gradId: "sbsGardenDaisyGrad",
    coreColor: "#facc15",
    petalCount: 9,
    innerCount: 0,
    baseLen: 37,
    baseW: 9.5,
    coreR: 7.5,
  },
};

type Placement = {
  x: number;
  yOffset: number;
  row: 0 | 1 | 2 | 3;
  species: Exclude<FlowerSpecies, "hero">;
  height: number;
  curveDir: -1 | 1;
};

export function createGardenLayout(
  composition: GardenComposition = "landscape",
  seed = 20261124
): {
  flowers: GardenFlowerDef[];
  grass: GrassBladeDef[];
  mushrooms: MushroomDef[];
  moss: MossTuftDef[];
} {
  const rng = createSeededRandom(seed + (composition === "portrait" ? 193 : 77));

  const landscapePlacements: Placement[] = [
    // Back row (row 0 — spans wide across 95%+ of landscape + ultrawide 844x390 edges)
    { x: -265, yOffset: -4, row: 0, species: "bluebell", height: 112, curveDir: 1 },
    { x: -125, yOffset: -8, row: 0, species: "daisy", height: 118, curveDir: 1 },
    { x: 42, yOffset: -10, row: 0, species: "bluebell", height: 128, curveDir: -1 },
    { x: 198, yOffset: -12, row: 0, species: "lily", height: 142, curveDir: 1 },
    { x: 358, yOffset: -14, row: 0, species: "daisy", height: 136, curveDir: -1 },
    { x: 762, yOffset: -14, row: 0, species: "tulip", height: 138, curveDir: 1 },
    { x: 922, yOffset: -12, row: 0, species: "bluebell", height: 142, curveDir: -1 },
    { x: 1078, yOffset: -10, row: 0, species: "daisy", height: 128, curveDir: 1 },
    { x: 1245, yOffset: -8, row: 0, species: "lily", height: 118, curveDir: -1 },
    { x: 1385, yOffset: -4, row: 0, species: "tulip", height: 112, curveDir: -1 },

    // Middle row (row 1 — lush mid-ground flanking the hero)
    { x: -45, yOffset: 14, row: 1, species: "tulip", height: 158, curveDir: 1 },
    { x: 132, yOffset: 12, row: 1, species: "rose", height: 170, curveDir: 1 },
    { x: 288, yOffset: 10, row: 1, species: "tulip", height: 184, curveDir: -1 },
    { x: 426, yOffset: 8, row: 1, species: "lily", height: 192, curveDir: -1 },
    { x: 694, yOffset: 8, row: 1, species: "rose", height: 190, curveDir: 1 },
    { x: 832, yOffset: 10, row: 1, species: "daisy", height: 180, curveDir: 1 },
    { x: 988, yOffset: 12, row: 1, species: "lily", height: 168, curveDir: -1 },
    { x: 1165, yOffset: 14, row: 1, species: "rose", height: 156, curveDir: -1 },

    // Front row (row 2 — rich foreground blooms filling lower ground)
    { x: 78, yOffset: 42, row: 2, species: "tulip", height: 184, curveDir: 1 },
    { x: 252, yOffset: 48, row: 2, species: "bluebell", height: 194, curveDir: -1 },
    { x: 868, yOffset: 48, row: 2, species: "rose", height: 196, curveDir: 1 },
    { x: 1042, yOffset: 42, row: 2, species: "tulip", height: 182, curveDir: -1 },
  ];

  // Portrait composition: 4 vertically stacked rows spanning ~92% width & 40%..90% height
  const portraitPlacements: Placement[] = [
    // Row 0 (High Back Hill — peeking softly above/behind hero shoulders)
    { x: 356, yOffset: -62, row: 0, species: "bluebell", height: 128, curveDir: -1 },
    { x: 454, yOffset: -74, row: 0, species: "daisy", height: 122, curveDir: 1 },
    { x: 666, yOffset: -74, row: 0, species: "lily", height: 124, curveDir: -1 },
    { x: 764, yOffset: -62, row: 0, species: "bluebell", height: 130, curveDir: 1 },

    // Row 1 (Upper-Mid Row — flanking hero on left & right, plus tablet wings)
    { x: 222, yOffset: 4, row: 1, species: "rose", height: 152, curveDir: 1 },
    { x: 326, yOffset: -10, row: 1, species: "lily", height: 164, curveDir: 1 },
    { x: 428, yOffset: -16, row: 1, species: "tulip", height: 158, curveDir: -1 },
    { x: 692, yOffset: -16, row: 1, species: "rose", height: 162, curveDir: 1 },
    { x: 794, yOffset: -10, row: 1, species: "daisy", height: 166, curveDir: -1 },
    { x: 898, yOffset: 4, row: 1, species: "lily", height: 152, curveDir: -1 },

    // Row 2 (Lower-Mid Row — stepping forward below main ground line)
    { x: 254, yOffset: 64, row: 2, species: "tulip", height: 160, curveDir: 1 },
    { x: 352, yOffset: 54, row: 2, species: "rose", height: 174, curveDir: -1 },
    { x: 468, yOffset: 66, row: 2, species: "bluebell", height: 152, curveDir: 1 },
    { x: 652, yOffset: 66, row: 2, species: "tulip", height: 154, curveDir: -1 },
    { x: 768, yOffset: 54, row: 2, species: "lily", height: 176, curveDir: 1 },
    { x: 866, yOffset: 64, row: 2, species: "daisy", height: 160, curveDir: -1 },

    // Row 3 (Foreground Row — large bright framing flowers at the bottom)
    { x: 382, yOffset: 136, row: 3, species: "tulip", height: 164, curveDir: 1 },
    { x: 738, yOffset: 136, row: 3, species: "rose", height: 166, curveDir: -1 },
  ];

  const placements = composition === "portrait" ? portraitPlacements : landscapePlacements;

  const flowers: GardenFlowerDef[] = placements.map((pl, idx) => {
    const spec = SPECIES_STYLE[pl.species];
    const rowScale =
      pl.row === 0 ? 0.62 : pl.row === 1 ? 0.8 : pl.row === 2 ? 0.94 : 1.02;
    const scale = rowScale * randomRange(rng, 0.93, 1.07);
    const rowOpacity =
      pl.row === 0 ? 0.58 : pl.row === 1 ? 0.84 : pl.row === 2 ? 0.95 : 1.0;
    const baseY = groundYAt(pl.x) + pl.yOffset + randomRange(rng, -4, 4);

    const h = pl.height * randomRange(rng, 0.94, 1.06);
    const swayBend = pl.curveDir * randomRange(rng, 10, 22);
    const tipLean = pl.curveDir * randomRange(rng, 6, 16);

    const stem: StemParams = {
      p0: { x: pl.x, y: baseY },
      p1: { x: pl.x + swayBend * 0.7, y: baseY - h * 0.34 },
      p2: { x: pl.x - swayBend * 0.45 + tipLean * 0.6, y: baseY - h * 0.72 },
      p3: { x: pl.x + tipLean, y: baseY - h },
      baseHalfW: 3.4 * scale,
      tipTaper: 0.65,
      sampleCount: 14,
      hookAmp: 7 * scale,
    };

    const leaves: GardenLeafSpec[] = [
      {
        nodeU: 0.32,
        side: pl.curveDir,
        maxPetiole: 7 * scale,
        maxLength: 38 * scale,
        maxWidth: 12 * scale,
        finalAngleDeg: 58,
      },
      {
        nodeU: 0.58,
        side: (pl.curveDir * -1) as -1 | 1,
        maxPetiole: 6 * scale,
        maxLength: 30 * scale,
        maxWidth: 10 * scale,
        finalAngleDeg: 50,
      },
    ];

    const petals: GardenPetalSpec[] = [];
    const step = 360 / spec.petalCount;
    for (let i = 0; i < spec.petalCount; i++) {
      let ang = i * step + randomRange(rng, -5, 5);
      while (ang > 180) ang -= 360;
      while (ang < -180) ang += 360;
      petals.push({
        targetAngleDeg: ang,
        maxLength: spec.baseLen * scale * randomRange(rng, 0.92, 1.08),
        maxWidth: spec.baseW * scale * randomRange(rng, 0.92, 1.08),
        stagger: (i / spec.petalCount) * 0.1,
        opacity: 0.88,
        isInner: false,
      });
    }
    if (spec.innerCount > 0) {
      const innerStep = 360 / spec.innerCount;
      for (let i = 0; i < spec.innerCount; i++) {
        let ang = innerStep * 0.5 + i * innerStep + randomRange(rng, -6, 6);
        while (ang > 180) ang -= 360;
        while (ang < -180) ang += 360;
        petals.push({
          targetAngleDeg: ang,
          maxLength: spec.baseLen * 0.66 * scale,
          maxWidth: spec.baseW * 0.72 * scale,
          stagger: 0.14 + (i / spec.innerCount) * 0.08,
          opacity: 0.96,
          isInner: true,
        });
      }
    }

    const maxDist = composition === "portrait" ? 300 : 720;
    const distNorm = Math.min(1, Math.abs(pl.x - HERO_BASE_X) / maxDist);
    const startSec = 0.2 + distNorm * 1.95 + pl.row * 0.14;
    const durationSec = randomRange(rng, 4.1, 4.9);

    return {
      id: `garden-${composition}-${idx}-${pl.species}`,
      species: pl.species,
      shape: spec.shape,
      row: pl.row,
      baseX: pl.x,
      baseY,
      scale,
      rowOpacity,
      gradId: spec.gradId,
      coreColor: spec.coreColor,
      coreR: spec.coreR * scale,
      startSec,
      durationSec,
      stem,
      leaves,
      petals,
      windPhase: randomRange(rng, 0, Math.PI * 2),
    };
  });

  // Rich glowing grass & sprouts extending across the overscanned width + lower foreground
  const grassCount = composition === "portrait" ? 40 : 64;
  const xMin = composition === "portrait" ? 140 : -360;
  const xMax = composition === "portrait" ? 980 : 1480;
  const grass: GrassBladeDef[] = Array.from({ length: grassCount }, (_, i) => {
    const x = xMin + (i / (grassCount - 1)) * (xMax - xMin) + randomRange(rng, -14, 14);
    const ySpread = composition === "portrait" ? randomRange(rng, -35, 185) : randomRange(rng, -10, 118);
    const y = groundYAt(x) + ySpread;
    const distNorm = Math.min(1, Math.abs(x - HERO_BASE_X) / 680);
    return {
      id: `grass-${composition}-${i}`,
      baseX: x,
      baseY: y,
      height: randomRange(rng, 22, 54),
      lean: randomRange(rng, -16, 16),
      startSec: 0.15 + distNorm * 1.8,
      color: i % 5 === 0 ? "#fde68a" : i % 2 === 0 ? "#2dd4bf" : "#0f766e",
      isSprout: i % 5 === 0,
    };
  });

  // Glowing mushrooms filling foreground edges and lower meadow
  const mushroomCoords =
    composition === "portrait"
      ? [
          { x: 318, yOff: 96 },
          { x: 348, yOff: 148 },
          { x: 438, yOff: 162 },
          { x: 682, yOff: 160 },
          { x: 774, yOff: 144 },
          { x: 806, yOff: 94 },
        ]
      : [
          { x: -85, yOff: 52 },
          { x: 38, yOff: 78 },
          { x: 162, yOff: 96 },
          { x: 418, yOff: 108 },
          { x: 702, yOff: 108 },
          { x: 958, yOff: 96 },
          { x: 1082, yOff: 78 },
          { x: 1205, yOff: 52 },
        ];

  const mushrooms: MushroomDef[] = mushroomCoords.map((mc, i) => ({
    id: `mush-${composition}-${i}`,
    x: mc.x,
    y: groundYAt(mc.x) + mc.yOff,
    capRx: randomRange(rng, 9, 15),
    capRy: randomRange(rng, 5, 8),
    stemH: randomRange(rng, 12, 21),
    startSec: 1.35 + (i % 4) * 0.22,
    color: i % 2 === 0 ? "#c084fc" : "#5eead4",
  }));

  // Soft glowing moss tufts scattered across the lower foreground
  const mossCount = composition === "portrait" ? 10 : 14;
  const moss: MossTuftDef[] = Array.from({ length: mossCount }, (_, i) => {
    const x = xMin + 50 + (i / (mossCount - 1)) * (xMax - xMin - 100) + randomRange(rng, -24, 24);
    const yOff = composition === "portrait" ? randomRange(rng, 45, 195) : randomRange(rng, 32, 122);
    return {
      id: `moss-${composition}-${i}`,
      x,
      y: groundYAt(x) + yOff,
      rx: randomRange(rng, 28, 62),
      ry: randomRange(rng, 8, 16),
      startSec: 0.7 + (i % 5) * 0.24,
      color: i % 2 === 0 ? "#0f766e" : "#312e81",
    };
  });

  return { flowers, grass, mushrooms, moss };
}
