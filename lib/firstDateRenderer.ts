/**
 * Canvas 2D Renderer for the redesigned "Our First Date" — Flowering Valley World
 * - 2.5D layered parallax valley: daylight sky (4-min slow morning->afternoon cycle),
 *   drifting clouds, warm sun, faint crescent moon, crossing birds, 4 hill/meadow layers,
 *   winding river flowing into a sea with rolling waves, harbor dock & 2 rocking sailboats.
 * - Literal growth from seeds/saplings/ground: ~260 desktop / ~145 mobile flowers
 *   (pre-rendered 5x4 growth-stage sprites), 12 desktop / 8 mobile trees (oak, pine,
 *   blossoming cherry), 6 cozy houses + riverside First Date Cafe (terrace, 2 empty chairs,
 *   flickering candle, string lights, path & little bridge).
 * - Interactive camera pan + mouse tilt, 8 softly glowing memory hotspots, tap-to-plant
 *   alternating flowers & trees (max 60, recycling oldest), river touch ripples,
 *   and the Dusk Lantern Finale (reusing the rounded paper lantern sprite builder).
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

export interface HotspotHUD {
  id: number;
  x: number; // screen X
  y: number; // screen Y
  discovered: boolean;
  memoryIndex: number; // -1 until discovered
}

export interface ValleyHUDState {
  hotspots: HotspotHUD[];
  discoveredCount: number;
  duskActive: boolean;
  cafeScreenX: number;
  cafeScreenY: number;
  moonScreenX: number;
  moonScreenY: number;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
}

interface Bird {
  x: number;
  y: number;
  vx: number;
  flapPhase: number;
  size: number;
}

interface ValleyFlower {
  wx: number; // world X relative to center
  y: number;
  palette: number; // 0..4
  size: number;
  startDelay: number;
  growth: number; // 0..1
  phase: number;
  isPlanted: boolean;
}

interface ValleyTree {
  wx: number;
  y: number;
  species: "oak" | "pine" | "cherry";
  maxH: number;
  startDelay: number;
  growth: number; // 0..1
  phase: number;
  isPlanted: boolean;
}

interface ValleyHouse {
  wx: number;
  y: number;
  w: number;
  h: number;
  wallColor: string;
  roofColor: string;
  isCafe: boolean;
  startDelay: number;
  build: number; // 0..1
  smokePhase: number;
}

interface Insect {
  wx: number;
  y: number;
  vx: number;
  vy: number;
  isBee: boolean;
  color: string;
  phase: number;
}

interface Ripple {
  wx: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
}

interface FallingPetal {
  wx: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  color: string;
  age: number;
  life: number;
}

interface Firefly {
  wx: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  r: number;
}

interface RiverLantern {
  t: number; // 0..1 along river curve out to sea
  speed: number;
  tintIdx: number;
  phase: number;
}

interface HeartLantern {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  t: number;
  delay: number;
  tintIdx: number;
  phase: number;
}

interface HotspotNode {
  id: number;
  wx: number;
  y: number;
  discovered: boolean;
  memoryIndex: number;
}

interface GrassTuft {
  wx: number;
  y: number;
  h: number;
  lean: number;
  phase: number;
}

interface SkyStar {
  x: number;
  y: number;
  r: number;
  phase: number;
}

const LANTERN_TINTS = [
  { top: "#d97706", mid: "#f59e0b", core: "#fffbeb", halo: "rgba(253, 224, 71, 0.34)" },
  { top: "#be185d", mid: "#f472b6", core: "#fff1f2", halo: "rgba(244, 114, 182, 0.32)" },
  { top: "#c2410c", mid: "#fb923c", core: "#fef3c7", halo: "rgba(251, 146, 60, 0.34)" },
] as const;

const FLOWER_COLORS = [
  { petal: "#f472b6", inner: "#fbcfe8", core: "#fef08a" },
  { petal: "#a855f7", inner: "#e9d5ff", core: "#fef9c3" },
  { petal: "#fbbf24", inner: "#fef08a", core: "#fffbeb" },
  { petal: "#60a5fa", inner: "#dbeafe", core: "#fef08a" },
  { petal: "#fb7185", inner: "#ffe4e6", core: "#fde68a" },
] as const;

/** Reused rounded paper lantern sprite builder from the original scene for the dusk finale. */
function buildLanternSprite(
  baseRadius: number,
  tint: (typeof LANTERN_TINTS)[number]
): HTMLCanvasElement {
  const pad = Math.ceil(baseRadius * 2.3);
  const dim = pad * 2;
  const c = document.createElement("canvas");
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const cx = pad;
  const cy = pad;
  const rx = baseRadius * 0.72;
  const ry = baseRadius * 0.95;

  const haloGrad = ctx.createRadialGradient(cx, cy + ry * 0.1, rx * 0.2, cx, cy, baseRadius * 2.1);
  haloGrad.addColorStop(0, tint.halo);
  haloGrad.addColorStop(0.55, "rgba(251, 191, 36, 0.10)");
  haloGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 2.1, 0, TAU);
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(cx, cy + ry * 0.32, rx * 0.12, cx, cy, ry * 1.15);
  bodyGrad.addColorStop(0, tint.core);
  bodyGrad.addColorStop(0.45, tint.mid);
  bodyGrad.addColorStop(1, tint.top);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(120, 40, 15, 0.25)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.45, ry * 0.96, 0, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "rgba(92, 42, 18, 0.72)";
  ctx.fillRect(cx - rx * 0.48, cy + ry * 0.88, rx * 0.96, Math.max(1.8, baseRadius * 0.14));
  return c;
}

