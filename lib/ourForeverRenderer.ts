/**
 * Canvas 2D Renderer for "Our Forever" — Braided Cosmic Infinity
 * - Pre-computes a 600-point uniform arc-length lemniscate (horizontal on landscape, vertical on portrait)
 * - Pre-renders cosmic nebula, galaxy band, leaf sprites (gold & rose tints), and 4x4 flower bloom sprites
 * - 3-layer twinkling starfield with parallax & drifting cosmic petal dust
 * - Faint dotted guide line with periodic demo light (once on enter, then every 6s while idle)
 * - Bidirectional pointer projection (~70px tolerance) advancing braided GOLD & ROSE vines
 *   in opposite directions from the center crossing with double-helix sinusoidal offset
 * - Tapered glowing vine strokes drawn only up to the growth front, sparkling tips,
 *   unfurling leaves, blooming cosmic flowers, completion light pulse, eternal flowing lights,
 *   and smooth vine retraction on replay.
 */

import { clamp, createSeededRandom, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

const PATH_POINTS = 600;
const BRAID_CYCLES = 18; // Full double-helix twists around the entire infinity loop
const TRACE_TOLERANCE_PX = 74;
const MAX_TRACE_STEP = 0.22; // Prevents jumping across the whole loop at once

export interface PathSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  s: number; // cumulative arc length in px
  u: number; // normalized [0, 1)
}

interface Star {
  x: number;
  y: number;
  r: number;
  layer: 0 | 1 | 2;
  phase: number;
  speed: number;
  color: string;
}

interface DustPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  alpha: number;
  color: string;
}

interface VineLeaf {
  vine: 0 | 1; // 0 = gold (forward), 1 = rose (backward)
  u: number; // growth fraction [0..1] at which this leaf appears
  pathU: number; // position along path [0..1)
  side: -1 | 1;
  size: number;
  swayPhase: number;
  growth: number; // 0..1 unfurl
}

interface VineFlower {
  vine: 0 | 1;
  u: number;
  pathU: number;
  side: -1 | 1;
  offsetPx: number;
  palette: 0 | 1 | 2 | 3; // 0: violet, 1: pink, 2: gold, 3: white
  size: number;
  swayPhase: number;
  bloom: number; // 0..1
  burstFlash: number; // 0..1
}

interface TipSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

interface FlowOrb {
  u: number;
  speed: number;
  vine: 0 | 1;
  size: number;
  isPetal: boolean;
  color: string;
  phase: number;
}

export interface OurForeverSnapshot {
  progress: number;
  completed: boolean;
  retracting: boolean;
  isPortrait: boolean;
  centerX: number;
  centerY: number;
}

const FLOWER_PALETTES = [
  { outer: "#a855f7", inner: "#e9d5ff", core: "#fef08a" }, // violet
  { outer: "#f472b6", inner: "#fbcfe8", core: "#fef3c7" }, // pink
  { outer: "#f59e0b", inner: "#fde68a", core: "#fffbeb" }, // gold
  { outer: "#e0e7ff", inner: "#ffffff", core: "#fde68a" }, // white
] as const;

function mod1(v: number): number {
  const m = v % 1;
  return m < 0 ? m + 1 : m;
}

function createOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class OurForeverRenderer {
  private width = 1;
  private height = 1;
  private dpr = 1;
  private isMobile = false;
  private isPortrait = false;
  private reducedMotion = false;

  private centerX = 0;
  private centerY = 0;
  private braidAmp = 8;

  private bgCanvas: HTMLCanvasElement | null = null;
  private leafSprites: HTMLCanvasElement[] = [];
  private flowerSprites: HTMLCanvasElement[][] = []; // [palette 0..3][stage 0..3]

  private path: PathSample[] = [];
  private totalLength = 1;

  private stars: Star[] = [];
  private dust: DustPetal[] = [];
  private leaves: VineLeaf[] = [];
  private flowers: VineFlower[] = [];
  private sparkles: TipSparkle[] = [];
  private flowOrbs: FlowOrb[] = [];

  private time = 0;
  private progress = 0;
  private targetProgress = 0;
  private completed = false;
  private completeTime = 0;
  private pulseU = -1; // 0..1 wave across loop on completion
  private retracting = false;

  private idleSeconds = 0;
  private demoActive = true;
  private demoU = 0;
  private demoCooldown = 0;

  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;
  private parallaxX = 0;
  private parallaxY = 0;

  private autoGrowing = false;
  private onCompleteCb?: () => void;

  constructor(opts: { reducedMotion: boolean; onComplete?: () => void }) {
    this.reducedMotion = opts.reducedMotion;
    this.onCompleteCb = opts.onComplete;
    this.buildSprites();
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.isMobile = this.width < 680;
    this.isPortrait = this.height > this.width * 1.05;
    this.braidAmp = this.isMobile ? 6.5 : 9;

    this.buildPath();
    this.buildBackground();
    this.buildStarsAndDust();
    this.buildBotanicals();
    this.buildFlowOrbs();
  }

  public setAutoGrow(active: boolean): void {
    this.autoGrowing = active;
    if (active) {
      this.idleSeconds = 0;
      this.demoActive = false;
    }
  }

  public advanceBy(delta: number): void {
    if (this.retracting || this.completed) return;
    this.idleSeconds = 0;
    this.demoActive = false;
    this.targetProgress = clamp(this.targetProgress + delta, 0, 1);
  }

  public completeImmediately(): void {
    if (this.completed || this.retracting) return;
    this.idleSeconds = 0;
    this.demoActive = false;
    this.targetProgress = 1;
    this.progress = 1;
    for (const leaf of this.leaves) leaf.growth = 1;
    for (const fl of this.flowers) fl.bloom = 1;
    this.triggerCompletion();
  }

  public replay(): void {
    this.retracting = true;
    this.completed = false;
    this.autoGrowing = false;
    this.pulseU = -1;
    this.targetProgress = 0;
    this.idleSeconds = 0;
    this.demoActive = false;
  }

  public onPointerDown(x: number, y: number): void {
    this.pointerActive = true;
    this.pointerX = x;
    this.pointerY = y;
    this.idleSeconds = 0;
    this.demoActive = false;
    if (this.reducedMotion && !this.completed && !this.retracting) {
      this.completeImmediately();
      return;
    }
    this.projectAndAdvance(x, y);
  }

  public onPointerMove(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    if (this.pointerActive && !this.completed && !this.retracting) {
      this.idleSeconds = 0;
      this.demoActive = false;
      this.projectAndAdvance(x, y);
    }
  }

  public onPointerUp(): void {
    this.pointerActive = false;
  }

  public getSnapshot(): OurForeverSnapshot {
    return {
      progress: this.progress,
      completed: this.completed,
      retracting: this.retracting,
      isPortrait: this.isPortrait,
      centerX: this.centerX,
      centerY: this.centerY,
    };
  }

  /** Project pointer onto nearest lemniscate point and advance growth front smoothly */
  private projectAndAdvance(x: number, y: number): void {
    if (this.path.length === 0 || this.completed || this.retracting) return;

    let bestDistSq = Infinity;
    let bestU = 0;
    const tolSq = TRACE_TOLERANCE_PX * TRACE_TOLERANCE_PX;

    // Coarse-to-fine search over 600 points (600 iterations is <0.02ms)
    for (let i = 0; i < this.path.length; i++) {
      const pt = this.path[i];
      const dx = x - pt.x;
      const dy = y - pt.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestU = pt.u;
      }
    }

    if (bestDistSq > tolSq) return;

    // Check forward ahead of Gold tip (at targetProgress)
    const dGold = mod1(bestU - this.targetProgress);
    // Check backward ahead of Rose tip (at 1 - targetProgress)
    const dRose = mod1(mod1(1 - this.targetProgress) - bestU);

    let step = 0;
    if (dGold > 0.002 && dGold <= MAX_TRACE_STEP) {
      step = Math.max(step, dGold);
    }
    if (dRose > 0.002 && dRose <= MAX_TRACE_STEP) {
      step = Math.max(step, dRose);
    }

    // Also allow gentle start nudge right at the center crossing
    if (this.targetProgress < 0.02 && step === 0) {
      const distFromStart = Math.min(bestU, 1 - bestU);
      if (distFromStart <= 0.12) {
        step = Math.max(0.035, distFromStart);
      }
    }

    if (step > 0) {
      this.targetProgress = clamp(this.targetProgress + step, 0, 1);
      if (this.targetProgress >= 0.965) {
        this.targetProgress = 1;
      }
    }
  }

  private buildPath(): void {
    const w = this.width;
    const h = this.height;

    // Center slightly above vertical middle on portrait/landscape to leave breathing room for bottom controls
    this.centerX = w * 0.5;
    this.centerY = this.isPortrait ? h * 0.49 : h * 0.49;

    // Lemniscate scale a: ~78% of width on landscape, ~78% of height on portrait
    let a: number;
    if (this.isPortrait) {
      const maxHalfH = h * 0.39;
      const maxHalfW = w * 0.41;
      // In portrait rotated 90deg, halfHeight = a, halfWidth = a * 0.42
      a = Math.min(maxHalfH, maxHalfW / 0.42);
    } else {
      const maxHalfW = w * 0.39;
      const maxHalfH = h * 0.34;
      // In landscape, halfWidth = a, halfHeight = a * 0.42
      a = Math.min(maxHalfW, maxHalfH / 0.42);
    }

    const rawCount = 1200;
    const rawPts: { x: number; y: number; s: number }[] = [];
    let accLen = 0;
    const yStretch = 1.18;

    for (let i = 0; i <= rawCount; i++) {
      const t = (i / rawCount) * TAU;
      const sinT = Math.sin(t);
      const cosT = Math.cos(t);
      const denom = 1 + cosT * cosT;
      // Starts at center crossing (0, 0) when t = 0
      const lx = (-a * sinT) / denom;
      const ly = ((-a * sinT * cosT) / denom) * yStretch;

      const x = this.isPortrait ? this.centerX + ly : this.centerX + lx;
      const y = this.isPortrait ? this.centerY + lx : this.centerY + ly;

      if (i > 0) {
        const prev = rawPts[i - 1];
        accLen += Math.hypot(x - prev.x, y - prev.y);
      }
      rawPts.push({ x, y, s: accLen });
    }

    this.totalLength = Math.max(1, accLen);
    const samples: PathSample[] = [];
    let rawIdx = 0;

    for (let i = 0; i < PATH_POINTS; i++) {
      const targetS = (i / PATH_POINTS) * this.totalLength;
      while (rawIdx < rawCount - 1 && rawPts[rawIdx + 1].s < targetS) {
        rawIdx++;
      }
      const p0 = rawPts[rawIdx];
      const p1 = rawPts[rawIdx + 1];
      const seg = Math.max(1e-6, p1.s - p0.s);
      const frac = clamp((targetS - p0.s) / seg, 0, 1);
      samples.push({
        x: lerp(p0.x, p1.x, frac),
        y: lerp(p0.y, p1.y, frac),
        tx: 1,
        ty: 0,
        nx: 0,
        ny: 1,
        s: targetS,
        u: i / PATH_POINTS,
      });
    }

    // Compute smooth tangents and normals
    for (let i = 0; i < PATH_POINTS; i++) {
      const prev = samples[(i - 1 + PATH_POINTS) % PATH_POINTS];
      const next = samples[(i + 1) % PATH_POINTS];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      samples[i].tx = dx / len;
      samples[i].ty = dy / len;
      samples[i].nx = -samples[i].ty;
      samples[i].ny = samples[i].tx;
    }

    this.path = samples;
  }

  private samplePath(u: number): PathSample {
    const wrapped = mod1(u);
    const idx = Math.floor(wrapped * PATH_POINTS) % PATH_POINTS;
    return this.path[idx];
  }

  private getBraidedPoint(
    pathU: number,
    vine: 0 | 1,
    swayOffset = 0
  ): { x: number; y: number; tx: number; ty: number; nx: number; ny: number } {
    const pt = this.samplePath(pathU);
    const phase = pathU * TAU * BRAID_CYCLES + (vine === 0 ? 0 : Math.PI);
    const offset = Math.sin(phase) * this.braidAmp + swayOffset;
    return {
      x: pt.x + pt.nx * offset,
      y: pt.y + pt.ny * offset,
      tx: pt.tx,
      ty: pt.ty,
      nx: pt.nx,
      ny: pt.ny,
    };
  }

  private buildBackground(): void {
    const bw = Math.max(1, Math.round(this.width * this.dpr));
    const bh = Math.max(1, Math.round(this.height * this.dpr));
    const c = createOffscreen(bw, bh);
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.scale(this.dpr, this.dpr);
    const w = this.width;
    const h = this.height;

    // Deep cosmic night base
    const sky = ctx.createLinearGradient(0, 0, w * 0.3, h);
    sky.addColorStop(0, "#040614");
    sky.addColorStop(0.45, "#090a24");
    sky.addColorStop(0.8, "#110c2b");
    sky.addColorStop(1, "#070616");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Soft nebula clouds (violet, blue, rose)
    const nebulae = [
      { x: w * 0.22, y: h * 0.28, r: Math.max(w, h) * 0.42, c0: "rgba(99, 64, 196, 0.20)", c1: "rgba(99, 64, 196, 0)" },
      { x: w * 0.78, y: h * 0.68, r: Math.max(w, h) * 0.44, c0: "rgba(190, 72, 148, 0.16)", c1: "rgba(190, 72, 148, 0)" },
      { x: w * 0.74, y: h * 0.22, r: Math.max(w, h) * 0.36, c0: "rgba(56, 108, 204, 0.16)", c1: "rgba(56, 108, 204, 0)" },
      { x: w * 0.28, y: h * 0.76, r: Math.max(w, h) * 0.38, c0: "rgba(124, 58, 237, 0.14)", c1: "rgba(124, 58, 237, 0)" },
    ];
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.c0);
      g.addColorStop(1, n.c1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Faint diagonal galaxy band
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-0.38);
    const bandW = Math.hypot(w, h) * 1.1;
    const bandH = Math.min(w, h) * 0.32;
    const band = ctx.createLinearGradient(0, -bandH, 0, bandH);
    band.addColorStop(0, "rgba(167, 139, 250, 0)");
    band.addColorStop(0.35, "rgba(147, 112, 219, 0.06)");
    band.addColorStop(0.5, "rgba(244, 180, 224, 0.085)");
    band.addColorStop(0.65, "rgba(129, 140, 248, 0.055)");
    band.addColorStop(1, "rgba(167, 139, 250, 0)");
    ctx.fillStyle = band;
    ctx.fillRect(-bandW * 0.5, -bandH, bandW, bandH * 2);

    // Subtle galaxy dust specks inside band
    const rng = createSeededRandom(4409);
    const specks = this.isMobile ? 90 : 180;
    for (let i = 0; i < specks; i++) {
      const sx = randomRange(rng, -bandW * 0.48, bandW * 0.48);
      const sy = (rng() + rng() - 1) * bandH * 0.72;
      const sr = randomRange(rng, 0.5, 1.4);
      ctx.fillStyle = `rgba(236, 228, 255, ${randomRange(rng, 0.08, 0.26).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Very soft glow beneath the floating infinity
    const auraR = Math.min(w, h) * 0.46;
    const aura = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      0,
      this.centerX,
      this.centerY,
      auraR
    );
    aura.addColorStop(0, "rgba(245, 185, 130, 0.07)");
    aura.addColorStop(0.5, "rgba(168, 85, 247, 0.05)");
    aura.addColorStop(1, "rgba(10, 8, 28, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    this.bgCanvas = c;
  }

  private buildSprites(): void {
    // 2 leaf sprites: 0 = warm gold-emerald, 1 = soft rose-emerald
    this.leafSprites = [0, 1].map((variant) => {
      const size = 44;
      const c = createOffscreen(size, size);
      const ctx = c.getContext("2d");
      if (!ctx) return c;

      ctx.translate(6, size * 0.5);
      const grad = ctx.createLinearGradient(0, 0, 32, 0);
      if (variant === 0) {
        grad.addColorStop(0, "#854d0e");
        grad.addColorStop(0.45, "#65a30d");
        grad.addColorStop(1, "#fde68a");
      } else {
        grad.addColorStop(0, "#831843");
        grad.addColorStop(0.45, "#0f766e");
        grad.addColorStop(1, "#fbcfe8");
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(14, -12, 32, 0);
      ctx.quadraticCurveTo(14, 12, 0, 0);
      ctx.closePath();
      ctx.fill();

      // Delicate central vein
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(27, 0);
      ctx.stroke();

      return c;
    });

    // 4 palettes x 4 bloom stages (0 = bud, 1 = opening, 2 = lush, 3 = full radiant bloom)
    this.flowerSprites = FLOWER_PALETTES.map((pal) =>
      [0, 1, 2, 3].map((stage) => {
        const size = 64;
        const c = createOffscreen(size, size);
        const ctx = c.getContext("2d");
        if (!ctx) return c;

        const cx = size * 0.5;
        const cy = size * 0.5;
        const bloomFrac = (stage + 1) / 4;

        // Soft luminous halo
        const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.48);
        halo.addColorStop(0, `${pal.inner}66`);
        halo.addColorStop(0.55, `${pal.outer}22`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.48, 0, TAU);
        ctx.fill();

        const petalCount = stage === 0 ? 3 : 5;
        const petalLen = lerp(9, 20, bloomFrac);
        const petalW = lerp(4.2, 9.2, bloomFrac);

        for (let p = 0; p < petalCount; p++) {
          const ang = (p / petalCount) * TAU - Math.PI * 0.5;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(ang);

          const pg = ctx.createLinearGradient(0, 0, 0, -petalLen);
          pg.addColorStop(0, pal.inner);
          pg.addColorStop(0.65, pal.outer);
          pg.addColorStop(1, "#ffffffcc");

          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-petalW, -petalLen * 0.4, -petalW * 0.7, -petalLen, 0, -petalLen);
          ctx.bezierCurveTo(petalW * 0.7, -petalLen, petalW, -petalLen * 0.4, 0, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Glowing stamen core
        const coreR = lerp(2.6, 5.2, bloomFrac);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 1.4);
        cg.addColorStop(0, "#ffffff");
        cg.addColorStop(0.55, pal.core);
        cg.addColorStop(1, `${pal.outer}00`);
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR * 1.4, 0, TAU);
        ctx.fill();

        return c;
      })
    );
  }

  private buildStarsAndDust(): void {
    const rng = createSeededRandom(7701);
    const starCount = this.isMobile ? 95 : 175;
    const starColors = ["#ffffff", "#e0e7ff", "#fde68a", "#fbcfe8", "#c4b5fd"];

    this.stars = [];
    for (let i = 0; i < starCount; i++) {
      const layer = (i % 3) as 0 | 1 | 2;
      this.stars.push({
        x: rng() * this.width,
        y: rng() * this.height,
        r: layer === 0 ? randomRange(rng, 0.5, 1.0) : layer === 1 ? randomRange(rng, 0.9, 1.5) : randomRange(rng, 1.3, 2.1),
        layer,
        phase: rng() * TAU,
        speed: randomRange(rng, 0.7, 2.2),
        color: starColors[Math.floor(rng() * starColors.length)],
      });
    }

    const dustCount = this.isMobile ? 16 : 34;
    const dustColors = ["#fbcfe8", "#fde68a", "#ddd6fe", "#f9a8d4"];
    this.dust = [];
    for (let i = 0; i < dustCount; i++) {
      this.dust.push({
        x: rng() * this.width,
        y: rng() * this.height,
        vx: randomRange(rng, -8, 8),
        vy: randomRange(rng, -11, -3),
        size: randomRange(rng, 2.2, 4.8),
        angle: rng() * TAU,
        spin: randomRange(rng, -0.8, 0.8),
        alpha: randomRange(rng, 0.16, 0.42),
        color: dustColors[Math.floor(rng() * dustColors.length)],
      });
    }
  }

  private buildBotanicals(): void {
    const rng = createSeededRandom(9104);
    const leafCount = this.isMobile ? 44 : 74;
    const flowerCount = this.isMobile ? 28 : 46;

    const prevLeaves = this.leaves;
    const prevFlowers = this.flowers;

    this.leaves = [];
    for (let i = 0; i < leafCount; i++) {
      const u = (i + 0.35 + randomRange(rng, -0.15, 0.15)) / leafCount;
      const vine = (i % 2) as 0 | 1;
      const pathU = vine === 0 ? mod1(u) : mod1(1 - u);
      const existing = prevLeaves[i];
      this.leaves.push({
        vine,
        u: clamp(u, 0.015, 0.985),
        pathU,
        side: i % 4 < 2 ? 1 : -1,
        size: randomRange(rng, this.isMobile ? 13 : 16, this.isMobile ? 20 : 25),
        swayPhase: rng() * TAU,
        growth: existing ? existing.growth : 0,
      });
    }

    this.flowers = [];
    for (let i = 0; i < flowerCount; i++) {
      const u = (i + 0.5 + randomRange(rng, -0.18, 0.18)) / flowerCount;
      const vine = (i % 2) as 0 | 1;
      const pathU = vine === 0 ? mod1(u) : mod1(1 - u);
      const existing = prevFlowers[i];
      this.flowers.push({
        vine,
        u: clamp(u, 0.025, 0.985),
        pathU,
        side: i % 2 === 0 ? 1 : -1,
        offsetPx: randomRange(rng, 4, 10),
        palette: Math.floor(rng() * 4) as 0 | 1 | 2 | 3,
        size: randomRange(rng, this.isMobile ? 18 : 22, this.isMobile ? 28 : 35),
        swayPhase: rng() * TAU,
        bloom: existing ? existing.bloom : 0,
        burstFlash: 0,
      });
    }
  }

  private buildFlowOrbs(): void {
    const rng = createSeededRandom(3319);
    const count = this.isMobile ? 14 : 26;
    const colors = ["#fde68a", "#fbcfe8", "#e9d5ff", "#ffffff"];
    this.flowOrbs = [];
    for (let i = 0; i < count; i++) {
      this.flowOrbs.push({
        u: i / count,
        speed: randomRange(rng, 0.045, 0.095) * (i % 2 === 0 ? 1 : -1),
        vine: (i % 2) as 0 | 1,
        size: randomRange(rng, 2.4, 5.2),
        isPetal: i % 3 === 0,
        color: colors[i % colors.length],
        phase: rng() * TAU,
      });
    }
  }

  private triggerCompletion(): void {
    if (this.completed) return;
    this.completed = true;
    this.completeTime = this.time;
    this.pulseU = 0;
    this.autoGrowing = false;
    this.demoActive = false;
    this.onCompleteCb?.();
  }

  private emitTipSparkles(x: number, y: number, color: string, count: number): void {
    const cap = this.isMobile ? 36 : 75;
    if (this.sparkles.length > cap) return;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * TAU;
      const spd = 14 + Math.random() * 34;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 6,
        age: 0,
        life: 0.45 + Math.random() * 0.45,
        size: 1.5 + Math.random() * 2.2,
        color,
      });
    }
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += clampedDt;

    // Gentle parallax toward pointer
    const targetPx = this.width > 0 ? (this.pointerX / this.width - 0.5) * 18 : 0;
    const targetPy = this.height > 0 ? (this.pointerY / this.height - 0.5) * 14 : 0;
    this.parallaxX = lerp(this.parallaxX, targetPx, clampedDt * 2.2);
    this.parallaxY = lerp(this.parallaxY, targetPy, clampedDt * 2.2);

    // Retraction animation (Grow it again)
    if (this.retracting) {
      this.progress = Math.max(0, this.progress - clampedDt * 0.78);
      for (const leaf of this.leaves) {
        if (leaf.u > this.progress) {
          leaf.growth = Math.max(0, leaf.growth - clampedDt * 3.5);
        }
      }
      for (const fl of this.flowers) {
        if (fl.u > this.progress) {
          fl.bloom = Math.max(0, fl.bloom - clampedDt * 3.5);
        }
      }
      if (this.progress <= 0.001) {
        this.progress = 0;
        this.targetProgress = 0;
        this.retracting = false;
        this.demoActive = true;
        this.demoU = 0;
        this.demoCooldown = 0;
        this.idleSeconds = 0;
      }
    } else if (!this.completed) {
      if (this.autoGrowing) {
        this.targetProgress = clamp(this.targetProgress + clampedDt * 0.26, 0, 1);
      }

      const prevP = this.progress;
      const diff = this.targetProgress - this.progress;
      if (diff > 0.0001) {
        // Smooth eased catch-up
        const step = Math.min(diff, Math.max(diff * 7.5, 0.14) * clampedDt);
        this.progress = clamp(this.progress + step, 0, 1);

        // Emit sparkles from both growing tips while advancing
        if (!this.reducedMotion && this.progress - prevP > 0.0015 && this.path.length > 0) {
          const gPt = this.getBraidedPoint(this.progress, 0);
          const rPt = this.getBraidedPoint(1 - this.progress, 1);
          this.emitTipSparkles(gPt.x, gPt.y, "#fde68a", this.isMobile ? 1 : 2);
          this.emitTipSparkles(rPt.x, rPt.y, "#fbcfe8", this.isMobile ? 1 : 2);
        }
      }

      if (this.progress >= 0.996) {
        this.progress = 1;
        this.targetProgress = 1;
        this.triggerCompletion();
      }

      // Demo light cadence (plays once at start, then repeats every 6s while idle)
      if (!this.pointerActive && !this.autoGrowing && !this.reducedMotion) {
        if (this.demoActive) {
          this.demoU += clampedDt * 0.21;
          if (this.demoU >= 1) {
            this.demoActive = false;
            this.demoU = 0;
            this.demoCooldown = 0;
          }
        } else {
          this.idleSeconds += clampedDt;
          this.demoCooldown += clampedDt;
          if (this.demoCooldown >= 6) {
            this.demoActive = true;
            this.demoU = 0;
            this.demoCooldown = 0;
          }
        }
      }
    } else {
      // Completion pulse traveling around the loop
      if (this.pulseU >= 0 && this.pulseU < 1.05) {
        this.pulseU += clampedDt * 0.48;
      }

      // Eternal flowing petals and glowing orbs along the infinity
      for (const orb of this.flowOrbs) {
        orb.u = mod1(orb.u + orb.speed * clampedDt);
      }
    }

    // Update leaf unfurling & flower blooming behind growth front
    for (const leaf of this.leaves) {
      if (this.progress >= leaf.u && !this.retracting) {
        const target = this.reducedMotion ? 1 : clamp((this.progress - leaf.u) * 14, 0, 1);
        leaf.growth = Math.min(1, Math.max(leaf.growth, target) + clampedDt * 1.65);
      }
    }

    for (const fl of this.flowers) {
      if (this.progress >= fl.u + 0.012 && !this.retracting) {
        // Flowers bloom a moment after the front passes
        const delayPassed = this.progress - fl.u;
        const speed = this.completed ? 2.4 : 1.15;
        if (delayPassed > 0.015 || this.completed) {
          const prevBloom = fl.bloom;
          fl.bloom = Math.min(1, fl.bloom + clampedDt * speed);
          if (prevBloom < 0.85 && fl.bloom >= 0.85) {
            fl.burstFlash = 1;
          }
        }
      }
      if (this.completed && this.pulseU >= 0 && this.pulseU <= 1.05) {
        const d = Math.abs(fl.pathU - this.pulseU);
        if (d < 0.04) {
          fl.bloom = 1;
          fl.burstFlash = Math.max(fl.burstFlash, 0.85);
        }
      }
      if (fl.burstFlash > 0) {
        fl.burstFlash = Math.max(0, fl.burstFlash - clampedDt * 1.9);
      }
    }

    // Update sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.age += clampedDt;
      if (sp.age >= sp.life) {
        this.sparkles.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * clampedDt;
      sp.y += sp.vy * clampedDt;
      sp.vx *= 0.96;
      sp.vy *= 0.96;
    }

    // Update drifting petal dust
    if (!this.reducedMotion) {
      for (const d of this.dust) {
        d.x += (d.vx + Math.sin(this.time * 0.5 + d.angle) * 4) * clampedDt;
        d.y += d.vy * clampedDt;
        d.angle += d.spin * clampedDt;
        if (d.y < -12) {
          d.y = this.height + 12;
          d.x = Math.random() * this.width;
        }
        if (d.x < -12) d.x = this.width + 12;
        if (d.x > this.width + 12) d.x = -12;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 1. Pre-rendered cosmic background
    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = "#050716";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Continuous subtle sky warmth driven by progress p
    if (this.progress > 0.005) {
      const glowAlpha = 0.04 + this.progress * 0.14;
      const g = ctx.createRadialGradient(
        this.centerX,
        this.centerY,
        10,
        this.centerX,
        this.centerY,
        Math.max(this.width, this.height) * 0.55
      );
      g.addColorStop(0, `rgba(251, 207, 232, ${(glowAlpha * 0.65).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(245, 158, 11, ${(glowAlpha * 0.35).toFixed(3)})`);
      g.addColorStop(1, "rgba(10, 8, 28, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 2. Three layers of twinkling stars with parallax
    for (const s of this.stars) {
      const depth = s.layer === 0 ? 0.25 : s.layer === 1 ? 0.6 : 1.0;
      const sx = s.x - this.parallaxX * depth;
      const sy = s.y - this.parallaxY * depth;
      const twinkle = this.reducedMotion
        ? 0.65
        : 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(this.time * s.speed + s.phase));
      ctx.globalAlpha = twinkle * (0.55 + this.progress * 0.35);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Drifting cosmic petal dust
    for (const d of this.dust) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.globalAlpha = d.alpha * (0.7 + this.progress * 0.5);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, d.size, d.size * 0.48, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 4. Dotted infinity guide line (fades gently once fully completed)
    this.renderGuideLine(ctx);

    // 5. Demo light traveling along the infinity while idle
    if (this.demoActive && !this.completed && !this.retracting && this.path.length > 0) {
      this.renderDemoLight(ctx);
    }

    // 6. Braided GOLD & ROSE vines up to growth front
    if (this.progress > 0.002 && this.path.length > 0) {
      this.renderVine(ctx, 0, "#f59e0b", "#fef08a", "rgba(251, 191, 36, 0.28)");
      this.renderVine(ctx, 1, "#ec4899", "#fbcfe8", "rgba(244, 114, 182, 0.28)");
      this.renderLeaves(ctx);
      this.renderFlowers(ctx);
      if (!this.completed && !this.retracting) {
        this.renderGrowingTips(ctx);
      }
    }

    // 7. Completion light pulse + eternal flowing petals & lights
    if (this.completed) {
      this.renderCompletionEffects(ctx);
    }

    // 8. Tip sparkles
    for (const sp of this.sparkles) {
      const a = 1 - sp.age / sp.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * (0.5 + 0.5 * a), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private renderGuideLine(ctx: CanvasRenderingContext2D): void {
    if (this.path.length === 0) return;
    const guideAlpha = this.completed
      ? Math.max(0.06, 0.22 - (this.time - this.completeTime) * 0.1)
      : 0.22 + this.progress * 0.16;

    ctx.save();
    // Subtle soft glow under the loop
    ctx.strokeStyle = `rgba(196, 181, 253, ${(guideAlpha * 0.35).toFixed(3)})`;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i += 2) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Crisp dotted guide
    ctx.strokeStyle = `rgba(233, 213, 255, ${guideAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 9]);
    ctx.lineDashOffset = -this.time * 10;
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i += 2) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private renderDemoLight(ctx: CanvasRenderingContext2D): void {
    // Draw a comet tail of 16 samples behind demoU
    const tailLen = 16;
    for (let i = tailLen; i >= 0; i--) {
      const u = mod1(this.demoU - i * 0.005);
      const pt = this.samplePath(u);
      const frac = 1 - i / tailLen;
      ctx.fillStyle = `rgba(254, 240, 138, ${(frac * 0.65).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.5 + frac * 3.8, 0, TAU);
      ctx.fill();
    }

    const head = this.samplePath(this.demoU);
    const halo = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 22);
    halo.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    halo.addColorStop(0.35, "rgba(254, 240, 138, 0.65)");
    halo.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 22, 0, TAU);
    ctx.fill();
  }

  private renderVine(
    ctx: CanvasRenderingContext2D,
    vine: 0 | 1,
    midColor: string,
    coreColor: string,
    glowColor: string
  ): void {
    const steps = Math.max(2, Math.floor(this.progress * PATH_POINTS));
    const stride = this.isMobile ? 2 : 1;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Pass 1: Soft outer glow stroke (single path for 60fps performance)
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = this.isMobile ? 8.5 : 10.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i += stride) {
      const frac = i / PATH_POINTS;
      const pathU = vine === 0 ? frac : mod1(1 - frac);
      const pt = this.getBraidedPoint(pathU, vine);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Pass 2: Tapered body stroke (mature body + tapered last 24 samples near growing tip)
    const taperStart = this.completed ? steps : Math.max(0, steps - 28);

    // Mature segment
    if (taperStart > 0) {
      ctx.strokeStyle = midColor;
      ctx.lineWidth = this.isMobile ? 3.2 : 3.8;
      ctx.beginPath();
      for (let i = 0; i <= taperStart; i += stride) {
        const frac = i / PATH_POINTS;
        const pathU = vine === 0 ? frac : mod1(1 - frac);
        const pt = this.getBraidedPoint(pathU, vine);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Bright inner highlight filament
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    // Tapered growing tip segment
    if (taperStart < steps) {
      let prevPt = this.getBraidedPoint(
        vine === 0 ? taperStart / PATH_POINTS : mod1(1 - taperStart / PATH_POINTS),
        vine
      );
      for (let i = taperStart + 1; i <= steps; i++) {
        const frac = i / PATH_POINTS;
        const pathU = vine === 0 ? frac : mod1(1 - frac);
        const curPt = this.getBraidedPoint(pathU, vine);
        const tipT = (i - taperStart) / Math.max(1, steps - taperStart);
        const lw = lerp(this.isMobile ? 3.2 : 3.8, 0.9, tipT);

        ctx.strokeStyle = tipT > 0.6 ? coreColor : midColor;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(curPt.x, curPt.y);
        ctx.stroke();
        prevPt = curPt;
      }
    }

    ctx.restore();
  }

  private renderGrowingTips(ctx: CanvasRenderingContext2D): void {
    const tips = [
      { pt: this.getBraidedPoint(this.progress, 0), glow: "rgba(254, 240, 138, 0.85)" },
      { pt: this.getBraidedPoint(mod1(1 - this.progress), 1), glow: "rgba(251, 207, 232, 0.85)" },
    ];
    for (const { pt, glow } of tips) {
      const r = 16 + Math.sin(this.time * 7) * 2.5;
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, glow);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, TAU);
      ctx.fill();
    }
  }

  private renderLeaves(ctx: CanvasRenderingContext2D): void {
    for (const leaf of this.leaves) {
      if (leaf.growth <= 0.02) continue;
      const pt = this.getBraidedPoint(leaf.pathU, leaf.vine);
      const sprite = this.leafSprites[leaf.vine];
      if (!sprite) continue;

      const scale = easeOutCubic(leaf.growth);
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.9 + leaf.swayPhase) * 0.12;
      const baseAngle = Math.atan2(pt.ty, pt.tx) + (leaf.vine === 1 ? Math.PI : 0);
      const angle = baseAngle + leaf.side * 0.72 + sway;

      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(angle);
      const drawSize = leaf.size * scale;
      ctx.globalAlpha = Math.min(1, scale * 1.15);
      ctx.drawImage(sprite, -drawSize * 0.12, -drawSize * 0.5, drawSize, drawSize);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private renderFlowers(ctx: CanvasRenderingContext2D): void {
    for (const fl of this.flowers) {
      if (fl.bloom <= 0.02) continue;
      const pt = this.getBraidedPoint(fl.pathU, fl.vine);
      const stage = Math.min(3, Math.floor(fl.bloom * 3.99));
      const sprite = this.flowerSprites[fl.palette]?.[stage];
      if (!sprite) continue;

      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.5 + fl.swayPhase) * 2.2;
      const fx = pt.x + pt.nx * (fl.side * fl.offsetPx + sway);
      const fy = pt.y + pt.ny * (fl.side * fl.offsetPx + sway);

      const scale = easeOutCubic(fl.bloom) * (1 + fl.burstFlash * 0.22);
      const drawSize = fl.size * scale;

      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(sway * 0.06);
      ctx.globalAlpha = Math.min(1, fl.bloom * 1.25);
      ctx.drawImage(sprite, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);

      if (fl.burstFlash > 0.05) {
        ctx.globalAlpha = fl.burstFlash * 0.55;
        ctx.fillStyle = "#fffbeb";
        ctx.beginPath();
        ctx.arc(0, 0, drawSize * 0.42, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private renderCompletionEffects(ctx: CanvasRenderingContext2D): void {
    // 1. Traveling pulse of light around the entire infinity loop
    if (this.pulseU >= 0 && this.pulseU <= 1.05) {
      const tail = 22;
      for (let i = tail; i >= 0; i--) {
        const u = mod1(this.pulseU - i * 0.004);
        const pt = this.samplePath(u);
        const frac = 1 - i / tail;
        ctx.fillStyle = `rgba(255, 251, 235, ${(frac * 0.72).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2 + frac * 7, 0, TAU);
        ctx.fill();
      }
      const head = this.samplePath(this.pulseU);
      const hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 38);
      hg.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      hg.addColorStop(0.4, "rgba(254, 240, 138, 0.55)");
      hg.addColorStop(1, "rgba(244, 114, 182, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 38, 0, TAU);
      ctx.fill();
    }

    // 2. Eternal flowing glowing petals & lights along the closed infinity
    const fadeIn = clamp((this.time - this.completeTime) * 0.7, 0, 1);
    for (const orb of this.flowOrbs) {
      const pt = this.getBraidedPoint(orb.u, orb.vine, Math.sin(this.time * 2 + orb.phase) * 3);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.globalAlpha = fadeIn * (0.55 + 0.35 * Math.sin(this.time * 3 + orb.phase));
      if (orb.isPetal) {
        ctx.rotate(Math.atan2(pt.ty, pt.tx) + Math.sin(this.time + orb.phase) * 0.4);
        ctx.fillStyle = orb.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, orb.size * 1.4, orb.size * 0.65, 0, 0, TAU);
        ctx.fill();
      } else {
        const og = ctx.createRadialGradient(0, 0, 0, 0, 0, orb.size * 2.8);
        og.addColorStop(0, "#ffffff");
        og.addColorStop(0.45, orb.color);
        og.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(0, 0, orb.size * 2.8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
