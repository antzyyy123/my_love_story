/**
 * Canvas 2D Renderer for "Things I Love About You" — Firefly Jar in a Night Meadow
 * - Pre-renders deep blue-green night sky, soft moon, 3 layered hills, mossy stump,
 *   glowing mushrooms, translucent glass jar back/front, and 4 meadow flower sprites.
 * - Animates 12 fireflies wandering inside the glass jar (illuminating jar, stump & grass),
 *   tilting cork lid on release, spiral ascent + curved flight with sparkle trails,
 *   settling into sky stars, and progressive starfield + mist response.
 * - Finale: 12 sky fireflies swirl into a spiral and burst into a golden bloom wave that
 *   turns hundreds of closed meadow buds into glowing flowers and makes the grass luminous,
 *   with a softly glowing empty jar & shimmering tag.
 * - Post-finale: tapping the meadow releases extra fireflies ("and countless more").
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

const MAX_JAR_SLOTS = 18;

export type FireflyState = "jar" | "flying" | "settled" | "spiraling";

export interface FireflyHUDItem {
  index: number;
  state: FireflyState;
  x: number;
  y: number;
  reasonIndex: number; // 0..11 once assigned on release, -1 while in jar
  noteAlpha: number; // 0..1 while flying note is open
}

export interface ExtraFireflyHUDItem {
  id: number;
  x: number;
  y: number;
  textIndex: number;
  noteAlpha: number;
}

export interface ThingsILoveHUDState {
  fireflies: FireflyHUDItem[];
  extraNotes: ExtraFireflyHUDItem[];
  releasedCount: number;
  finaleActive: boolean;
  jarTopY: number;
  jarBottomY: number;
}

interface BgStar {
  x: number;
  y: number;
  r: number;
  threshold: number; // 0..1 fraction of jar emptied at which this star appears
  phase: number;
  speed: number;
  color: string;
}

interface GrassBlade {
  x: number;
  baseY: number;
  h: number;
  lean: number;
  phase: number;
  width: number;
  shade: number;
}

interface MeadowBud {
  x: number;
  y: number;
  distFromCenter: number;
  palette: 0 | 1 | 2 | 3;
  size: number;
  phase: number;
  bloom: number; // 0 = closed bud, 1 = glowing open flower
}

interface JarFirefly {
  index: number;
  state: FireflyState;
  reasonIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  wingPhase: number;
  // Flight parameters
  flightT: number;
  flightDuration: number;
  noteTimer: number; // counts up to ~6s
  p0x: number;
  p0y: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  targetX: number;
  targetY: number;
  // Spiral parameters
  spiralAngle: number;
  spiralRadius: number;
  fadeIn: number;
}

interface ExtraFirefly {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  textIndex: number;
  phase: number;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

const FLOWER_PALETTES = [
  { outer: "#f472b6", inner: "#fbcfe8", core: "#fef08a" }, // soft pink
  { outer: "#a855f7", inner: "#e9d5ff", core: "#fef9c3" }, // soft violet
  { outer: "#f59e0b", inner: "#fde68a", core: "#fffbeb" }, // warm gold
  { outer: "#fb7185", inner: "#ffe4e6", core: "#fef08a" }, // rose blush
] as const;

function createOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

export class ThingsILoveRenderer {
  private width = 1;
  private height = 1;
  private dpr = 1;
  private isMobile = false;
  private isPortrait = false;
  private reducedMotion = false;
  private jarTagText: string;

  // Jar geometry in CSS px
  private jarCx = 0;
  private jarCy = 0;
  private jarW = 140;
  private jarH = 190;
  private jarNeckY = 0;
  private jarBottomY = 0;
  private horizonY = 0;

  // Pre-rendered caches
  private bgCanvas: HTMLCanvasElement | null = null;
  private jarBackCanvas: HTMLCanvasElement | null = null;
  private jarFrontCanvas: HTMLCanvasElement | null = null;
  private jarCacheW = 0;
  private jarCacheH = 0;
  private jarCacheX = 0;
  private jarCacheY = 0;
  private flowerSprites: HTMLCanvasElement[] = [];

  // Dynamic entities
  private stars: BgStar[] = [];
  private grass: GrassBlade[] = [];
  private buds: MeadowBud[] = [];
  private fireflies: JarFirefly[] = [];
  private extraFireflies: ExtraFirefly[] = [];
  private sparkles: Sparkle[] = [];

  private time = 0;
  private lidOpen = 0; // 0..1 tilt
  private lidHoldTimer = 0;
  private totalReasons = 12;
  private jarSlotCount = 12;
  private releasedCount = 0;
  private nextReasonIdx = 0;

  // Finale state
  private finaleStage: "none" | "spiral" | "wave" | "done" = "none";
  private finaleTimer = 0;
  private spiralCx = 0;
  private spiralCy = 0;
  private waveRadius = 0;
  private maxWaveRadius = 1000;
  private meadowGlow = 0; // 0..1 luminous meadow

  private extraIdCounter = 1;
  private nextExtraTextIdx = 0;
  private extraCount = 0;
  private extraReasonTotal: number;

  private parallaxX = 0;
  private pointerX = 0;

  private onFinaleDoneCb?: () => void;
  private onExtraReleaseCb?: (count: number, textIndex: number) => void;

  constructor(opts: {
    jarTagText: string;
    reasonCount: number;
    extraReasonTotal: number;
    reducedMotion: boolean;
    onFinaleDone?: () => void;
    onExtraRelease?: (count: number, textIndex: number) => void;
  }) {
    this.jarTagText = opts.jarTagText;
    this.totalReasons = Math.max(1, opts.reasonCount);
    this.jarSlotCount = Math.min(MAX_JAR_SLOTS, this.totalReasons);
    this.extraReasonTotal = Math.max(1, opts.extraReasonTotal);
    this.reducedMotion = opts.reducedMotion;
    this.onFinaleDoneCb = opts.onFinaleDone;
    this.onExtraReleaseCb = opts.onExtraRelease;
    this.buildFlowerSprites();
  }

  public setReducedMotion(rm: boolean): void {
    this.reducedMotion = rm;
  }

  public resize(width: number, height: number, dpr: number): void {
    const prevW = this.width;
    const prevH = this.height;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.isMobile = this.width < 680;
    this.isPortrait = this.height > this.width * 1.05;

    this.horizonY = this.isPortrait ? this.height * 0.56 : this.height * 0.58;

    // Jar larger on portrait, cleanly centered above bottom 12 dots & hint
    if (this.isPortrait) {
      this.jarH = clamp(this.height * 0.28, 170, 250);
      this.jarW = this.jarH * 0.72;
      this.jarCx = this.width * 0.5;
      this.jarCy = this.height * 0.61;
    } else {
      this.jarH = clamp(this.height * 0.30, 165, 240);
      this.jarW = this.jarH * 0.72;
      this.jarCx = this.width * 0.5;
      this.jarCy = this.height * 0.63;
    }
    this.jarNeckY = this.jarCy - this.jarH * 0.52;
    this.jarBottomY = this.jarCy + this.jarH * 0.5;

    this.spiralCx = this.width * 0.5;
    this.spiralCy = this.isPortrait ? this.height * 0.26 : this.height * 0.27;
    this.maxWaveRadius = Math.hypot(this.width, this.height) * 1.05;

    this.buildBackground();
    this.buildJarCaches();
    this.buildStars();
    this.buildGrassAndBuds();

    if (this.fireflies.length === 0) {
      this.initFireflies();
    } else if (prevW > 1 && prevH > 1) {
      // Reposition existing fireflies proportionally on resize
      const sx = this.width / prevW;
      const sy = this.height / prevH;
      for (const ff of this.fireflies) {
        if (ff.state === "jar") {
          ff.x = clamp(ff.x * sx, this.jarCx - this.jarW * 0.36, this.jarCx + this.jarW * 0.36);
          ff.y = clamp(ff.y * sy, this.jarCy - this.jarH * 0.32, this.jarCy + this.jarH * 0.38);
        } else {
          ff.x *= sx;
          ff.y *= sy;
          ff.targetX *= sx;
          ff.targetY *= sy;
        }
      }
    }
  }

  public setPointerX(x: number): void {
    this.pointerX = x;
  }

  /** Free a specific firefly inside the jar, or find the nearest jar firefly to (x,y) */
  public releaseFireflyByIndex(index: number): number | null {
    const ff = this.fireflies[index];
    if (!ff || ff.state !== "jar") return null;

    const reasonIndex = this.nextReasonIdx;
    this.nextReasonIdx = (this.nextReasonIdx + 1) % this.totalReasons;
    this.releasedCount++;
    ff.reasonIndex = reasonIndex;

    // Assign a well-spaced constellation target in the upper sky
    const target = this.getSkyTarget(reasonIndex);
    ff.targetX = target.x;
    ff.targetY = target.y;

    this.lidHoldTimer = 0.95;

    if (this.reducedMotion) {
      ff.state = "settled";
      ff.x = target.x;
      ff.y = target.y;
      ff.fadeIn = 0;
      ff.noteTimer = 0.01;
    } else {
      ff.state = "flying";
      ff.flightT = 0;
      ff.flightDuration = 3.2;
      ff.noteTimer = 0.01;
      ff.p0x = ff.x;
      ff.p0y = ff.y;
      ff.p1x = this.jarCx + (target.x < this.jarCx ? -this.jarW * 0.65 : this.jarW * 0.65);
      ff.p1y = this.jarNeckY - this.jarH * 0.42;
      ff.p2x = lerp(this.jarCx, target.x, 0.72);
      ff.p2y = Math.min(this.jarNeckY - 60, target.y + 40);
      this.emitSparkles(ff.x, ff.y, "#fde68a", 8);
    }

    // If totalReasons > MAX_JAR_SLOTS, replenish a fresh firefly in the jar until all reasons are released
    if (this.releasedCount < this.totalReasons && this.fireflies.every((item) => item.state !== "jar")) {
      const oldest = this.fireflies.find((item) => item.state === "settled") ?? this.fireflies[0];
      if (oldest) {
        oldest.state = "jar";
        oldest.x = this.jarCx;
        oldest.y = this.jarCy;
      }
    }

    if (this.releasedCount >= this.totalReasons && this.finaleStage === "none") {
      // Wait briefly for the final firefly to rise before triggering spiral
      this.finaleTimer = this.reducedMotion ? -0.4 : -2.6;
    }

    return reasonIndex;
  }

  /** Hit test a click/tap on the canvas; returns action taken */
  public handleTap(x: number, y: number): { type: "released"; index: number; reasonIndex: number } | { type: "star"; index: number; reasonIndex: number } | { type: "extra"; count: number; textIndex: number } | { type: "none" } {
    // 1. Check settled sky stars first (generous 48px diameter -> 28px+ radius)
    for (const ff of this.fireflies) {
      if (ff.state === "settled") {
        if (Math.hypot(x - ff.x, y - ff.y) <= 30) {
          return { type: "star", index: ff.index, reasonIndex: ff.reasonIndex };
        }
      }
    }

    // 2. Check jar fireflies (generous 48px+ hit area, or tapping anywhere inside the jar frees the nearest firefly)
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const ff of this.fireflies) {
      if (ff.state === "jar") {
        const d = Math.hypot(x - ff.x, y - ff.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = ff.index;
        }
      }
    }

    const insideJar =
      Math.abs(x - this.jarCx) <= this.jarW * 0.65 &&
      y >= this.jarNeckY - 24 &&
      y <= this.jarBottomY + 24;

    if (bestIdx !== -1 && (bestDist <= 42 || insideJar)) {
      const reasonIndex = this.releaseFireflyByIndex(bestIdx);
      if (reasonIndex !== null) {
        return { type: "released", index: bestIdx, reasonIndex };
      }
    }

    // 3. After finale, tapping the meadow releases extra fireflies ("countless more")
    if (this.finaleStage === "done" && y >= this.horizonY - 30) {
      const textIndex = this.nextExtraTextIdx;
      this.nextExtraTextIdx = (this.nextExtraTextIdx + 1) % this.extraReasonTotal;
      this.extraCount++;
      this.spawnExtraFirefly(x, y, textIndex);
      this.onExtraReleaseCb?.(this.extraCount, textIndex);
      return { type: "extra", count: this.extraCount, textIndex };
    }

    return { type: "none" };
  }

  public refillJar(): void {
    this.releasedCount = 0;
    this.nextReasonIdx = 0;
    this.finaleStage = "none";
    this.finaleTimer = 0;
    this.waveRadius = 0;
    this.meadowGlow = 0;
    this.extraFireflies = [];
    this.extraCount = 0;
    this.lidHoldTimer = 0.6;
    for (const b of this.buds) {
      b.bloom = 0;
    }
    this.initFireflies();
  }

  public getHUDState(): ThingsILoveHUDState {
    const fireflies: FireflyHUDItem[] = this.fireflies.map((ff) => {
      let noteAlpha = 0;
      if (ff.noteTimer > 0 && ff.noteTimer < 6.0) {
        const fadeIn = clamp(ff.noteTimer / 0.45, 0, 1);
        const fadeOut = clamp((6.0 - ff.noteTimer) / 0.65, 0, 1);
        noteAlpha = Math.min(fadeIn, fadeOut);
      }
      return {
        index: ff.index,
        state: ff.state,
        x: ff.x,
        y: ff.y,
        reasonIndex: ff.reasonIndex,
        noteAlpha,
      };
    });

    const extraNotes: ExtraFireflyHUDItem[] = this.extraFireflies
      .filter((ef) => ef.age < 5.2)
      .map((ef) => {
        const fadeIn = clamp(ef.age / 0.35, 0, 1);
        const fadeOut = clamp((5.2 - ef.age) / 0.6, 0, 1);
        return {
          id: ef.id,
          x: ef.x,
          y: ef.y,
          textIndex: ef.textIndex,
          noteAlpha: Math.min(fadeIn, fadeOut),
        };
      });

    return {
      fireflies,
      extraNotes,
      releasedCount: this.releasedCount,
      finaleActive: this.finaleStage === "done",
      jarTopY: this.jarNeckY,
      jarBottomY: this.jarBottomY,
    };
  }

  private getSkyTarget(reasonIndex: number): { x: number; y: number } {
    // Graceful arching constellation across upper sky, avoiding top-left Back button & top edge
    const slot = reasonIndex % this.jarSlotCount;
    const t = this.jarSlotCount <= 1 ? 0.5 : slot / (this.jarSlotCount - 1);
    const padX = this.isPortrait ? this.width * 0.12 : this.width * 0.11;
    const x = lerp(padX, this.width - padX, t);
    const arc = Math.sin(t * Math.PI);
    const baseMinY = this.isPortrait ? this.height * 0.14 : this.height * 0.14;
    const baseMaxY = this.isPortrait ? this.height * 0.37 : this.height * 0.40;
    const rowJitter = reasonIndex % 2 === 0 ? -0.22 : 0.24;
    const y = lerp(baseMaxY, baseMinY, arc * 0.72 + 0.14) + rowJitter * (baseMaxY - baseMinY) * 0.45;
    return { x, y: clamp(y, 76, this.horizonY - 56) };
  }

  private initFireflies(): void {
    const rng = createSeededRandom(5512);
    this.fireflies = [];
    for (let i = 0; i < this.jarSlotCount; i++) {
      this.fireflies.push({
        index: i,
        state: "jar",
        reasonIndex: -1,
        x: this.jarCx + randomRange(rng, -this.jarW * 0.30, this.jarW * 0.30),
        y: this.jarCy + randomRange(rng, -this.jarH * 0.24, this.jarH * 0.34),
        vx: randomRange(rng, -24, 24),
        vy: randomRange(rng, -22, 22),
        phase: rng() * TAU,
        wingPhase: rng() * TAU,
        flightT: 0,
        flightDuration: 3.2,
        noteTimer: 0,
        p0x: 0,
        p0y: 0,
        p1x: 0,
        p1y: 0,
        p2x: 0,
        p2y: 0,
        targetX: this.width * 0.5,
        targetY: this.height * 0.25,
        spiralAngle: (i / this.jarSlotCount) * TAU,
        spiralRadius: 90,
        fadeIn: 1,
      });
    }
  }

  private spawnExtraFirefly(x: number, y: number, textIndex: number): void {
    this.extraFireflies.push({
      id: this.extraIdCounter++,
      x,
      y,
      vx: (Math.random() - 0.5) * 26,
      vy: -(48 + Math.random() * 28),
      age: 0,
      life: 7.5,
      textIndex,
      phase: Math.random() * TAU,
    });
    if (this.extraFireflies.length > 18) {
      this.extraFireflies.shift();
    }
    this.emitSparkles(x, y, "#fde68a", 6);
  }

  private emitSparkles(x: number, y: number, color: string, count: number): void {
    const cap = this.isMobile ? 45 : 95;
    if (this.sparkles.length > cap) return;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * TAU;
      const spd = 12 + Math.random() * 34;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 8,
        age: 0,
        life: 0.45 + Math.random() * 0.5,
        size: 1.3 + Math.random() * 2.0,
        color,
      });
    }
  }

  private buildFlowerSprites(): void {
    this.flowerSprites = FLOWER_PALETTES.map((pal) => {
      const size = 40;
      const c = createOffscreen(size, size);
      const ctx = c.getContext("2d");
      if (!ctx) return c;
      const cx = size * 0.5;
      const cy = size * 0.5;

      const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, size * 0.48);
      halo.addColorStop(0, `${pal.inner}88`);
      halo.addColorStop(0.55, `${pal.outer}28`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, TAU);
      ctx.fill();

      for (let p = 0; p < 5; p++) {
        const ang = (p / 5) * TAU - Math.PI * 0.5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = pal.outer;
        ctx.beginPath();
        ctx.ellipse(0, -7, 4.2, 7.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = pal.inner;
        ctx.beginPath();
        ctx.ellipse(0, -5.5, 2.2, 4.2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = pal.core;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.2, 0, TAU);
      ctx.fill();
      return c;
    });
  }

  private buildBackground(): void {
    const c = createOffscreen(this.width * this.dpr, this.height * this.dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // Deep blue-green night sky
    const sky = ctx.createLinearGradient(0, 0, 0, this.horizonY + 80);
    sky.addColorStop(0, "#030c14");
    sky.addColorStop(0.48, "#061a24");
    sky.addColorStop(0.85, "#0b2932");
    sky.addColorStop(1, "#103138");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Soft pale moon in upper right
    const moonX = this.isPortrait ? w * 0.80 : w * 0.82;
    const moonY = this.isPortrait ? h * 0.14 : h * 0.17;
    const moonR = this.isMobile ? 22 : 30;
    const moonHalo = ctx.createRadialGradient(moonX, moonY, moonR * 0.4, moonX, moonY, moonR * 5.2);
    moonHalo.addColorStop(0, "rgba(226, 245, 240, 0.28)");
    moonHalo.addColorStop(0.4, "rgba(148, 210, 205, 0.09)");
    moonHalo.addColorStop(1, "rgba(6, 26, 36, 0)");
    ctx.fillStyle = moonHalo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 5.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#eefaf7";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fill();

    // 3 layered hill silhouettes extending past screen edges
    const hills = [
      { baseY: this.horizonY - 12, amp: 34, freq: 1.5, phase: 0.4, color: "#081f27" },
      { baseY: this.horizonY + 18, amp: 28, freq: 2.1, phase: 2.0, color: "#06181f" },
      { baseY: this.horizonY + 46, amp: 22, freq: 1.7, phase: 4.1, color: "#051319" },
    ];
    for (const hill of hills) {
      ctx.fillStyle = hill.color;
      ctx.beginPath();
      ctx.moveTo(-40, h + 20);
      for (let x = -40; x <= w + 40; x += 24) {
        const nx = x / w;
        const y =
          hill.baseY +
          Math.sin(nx * Math.PI * hill.freq + hill.phase) * hill.amp +
          Math.cos(nx * Math.PI * hill.freq * 2.1 + hill.phase) * (hill.amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 40, h + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Foreground meadow ground slope
    const meadowGrad = ctx.createLinearGradient(0, this.horizonY + 30, 0, h);
    meadowGrad.addColorStop(0, "#06161c");
    meadowGrad.addColorStop(0.55, "#071a1f");
    meadowGrad.addColorStop(1, "#040f13");
    ctx.fillStyle = meadowGrad;
    ctx.fillRect(0, this.horizonY + 48, w, h - this.horizonY);

    // Mossy wooden stump beneath the jar
    const stumpTopY = this.jarBottomY - 6;
    const stumpW = this.jarW * 1.48;
    const stumpH = clamp(h - stumpTopY + 18, 65, 160);
    const sx = this.jarCx;

    const barkGrad = ctx.createLinearGradient(sx - stumpW * 0.55, stumpTopY, sx + stumpW * 0.55, stumpTopY);
    barkGrad.addColorStop(0, "#12100e");
    barkGrad.addColorStop(0.32, "#241b15");
    barkGrad.addColorStop(0.55, "#2f231a");
    barkGrad.addColorStop(0.82, "#1c1510");
    barkGrad.addColorStop(1, "#0d0b0a");

    ctx.fillStyle = barkGrad;
    ctx.beginPath();
    ctx.moveTo(sx - stumpW * 0.46, stumpTopY);
    ctx.quadraticCurveTo(sx - stumpW * 0.52, stumpTopY + stumpH * 0.55, sx - stumpW * 0.64, stumpTopY + stumpH);
    ctx.lineTo(sx + stumpW * 0.64, stumpTopY + stumpH);
    ctx.quadraticCurveTo(sx + stumpW * 0.52, stumpTopY + stumpH * 0.55, sx + stumpW * 0.46, stumpTopY);
    ctx.closePath();
    ctx.fill();

    // Subtle vertical bark grooves
    ctx.strokeStyle = "rgba(8, 6, 5, 0.45)";
    ctx.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) {
      const bx = sx + i * (stumpW * 0.11);
      ctx.beginPath();
      ctx.moveTo(bx, stumpTopY + 8);
      ctx.quadraticCurveTo(bx + i * 3, stumpTopY + stumpH * 0.5, bx + i * 5, stumpTopY + stumpH - 6);
      ctx.stroke();
    }

    // Top cut surface of stump
    ctx.fillStyle = "#33261c";
    ctx.beginPath();
    ctx.ellipse(sx, stumpTopY, stumpW * 0.47, 13, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 232, 195, 0.14)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Soft moss patches on stump edge
    const mossSpots = [
      { ox: -stumpW * 0.36, oy: 4, rx: 22, ry: 8 },
      { ox: stumpW * 0.34, oy: 6, rx: 24, ry: 9 },
      { ox: -stumpW * 0.18, oy: 12, rx: 16, ry: 6 },
    ];
    for (const m of mossSpots) {
      ctx.fillStyle = "rgba(38, 92, 68, 0.72)";
      ctx.beginPath();
      ctx.ellipse(sx + m.ox, stumpTopY + m.oy, m.rx, m.ry, 0, 0, TAU);
      ctx.fill();
    }

    // Small glowing bioluminescent mushrooms near stump & foreground
    const mushRng = createSeededRandom(8841);
    const mushCount = this.isMobile ? 6 : 11;
    for (let i = 0; i < mushCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const mx =
        i < 4
          ? sx + side * randomRange(mushRng, stumpW * 0.48, stumpW * 0.85)
          : randomRange(mushRng, w * 0.06, w * 0.94);
      const my =
        i < 4
          ? stumpTopY + randomRange(mushRng, 26, Math.min(82, h - stumpTopY - 20))
          : randomRange(mushRng, this.horizonY + 85, h - 22);
      const mr = randomRange(mushRng, 5, 9.5);

      const mg = ctx.createRadialGradient(mx, my - mr, 0, mx, my - mr, mr * 3.4);
      mg.addColorStop(0, "rgba(110, 231, 183, 0.36)");
      mg.addColorStop(0.5, "rgba(56, 189, 248, 0.12)");
      mg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my - mr, mr * 3.4, 0, TAU);
      ctx.fill();

      // Stem
      ctx.strokeStyle = "rgba(209, 250, 229, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, my + 2);
      ctx.quadraticCurveTo(mx + side * 2, my - mr * 0.5, mx, my - mr);
      ctx.stroke();

      // Cap
      ctx.fillStyle = i % 3 === 0 ? "rgba(167, 243, 208, 0.82)" : "rgba(125, 211, 252, 0.78)";
      ctx.beginPath();
      ctx.arc(mx, my - mr, mr, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
    }

    this.bgCanvas = c;
  }

  private drawJarBodyPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const neckW = hw * 0.62;
    const shoulderY = cy - hh * 0.70;
    const neckTopY = cy - hh * 1.02;

    ctx.beginPath();
    ctx.moveTo(cx - neckW, neckTopY);
    ctx.lineTo(cx - neckW, shoulderY - 6);
    ctx.quadraticCurveTo(cx - hw, shoulderY + 4, cx - hw, shoulderY + 32);
    ctx.lineTo(cx - hw, cy + hh - 26);
    ctx.quadraticCurveTo(cx - hw, cy + hh, cx - hw + 26, cy + hh);
    ctx.lineTo(cx + hw - 26, cy + hh);
    ctx.quadraticCurveTo(cx + hw, cy + hh, cx + hw, cy + hh - 26);
    ctx.lineTo(cx + hw, shoulderY + 32);
    ctx.quadraticCurveTo(cx + hw, shoulderY + 4, cx + neckW, shoulderY - 6);
    ctx.lineTo(cx + neckW, neckTopY);
    ctx.closePath();
  }

  private buildJarCaches(): void {
    const pad = 64;
    this.jarCacheW = Math.ceil(this.jarW + pad * 2);
    this.jarCacheH = Math.ceil(this.jarH + pad * 2);
    this.jarCacheX = this.jarCx - this.jarCacheW * 0.5;
    this.jarCacheY = this.jarCy - this.jarCacheH * 0.5;

    const lcx = this.jarCacheW * 0.5;
    const lcy = this.jarCacheH * 0.5;

    // 1. Jar back glass
    const back = createOffscreen(this.jarCacheW * this.dpr, this.jarCacheH * this.dpr);
    const bctx = back.getContext("2d");
    if (bctx) {
      bctx.scale(this.dpr, this.dpr);
      this.drawJarBodyPath(bctx, lcx, lcy, this.jarW, this.jarH);
      const fillG = bctx.createLinearGradient(lcx - this.jarW * 0.5, lcy, lcx + this.jarW * 0.5, lcy);
      fillG.addColorStop(0, "rgba(186, 230, 253, 0.14)");
      fillG.addColorStop(0.5, "rgba(15, 35, 48, 0.28)");
      fillG.addColorStop(1, "rgba(186, 230, 253, 0.13)");
      bctx.fillStyle = fillG;
      bctx.fill();
    }
    this.jarBackCanvas = back;

    // 2. Jar front glass highlights, rim reflections, ribbon & tag
    const front = createOffscreen(this.jarCacheW * this.dpr, this.jarCacheH * this.dpr);
    const fctx = front.getContext("2d");
    if (fctx) {
      fctx.scale(this.dpr, this.dpr);

      // Outer glass rim outline
      this.drawJarBodyPath(fctx, lcx, lcy, this.jarW, this.jarH);
      fctx.strokeStyle = "rgba(224, 242, 254, 0.42)";
      fctx.lineWidth = 2;
      fctx.stroke();

      // Left vertical specular glass highlight
      fctx.save();
      this.drawJarBodyPath(fctx, lcx, lcy, this.jarW, this.jarH);
      fctx.clip();

      const leftHighlight = fctx.createLinearGradient(
        lcx - this.jarW * 0.46,
        lcy,
        lcx - this.jarW * 0.24,
        lcy
      );
      leftHighlight.addColorStop(0, "rgba(255, 255, 255, 0.26)");
      leftHighlight.addColorStop(0.6, "rgba(255, 255, 255, 0.08)");
      leftHighlight.addColorStop(1, "rgba(255, 255, 255, 0)");
      fctx.fillStyle = leftHighlight;
      fctx.fillRect(lcx - this.jarW * 0.46, lcy - this.jarH * 0.36, this.jarW * 0.22, this.jarH * 0.78);

      // Crisp curved reflection arc on right shoulder
      fctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
      fctx.lineWidth = 2.5;
      fctx.lineCap = "round";
      fctx.beginPath();
      fctx.moveTo(lcx + this.jarW * 0.39, lcy - this.jarH * 0.22);
      fctx.lineTo(lcx + this.jarW * 0.39, lcy + this.jarH * 0.26);
      fctx.stroke();

      // Bottom glass thickness reflection
      fctx.strokeStyle = "rgba(224, 242, 254, 0.28)";
      fctx.lineWidth = 4;
      fctx.beginPath();
      fctx.ellipse(lcx, lcy + this.jarH * 0.47, this.jarW * 0.38, 6, 0, 0, Math.PI);
      fctx.stroke();
      fctx.restore();

      // Glass neck rim ellipse
      const neckY = lcy - this.jarH * 0.51;
      const neckRx = this.jarW * 0.32;
      fctx.strokeStyle = "rgba(224, 242, 254, 0.58)";
      fctx.lineWidth = 2.2;
      fctx.beginPath();
      fctx.ellipse(lcx, neckY, neckRx, 7, 0, 0, TAU);
      fctx.stroke();

      // Ribbon around the neck
      const ribY = lcy - this.jarH * 0.41;
      fctx.strokeStyle = "#f472b6";
      fctx.lineWidth = 4.5;
      fctx.beginPath();
      fctx.ellipse(lcx, ribY, neckRx * 1.03, 6.5, 0, 0.1, Math.PI - 0.1);
      fctx.stroke();

      // Small bow on the right side of the neck
      const bowX = lcx + neckRx * 0.82;
      const bowY = ribY + 3;
      fctx.fillStyle = "#f9a8d4";
      fctx.beginPath();
      fctx.ellipse(bowX - 7, bowY - 2, 7, 4, -0.35, 0, TAU);
      fctx.ellipse(bowX + 7, bowY + 1, 7, 4, 0.35, 0, TAU);
      fctx.fill();

      // Twine string holding the tag
      const tagX = bowX + 12;
      const tagY = ribY + 36;
      fctx.strokeStyle = "rgba(253, 230, 138, 0.72)";
      fctx.lineWidth = 1.2;
      fctx.beginPath();
      fctx.moveTo(bowX, bowY + 2);
      fctx.quadraticCurveTo(bowX + 10, ribY + 18, tagX, tagY - 12);
      fctx.stroke();

      // Hanging parchment tag reading "Things I love about you"
      fctx.save();
      fctx.translate(tagX, tagY);
      fctx.rotate(0.14);
      const tw = 74;
      const th = 32;
      fctx.fillStyle = "#fef3c7";
      fctx.strokeStyle = "#d97706";
      fctx.lineWidth = 1;
      fctx.beginPath();
      fctx.roundRect(-tw * 0.5, -th * 0.5, tw, th, 4);
      fctx.fill();
      fctx.stroke();

      // Eyelet hole
      fctx.fillStyle = "#92400e";
      fctx.beginPath();
      fctx.arc(0, -th * 0.5 + 4, 1.8, 0, TAU);
      fctx.fill();

      // Tag text
      fctx.fillStyle = "#451a03";
      fctx.font = "600 7.5px Georgia, serif";
      fctx.textAlign = "center";
      fctx.textBaseline = "middle";
      const words = this.jarTagText.split(" ");
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(" ");
      const line2 = words.slice(mid).join(" ");
      fctx.fillText(line1, 0, -2.5);
      fctx.fillText(line2, 0, 7.5);
      fctx.restore();
    }
    this.jarFrontCanvas = front;
  }

  private buildStars(): void {
    const rng = createSeededRandom(3108);
    const total = this.isMobile ? 95 : 165;
    const colors = ["#ffffff", "#e0f2fe", "#fef3c7", "#fbcfe8"];
    this.stars = [];
    for (let i = 0; i < total; i++) {
      this.stars.push({
        x: rng() * this.width,
        y: rng() * (this.horizonY - 10),
        r: randomRange(rng, 0.55, 1.8),
        // First 25% of stars are visible from the start; rest fill in continuously as jar empties
        threshold: i < total * 0.24 ? 0 : (i - total * 0.24) / (total * 0.76),
        phase: rng() * TAU,
        speed: randomRange(rng, 0.8, 2.3),
        color: colors[i % colors.length],
      });
    }
  }

  private buildGrassAndBuds(): void {
    const rng = createSeededRandom(6209);
    const grassCount = this.isMobile ? 75 : 140;
    this.grass = [];
    for (let i = 0; i < grassCount; i++) {
      this.grass.push({
        x: randomRange(rng, -10, this.width + 10),
        baseY: randomRange(rng, this.horizonY + 46, this.height + 10),
        h: randomRange(rng, this.isMobile ? 28 : 34, this.isMobile ? 64 : 84),
        lean: randomRange(rng, -14, 14),
        phase: rng() * TAU,
        width: randomRange(rng, 1.4, 2.8),
        shade: rng(),
      });
    }
    this.grass.sort((a, b) => a.baseY - b.baseY);

    const budCount = this.isMobile ? 115 : 225;
    const prevBuds = this.buds;
    this.buds = [];
    for (let i = 0; i < budCount; i++) {
      const bx = randomRange(rng, 6, this.width - 6);
      const by = randomRange(rng, this.horizonY + 34, this.height - 14);
      // Avoid placing buds directly on top of the jar glass
      if (
        Math.abs(bx - this.jarCx) < this.jarW * 0.58 &&
        by < this.jarBottomY + 12
      ) {
        continue;
      }
      const dist = Math.hypot(bx - this.spiralCx, by - this.spiralCy);
      this.buds.push({
        x: bx,
        y: by,
        distFromCenter: dist,
        palette: (i % 4) as 0 | 1 | 2 | 3,
        size: randomRange(rng, this.isMobile ? 11 : 13, this.isMobile ? 19 : 24),
        phase: rng() * TAU,
        bloom: prevBuds[i] ? prevBuds[i].bloom : this.finaleStage === "done" ? 1 : 0,
      });
    }
    this.buds.sort((a, b) => a.y - b.y);
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += clampedDt;

    const targetPx = this.width > 0 ? (this.pointerX / this.width - 0.5) * 14 : 0;
    this.parallaxX = lerp(this.parallaxX, targetPx, clampedDt * 2.0);

    // Lid tilt animation
    if (this.lidHoldTimer > 0) {
      this.lidHoldTimer = Math.max(0, this.lidHoldTimer - clampedDt);
      this.lidOpen = lerp(this.lidOpen, 1, clampedDt * 10);
    } else {
      this.lidOpen = lerp(this.lidOpen, 0, clampedDt * 5);
    }

    // Update 12 fireflies
    const jarMinX = this.jarCx - this.jarW * 0.36;
    const jarMaxX = this.jarCx + this.jarW * 0.36;
    const jarMinY = this.jarCy - this.jarH * 0.28;
    const jarMaxY = this.jarCy + this.jarH * 0.38;

    for (const ff of this.fireflies) {
      ff.wingPhase += clampedDt * 22;

      if (ff.state === "jar") {
        if (!this.reducedMotion) {
          ff.vx += (Math.sin(this.time * 1.4 + ff.phase) * 18) * clampedDt;
          ff.vy += (Math.cos(this.time * 1.7 + ff.phase * 1.3) * 16) * clampedDt;
          const speed = Math.hypot(ff.vx, ff.vy);
          if (speed > 34) {
            ff.vx = (ff.vx / speed) * 34;
            ff.vy = (ff.vy / speed) * 34;
          }
          ff.x += ff.vx * clampedDt;
          ff.y += ff.vy * clampedDt;

          // Soft bouncing inside the glass walls
          if (ff.x < jarMinX) {
            ff.x = jarMinX;
            ff.vx = Math.abs(ff.vx) * 0.8 + 6;
          } else if (ff.x > jarMaxX) {
            ff.x = jarMaxX;
            ff.vx = -Math.abs(ff.vx) * 0.8 - 6;
          }
          if (ff.y < jarMinY) {
            ff.y = jarMinY;
            ff.vy = Math.abs(ff.vy) * 0.8 + 5;
          } else if (ff.y > jarMaxY) {
            ff.y = jarMaxY;
            ff.vy = -Math.abs(ff.vy) * 0.8 - 5;
          }
        }
      } else if (ff.state === "flying") {
        ff.flightT = Math.min(1, ff.flightT + clampedDt / ff.flightDuration);
        ff.noteTimer += clampedDt;
        const t = easeInOutCubic(ff.flightT);
        // Spiral upward out of the neck during first 28% of flight
        const spiralAmp = Math.max(0, 1 - ff.flightT * 3.2) * 16;
        const spiralX = Math.sin(ff.flightT * TAU * 3.5 + ff.phase) * spiralAmp;
        ff.x = cubicBezier(ff.p0x, ff.p1x, ff.p2x, ff.targetX, t) + spiralX;
        ff.y = cubicBezier(ff.p0y, ff.p1y, ff.p2y, ff.targetY, t);

        if (Math.random() < (this.isMobile ? 0.35 : 0.65)) {
          this.emitSparkles(ff.x, ff.y, "#fde68a", 1);
        }

        if (ff.flightT >= 1) {
          ff.state = "settled";
          ff.x = ff.targetX;
          ff.y = ff.targetY;
        }
      } else if (ff.state === "settled") {
        ff.fadeIn = Math.min(1, ff.fadeIn + clampedDt * 2.2);
        if (ff.noteTimer > 0 && ff.noteTimer < 6.2) {
          ff.noteTimer += clampedDt;
        }
      } else if (ff.state === "spiraling") {
        ff.spiralAngle += clampedDt * 2.6;
        const targetR = lerp(115, 26, clamp(this.finaleTimer / 2.2, 0, 1));
        ff.spiralRadius = lerp(ff.spiralRadius, targetR, clampedDt * 2.5);
        ff.x = lerp(ff.x, this.spiralCx + Math.cos(ff.spiralAngle) * ff.spiralRadius, clampedDt * 4.2);
        ff.y = lerp(ff.y, this.spiralCy + Math.sin(ff.spiralAngle) * ff.spiralRadius * 0.62, clampedDt * 4.2);
        if (Math.random() < 0.35) {
          this.emitSparkles(ff.x, ff.y, "#fef08a", 1);
        }
      }
    }

    // Finale state machine after final firefly is freed
    if (this.releasedCount >= this.totalReasons) {
      if (this.finaleStage === "none") {
        this.finaleTimer += clampedDt;
        if (this.finaleTimer >= 0) {
          this.finaleStage = this.reducedMotion ? "wave" : "spiral";
          this.finaleTimer = 0;
          if (!this.reducedMotion) {
            for (const ff of this.fireflies) {
              ff.state = "spiraling";
              ff.spiralAngle = (ff.index / Math.max(1, this.fireflies.length)) * TAU;
              ff.spiralRadius = Math.hypot(ff.x - this.spiralCx, ff.y - this.spiralCy);
            }
          }
        }
      } else if (this.finaleStage === "spiral") {
        this.finaleTimer += clampedDt;
        if (this.finaleTimer >= 2.2) {
          this.finaleStage = "wave";
          this.finaleTimer = 0;
          this.waveRadius = 10;
          // Return fireflies smoothly back to their constellation stars
          for (const ff of this.fireflies) {
            ff.state = "settled";
            ff.x = ff.targetX;
            ff.y = ff.targetY;
          }
          this.emitSparkles(this.spiralCx, this.spiralCy, "#fef08a", this.isMobile ? 20 : 40);
        }
      } else if (this.finaleStage === "wave") {
        const waveSpeed = this.reducedMotion ? this.maxWaveRadius * 2.5 : this.maxWaveRadius * 0.44;
        this.waveRadius += waveSpeed * clampedDt;
        this.meadowGlow = Math.min(1, this.meadowGlow + clampedDt * 0.55);

        for (const bud of this.buds) {
          if (bud.distFromCenter <= this.waveRadius) {
            bud.bloom = Math.min(1, bud.bloom + clampedDt * 2.2);
          }
        }

        if (this.waveRadius >= this.maxWaveRadius) {
          this.finaleStage = "done";
          for (const bud of this.buds) bud.bloom = 1;
          this.meadowGlow = 1;
          this.onFinaleDoneCb?.();
        }
      } else if (this.finaleStage === "done") {
        this.meadowGlow = 1;
      }
    }

    // Update extra "countless more" fireflies
    for (let i = this.extraFireflies.length - 1; i >= 0; i--) {
      const ef = this.extraFireflies[i];
      ef.age += clampedDt;
      if (ef.age >= ef.life) {
        this.extraFireflies.splice(i, 1);
        continue;
      }
      ef.x += (ef.vx + Math.sin(this.time * 2.4 + ef.phase) * 18) * clampedDt;
      ef.y += ef.vy * clampedDt;
      if (Math.random() < 0.25) {
        this.emitSparkles(ef.x, ef.y, "#fde68a", 1);
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
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const releaseFrac = clamp(this.releasedCount / this.totalReasons, 0, 1);
    const jarFractionLeft = 1 - releaseFrac;

    // 1. Pre-rendered sky, moon, hills, stump, and glowing mushrooms
    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
    }

    // 2. Stars filling in continuously as fireflies are released
    for (const st of this.stars) {
      const vis = clamp((releaseFrac - st.threshold + 0.14) / 0.14, 0, 1);
      if (vis <= 0.01) continue;
      const tw = this.reducedMotion ? 0.75 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * st.speed + st.phase));
      ctx.globalAlpha = vis * tw * 0.9;
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(st.x - this.parallaxX * 0.2, st.y, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Soft drifting mist over the meadow hills
    const mistY = this.horizonY + 18;
    const mistShift = Math.sin(this.time * 0.25) * 30;
    const mistGrad = ctx.createLinearGradient(0, mistY - 50, 0, mistY + 65);
    const mistA = 0.09 + releaseFrac * 0.06 + this.meadowGlow * 0.05;
    mistGrad.addColorStop(0, "rgba(148, 210, 205, 0)");
    mistGrad.addColorStop(0.5, `rgba(186, 230, 224, ${mistA.toFixed(3)})`);
    mistGrad.addColorStop(1, "rgba(148, 210, 205, 0)");
    ctx.fillStyle = mistGrad;
    ctx.fillRect(mistShift - 40, mistY - 50, this.width + 80, 115);

    // 4. Warm glow cast by the jar onto the mossy stump and surrounding grass
    const jarGlowStrength = this.finaleStage === "done" ? 0.45 : 0.15 + jarFractionLeft * 0.78;
    const stumpGlow = ctx.createRadialGradient(
      this.jarCx,
      this.jarCy + this.jarH * 0.25,
      8,
      this.jarCx,
      this.jarCy + this.jarH * 0.35,
      this.jarW * 1.9
    );
    stumpGlow.addColorStop(0, `rgba(253, 224, 71, ${(0.28 * jarGlowStrength).toFixed(3)})`);
    stumpGlow.addColorStop(0.45, `rgba(245, 158, 11, ${(0.12 * jarGlowStrength).toFixed(3)})`);
    stumpGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = stumpGlow;
    ctx.beginPath();
    ctx.arc(this.jarCx, this.jarCy + this.jarH * 0.35, this.jarW * 1.9, 0, TAU);
    ctx.fill();

    // 5. Meadow buds & blooming flowers (behind jar/grass)
    this.renderMeadowFlowers(ctx);

    // 6. Jar back wall
    if (this.jarBackCanvas) {
      ctx.drawImage(this.jarBackCanvas, this.jarCacheX, this.jarCacheY, this.jarCacheW, this.jarCacheH);
    }

    // Soft interior jar glow (from fireflies inside, or gentle luminous afterglow after finale)
    const innerGlow = ctx.createRadialGradient(
      this.jarCx,
      this.jarCy + 6,
      4,
      this.jarCx,
      this.jarCy + 6,
      this.jarH * 0.56
    );
    innerGlow.addColorStop(0, `rgba(254, 240, 138, ${(0.34 * jarGlowStrength).toFixed(3)})`);
    innerGlow.addColorStop(0.6, `rgba(251, 191, 36, ${(0.12 * jarGlowStrength).toFixed(3)})`);
    innerGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.ellipse(this.jarCx, this.jarCy + 6, this.jarW * 0.48, this.jarH * 0.44, 0, 0, TAU);
    ctx.fill();

    // 7. Fireflies inside the jar (drawn between back glass and front glass!)
    for (const ff of this.fireflies) {
      if (ff.state === "jar") {
        this.drawFirefly(ctx, ff.x, ff.y, ff.phase, ff.wingPhase, 1.0, false);
      }
    }

    // 8. Jar front glass reflections, ribbon & tag
    if (this.jarFrontCanvas) {
      ctx.drawImage(this.jarFrontCanvas, this.jarCacheX, this.jarCacheY, this.jarCacheW, this.jarCacheH);
    }

    // Tag shimmer during/after finale
    if (this.finaleStage === "done" || this.finaleStage === "wave") {
      const shimmer = 0.25 + 0.25 * Math.sin(this.time * 3.5);
      const tagX = this.jarCx + this.jarW * 0.32 * 0.82 + 12;
      const tagY = this.jarCy - this.jarH * 0.41 + 36;
      const tg = ctx.createRadialGradient(tagX, tagY, 2, tagX, tagY, 44);
      tg.addColorStop(0, `rgba(254, 240, 138, ${shimmer.toFixed(3)})`);
      tg.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(tagX, tagY, 44, 0, TAU);
      ctx.fill();
    }

    // 9. Dynamic cork lid (tilts open on release)
    this.renderCorkLid(ctx);

    // 10. Foreground swaying tall grass
    this.renderGrass(ctx);

    // 11. Finale golden bloom wave ring
    if (this.finaleStage === "wave" && this.waveRadius > 0) {
      const alpha = clamp(1 - this.waveRadius / this.maxWaveRadius, 0, 1) * 0.65;
      ctx.save();
      ctx.strokeStyle = `rgba(254, 240, 138, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(this.spiralCx, this.spiralCy, this.waveRadius, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.7).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 12. Flying, spiraling, and settled sky fireflies
    for (const ff of this.fireflies) {
      if (ff.state === "flying" || ff.state === "spiraling") {
        this.drawFirefly(ctx, ff.x, ff.y, ff.phase, ff.wingPhase, 1.35, false);
      } else if (ff.state === "settled") {
        this.drawFirefly(ctx, ff.x, ff.y, ff.phase, ff.wingPhase, ff.fadeIn, true);
      }
    }

    // 13. Extra "countless more" fireflies
    for (const ef of this.extraFireflies) {
      const a = clamp(1 - ef.age / ef.life, 0, 1);
      ctx.globalAlpha = a;
      this.drawFirefly(ctx, ef.x, ef.y, ef.phase, this.time * 22, 1.1, false);
    }
    ctx.globalAlpha = 1;

    // 14. Sparkle trails
    for (const sp of this.sparkles) {
      const a = 1 - sp.age / sp.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * (0.4 + 0.6 * a), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private renderCorkLid(ctx: CanvasRenderingContext2D): void {
    const neckRx = this.jarW * 0.28;
    const lidH = 22;
    const pivotX = this.jarCx - neckRx;
    const pivotY = this.jarNeckY - 2;

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(-this.lidOpen * 0.52);
    ctx.translate(0, -this.lidOpen * 8);

    const corkGrad = ctx.createLinearGradient(0, -lidH, neckRx * 2, 0);
    corkGrad.addColorStop(0, "#78350f");
    corkGrad.addColorStop(0.5, "#b45309");
    corkGrad.addColorStop(1, "#713f12");

    ctx.fillStyle = corkGrad;
    ctx.beginPath();
    ctx.roundRect(0, -lidH, neckRx * 2, lidH + 4, [5, 5, 3, 3]);
    ctx.fill();
    ctx.strokeStyle = "rgba(254, 243, 199, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private renderGrass(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = "round";
    for (const g of this.grass) {
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.4 + g.phase) * 7;
      const tipX = g.x + g.lean + sway;
      const tipY = g.baseY - g.h;
      const ctrlX = g.x + (g.lean + sway) * 0.45;
      const ctrlY = g.baseY - g.h * 0.55;

      // Grass turns subtly luminous during/after finale bloom wave
      const r = Math.round(lerp(12 + g.shade * 12, 58 + g.shade * 45, this.meadowGlow));
      const gr = Math.round(lerp(42 + g.shade * 26, 138 + g.shade * 48, this.meadowGlow));
      const b = Math.round(lerp(46 + g.shade * 22, 118 + g.shade * 36, this.meadowGlow));
      ctx.strokeStyle = `rgb(${r}, ${gr}, ${b})`;
      ctx.lineWidth = g.width;
      ctx.beginPath();
      ctx.moveTo(g.x, g.baseY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderMeadowFlowers(ctx: CanvasRenderingContext2D): void {
    for (const b of this.buds) {
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.6 + b.phase) * 2.2;
      if (b.bloom <= 0.04) {
        // Subtle closed bud on thin stem
        ctx.strokeStyle = "rgba(24, 72, 68, 0.7)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + 8);
        ctx.lineTo(b.x + sway * 0.6, b.y);
        ctx.stroke();

        ctx.fillStyle = "rgba(120, 165, 160, 0.42)";
        ctx.beginPath();
        ctx.ellipse(b.x + sway * 0.6, b.y - 2, 2.1, 3.6, 0, 0, TAU);
        ctx.fill();
      } else {
        const sprite = this.flowerSprites[b.palette];
        if (!sprite) continue;
        const scale = easeOutCubic(b.bloom);
        const s = b.size * scale;
        ctx.drawImage(sprite, b.x + sway - s * 0.5, b.y - s * 0.5, s, s);
      }
    }
  }

  private drawFirefly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    phase: number,
    wingPhase: number,
    intensity: number,
    isStar: boolean
  ): void {
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 3.4 + phase);
    const r = (isStar ? 16 : 20) * intensity * pulse;

    const halo = ctx.createRadialGradient(x, y, 0, x, y, r);
    halo.addColorStop(0, `rgba(255, 255, 245, ${(0.95 * intensity).toFixed(3)})`);
    halo.addColorStop(0.28, `rgba(254, 240, 138, ${(0.62 * intensity).toFixed(3)})`);
    halo.addColorStop(0.65, `rgba(245, 158, 11, ${(0.18 * intensity).toFixed(3)})`);
    halo.addColorStop(1, "rgba(245, 158, 11, 0)");

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    // Tiny fluttering wings when not yet a settled star
    if (!isStar && !this.reducedMotion) {
      const wingSpread = 0.35 + 0.45 * Math.abs(Math.sin(wingPhase));
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.beginPath();
      ctx.ellipse(-4, -3, 4.2, 1.8, -wingSpread, 0, TAU);
      ctx.ellipse(4, -3, 4.2, 1.8, wingSpread, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Crisp warm core (or 4-point star glint when settled)
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(x, y, isStar ? 2.6 : 3.1, 0, TAU);
    ctx.fill();

    if (isStar) {
      ctx.strokeStyle = `rgba(254, 240, 138, ${(0.55 * pulse).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
    }
  }
}