/** Pre-renders 5 palettes x 4 literal growth-stage flower sprites (sprout -> stem/leaves -> bud -> bloom). */
function buildFlowerGrowthSprites(): HTMLCanvasElement[][] {
  return FLOWER_COLORS.map((col) =>
    [0, 1, 2, 3].map((stage) => {
      const w = 36;
      const h = 48;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return c;

      const bx = w * 0.5;
      const by = h - 4;
      const stemH = stage === 0 ? 10 : stage === 1 ? 22 : 30;

      // Stem
      ctx.strokeStyle = "#3f8f4e";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx - 2, by - stemH * 0.5, bx, by - stemH);
      ctx.stroke();

      // Leaves from stage 1+
      if (stage >= 1) {
        ctx.fillStyle = "#4caf50";
        ctx.beginPath();
        ctx.ellipse(bx - 5, by - stemH * 0.45, 5, 2.3, -0.5, 0, TAU);
        ctx.ellipse(bx + 5, by - stemH * 0.35, 5, 2.3, 0.5, 0, TAU);
        ctx.fill();
      }

      const hy = by - stemH;
      if (stage === 0) {
        ctx.fillStyle = "#86efac";
        ctx.beginPath();
        ctx.arc(bx, hy, 2.2, 0, TAU);
        ctx.fill();
      } else if (stage === 1 || stage === 2) {
        ctx.fillStyle = col.petal;
        ctx.beginPath();
        ctx.ellipse(bx, hy - 2, stage === 1 ? 2.8 : 4.2, stage === 1 ? 4.4 : 6.2, 0, 0, TAU);
        ctx.fill();
      } else {
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * TAU - Math.PI * 0.5;
          ctx.save();
          ctx.translate(bx, hy);
          ctx.rotate(ang);
          ctx.fillStyle = col.petal;
          ctx.beginPath();
          ctx.ellipse(0, -6.2, 3.6, 6.2, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = col.inner;
          ctx.beginPath();
          ctx.ellipse(0, -5, 1.8, 3.6, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = col.core;
        ctx.beginPath();
        ctx.arc(bx, hy, 2.8, 0, TAU);
        ctx.fill();
      }
      return c;
    })
  );
}

function mixHex(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

export class FirstDateValleyRenderer {
  private width = 1;
  private height = 1;
  private dpr = 1;
  private isMobile = false;
  private isPortrait = false;
  private reducedMotion = false;
  private totalMemories = 8;

  private horizonY = 0;
  private maxPanX = 180;
  private panX = 0;
  private targetPanX = 0;
  private tiltX = 0;
  private tiltY = 0;

  private time = 0;
  private duskActive = false;
  private dusk = 0; // 0 = day, 1 = full dusk
  private discoveredCount = 0;
  private nextMemoryIdx = 0;
  private plantToggle = false;
  private plantedCount = 0;
  private moonFound = false;

  public setMoonFound(found: boolean): void {
    this.moonFound = found;
  }

  private flowerSprites: HTMLCanvasElement[][] = [];
  private lanternSprites: HTMLCanvasElement[] = [];

  private clouds: Cloud[] = [];
  private birds: Bird[] = [];
  private stars: SkyStar[] = [];
  private flowers: ValleyFlower[] = [];
  private trees: ValleyTree[] = [];
  private houses: ValleyHouse[] = [];
  private grass: GrassTuft[] = [];
  private insects: Insect[] = [];
  private ripples: Ripple[] = [];
  private petals: FallingPetal[] = [];
  private fireflies: Firefly[] = [];
  private riverLanterns: RiverLantern[] = [];
  private heartLanterns: HeartLantern[] = [];
  private hotspots: HotspotNode[] = [];

  private cafeWx = 0;
  private cafeY = 0;
  private bridgeWx = 0;
  private bridgeY = 0;
  private dockWx = 0;
  private dockY = 0;

  private onFinaleCb?: () => void;

  constructor(opts: { totalMemories: number; reducedMotion: boolean; onFinale?: () => void }) {
    this.totalMemories = Math.max(1, opts.totalMemories);
    this.reducedMotion = opts.reducedMotion;
    this.onFinaleCb = opts.onFinale;
    this.flowerSprites = buildFlowerGrowthSprites();
    this.lanternSprites = LANTERN_TINTS.map((t) => buildLanternSprite(11, t));
  }

  public setReducedMotion(rm: boolean): void {
    this.reducedMotion = rm;
  }

  public resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.isMobile = this.width < 680;
    this.isPortrait = this.height > this.width * 1.05;
    this.horizonY = this.isPortrait ? this.height * 0.40 : this.height * 0.42;
    this.maxPanX = this.isPortrait ? Math.max(160, this.width * 0.42) : Math.max(180, this.width * 0.24);
    this.panX = clamp(this.panX, -this.maxPanX, this.maxPanX);
    this.targetPanX = clamp(this.targetPanX, -this.maxPanX, this.maxPanX);

    this.buildWorld();
  }

  /** River centerline in world coordinates (t = 0 foreground -> t = 1 sea horizon on right) */
  private sampleRiver(t: number): { wx: number; y: number; halfW: number } {
    const h = this.height;
    const p0x = -this.width * 0.16;
    const p0y = h + 20;
    const p1x = -this.width * 0.04;
    const p1y = h * 0.74;
    const p2x = this.width * 0.14;
    const p2y = this.horizonY + (h - this.horizonY) * 0.34;
    const p3x = this.width * 0.36;
    const p3y = this.horizonY + 12;
    const mt = 1 - t;
    const wx = mt * mt * mt * p0x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * p3x;
    const y = mt * mt * mt * p0y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * p3y;
    const halfW = lerp(this.isMobile ? 46 : 64, 16, Math.pow(t, 0.85));
    return { wx, y, halfW };
  }

  private worldToScreenX(wx: number, parallax = 1): number {
    return this.width * 0.5 + wx - (this.panX + this.tiltX) * parallax;
  }

  public panBy(dx: number): void {
    this.targetPanX = clamp(this.targetPanX - dx, -this.maxPanX, this.maxPanX);
  }

  public setMouseTilt(normX: number, normY: number): void {
    this.tiltX = clamp(normX * 26, -26, 26);
    this.tiltY = clamp(normY * 8, -8, 8);
  }

  /** Smoothly pan camera to an undiscovered memory hotspot */
  public focusNextUndiscovered(): HotspotNode | null {
    const next = this.hotspots.find((h) => !h.discovered) ?? this.hotspots[0] ?? null;
    if (!next) return null;
    this.targetPanX = clamp(next.wx, -this.maxPanX, this.maxPanX);
    return next;
  }

  /** Trigger a hotspot by its index (returns memoryIndex or null) */
  public activateHotspot(id: number): number | null {
    const hs = this.hotspots.find((h) => h.id === id);
    if (!hs) return null;

    if (!hs.discovered) {
      hs.discovered = true;
      hs.memoryIndex = this.nextMemoryIdx;
      this.nextMemoryIdx = (this.nextMemoryIdx + 1) % this.totalMemories;
      this.discoveredCount++;
      if (this.discoveredCount >= this.totalMemories && !this.duskActive) {
        this.triggerDuskFinale();
      }
    }
    return hs.memoryIndex;
  }

  /** Handle tap on canvas: hotspot hit, river ripple, or plant flower/tree on empty meadow */
  public handleTap(
    sx: number,
    sy: number
  ): { type: "hotspot"; hotspotId: number; memoryIndex: number; x: number; y: number } | { type: "planted" } | { type: "ripple" } | { type: "none" } {
    // 1. Check memory hotspots (generous 46px radius)
    for (const hs of this.hotspots) {
      const hx = this.worldToScreenX(hs.wx, 1);
      if (Math.hypot(sx - hx, sy - hs.y) <= 46) {
        const memIdx = this.activateHotspot(hs.id);
        if (memIdx !== null) {
          return { type: "hotspot", hotspotId: hs.id, memoryIndex: memIdx, x: hx, y: hs.y };
        }
      }
    }

    // 2. Check river tap for water ripple
    const wx = sx - this.width * 0.5 + this.panX + this.tiltX;
    if (sy > this.horizonY + 12) {
      for (let i = 0; i <= 24; i++) {
        const rv = this.sampleRiver(i / 24);
        if (Math.abs(sy - rv.y) < 26 && Math.abs(wx - rv.wx) <= rv.halfW + 10) {
          this.ripples.push({ wx, y: sy, r: 4, maxR: 34, life: 0, maxLife: 1.4 });
          return { type: "ripple" };
        }
      }

      // 3. Plant alternating flower or sapling tree on empty meadow!
      if (sy > this.horizonY + 34 && sy < this.height - 22) {
        this.plantAt(wx, sy);
        return { type: "planted" };
      }
    }

    return { type: "none" };
  }

  private plantAt(wx: number, y: number): void {
    this.plantToggle = !this.plantToggle;
    this.plantedCount++;
    if (this.plantedCount > 60) {
      // Recycle oldest planted item
      const oldF = this.flowers.findIndex((f) => f.isPlanted);
      if (oldF !== -1) this.flowers.splice(oldF, 1);
      else {
        const oldT = this.trees.findIndex((t) => t.isPlanted);
        if (oldT !== -1) this.trees.splice(oldT, 1);
      }
    }

    if (this.plantToggle) {
      this.flowers.push({
        wx,
        y,
        palette: Math.floor(Math.random() * FLOWER_COLORS.length),
        size: (this.isMobile ? 22 : 28) + Math.random() * 10,
        startDelay: 0,
        growth: 0.02,
        phase: Math.random() * TAU,
        isPlanted: true,
      });
    } else {
      const speciesList: Array<"oak" | "pine" | "cherry"> = ["cherry", "oak", "pine"];
      this.trees.push({
        wx,
        y,
        species: speciesList[this.plantedCount % 3],
        maxH: (this.isMobile ? 62 : 82) + Math.random() * 24,
        startDelay: 0,
        growth: 0.02,
        phase: Math.random() * TAU,
        isPlanted: true,
      });
      this.trees.sort((a, b) => a.y - b.y);
    }

    // Sparkle & petal burst at planted spot
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      this.petals.push({
        wx,
        y: y - 6,
        vx: Math.cos(ang) * (18 + Math.random() * 24),
        vy: Math.sin(ang) * 14 - 22,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 4,
        size: 5 + Math.random() * 4,
        color: i % 2 === 0 ? "#fbcfe8" : "#fde68a",
        age: 0,
        life: 1.8,
      });
    }
  }

  private triggerDuskFinale(): void {
    if (this.duskActive) return;
    this.duskActive = true;

    // Seed glowing river lanterns floating down the river out to the sea
    this.riverLanterns = Array.from({ length: this.isMobile ? 10 : 16 }, (_, i) => ({
      t: -i * 0.085,
      speed: 0.055 + (i % 3) * 0.008,
      tintIdx: i % LANTERN_TINTS.length,
      phase: i * 1.1,
    }));

    // Sky lanterns rising to form a small heart above the cafe
    const heartCount = 12;
    const heartCx = this.cafeWx;
    const heartCy = this.horizonY - (this.isPortrait ? 56 : 66);
    const heartScale = this.isMobile ? 2.6 : 3.4;
    this.heartLanterns = Array.from({ length: heartCount }, (_, i) => {
      const a = (i / heartCount) * TAU;
      const hx = 16 * Math.pow(Math.sin(a), 3) * heartScale;
      const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * heartScale;
      return {
        x: this.cafeWx + (Math.random() - 0.5) * 40,
        y: this.cafeY - 12,
        startX: this.cafeWx + (Math.random() - 0.5) * 40,
        startY: this.cafeY - 12,
        targetX: heartCx + hx,
        targetY: heartCy + hy,
        t: 0,
        delay: i * 0.16,
        tintIdx: i % LANTERN_TINTS.length,
        phase: i * 0.9,
      };
    });

    this.onFinaleCb?.();
  }

  public getHUDState(): ValleyHUDState {
    return {
      hotspots: this.hotspots.map((h) => ({
        id: h.id,
        x: this.worldToScreenX(h.wx, 1),
        y: h.y,
        discovered: h.discovered,
        memoryIndex: h.memoryIndex,
      })),
      discoveredCount: this.discoveredCount,
      duskActive: this.duskActive,
      cafeScreenX: this.worldToScreenX(this.cafeWx, 1),
      cafeScreenY: this.cafeY,
      moonScreenX: this.worldToScreenX(-this.width * 0.28, 0.10),
      moonScreenY: this.height * 0.14,
    };
  }

  private buildWorld(): void {
    const rng = createSeededRandom(20260615);
    const w = this.width;
    const h = this.height;
    const span = w + this.maxPanX * 2 + 120;

    // Preserve discovered state across resizes
    const prevDiscovered = new Map(this.hotspots.map((hs) => [hs.id, { discovered: hs.discovered, memoryIndex: hs.memoryIndex }]));

    // Clouds & birds & dusk stars
    this.clouds = Array.from({ length: this.isMobile ? 6 : 10 }, () => ({
      x: randomRange(rng, -span * 0.5, span * 0.5),
      y: randomRange(rng, h * 0.06, this.horizonY * 0.68),
      w: randomRange(rng, 75, 165),
      h: randomRange(rng, 22, 42),
      speed: randomRange(rng, 6, 15),
      alpha: randomRange(rng, 0.55, 0.85),
    }));

    this.birds = Array.from({ length: this.isMobile ? 4 : 7 }, () => ({
      x: randomRange(rng, -span * 0.5, span * 0.5),
      y: randomRange(rng, h * 0.10, this.horizonY * 0.65),
      vx: randomRange(rng, 24, 48) * (rng() > 0.3 ? 1 : -1),
      flapPhase: rng() * TAU,
      size: randomRange(rng, 4.5, 7.5),
    }));

    this.stars = Array.from({ length: this.isMobile ? 55 : 110 }, () => ({
      x: rng() * w,
      y: rng() * this.horizonY * 0.92,
      r: randomRange(rng, 0.6, 1.8),
      phase: rng() * TAU,
    }));

    // Key landmark coordinates (spread across the valley, cafe near river bend)
    const riverMid = this.sampleRiver(0.50);
    const riverBridge = this.sampleRiver(0.35);
    this.cafeWx = riverMid.wx - (this.isMobile ? 74 : 112);
    this.cafeY = riverMid.y + 8;
    this.bridgeWx = riverBridge.wx;
    this.bridgeY = riverBridge.y;
    this.dockWx = w * 0.38;
    this.dockY = this.horizonY + 28;

    // 6 cozy houses + the First Date Cafe
    const houseSpecs: Array<{ wx: number; y: number; w: number; h: number; wall: string; roof: string; isCafe: boolean }> = [
      { wx: this.cafeWx, y: this.cafeY, w: 68, h: 40, wall: "#fef3c7", roof: "#b45309", isCafe: true },
      { wx: -w * 0.34, y: this.horizonY + (h - this.horizonY) * 0.34, w: 46, h: 30, wall: "#fce7f3", roof: "#9d174d", isCafe: false },
      { wx: -w * 0.22, y: this.horizonY + (h - this.horizonY) * 0.22, w: 38, h: 25, wall: "#e0e7ff", roof: "#4338ca", isCafe: false },
      { wx: w * 0.16, y: this.horizonY + (h - this.horizonY) * 0.24, w: 40, h: 26, wall: "#fef9c3", roof: "#a16207", isCafe: false },
      { wx: w * 0.28, y: this.horizonY + (h - this.horizonY) * 0.50, w: 50, h: 32, wall: "#f3e8ff", roof: "#6b21a8", isCafe: false },
      { wx: -w * 0.42, y: this.horizonY + (h - this.horizonY) * 0.64, w: 52, h: 34, wall: "#ffedd5", roof: "#c2410c", isCafe: false },
      { wx: w * 0.04, y: this.horizonY + (h - this.horizonY) * 0.18, w: 34, h: 22, wall: "#ecfeff", roof: "#0e7490", isCafe: false },
    ];
    this.houses = houseSpecs.map((hs, idx) => ({
      wx: hs.wx,
      y: hs.y,
      w: hs.w,
      h: hs.h,
      wallColor: hs.wall,
      roofColor: hs.roof,
      isCafe: hs.isCafe,
      startDelay: this.reducedMotion ? 0 : 0.8 + idx * 0.45,
      build: this.reducedMotion ? 1 : 0,
      smokePhase: idx * 1.4,
    }));
    this.houses.sort((a, b) => a.y - b.y);

    // 12 desktop / 8 mobile trees across 3 species (oak, pine, blossoming cherry)
    const treeCount = this.isMobile ? 8 : 13;
    const treeSpecs: Array<{ wx: number; y: number; species: "oak" | "pine" | "cherry"; maxH: number }> = [
      { wx: this.cafeWx - 68, y: this.cafeY - 12, species: "cherry", maxH: 88 },
      { wx: -w * 0.28, y: this.horizonY + (h - this.horizonY) * 0.56, species: "oak", maxH: 94 },
      { wx: w * 0.24, y: this.horizonY + (h - this.horizonY) * 0.34, species: "pine", maxH: 98 },
      { wx: -w * 0.14, y: this.horizonY + (h - this.horizonY) * 0.20, species: "cherry", maxH: 72 },
      { wx: w * 0.36, y: this.horizonY + (h - this.horizonY) * 0.64, species: "cherry", maxH: 92 },
      { wx: -w * 0.46, y: this.horizonY + (h - this.horizonY) * 0.40, species: "pine", maxH: 86 },
      { wx: w * 0.12, y: this.horizonY + (h - this.horizonY) * 0.68, species: "oak", maxH: 92 },
      { wx: -w * 0.04, y: this.horizonY + (h - this.horizonY) * 0.28, species: "oak", maxH: 76 },
      { wx: -w * 0.38, y: this.horizonY + (h - this.horizonY) * 0.78, species: "cherry", maxH: 102 },
      { wx: w * 0.44, y: this.horizonY + (h - this.horizonY) * 0.44, species: "pine", maxH: 84 },
      { wx: w * 0.06, y: this.horizonY + (h - this.horizonY) * 0.46, species: "cherry", maxH: 82 },
      { wx: -w * 0.20, y: this.horizonY + (h - this.horizonY) * 0.74, species: "pine", maxH: 96 },
      { wx: w * 0.30, y: this.horizonY + (h - this.horizonY) * 0.78, species: "oak", maxH: 98 },
    ];
    this.trees = treeSpecs.slice(0, treeCount).map((ts, idx) => ({
      ...ts,
      maxH: ts.maxH * (this.isMobile ? 0.82 : 1),
      startDelay: this.reducedMotion ? 0 : 0.4 + idx * 0.28,
      growth: this.reducedMotion ? 1 : 0,
      phase: idx * 1.1,
      isPlanted: false,
    }));
    this.trees.sort((a, b) => a.y - b.y);

    // Growing flowers spreading outward from the river
    const flowerCount = this.isMobile ? 145 : 260;
    this.flowers = [];
    for (let i = 0; i < flowerCount; i++) {
      const fx = randomRange(rng, -span * 0.48, span * 0.48);
      const fy = randomRange(rng, this.horizonY + 26, h - 10);
      // Skip river channel & sea corner
      const tEst = clamp(1 - (fy - this.horizonY) / Math.max(1, h - this.horizonY), 0, 1);
      const rv = this.sampleRiver(tEst);
      if (Math.abs(fx - rv.wx) < rv.halfW + 10) continue;
      if (fx > w * 0.22 && fy < this.horizonY + (h - this.horizonY) * 0.24) continue;

      const distFromRiver = Math.abs(fx - rv.wx) / (w * 0.5);
      this.flowers.push({
        wx: fx,
        y: fy,
        palette: i % FLOWER_COLORS.length,
        size: lerp(14, this.isMobile ? 26 : 32, (fy - this.horizonY) / Math.max(1, h - this.horizonY)),
        startDelay: this.reducedMotion ? 0 : 0.2 + distFromRiver * 3.8 + rng() * 0.9,
        growth: this.reducedMotion ? 1 : 0,
        phase: rng() * TAU,
        isPlanted: false,
      });
    }
    this.flowers.sort((a, b) => a.y - b.y);

    // Grass tufts, butterflies/bees, and dusk fireflies
    this.grass = Array.from({ length: this.isMobile ? 65 : 120 }, () => ({
      wx: randomRange(rng, -span * 0.48, span * 0.48),
      y: randomRange(rng, this.horizonY + 42, h - 4),
      h: randomRange(rng, 14, 30),
      lean: randomRange(rng, -6, 6),
      phase: rng() * TAU,
    }));

    this.insects = Array.from({ length: this.isMobile ? 8 : 16 }, (_, i) => ({
      wx: randomRange(rng, -w * 0.42, w * 0.42),
      y: randomRange(rng, this.horizonY + 40, h - 40),
      vx: randomRange(rng, -24, 24),
      vy: randomRange(rng, -12, 12),
      isBee: i % 3 === 0,
      color: i % 3 === 0 ? "#fde047" : i % 2 === 0 ? "#fbcfe8" : "#bae6fd",
      phase: rng() * TAU,
    }));

    this.fireflies = Array.from({ length: this.isMobile ? 20 : 42 }, () => ({
      wx: randomRange(rng, -span * 0.45, span * 0.45),
      y: randomRange(rng, this.horizonY + 12, h - 24),
      vx: randomRange(rng, -12, 12),
      vy: randomRange(rng, -14, -4),
      phase: rng() * TAU,
      r: randomRange(rng, 2, 3.6),
    }));

    // 8 Memory Hotspots (cafe, bridge, dock, 3 special trees, 2 cozy houses)
    const landmarkCoords = [
      { wx: this.cafeWx, y: this.cafeY - 10 },
      { wx: this.bridgeWx, y: this.bridgeY },
      { wx: this.dockWx, y: this.dockY },
      { wx: this.trees[0]?.wx ?? this.cafeWx - 68, y: (this.trees[0]?.y ?? this.cafeY) - 42 },
      { wx: houseSpecs[1].wx, y: houseSpecs[1].y - 12 },
      { wx: this.trees[1]?.wx ?? -w * 0.28, y: (this.trees[1]?.y ?? this.horizonY + 140) - 44 },
      { wx: houseSpecs[4].wx, y: houseSpecs[4].y - 12 },
      { wx: this.trees[2]?.wx ?? w * 0.24, y: (this.trees[2]?.y ?? this.horizonY + 110) - 44 },
    ];
    this.hotspots = landmarkCoords.map((pt, idx) => {
      const saved = prevDiscovered.get(idx);
      return {
        id: idx,
        wx: pt.wx,
        y: pt.y,
        discovered: saved?.discovered ?? false,
        memoryIndex: saved?.memoryIndex ?? -1,
      };
    });
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += clampedDt;

    this.panX = lerp(this.panX, this.targetPanX, Math.min(1, clampedDt * 6.5));

    if (this.duskActive) {
      this.dusk = Math.min(1, this.dusk + clampedDt / (this.reducedMotion ? 1.0 : 7.5));
    }

    // Grow flowers, trees & build houses literally from seed/sapling/ground
    for (const f of this.flowers) {
      if (f.growth < 1 && this.time >= f.startDelay) {
        f.growth = Math.min(1, f.growth + clampedDt * (f.isPlanted ? 0.95 : 0.48));
      }
    }
    for (const t of this.trees) {
      if (t.growth < 1 && this.time >= t.startDelay) {
        t.growth = Math.min(1, t.growth + clampedDt * (t.isPlanted ? 0.65 : 0.34));
      }
      // Cherry trees drop gentle petals once blossomed
      if (t.species === "cherry" && t.growth > 0.85 && !this.reducedMotion && Math.random() < (this.isMobile ? 0.015 : 0.03)) {
        if (this.petals.length < (this.isMobile ? 24 : 52)) {
          this.petals.push({
            wx: t.wx + (Math.random() - 0.5) * t.maxH * 0.55,
            y: t.y - t.maxH * 0.72,
            vx: -14 - Math.random() * 14,
            vy: 14 + Math.random() * 14,
            rot: Math.random() * TAU,
            spin: (Math.random() - 0.5) * 2.5,
            size: 4.5 + Math.random() * 3.5,
            color: "#fbcfe8",
            age: 0,
            life: 4.2,
          });
        }
      }
    }
    for (const hs of this.houses) {
      if (hs.build < 1 && this.time >= hs.startDelay) {
        hs.build = Math.min(1, hs.build + clampedDt * 0.36);
      }
    }

    if (!this.reducedMotion) {
      const halfSpan = this.width * 0.5 + this.maxPanX + 120;
      for (const c of this.clouds) {
        c.x += c.speed * clampedDt;
        if (c.x > halfSpan) c.x = -halfSpan;
      }
      for (const b of this.birds) {
        b.x += b.vx * clampedDt;
        b.flapPhase += clampedDt * 8.5;
        if (b.x > halfSpan) b.x = -halfSpan;
        if (b.x < -halfSpan) b.x = halfSpan;
      }
      for (const ins of this.insects) {
        ins.wx += (ins.vx + Math.sin(this.time * 2.5 + ins.phase) * 16) * clampedDt;
        ins.y += (ins.vy + Math.cos(this.time * 3.1 + ins.phase) * 10) * clampedDt;
        if (ins.wx < -this.width * 0.5) ins.vx = Math.abs(ins.vx);
        if (ins.wx > this.width * 0.5) ins.vx = -Math.abs(ins.vx);
        if (ins.y < this.horizonY + 32) ins.vy = Math.abs(ins.vy);
        if (ins.y > this.height - 28) ins.vy = -Math.abs(ins.vy);
      }

      // Occasional ambient fish ring in the river
      if (Math.random() < 0.012 && this.ripples.length < 8) {
        const rv = this.sampleRiver(0.18 + Math.random() * 0.65);
        this.ripples.push({ wx: rv.wx + (Math.random() - 0.5) * rv.halfW, y: rv.y, r: 2, maxR: 22, life: 0, maxLife: 1.5 });
      }
    }

    // Update ripples & falling petals
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.life += clampedDt;
      if (rp.life >= rp.maxLife) {
        this.ripples.splice(i, 1);
      } else {
        rp.r = lerp(3, rp.maxR, easeOutCubic(rp.life / rp.maxLife));
      }
    }

    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      p.age += clampedDt;
      if (p.age >= p.life || p.y > this.height + 12) {
        this.petals.splice(i, 1);
        continue;
      }
      p.wx += (p.vx + Math.sin(this.time * 2 + p.rot) * 10) * clampedDt;
      p.y += p.vy * clampedDt;
      p.rot += p.spin * clampedDt;
    }

    // Dusk fireflies + river lanterns + cafe heart sky lanterns
    if (this.dusk > 0.2) {
      for (const ff of this.fireflies) {
        ff.wx += (ff.vx + Math.sin(this.time * 1.8 + ff.phase) * 12) * clampedDt;
        ff.y += ff.vy * clampedDt;
        if (ff.y < this.horizonY - 40) ff.y = this.height - 16;
      }
      for (const rl of this.riverLanterns) {
        rl.t += rl.speed * clampedDt;
        if (rl.t > 1.18) rl.t = -0.1;
      }
      for (const hl of this.heartLanterns) {
        if (hl.delay > 0) {
          hl.delay -= clampedDt;
        } else if (hl.t < 1) {
          hl.t = Math.min(1, hl.t + clampedDt * 0.28);
          const e = easeInOutCubic(hl.t);
          hl.x = lerp(hl.startX, hl.targetX, e);
          hl.y = lerp(hl.startY, hl.targetY, e);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const w = this.width;
    const h = this.height;
    const hy = this.horizonY + this.tiltY * 0.5;
    // Slow 4-minute day cycle (0 = morning, 1 = golden afternoon)
    const dayCycle = 0.5 - 0.5 * Math.cos((this.time / 240) * TAU);
    const d = this.dusk;

    // 1. Sky gradient (morning -> golden afternoon -> rose -> deep violet dusk)
    const dayTop: [number, number, number] = [
      lerp(105, 82, dayCycle),
      lerp(168, 132, dayCycle),
      lerp(228, 198, dayCycle),
    ];
    const dayBot: [number, number, number] = [
      lerp(222, 248, dayCycle),
      lerp(236, 206, dayCycle),
      lerp(246, 166, dayCycle),
    ];
    const duskTop: [number, number, number] = [14, 11, 40];
    const duskMid: [number, number, number] = [66, 36, 98];
    const duskBot: [number, number, number] = [214, 112, 92];

    const skyGrad = ctx.createLinearGradient(0, 0, 0, hy + 20);
    skyGrad.addColorStop(0, mixHex(dayTop, duskTop, d));
    skyGrad.addColorStop(0.55, mixHex(dayBot, duskMid, d));
    skyGrad.addColorStop(1, mixHex(dayBot, duskBot, d));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, hy + 30);

    // Stars fading in at dusk
    if (d > 0.25) {
      const starVis = clamp((d - 0.25) / 0.65, 0, 1);
      for (const st of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 2.2 + st.phase);
        ctx.fillStyle = `rgba(255, 251, 235, ${(starVis * tw * 0.85).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, TAU);
        ctx.fill();
      }
    }

    // Warm sun (sets smoothly into the sea during dusk)
    const sunX = this.worldToScreenX(w * 0.26, 0.12);
    const sunY = lerp(h * 0.16 + dayCycle * 26, hy + 26, easeInOutCubic(d));
    const sunR = this.isMobile ? 24 : 34;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 4.5);
    sunGlow.addColorStop(0, d > 0.4 ? "rgba(253, 186, 116, 0.72)" : "rgba(255, 251, 235, 0.75)");
    sunGlow.addColorStop(0.45, "rgba(253, 224, 71, 0.22)");
    sunGlow.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 4.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = d > 0.5 ? "#fdba74" : "#fffbeb";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, TAU);
    ctx.fill();

    // Faint thin crescent moon in opposite sky (soft warm glow once found)
    const moonX = this.worldToScreenX(-w * 0.28, 0.10);
    const moonY = h * 0.14;
    if (this.moonFound) {
      const mg = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 34);
      mg.addColorStop(0, "rgba(254, 240, 138, 0.42)");
      mg.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 34, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.globalAlpha = lerp(this.moonFound ? 0.55 : 0.32, 0.92, d);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mixHex(dayTop, duskTop, d);
    ctx.beginPath();
    ctx.arc(moonX + 5, moonY - 3, 12, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Drifting clouds
    for (const cl of this.clouds) {
      const cx = this.worldToScreenX(cl.x, 0.22);
      ctx.fillStyle = d > 0.45
        ? `rgba(244, 180, 196, ${(cl.alpha * 0.48).toFixed(3)})`
        : `rgba(255, 255, 255, ${(cl.alpha * 0.72).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cl.y, cl.w * 0.5, cl.h * 0.45, 0, 0, TAU);
      ctx.ellipse(cx - cl.w * 0.24, cl.y + 4, cl.w * 0.34, cl.h * 0.35, 0, 0, TAU);
      ctx.ellipse(cx + cl.w * 0.26, cl.y + 5, cl.w * 0.32, cl.h * 0.34, 0, 0, TAU);
      ctx.fill();
    }

    // Crossing birds
    ctx.strokeStyle = d > 0.6 ? "rgba(30, 20, 50, 0.7)" : "rgba(45, 62, 85, 0.65)";
    ctx.lineWidth = 1.4;
    for (const b of this.birds) {
      const bx = this.worldToScreenX(b.x, 0.3);
      const wingY = Math.sin(b.flapPhase) * b.size * 0.55;
      ctx.beginPath();
      ctx.moveTo(bx - b.size, b.y + wingY);
      ctx.quadraticCurveTo(bx - b.size * 0.4, b.y - 3, bx, b.y);
      ctx.quadraticCurveTo(bx + b.size * 0.4, b.y - 3, bx + b.size, b.y + wingY);
      ctx.stroke();
    }

    // 2. Sea filling the right horizon with rolling waves, glitter, harbor dock & 2 sailboats
    this.renderSeaAndHarbor(ctx, hy, d);

    // 3. Three distant parallax hill layers with mist
    const hillLayers = [
      { parallax: 0.35, baseY: hy + 4, amp: 38, freq: 1.4, phase: 0.5, dayCol: [96, 146, 134] as [number, number, number], duskCol: [32, 26, 62] as [number, number, number] },
      { parallax: 0.55, baseY: hy + 26, amp: 30, freq: 1.8, phase: 2.1, dayCol: [74, 134, 102] as [number, number, number], duskCol: [24, 24, 52] as [number, number, number] },
      { parallax: 0.78, baseY: hy + 48, amp: 20, freq: 1.3, phase: 3.9, dayCol: [62, 128, 82] as [number, number, number], duskCol: [18, 22, 42] as [number, number, number] },
    ];
    for (const hl of hillLayers) {
      ctx.fillStyle = mixHex(hl.dayCol, hl.duskCol, d);
      ctx.beginPath();
      ctx.moveTo(-40, h + 20);
      for (let sx = -40; sx <= w + 40; sx += 24) {
        const wx = sx - w * 0.5 + (this.panX + this.tiltX) * hl.parallax;
        // Dip down on the right side so the sea stays open and visible!
        const seaDip = clamp((wx - w * 0.10) / (w * 0.25), 0, 1) * 85;
        const y = hl.baseY + seaDip + Math.sin(wx * 0.004 * hl.freq + hl.phase) * hl.amp;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(w + 40, h + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Foreground lush meadow slope
    const meadowGrad = ctx.createLinearGradient(0, hy + 24, 0, h);
    meadowGrad.addColorStop(0, mixHex([88, 156, 86], [20, 32, 46], d));
    meadowGrad.addColorStop(0.55, mixHex([66, 136, 72], [14, 26, 38], d));
    meadowGrad.addColorStop(1, mixHex([48, 108, 58], [10, 18, 28], d));
    ctx.fillStyle = meadowGrad;
    ctx.beginPath();
    ctx.moveTo(-20, hy + 38);
    for (let sx = -20; sx <= w + 20; sx += 28) {
      const wx = sx - w * 0.5 + this.panX + this.tiltX;
      const seaNotch = clamp((wx - w * 0.16) / (w * 0.20), 0, 1) * 58;
      ctx.lineTo(sx, hy + 32 + seaNotch + Math.sin(wx * 0.005) * 10);
    }
    ctx.lineTo(w + 20, h + 20);
    ctx.lineTo(-20, h + 20);
    ctx.closePath();
    ctx.fill();

    // 4. Winding footpath connecting cafe, bridge & houses
    ctx.save();
    ctx.strokeStyle = mixHex([214, 192, 152], [68, 56, 66], d);
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.worldToScreenX(this.cafeWx - 160, 1), this.cafeY + 26);
    ctx.quadraticCurveTo(this.worldToScreenX(this.cafeWx, 1), this.cafeY + 18, this.worldToScreenX(this.bridgeWx, 1), this.bridgeY + 4);
    ctx.quadraticCurveTo(this.worldToScreenX(this.bridgeWx + 140, 1), this.bridgeY - 10, this.worldToScreenX(this.dockWx - 24, 1), this.dockY + 16);
    ctx.stroke();
    ctx.restore();

    // 5. Winding River with animated current streaks, sparkles & ripples
    this.renderRiver(ctx, d);

    // 6. Little Wooden Bridge over the river
    this.renderBridge(ctx, d);

    // 7. Depth-sorted Meadow World: Grass, Growing Flowers, Growing Trees, Houses & Cafe
    this.renderGrass(ctx, d);
    this.renderFlowers(ctx, d);
    this.renderHousesAndTrees(ctx, d);

    // 8. Butterflies & bees (daytime) + Fireflies (dusk)
    if (d < 0.75) {
      ctx.globalAlpha = 1 - d;
      for (const ins of this.insects) {
        const ix = this.worldToScreenX(ins.wx, 1);
        const flap = Math.sin(this.time * 18 + ins.phase) * 3;
        ctx.fillStyle = ins.color;
        ctx.beginPath();
        ctx.ellipse(ix - 2.5, ins.y - flap * 0.4, 3.2, 1.8, -0.4, 0, TAU);
        ctx.ellipse(ix + 2.5, ins.y - flap * 0.4, 3.2, 1.8, 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (d > 0.25) {
      const ffVis = clamp((d - 0.25) / 0.65, 0, 1);
      for (const ff of this.fireflies) {
        const fx = this.worldToScreenX(ff.wx, 1);
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.6 + ff.phase);
        const fg = ctx.createRadialGradient(fx, ff.y, 0, fx, ff.y, ff.r * 4.5);
        fg.addColorStop(0, `rgba(254, 240, 138, ${(ffVis * pulse * 0.9).toFixed(3)})`);
        fg.addColorStop(1, "rgba(254, 240, 138, 0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fx, ff.y, ff.r * 4.5, 0, TAU);
        ctx.fill();
      }
    }

    // 9. Dusk Finale Lanterns (floating down the river + heart above cafe)
    if (this.duskActive && d > 0.18) {
      this.renderDuskLanterns(ctx, clamp((d - 0.18) / 0.5, 0, 1));
    }

    // 10. Drifting cherry blossoms & planting petals
    for (const p of this.petals) {
      const px = this.worldToScreenX(p.wx, 1);
      ctx.save();
      ctx.translate(px, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = clamp((p.life - p.age) / 0.8, 0, 1) * 0.88;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 11. Soft glowing beacons on memory hotspots
    for (const hs of this.hotspots) {
      const hx = this.worldToScreenX(hs.wx, 1);
      const pulse = 0.72 + 0.28 * Math.sin(this.time * 2.8 + hs.id * 1.3);
      const r = hs.discovered ? 14 : 20 * pulse;
      const bg = ctx.createRadialGradient(hx, hs.y, 1, hx, hs.y, r);
      if (hs.discovered) {
        bg.addColorStop(0, "rgba(254, 240, 138, 0.65)");
        bg.addColorStop(1, "rgba(254, 240, 138, 0)");
      } else {
        bg.addColorStop(0, "rgba(255, 255, 255, 0.92)");
        bg.addColorStop(0.38, "rgba(253, 224, 71, 0.58)");
        bg.addColorStop(1, "rgba(244, 114, 182, 0)");
      }
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(hx, hs.y, r, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderSeaAndHarbor(ctx: CanvasRenderingContext2D, hy: number, d: number): void {
    const w = this.width;
    const seaGrad = ctx.createLinearGradient(0, hy, 0, hy + 130);
    seaGrad.addColorStop(0, mixHex([56, 138, 198], [26, 26, 68], d));
    seaGrad.addColorStop(1, mixHex([34, 102, 162], [14, 18, 48], d));
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, hy, w, 135);

    // Rolling wave bands with animated foam lines
    ctx.strokeStyle = d > 0.5 ? "rgba(253, 186, 116, 0.28)" : "rgba(255, 255, 255, 0.36)";
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 6; row++) {
      const ry = hy + 10 + row * 15 + ((this.time * 6 + row * 4) % 10);
      ctx.beginPath();
      for (let sx = w * 0.45; sx <= w + 20; sx += 26) {
        const wy = ry + Math.sin(sx * 0.04 + this.time * 2.1 + row) * 2.2;
        if (sx === w * 0.45) ctx.moveTo(sx, wy);
        else ctx.lineTo(sx, wy);
      }
      ctx.stroke();
    }

    // Two gently rocking sailboats on the sea
    const boats = [
      { wx: w * 0.28, y: hy + 20, scale: 0.72, phase: 0.4 },
      { wx: w * 0.44, y: hy + 36, scale: 0.95, phase: 2.3 },
    ];
    for (const b of boats) {
      const bx = this.worldToScreenX(b.wx, 0.75);
      const rock = Math.sin(this.time * 1.9 + b.phase) * 0.09;
      ctx.save();
      ctx.translate(bx, b.y);
      ctx.rotate(rock);
      ctx.scale(b.scale, b.scale);
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.lineTo(9, 6);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = d > 0.5 ? "#fde68a" : "#fffbeb";
      ctx.beginPath();
      ctx.moveTo(-1, -1);
      ctx.lineTo(-1, -24);
      ctx.lineTo(12, -3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Wooden harbor dock
    const dx = this.worldToScreenX(this.dockWx, 1);
    const dy = this.dockY;
    ctx.fillStyle = mixHex([115, 76, 48], [46, 30, 34], d);
    ctx.fillRect(dx - 30, dy, 60, 7);
    for (const px of [-24, -4, 18]) {
      ctx.fillRect(dx + px, dy + 4, 4, 16);
    }
  }

  private renderRiver(ctx: CanvasRenderingContext2D, d: number): void {
    const steps = this.isMobile ? 22 : 34;
    const leftPts: Array<{ x: number; y: number }> = [];
    const rightPts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const rv = this.sampleRiver(i / steps);
      const sx = this.worldToScreenX(rv.wx, 1);
      leftPts.push({ x: sx - rv.halfW, y: rv.y });
      rightPts.push({ x: sx + rv.halfW, y: rv.y });
    }

    const rGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.height);
    rGrad.addColorStop(0, mixHex([96, 178, 224], [48, 36, 86], d));
    rGrad.addColorStop(1, mixHex([44, 134, 196], [20, 24, 58], d));
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    for (let i = 1; i <= steps; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
    for (let i = steps; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
    ctx.closePath();
    ctx.fill();

    // Animated flowing current streaks & light sparkles
    ctx.strokeStyle = d > 0.5 ? "rgba(254, 240, 138, 0.32)" : "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 1.4;
    const streakCount = this.isMobile ? 12 : 22;
    for (let i = 0; i < streakCount; i++) {
      const t = (i / streakCount + this.time * 0.085) % 1;
      const rv = this.sampleRiver(t);
      const rv2 = this.sampleRiver(Math.min(1, t + 0.035));
      const lane = ((i % 5) - 2) * 0.32;
      ctx.beginPath();
      ctx.moveTo(this.worldToScreenX(rv.wx + rv.halfW * lane, 1), rv.y);
      ctx.lineTo(this.worldToScreenX(rv2.wx + rv2.halfW * lane, 1), rv2.y);
      ctx.stroke();
    }

    // Interactive & ambient ripples
    for (const rp of this.ripples) {
      const a = (1 - rp.life / rp.maxLife) * 0.55;
      ctx.strokeStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(this.worldToScreenX(rp.wx, 1), rp.y, rp.r, rp.r * 0.38, 0, 0, TAU);
      ctx.stroke();
    }
  }

  private renderBridge(ctx: CanvasRenderingContext2D, d: number): void {
    const bx = this.worldToScreenX(this.bridgeWx, 1);
    const by = this.bridgeY;
    const bw = this.isMobile ? 86 : 112;
    ctx.save();
    ctx.strokeStyle = mixHex([132, 86, 52], [62, 42, 44], d);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.5, by + 6);
    ctx.quadraticCurveTo(bx, by - 14, bx + bw * 0.5, by + 6);
    ctx.stroke();

    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.48, by - 4);
    ctx.quadraticCurveTo(bx, by - 24, bx + bw * 0.48, by - 4);
    ctx.stroke();
    ctx.restore();
  }

  private renderGrass(ctx: CanvasRenderingContext2D, d: number): void {
    ctx.strokeStyle = mixHex([52, 122, 62], [18, 34, 46], d);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (const g of this.grass) {
      const gx = this.worldToScreenX(g.wx, 1);
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.8 + g.phase + g.wx * 0.01) * 4.5;
      ctx.beginPath();
      ctx.moveTo(gx, g.y);
      ctx.quadraticCurveTo(gx + sway * 0.5, g.y - g.h * 0.5, gx + g.lean + sway, g.y - g.h);
      ctx.stroke();
    }
  }

  private renderFlowers(ctx: CanvasRenderingContext2D, d: number): void {
    ctx.save();
    ctx.globalAlpha = lerp(1, 0.85, d);
    for (const f of this.flowers) {
      if (f.growth <= 0.02) continue;
      const sx = this.worldToScreenX(f.wx, 1);
      if (sx < -30 || sx > this.width + 30) continue;
      const stage = Math.min(3, Math.floor(f.growth * 3.99));
      const sprite = this.flowerSprites[f.palette]?.[stage];
      if (!sprite) continue;
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.7 + f.phase + f.wx * 0.01) * 2.2;
      const scale = 0.4 + 0.6 * easeOutCubic(f.growth);
      const dw = f.size * 0.78 * scale;
      const dh = f.size * scale;
      ctx.drawImage(sprite, sx + sway - dw * 0.5, f.y - dh, dw, dh);
    }
    ctx.restore();
  }

  private renderHousesAndTrees(ctx: CanvasRenderingContext2D, d: number): void {
    type Item = { y: number; draw: () => void };
    const list: Item[] = [];

    for (const t of this.trees) {
      if (t.growth <= 0.01) continue;
      list.push({
        y: t.y,
        draw: () => this.drawTree(ctx, t, d),
      });
    }
    for (const hs of this.houses) {
      if (hs.build <= 0.01) continue;
      list.push({
        y: hs.y,
        draw: () => this.drawHouse(ctx, hs, d),
      });
    }

    list.sort((a, b) => a.y - b.y);
    for (const item of list) item.draw();
  }

  private drawTree(ctx: CanvasRenderingContext2D, t: ValleyTree, d: number): void {
    const sx = this.worldToScreenX(t.wx, 1);
    if (sx < -90 || sx > this.width + 90) return;

    const g = easeOutCubic(t.growth);
    const trunkH = t.maxH * 0.56 * clamp(g / 0.6, 0, 1);
    const canopyG = clamp((g - 0.35) / 0.65, 0, 1);
    const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.3 + t.phase + t.wx * 0.008) * 3.5 * canopyG;

    // Trunk
    ctx.strokeStyle = mixHex([96, 64, 42], [38, 28, 36], d);
    ctx.lineWidth = Math.max(2.5, t.maxH * 0.08 * g);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, t.y);
    ctx.quadraticCurveTo(sx + sway * 0.4, t.y - trunkH * 0.5, sx + sway, t.y - trunkH);
    ctx.stroke();

    if (canopyG <= 0.02) return;
    const cx = sx + sway;
    const cy = t.y - trunkH;

    if (t.species === "pine") {
      ctx.fillStyle = mixHex([34, 96, 68], [16, 36, 48], d);
      const pw = t.maxH * 0.38 * canopyG;
      const ph = t.maxH * 0.65 * canopyG;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ph * 0.85);
      ctx.lineTo(cx - pw, cy + ph * 0.25);
      ctx.lineTo(cx + pw, cy + ph * 0.25);
      ctx.closePath();
      ctx.fill();
    } else if (t.species === "oak") {
      ctx.fillStyle = mixHex([56, 134, 72], [22, 46, 52], d);
      const r = t.maxH * 0.34 * canopyG;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.45, r, 0, TAU);
      ctx.arc(cx - r * 0.65, cy - r * 0.1, r * 0.72, 0, TAU);
      ctx.arc(cx + r * 0.65, cy - r * 0.1, r * 0.72, 0, TAU);
      ctx.fill();
    } else {
      // Blossoming cherry tree
      ctx.fillStyle = mixHex([244, 168, 204], [148, 86, 134], d);
      const r = t.maxH * 0.35 * canopyG;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.45, r, 0, TAU);
      ctx.arc(cx - r * 0.68, cy - r * 0.05, r * 0.72, 0, TAU);
      ctx.arc(cx + r * 0.68, cy - r * 0.05, r * 0.72, 0, TAU);
      ctx.fill();
    }
  }

  private drawHouse(ctx: CanvasRenderingContext2D, hs: ValleyHouse, d: number): void {
    const sx = this.worldToScreenX(hs.wx, 1);
    if (sx < -120 || sx > this.width + 120) return;

    const wallG = easeOutCubic(clamp(hs.build / 0.55, 0, 1));
    const roofG = easeOutCubic(clamp((hs.build - 0.45) / 0.35, 0, 1));
    const winG = clamp((hs.build - 0.72) / 0.28, 0, 1);
    const curH = hs.h * wallG;

    // Walls rising from ground
    ctx.fillStyle = d > 0.5 ? "#342a4a" : hs.wallColor;
    ctx.fillRect(sx - hs.w * 0.5, hs.y - curH, hs.w, curH);

    // Pitched roof settling on
    if (roofG > 0.02) {
      const roofDrop = (1 - roofG) * 18;
      ctx.fillStyle = d > 0.5 ? "#522546" : hs.roofColor;
      ctx.beginPath();
      ctx.moveTo(sx - hs.w * 0.6, hs.y - curH - roofDrop);
      ctx.lineTo(sx, hs.y - curH - hs.h * 0.62 - roofDrop);
      ctx.lineTo(sx + hs.w * 0.6, hs.y - curH - roofDrop);
      ctx.closePath();
      ctx.fill();

      // Chimney + curling smoke
      const chX = sx + hs.w * 0.25;
      const chY = hs.y - curH - hs.h * 0.45 - roofDrop;
      ctx.fillRect(chX - 3, chY - 8, 6, 12);
      if (winG > 0.2) {
        for (let sm = 0; sm < 3; sm++) {
          const st = (this.time * 0.45 + hs.smokePhase + sm * 0.33) % 1;
          ctx.fillStyle = `rgba(241, 245, 249, ${((1 - st) * 0.28).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(chX + Math.sin(st * 5 + hs.smokePhase) * 6, chY - 12 - st * 26, 3 + st * 5, 0, TAU);
          ctx.fill();
        }
      }
    }

    // Glowing windows
    if (winG > 0.05) {
      const winLit = 0.45 + d * 0.55;
      ctx.fillStyle = `rgba(254, 240, 138, ${(winG * winLit).toFixed(3)})`;
      ctx.fillRect(sx - hs.w * 0.32, hs.y - curH * 0.62, hs.w * 0.2, curH * 0.28);
      ctx.fillRect(sx + hs.w * 0.12, hs.y - curH * 0.62, hs.w * 0.2, curH * 0.28);
    }

    // Special First Date Cafe terrace: two empty chairs, table with flickering candle, and string lights!
    if (hs.isCafe && winG > 0.3) {
      const tx = sx + hs.w * 0.66;
      const ty = hs.y - 2;
      // Terrace deck
      ctx.fillStyle = d > 0.5 ? "#3b2638" : "#a16207";
      ctx.fillRect(sx + hs.w * 0.48, ty - 2, 46, 5);
      // Table + two empty chairs
      ctx.strokeStyle = d > 0.5 ? "#e2e8f0" : "#451a03";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx - 10, ty - 10);
      ctx.lineTo(tx + 10, ty - 10);
      ctx.moveTo(tx, ty - 10);
      ctx.lineTo(tx, ty);
      // Left & right empty chairs
      ctx.moveTo(tx - 18, ty - 12);
      ctx.lineTo(tx - 18, ty);
      ctx.moveTo(tx - 18, ty - 6);
      ctx.lineTo(tx - 12, ty - 6);
      ctx.moveTo(tx + 18, ty - 12);
      ctx.lineTo(tx + 18, ty);
      ctx.moveTo(tx + 18, ty - 6);
      ctx.lineTo(tx + 12, ty - 6);
      ctx.stroke();

      // Flickering candle on the table
      const flicker = 0.8 + 0.2 * Math.sin(this.time * 11);
      const cg = ctx.createRadialGradient(tx, ty - 14, 0, tx, ty - 14, (14 + d * 14) * flicker);
      cg.addColorStop(0, "rgba(255, 251, 235, 0.95)");
      cg.addColorStop(0.4, `rgba(253, 224, 71, ${(0.35 + d * 0.45).toFixed(3)})`);
      cg.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(tx, ty - 14, (14 + d * 14) * flicker, 0, TAU);
      ctx.fill();

      // String lights draped over the cafe terrace
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx + hs.w * 0.45, hs.y - curH * 0.85);
      ctx.quadraticCurveTo(tx, hs.y - curH * 0.55, sx + hs.w * 0.48 + 44, hs.y - curH * 0.78);
      ctx.stroke();
      for (let b = 0; b < 5; b++) {
        const bt = (b + 0.5) / 5;
        const lx = lerp(sx + hs.w * 0.45, sx + hs.w * 0.48 + 44, bt);
        const ly = hs.y - curH * 0.82 + Math.sin(bt * Math.PI) * 10;
        ctx.fillStyle = `rgba(254, 240, 138, ${(0.45 + d * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.2 + d * 1.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  private renderDuskLanterns(ctx: CanvasRenderingContext2D, alpha: number): void {
    // 1. River lanterns floating down the river and out to the sea
    for (const rl of this.riverLanterns) {
      if (rl.t < 0 || rl.t > 1.12) continue;
      const clampedT = Math.min(1, rl.t);
      const rv = this.sampleRiver(clampedT);
      const seaDrift = rl.t > 1 ? (rl.t - 1) * 180 : 0;
      const sx = this.worldToScreenX(rv.wx + seaDrift, 1);
      const sy = rv.y + Math.sin(this.time * 2 + rl.phase) * 2;
      const sp = this.lanternSprites[rl.tintIdx];
      const sz = lerp(24, 13, clampedT);
      ctx.globalAlpha = alpha * (rl.t > 1 ? clamp(1 - (rl.t - 1) / 0.12, 0, 1) : 1);
      ctx.drawImage(sp, sx - sz * 0.5, sy - sz * 0.5, sz, sz);
    }

    // 2. Sky lanterns rising to form a small glowing heart above the cafe
    for (const hl of this.heartLanterns) {
      if (hl.t <= 0.02) continue;
      const sx = this.worldToScreenX(hl.x, 1);
      const sy = hl.y + Math.sin(this.time * 1.8 + hl.phase) * 3;
      const sp = this.lanternSprites[hl.tintIdx];
      const sz = this.isMobile ? 20 : 25;
      ctx.globalAlpha = alpha * clamp(hl.t * 1.4, 0, 1);
      ctx.drawImage(sp, sx - sz * 0.5, sy - sz * 0.5, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
}
