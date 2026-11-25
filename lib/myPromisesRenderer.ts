/**
 * Canvas 2D Renderer for "My Promises" — Meteor Shower Hilltop & Promise Tree
 * - Pre-renders deep indigo/violet sky, Milky Way band, faint aurora, pale moon,
 *   3 layered hills, wooden bench for two with lantern, glowing mushrooms, and the
 *   procedural bare glowing promise tree (recording 8 crown anchors + extra tips).
 * - Reuses pre-rendered blossom (4 palettes) and petal (3 palettes) sprites.
 * - Dynamic 3-layer parallax stars, swaying grass, flickering bench lantern,
 *   shooting stars (1.5-3s cadence, max 3, proximity slowdown within 120px,
 *   20s idle golden guide star, grand finale shower), caught glowing orb,
 *   ribbon-of-light sealing flight, growing blossom clusters (~20 blooms per seal),
 *   and gentle finale petal rain.
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

const MAX_CROWN_ANCHORS = 8;

export interface CaughtOrbHUD {
  active: boolean;
  sealing: boolean;
  x: number;
  y: number;
  promiseIndex: number; // 0..7 for main promises
  isExtraWish: boolean;
  wishIndex: number;
}

export interface MyPromisesHUDState {
  sealedCount: number;
  finaleActive: boolean;
  wishMode: boolean;
  caughtOrb: CaughtOrbHUD;
  hasGuideStar: boolean;
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

interface GrassBlade {
  x: number;
  baseY: number;
  h: number;
  lean: number;
  phase: number;
  width: number;
  shade: number;
}

interface Meteor {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  isGuide: boolean;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
}

interface TreeBlossom {
  x: number;
  y: number;
  palette: 0 | 1 | 2 | 3;
  size: number;
  growth: number; // 0..1 smooth unfurl
  delay: number;
  phase: number;
}

interface FallingPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  palette: 0 | 1 | 2;
  age: number;
  life: number;
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

interface CaughtStar {
  state: "none" | "floating" | "hovering" | "returning" | "sealing";
  x: number;
  y: number;
  startX: number;
  startY: number;
  hoverX: number;
  hoverY: number;
  targetX: number;
  targetY: number;
  t: number;
  hoverAge: number;
  color: string;
  promiseIndex: number;
  isExtraWish: boolean;
  wishIndex: number;
  ribbon: { x: number; y: number }[];
}

const BLOSSOM_PALETTES = [
  { outer: "#f472b6", inner: "#fbcfe8", core: "#fef08a" }, // rose pink
  { outer: "#c084fc", inner: "#f3e8ff", core: "#fef9c3" }, // soft lavender
  { outer: "#f59e0b", inner: "#fde68a", core: "#fffbeb" }, // warm gold
  { outer: "#e0e7ff", inner: "#ffffff", core: "#fde68a" }, // pearl white
] as const;

const METEOR_COLORS = ["#fde68a", "#fbcfe8", "#ddd6fe", "#bae6fd"];

function createOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export class MyPromisesRenderer {
  private width = 1;
  private height = 1;
  private dpr = 1;
  private isMobile = false;
  private isPortrait = false;
  private reducedMotion = false;

  private horizonY = 0;
  private treeBaseX = 0;
  private treeBaseY = 0;
  private treeCrownCx = 0;
  private treeCrownCy = 0;
  private benchLanternX = 0;
  private benchLanternY = 0;

  // Pre-rendered caches
  private bgCanvas: HTMLCanvasElement | null = null;
  private treeCanvas: HTMLCanvasElement | null = null;
  private blossomSprites: HTMLCanvasElement[] = [];
  private petalSprites: HTMLCanvasElement[] = [];

  // Tree anchors
  private crownAnchors: { x: number; y: number }[] = [];
  private extraTips: { x: number; y: number }[] = [];

  // Dynamic entities
  private stars: Star[] = [];
  private grass: GrassBlade[] = [];
  private meteors: Meteor[] = [];
  private blossoms: TreeBlossom[] = [];
  private petals: FallingPetal[] = [];
  private sparkles: Sparkle[] = [];

  private time = 0;
  private meteorId = 1;
  private nextMeteorIn = 1.1;
  private idleTimer = 0;

  private pointerX = -9999;
  private pointerY = -9999;
  private parallaxX = 0;

  private totalPromises = 8;
  private sealedCount = 0;
  private finaleActive = false;
  private finaleTimer = 0;
  private wishMode = false;
  private nextWishIdx = 0;
  private extraWishTotal: number;
  private sealHoldProgress = 0; // 0..1 while user holds "Seal it"

  private caught: CaughtStar = {
    state: "none",
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    hoverX: 0,
    hoverY: 0,
    targetX: 0,
    targetY: 0,
    t: 0,
    hoverAge: 0,
    color: "#fde68a",
    promiseIndex: 0,
    isExtraWish: false,
    wishIndex: 0,
    ribbon: [],
  };

  private onCatchCb?: (promiseIndex: number, isExtraWish: boolean, wishIndex: number) => void;
  private onFinaleCb?: () => void;

  constructor(opts: {
    promiseCount: number;
    extraWishTotal: number;
    reducedMotion: boolean;
    onCatch?: (promiseIndex: number, isExtraWish: boolean, wishIndex: number) => void;
    onFinale?: () => void;
  }) {
    this.totalPromises = Math.max(1, opts.promiseCount);
    this.extraWishTotal = Math.max(1, opts.extraWishTotal);
    this.reducedMotion = opts.reducedMotion;
    this.onCatchCb = opts.onCatch;
    this.onFinaleCb = opts.onFinale;
    this.buildSprites();
  }

  public setReducedMotion(rm: boolean): void {
    this.reducedMotion = rm;
  }

  public setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  public setSealHoldProgress(p: number): void {
    this.sealHoldProgress = clamp(p, 0, 1);
  }

  public enterWishMode(): void {
    this.wishMode = true;
    this.idleTimer = 0;
  }

  public resize(width: number, height: number, dpr: number): void {
    const prevW = this.width;
    const prevH = this.height;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.isMobile = this.width < 680;
    this.isPortrait = this.height > this.width * 1.05;

    this.horizonY = this.isPortrait ? this.height * 0.64 : this.height * 0.68;
    // Tree larger on portrait, positioned cleanly on right-center of hilltop
    this.treeBaseX = this.isPortrait ? this.width * 0.60 : this.width * 0.64;
    this.treeBaseY = this.horizonY + (this.isPortrait ? 36 : 30);

    this.buildBackground();
    this.buildTree();
    this.buildStarsAndGrass();

    // Rescale any existing blossoms proportionally on resize
    if (prevW > 1 && prevH > 1 && this.blossoms.length > 0) {
      const sx = this.width / prevW;
      const sy = this.height / prevH;
      for (const b of this.blossoms) {
        b.x *= sx;
        b.y *= sy;
      }
    }

    // Keep hovering caught orb positioned safely
    if (this.caught.state === "hovering" || this.caught.state === "floating") {
      const hover = this.getHoverPosition();
      this.caught.hoverX = hover.x;
      this.caught.hoverY = hover.y;
      if (this.caught.state === "hovering") {
        this.caught.x = hover.x;
        this.caught.y = hover.y;
      }
    }
  }

  private getHoverPosition(): { x: number; y: number } {
    if (this.isPortrait) {
      return { x: this.width * 0.34, y: this.height * 0.34 };
    }
    return { x: this.width * 0.34, y: this.height * 0.42 };
  }

  /** Summon a slow golden guide star (or catch it directly if one is already present) */
  public summonOrCatchGuideStar(): boolean {
    if (this.caught.state !== "none") return false;
    if (this.finaleActive && !this.wishMode) return false;

    const existing = this.meteors.find((m) => m.isGuide) ?? this.meteors[0];
    if (existing) {
      this.catchMeteor(existing);
      return true;
    }
    this.spawnMeteor(true);
    return false;
  }

  /** Try to catch a shooting star near (x, y) with generous >= 64px hit radius */
  public handleTap(x: number, y: number): boolean {
    this.pointerX = x;
    this.pointerY = y;
    this.idleTimer = 0;

    if (this.caught.state !== "none") return false;
    if (this.finaleActive && !this.wishMode) return false;

    const hitRadius = this.isMobile ? 74 : 66;
    let best: Meteor | null = null;
    let bestDist = hitRadius;

    for (const m of this.meteors) {
      const d = Math.hypot(x - m.x, y - m.y);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }

    if (best) {
      this.catchMeteor(best);
      return true;
    }
    return false;
  }

  private catchMeteor(m: Meteor): void {
    this.meteors = this.meteors.filter((item) => item.id !== m.id);
    this.idleTimer = 0;

    const hover = this.getHoverPosition();
    const isExtra = this.finaleActive && this.wishMode;
    const promiseIndex = Math.min(this.totalPromises - 1, this.sealedCount);
    const wishIndex = this.nextWishIdx;

    this.caught = {
      state: "floating",
      x: m.x,
      y: m.y,
      startX: m.x,
      startY: m.y,
      hoverX: hover.x,
      hoverY: hover.y,
      targetX: this.treeCrownCx,
      targetY: this.treeCrownCy,
      t: 0,
      hoverAge: 0,
      color: m.color,
      promiseIndex,
      isExtraWish: isExtra,
      wishIndex,
      ribbon: [],
    };

    this.emitSparkles(m.x, m.y, m.color, 14);
    this.onCatchCb?.(promiseIndex, isExtra, wishIndex);
  }

  /** Seal the currently caught star: fly along a light ribbon to the tree and bloom! */
  public sealCaughtStar(): boolean {
    if (this.caught.state !== "hovering" && this.caught.state !== "floating") {
      return false;
    }
    this.idleTimer = 0;
    this.sealHoldProgress = 0;

    let anchor: { x: number; y: number };
    if (this.caught.isExtraWish) {
      const pool = this.extraTips.length > 0 ? this.extraTips : this.crownAnchors;
      anchor = pool[this.nextWishIdx % pool.length] ?? { x: this.treeCrownCx, y: this.treeCrownCy };
      this.nextWishIdx = (this.nextWishIdx + 1) % this.extraWishTotal;
    } else {
      anchor = this.crownAnchors[this.sealedCount % Math.max(1, this.crownAnchors.length)] ?? {
        x: this.treeCrownCx,
        y: this.treeCrownCy,
      };
    }

    this.caught.state = "sealing";
    this.caught.startX = this.caught.x;
    this.caught.startY = this.caught.y;
    this.caught.targetX = anchor.x;
    this.caught.targetY = anchor.y;
    this.caught.t = 0;
    this.caught.ribbon = [{ x: this.caught.x, y: this.caught.y }];
    return true;
  }

  public getHUDState(): MyPromisesHUDState {
    return {
      sealedCount: this.sealedCount,
      finaleActive: this.finaleActive,
      wishMode: this.wishMode,
      caughtOrb: {
        active: this.caught.state === "floating" || this.caught.state === "hovering",
        sealing: this.caught.state === "sealing",
        x: this.caught.x,
        y: this.caught.y,
        promiseIndex: this.caught.promiseIndex,
        isExtraWish: this.caught.isExtraWish,
        wishIndex: this.caught.wishIndex,
      },
      hasGuideStar: this.meteors.some((m) => m.isGuide),
    };
  }

  private spawnBlossomCluster(cx: number, cy: number, count: number, spread: number): void {
    const cap = this.isMobile ? 220 : 420;
    for (let i = 0; i < count; i++) {
      if (this.blossoms.length >= cap) break;
      const ang = Math.random() * TAU;
      const dist = Math.pow(Math.random(), 0.65) * spread;
      this.blossoms.push({
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist * 0.85,
        palette: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
        size: (this.isMobile ? 13 : 16) + Math.random() * (this.isMobile ? 10 : 14),
        growth: 0,
        delay: Math.random() * 0.45,
        phase: Math.random() * TAU,
      });
    }

    // Spray of glowing petals bursting outward
    const petalSpray = this.isMobile ? 8 : 16;
    for (let i = 0; i < petalSpray; i++) {
      const ang = Math.random() * TAU;
      const spd = 25 + Math.random() * 55;
      this.petals.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 15,
        angle: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 3.2,
        size: 6 + Math.random() * 6,
        palette: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        age: 0,
        life: 3.5 + Math.random() * 2.5,
      });
    }
    this.emitSparkles(cx, cy, "#fde68a", this.isMobile ? 12 : 22);
  }

  private triggerFinale(): void {
    if (this.finaleActive) return;
    this.finaleActive = true;
    this.finaleTimer = 0;

    // Erupt every remaining branch tip into full bloom
    const tips = this.extraTips.length > 0 ? this.extraTips : this.crownAnchors;
    for (const tip of tips) {
      this.spawnBlossomCluster(tip.x, tip.y, this.isMobile ? 5 : 8, this.isMobile ? 34 : 46);
    }

    // Launch immediate grand meteor shower
    for (let i = 0; i < 3; i++) {
      this.spawnMeteor(false, true);
    }

    this.onFinaleCb?.();
  }

  private spawnMeteor(isGuide = false, grand = false): void {
    const fromLeft = Math.random() < 0.72;
    const startX = isGuide
      ? this.width * 0.12
      : fromLeft
        ? randomRange(Math.random, this.width * 0.05, this.width * 0.62)
        : randomRange(Math.random, this.width * 0.42, this.width * 0.95);
    const startY = isGuide
      ? this.height * 0.22
      : randomRange(Math.random, this.height * 0.06, this.horizonY * 0.42);

    const speed = this.reducedMotion
      ? isGuide
        ? 45
        : 60
      : isGuide
        ? 82
        : grand
          ? randomRange(Math.random, 240, 340)
          : randomRange(Math.random, 155, 225);

    const angle = isGuide
      ? 0.14
      : fromLeft
        ? randomRange(Math.random, 0.22, 0.46)
        : Math.PI - randomRange(Math.random, 0.22, 0.46);

    this.meteors.push({
      id: this.meteorId++,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      maxAge: isGuide ? 11.5 : this.reducedMotion ? 7.5 : 4.2,
      isGuide,
      color: isGuide ? "#fde68a" : METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)],
      size: isGuide ? 6.2 : 4.0,
      trail: [],
    });
  }

  private emitSparkles(x: number, y: number, color: string, count: number): void {
    const cap = this.isMobile ? 45 : 95;
    if (this.sparkles.length > cap) return;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * TAU;
      const spd = 12 + Math.random() * 42;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 6,
        age: 0,
        life: 0.45 + Math.random() * 0.5,
        size: 1.4 + Math.random() * 2.2,
        color,
      });
    }
  }

  private buildSprites(): void {
    this.blossomSprites = BLOSSOM_PALETTES.map((pal) => {
      const size = 44;
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
        ctx.ellipse(0, -8, 4.8, 8.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = pal.inner;
        ctx.beginPath();
        ctx.ellipse(0, -6.5, 2.5, 5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = pal.core;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, TAU);
      ctx.fill();
      return c;
    });

    const petalColors = ["#fbcfe8", "#fde68a", "#e9d5ff"];
    this.petalSprites = petalColors.map((col) => {
      const s = 18;
      const c = createOffscreen(s, s);
      const ctx = c.getContext("2d");
      if (!ctx) return c;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(s * 0.5, s * 0.5, 6.5, 3.2, 0, 0, TAU);
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

    // Deep indigo to violet night sky
    const sky = ctx.createLinearGradient(0, 0, 0, this.horizonY + 80);
    sky.addColorStop(0, "#050618");
    sky.addColorStop(0.46, "#0d0b2c");
    sky.addColorStop(0.84, "#1c123c");
    sky.addColorStop(1, "#241645");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Soft diagonal Milky Way band
    ctx.save();
    ctx.translate(w * 0.45, h * 0.34);
    ctx.rotate(-0.42);
    const mwW = Math.hypot(w, h) * 1.15;
    const mwH = Math.min(w, h) * 0.28;
    const mw = ctx.createLinearGradient(0, -mwH, 0, mwH);
    mw.addColorStop(0, "rgba(167, 139, 250, 0)");
    mw.addColorStop(0.35, "rgba(139, 92, 246, 0.08)");
    mw.addColorStop(0.5, "rgba(244, 180, 224, 0.11)");
    mw.addColorStop(0.65, "rgba(129, 140, 248, 0.07)");
    mw.addColorStop(1, "rgba(167, 139, 250, 0)");
    ctx.fillStyle = mw;
    ctx.fillRect(-mwW * 0.5, -mwH, mwW, mwH * 2);

    const mwRng = createSeededRandom(2049);
    const dustCount = this.isMobile ? 80 : 170;
    for (let i = 0; i < dustCount; i++) {
      const dx = randomRange(mwRng, -mwW * 0.45, mwW * 0.45);
      const dy = (mwRng() + mwRng() - 1) * mwH * 0.72;
      ctx.fillStyle = `rgba(243, 232, 255, ${randomRange(mwRng, 0.07, 0.24).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(dx, dy, randomRange(mwRng, 0.5, 1.3), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Faint aurora haze
    const aurora = ctx.createRadialGradient(w * 0.32, this.horizonY * 0.52, 10, w * 0.32, this.horizonY * 0.52, w * 0.48);
    aurora.addColorStop(0, "rgba(129, 140, 248, 0.12)");
    aurora.addColorStop(0.5, "rgba(45, 212, 191, 0.05)");
    aurora.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, w, this.horizonY + 40);

    // Pale moon low on the right side
    const moonX = this.isPortrait ? w * 0.85 : w * 0.88;
    const moonY = this.horizonY - (this.isPortrait ? 84 : 74);
    const moonR = this.isMobile ? 20 : 28;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 5);
    moonGlow.addColorStop(0, "rgba(243, 232, 255, 0.32)");
    moonGlow.addColorStop(0.4, "rgba(196, 181, 253, 0.10)");
    moonGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 5, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#f5f3ff";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fill();

    // 3 layered hill silhouettes extending past edges
    const hills = [
      { baseY: this.horizonY - 10, amp: 32, freq: 1.5, phase: 0.7, color: "#150e2e" },
      { baseY: this.horizonY + 18, amp: 24, freq: 2.0, phase: 2.2, color: "#0e0a22" },
      { baseY: this.horizonY + 42, amp: 18, freq: 1.4, phase: 4.5, color: "#090717" },
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
          Math.cos(nx * Math.PI * hill.freq * 1.9 + hill.phase) * (hill.amp * 0.32);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 40, h + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Soft horizon mist
    const mist = ctx.createLinearGradient(0, this.horizonY - 36, 0, this.horizonY + 60);
    mist.addColorStop(0, "rgba(196, 181, 253, 0)");
    mist.addColorStop(0.5, "rgba(196, 181, 253, 0.11)");
    mist.addColorStop(1, "rgba(196, 181, 253, 0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, this.horizonY - 36, w, 96);

    // Foreground hilltop meadow fill
    const ground = ctx.createLinearGradient(0, this.horizonY + 34, 0, h);
    ground.addColorStop(0, "#0b081b");
    ground.addColorStop(0.55, "#090716");
    ground.addColorStop(1, "#05040e");
    ctx.fillStyle = ground;
    ctx.fillRect(0, this.horizonY + 46, w, h - this.horizonY);

    // Small wooden bench for two with a lantern on the left
    const bx = this.isPortrait ? w * 0.22 : w * 0.20;
    const by = this.horizonY + (this.isPortrait ? 52 : 46);
    const bw = this.isMobile ? 64 : 84;

    ctx.strokeStyle = "#2b1d2e";
    ctx.fillStyle = "#231729";
    ctx.lineWidth = 3;
    // Legs
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.38, by);
    ctx.lineTo(bx - bw * 0.42, by + 20);
    ctx.moveTo(bx + bw * 0.38, by);
    ctx.lineTo(bx + bw * 0.42, by + 20);
    ctx.stroke();
    // Backrest posts
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.36, by - 2);
    ctx.lineTo(bx - bw * 0.40, by - 24);
    ctx.moveTo(bx + bw * 0.36, by - 2);
    ctx.lineTo(bx + bw * 0.40, by - 24);
    ctx.stroke();
    // Backrest slats
    ctx.fillRect(bx - bw * 0.44, by - 22, bw * 0.88, 5);
    ctx.fillRect(bx - bw * 0.43, by - 13, bw * 0.86, 5);
    // Seat plank
    ctx.fillStyle = "#312036";
    ctx.fillRect(bx - bw * 0.48, by - 3, bw * 0.96, 6);

    // Small lantern sitting on the right corner of the bench
    this.benchLanternX = bx + bw * 0.28;
    this.benchLanternY = by - 9;
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(this.benchLanternX - 3.5, this.benchLanternY - 5, 7, 9);
    ctx.strokeStyle = "#4c354f";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(this.benchLanternX - 4, this.benchLanternY - 5.5, 8, 10);

    // Small glowing mushrooms & wildflowers across the lower meadow
    const mRng = createSeededRandom(6617);
    const mushCount = this.isMobile ? 6 : 12;
    for (let i = 0; i < mushCount; i++) {
      const mx = randomRange(mRng, w * 0.05, w * 0.95);
      const my = randomRange(mRng, this.horizonY + 62, h - 22);
      const mr = randomRange(mRng, 4, 8);
      const mg = ctx.createRadialGradient(mx, my - mr, 0, mx, my - mr, mr * 3.2);
      mg.addColorStop(0, "rgba(196, 181, 253, 0.34)");
      mg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my - mr, mr * 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = i % 2 === 0 ? "rgba(216, 180, 254, 0.78)" : "rgba(165, 243, 252, 0.72)";
      ctx.beginPath();
      ctx.arc(mx, my - mr, mr, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
    }

    this.bgCanvas = c;
  }

  private buildTree(): void {
    const c = createOffscreen(this.width * this.dpr, this.height * this.dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(this.dpr, this.dpr);

    const rng = createSeededRandom(9421);
    const trunkLen = this.isPortrait
      ? clamp(this.height * 0.16, 95, 145)
      : clamp(this.height * 0.17, 92, 140);
    const baseThick = this.isMobile ? 14 : 18;

    const tips: { x: number; y: number }[] = [];

    const drawBranch = (
      x: number,
      y: number,
      len: number,
      angle: number,
      thick: number,
      depth: number
    ) => {
      const endX = x + Math.cos(angle) * len;
      const endY = y + Math.sin(angle) * len;
      const ctrlX = (x + endX) * 0.5 + (rng() - 0.5) * len * 0.18;
      const ctrlY = (y + endY) * 0.5 + (rng() - 0.5) * len * 0.14;

      // Subtle glowing outer edge on bare branches
      ctx.strokeStyle = depth <= 2 ? "rgba(196, 181, 253, 0.18)" : "rgba(216, 180, 254, 0.24)";
      ctx.lineWidth = thick + 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.stroke();

      // Core dark bark with warm violet tint
      ctx.strokeStyle = depth <= 1 ? "#1e162c" : "#2d2142";
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.stroke();

      if (depth >= 4 || len < 18) {
        tips.push({ x: endX, y: endY });
        return;
      }

      const subCount = depth === 0 ? 3 : 2;
      for (let i = 0; i < subCount; i++) {
        const spread =
          subCount === 3
            ? (i - 1) * 0.48 + randomRange(rng, -0.1, 0.1)
            : (i === 0 ? -1 : 1) * randomRange(rng, 0.34, 0.58);
        const nextLen = len * randomRange(rng, 0.68, 0.80);
        const nextThick = Math.max(1.4, thick * 0.65);
        drawBranch(endX, endY, nextLen, angle + spread, nextThick, depth + 1);
      }
    };

    // Subtle roots gripping the hilltop
    drawBranch(this.treeBaseX, this.treeBaseY + 10, trunkLen, -Math.PI * 0.5 + 0.03, baseThick, 0);

    // Pick well-spaced crown anchor points from the generated branch tips
    tips.sort((a, b) => a.x - b.x);
    this.crownAnchors = [];
    this.extraTips = [];
    const anchorCount = Math.min(MAX_CROWN_ANCHORS, tips.length);
    if (anchorCount > 0) {
      const step = tips.length / anchorCount;
      const used = new Set<number>();
      for (let i = 0; i < anchorCount; i++) {
        const idx = Math.min(tips.length - 1, Math.floor((i + 0.5) * step));
        used.add(idx);
        this.crownAnchors.push(tips[idx]);
      }
      tips.forEach((pt, idx) => {
        if (!used.has(idx)) this.extraTips.push(pt);
      });
    } else {
      this.crownAnchors = tips;
    }

    // Compute crown center for glow halo
    if (tips.length > 0) {
      this.treeCrownCx = tips.reduce((s, p) => s + p.x, 0) / tips.length;
      this.treeCrownCy = tips.reduce((s, p) => s + p.y, 0) / tips.length;
    } else {
      this.treeCrownCx = this.treeBaseX;
      this.treeCrownCy = this.treeBaseY - trunkLen * 1.8;
    }

    this.treeCanvas = c;
  }

  private buildStarsAndGrass(): void {
    const rng = createSeededRandom(4482);
    const starCount = this.isMobile ? 90 : 170;
    const starColors = ["#ffffff", "#e0e7ff", "#fde68a", "#fbcfe8"];
    this.stars = [];
    for (let i = 0; i < starCount; i++) {
      const layer = (i % 3) as 0 | 1 | 2;
      this.stars.push({
        x: rng() * this.width,
        y: rng() * (this.horizonY - 8),
        r: layer === 0 ? randomRange(rng, 0.5, 1.0) : layer === 1 ? randomRange(rng, 0.9, 1.5) : randomRange(rng, 1.3, 2.0),
        layer,
        phase: rng() * TAU,
        speed: randomRange(rng, 0.7, 2.1),
        color: starColors[i % starColors.length],
      });
    }

    const grassCount = this.isMobile ? 75 : 140;
    this.grass = [];
    for (let i = 0; i < grassCount; i++) {
      this.grass.push({
        x: randomRange(rng, -10, this.width + 10),
        baseY: randomRange(rng, this.horizonY + 46, this.height + 10),
        h: randomRange(rng, this.isMobile ? 24 : 30, this.isMobile ? 56 : 74),
        lean: randomRange(rng, -12, 12),
        phase: rng() * TAU,
        width: randomRange(rng, 1.3, 2.5),
        shade: rng(),
      });
    }
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += clampedDt;

    const targetPx = this.width > 0 && this.pointerX >= 0 ? (this.pointerX / this.width - 0.5) * 14 : 0;
    this.parallaxX = lerp(this.parallaxX, targetPx, clampedDt * 2.0);

    // Idle guide star after 20s without catching
    if (this.caught.state === "none" && (!this.finaleActive || this.wishMode)) {
      this.idleTimer += clampedDt;
      if (this.idleTimer >= 20 && !this.meteors.some((m) => m.isGuide)) {
        this.spawnMeteor(true);
        this.idleTimer = 8;
      }
    }

    // Spawn meteors (1.5-3.0s cadence, max 3 normally; grand shower for 5s on finale)
    if (this.finaleActive) {
      this.finaleTimer += clampedDt;
    }
    const grandShower = this.finaleActive && this.finaleTimer < 5.5;
    const maxMeteors = grandShower ? 6 : 3;
    this.nextMeteorIn -= clampedDt;
    if (this.nextMeteorIn <= 0 && this.meteors.length < maxMeteors) {
      this.spawnMeteor(false, grandShower);
      this.nextMeteorIn = grandShower ? randomRange(Math.random, 0.35, 0.75) : randomRange(Math.random, 1.5, 3.0);
    }

    // Update meteors with pointer-proximity slowdown within 120px
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.age += clampedDt;

      let speedFactor = 1;
      if (this.pointerX >= 0 && this.caught.state === "none") {
        const d = Math.hypot(this.pointerX - m.x, this.pointerY - m.y);
        if (d < 120) {
          speedFactor = lerp(0.22, 1, clamp(d / 120, 0, 1));
        }
      }

      m.x += m.vx * speedFactor * clampedDt;
      m.y += m.vy * speedFactor * clampedDt;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > (this.isMobile ? 14 : 22)) {
        m.trail.shift();
      }

      if (!this.reducedMotion && Math.random() < (this.isMobile ? 0.25 : 0.45)) {
        this.emitSparkles(m.x, m.y, m.color, 1);
      }

      if (m.age >= m.maxAge || m.x < -80 || m.x > this.width + 80 || m.y > this.horizonY + 40) {
        this.meteors.splice(i, 1);
      }
    }

    // Update caught orb state machine
    if (this.caught.state === "floating") {
      this.caught.t = Math.min(1, this.caught.t + clampedDt * 1.45);
      const e = easeOutCubic(this.caught.t);
      this.caught.x = lerp(this.caught.startX, this.caught.hoverX, e);
      this.caught.y = lerp(this.caught.startY, this.caught.hoverY, e);
      if (this.caught.t >= 1) {
        this.caught.state = "hovering";
        this.caught.hoverAge = 0;
      }
    } else if (this.caught.state === "hovering") {
      this.caught.hoverAge += clampedDt;
      this.caught.y = this.caught.hoverY + Math.sin(this.time * 2.4) * 5;
      if (this.sealHoldProgress > 0.05 && Math.random() < 0.5) {
        this.emitSparkles(this.caught.x, this.caught.y, "#fef08a", 1);
      }
      // If ignored for 20s, gently return to the sky
      if (this.caught.hoverAge >= 20 && this.sealHoldProgress === 0) {
        this.caught.state = "returning";
        this.caught.startX = this.caught.x;
        this.caught.startY = this.caught.y;
        this.caught.t = 0;
      }
    } else if (this.caught.state === "returning") {
      this.caught.t = Math.min(1, this.caught.t + clampedDt * 0.9);
      const e = easeInOutCubic(this.caught.t);
      this.caught.x = lerp(this.caught.startX, this.caught.startX + 40, e);
      this.caught.y = lerp(this.caught.startY, -40, e);
      if (this.caught.t >= 1) {
        this.caught.state = "none";
      }
    } else if (this.caught.state === "sealing") {
      this.caught.t = Math.min(1, this.caught.t + clampedDt * 1.15);
      const e = easeInOutCubic(this.caught.t);
      const midX = (this.caught.startX + this.caught.targetX) * 0.5;
      const midY = Math.min(this.caught.startY, this.caught.targetY) - 70;
      const mt = 1 - e;
      this.caught.x = mt * mt * this.caught.startX + 2 * mt * e * midX + e * e * this.caught.targetX;
      this.caught.y = mt * mt * this.caught.startY + 2 * mt * e * midY + e * e * this.caught.targetY;
      this.caught.ribbon.push({ x: this.caught.x, y: this.caught.y });
      if (this.caught.ribbon.length > 26) this.caught.ribbon.shift();

      if (Math.random() < 0.7) {
        this.emitSparkles(this.caught.x, this.caught.y, "#fde68a", 1);
      }

      if (this.caught.t >= 1) {
        const ax = this.caught.targetX;
        const ay = this.caught.targetY;
        const wasExtra = this.caught.isExtraWish;
        this.caught.state = "none";
        this.caught.ribbon = [];

        if (wasExtra) {
          this.spawnBlossomCluster(ax, ay, this.isMobile ? 8 : 12, 34);
        } else {
          this.sealedCount = Math.min(this.totalPromises, this.sealedCount + 1);
          this.spawnBlossomCluster(ax, ay, this.isMobile ? 14 : 20, this.isMobile ? 34 : 46);
          if (this.sealedCount >= this.totalPromises && !this.finaleActive) {
            this.triggerFinale();
          }
        }
      }
    }

    // Grow blossoms smoothly (never popping in)
    for (const b of this.blossoms) {
      if (b.delay > 0) {
        b.delay = Math.max(0, b.delay - clampedDt);
      } else if (b.growth < 1) {
        b.growth = Math.min(1, b.growth + clampedDt * (this.reducedMotion ? 3.5 : 1.35));
      }
    }

    // Gentle finale petal rain across the hill
    if (this.finaleActive && !this.reducedMotion) {
      const rainRate = this.isMobile ? 0.14 : 0.28;
      if (Math.random() < rainRate && this.petals.length < (this.isMobile ? 28 : 56)) {
        this.petals.push({
          x: this.treeCrownCx + randomRange(Math.random, -this.width * 0.35, this.width * 0.35),
          y: this.treeCrownCy - 40 + Math.random() * 60,
          vx: randomRange(Math.random, -22, -6),
          vy: randomRange(Math.random, 18, 36),
          angle: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 2.2,
          size: 6 + Math.random() * 5,
          palette: Math.floor(Math.random() * 3) as 0 | 1 | 2,
          age: 0,
          life: 6 + Math.random() * 3,
        });
      }
    }

    // Update falling petals
    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      p.age += clampedDt;
      if (p.age >= p.life || p.y > this.height + 16) {
        this.petals.splice(i, 1);
        continue;
      }
      p.x += (p.vx + Math.sin(this.time * 1.8 + p.angle) * 14) * clampedDt;
      p.y += p.vy * clampedDt;
      p.vy = Math.min(44, p.vy + 18 * clampedDt);
      p.angle += p.spin * clampedDt;
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

    // 1. Pre-rendered sky, hills, bench, and mushrooms
    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
    }

    // 2. Three layers of twinkling parallax stars
    for (const s of this.stars) {
      const depth = s.layer === 0 ? 0.25 : s.layer === 1 ? 0.55 : 1.0;
      const tw = this.reducedMotion ? 0.72 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.time * s.speed + s.phase));
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x - this.parallaxX * depth, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Bench lantern warm glow (brightens noticeably on finale!)
    const lanternBoost = this.finaleActive ? 1.65 : 1.0 + (this.sealedCount / this.totalPromises) * 0.35;
    const flicker = 0.92 + 0.08 * Math.sin(this.time * 7.5);
    const lR = 52 * lanternBoost * flicker;
    const lg = ctx.createRadialGradient(
      this.benchLanternX,
      this.benchLanternY,
      2,
      this.benchLanternX,
      this.benchLanternY,
      lR
    );
    lg.addColorStop(0, "rgba(255, 251, 235, 0.85)");
    lg.addColorStop(0.28, `rgba(253, 224, 71, ${(0.38 * lanternBoost).toFixed(3)})`);
    lg.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(this.benchLanternX, this.benchLanternY, lR, 0, TAU);
    ctx.fill();

    // 4. Tree crown glow growing with each sealed promise
    const sealFrac = clamp(this.sealedCount / this.totalPromises, 0, 1);
    const crownGlowR = (this.isMobile ? 135 : 195) * (0.7 + sealFrac * 0.55);
    const cg = ctx.createRadialGradient(
      this.treeCrownCx,
      this.treeCrownCy,
      10,
      this.treeCrownCx,
      this.treeCrownCy,
      crownGlowR
    );
    const crownAlpha = 0.08 + sealFrac * 0.24 + (this.finaleActive ? 0.14 : 0);
    cg.addColorStop(0, `rgba(251, 207, 232, ${crownAlpha.toFixed(3)})`);
    cg.addColorStop(0.55, `rgba(192, 132, 252, ${(crownAlpha * 0.55).toFixed(3)})`);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(this.treeCrownCx, this.treeCrownCy, crownGlowR, 0, TAU);
    ctx.fill();

    // 5. Pre-rendered bare promise tree
    if (this.treeCanvas) {
      ctx.drawImage(this.treeCanvas, 0, 0, this.width, this.height);
    }

    // 6. Growing glowing blossoms on the tree
    for (const b of this.blossoms) {
      if (b.growth <= 0.01) continue;
      const sprite = this.blossomSprites[b.palette];
      if (!sprite) continue;
      const scale = easeOutCubic(b.growth);
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.5 + b.phase) * 1.8;
      const s = b.size * scale;
      ctx.drawImage(sprite, b.x + sway - s * 0.5, b.y - s * 0.5, s, s);
    }

    // 7. Foreground swaying grass
    ctx.save();
    ctx.lineCap = "round";
    for (const g of this.grass) {
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.45 + g.phase) * 6.5;
      ctx.strokeStyle = `rgb(${Math.round(22 + g.shade * 18)}, ${Math.round(18 + g.shade * 22)}, ${Math.round(46 + g.shade * 32)})`;
      ctx.lineWidth = g.width;
      ctx.beginPath();
      ctx.moveTo(g.x, g.baseY);
      ctx.quadraticCurveTo(g.x + (g.lean + sway) * 0.45, g.baseY - g.h * 0.55, g.x + g.lean + sway, g.baseY - g.h);
      ctx.stroke();
    }
    ctx.restore();

    // 8. Shooting stars (meteors)
    for (const m of this.meteors) {
      const fadeIn = clamp(m.age / 0.35, 0, 1);
      const fadeOut = clamp((m.maxAge - m.age) / 0.65, 0, 1);
      const alpha = Math.min(fadeIn, fadeOut);
      if (alpha <= 0.01) continue;

      if (m.trail.length > 1) {
        for (let i = 1; i < m.trail.length; i++) {
          const frac = i / m.trail.length;
          ctx.strokeStyle = m.color;
          ctx.globalAlpha = frac * alpha * (m.isGuide ? 0.65 : 0.48);
          ctx.lineWidth = frac * (m.isGuide ? 4.5 : 3.0);
          ctx.beginPath();
          ctx.moveTo(m.trail[i - 1].x, m.trail[i - 1].y);
          ctx.lineTo(m.trail[i].x, m.trail[i].y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = alpha;
      const hr = m.isGuide ? 26 : 16;
      const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, hr);
      hg.addColorStop(0, "#ffffff");
      hg.addColorStop(0.35, m.color);
      hg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, hr, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size * 0.65, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 9. Caught orb & sealing ribbon of light
    if (this.caught.state !== "none") {
      if (this.caught.state === "sealing" && this.caught.ribbon.length > 1) {
        for (let i = 1; i < this.caught.ribbon.length; i++) {
          const frac = i / this.caught.ribbon.length;
          ctx.strokeStyle = "#fde68a";
          ctx.globalAlpha = frac * 0.72;
          ctx.lineWidth = frac * 5;
          ctx.beginPath();
          ctx.moveTo(this.caught.ribbon[i - 1].x, this.caught.ribbon[i - 1].y);
          ctx.lineTo(this.caught.ribbon[i].x, this.caught.ribbon[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      const orbAlpha = this.caught.state === "returning" ? 1 - this.caught.t : 1;
      const orbR = (26 + this.sealHoldProgress * 16) * (0.94 + 0.06 * Math.sin(this.time * 5));
      ctx.globalAlpha = orbAlpha;
      const og = ctx.createRadialGradient(this.caught.x, this.caught.y, 0, this.caught.x, this.caught.y, orbR);
      og.addColorStop(0, "#ffffff");
      og.addColorStop(0.32, this.caught.color);
      og.addColorStop(0.7, "rgba(244, 114, 182, 0.25)");
      og.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(this.caught.x, this.caught.y, orbR, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 10. Falling petals
    for (const p of this.petals) {
      const sprite = this.petalSprites[p.palette];
      if (!sprite) continue;
      const a = clamp((p.life - p.age) / 0.8, 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = a * 0.85;
      ctx.drawImage(sprite, -p.size * 0.5, -p.size * 0.5, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 11. Sparkles
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
}
