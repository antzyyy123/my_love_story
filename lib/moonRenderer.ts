/**
 * Canvas 2D Renderer for "The Moon" — Hidden Bonus Lunar Surface Scene
 * - Pre-renders deep starfield + bright Milky Way band & 3 curved parallax lunar ground layers
 *   with craters, scattered rocks, fine dust, and long soft shadows tinted by blue-green earthshine.
 * - Renders a huge rotating Flowering Earth in the sky (reusing drawFloweringEarthGlobe) with
 *   night-side village lights, warm cafe glow, rhythm-echo flicker, and continent HEART reply.
 * - Interactive low-gravity Moonflower (literal growth from bud -> silver-blue bloom with
 *   petals floating toward Earth), Signal Lamp on a post (beam toward Earth + rhythm recording),
 *   and silver light ribbon streaming petals to Earth once both are completed.
 */

import { drawFloweringEarthGlobe } from "@/lib/earthGlobeRenderer";
import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

export interface MoonHUDState {
  flowerX: number;
  flowerY: number;
  lampX: number;
  lampY: number;
  flowerPlanted: boolean;
  signalComplete: boolean;
  endingActive: boolean;
}

interface DustMote {
  wx: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

interface FloatingPetal {
  x: number;
  y: number;
  t: number;
  speed: number;
  offset: number;
  size: number;
  rot: number;
  onRibbon: boolean;
}

interface SignalPulse {
  startSec: number;
  durationSec: number;
}

function createOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export class MoonSurfaceRenderer {
  private width = 1;
  private height = 1;
  private dpr = 1;
  private isMobile = false;
  private isPortrait = false;
  private reducedMotion = false;

  private horizonY = 0;
  private maxPanX = 140;
  private panX = 0;
  private targetPanX = 0;

  private skyCanvas: HTMLCanvasElement | null = null;
  private dust: DustMote[] = [];
  private petals: FloatingPetal[] = [];
  private craters: Array<{ wx: number; y: number; rx: number; ry: number; depth: number; layer: 0 | 1 | 2 }> = [];
  private rocks: Array<{ wx: number; y: number; rx: number; ry: number; layer: 1 | 2 }> = [];

  private time = 0;
  private earthSpin = 1.4;
  private earthCx = 0;
  private earthCy = 0;
  private earthR = 110;
  private cafeScreenX = 0;
  private cafeScreenY = 0;

  // Interactive world positions (relative to center)
  private lampWx = -120;
  private lampY = 0;
  private flowerWx = 115;
  private flowerY = 0;

  // Interaction A: Moonflower growth
  private flowerPlanted = false;
  private flowerGrowth = 0; // 0..1 slow low-gravity bloom

  // Interaction B: Signal Lamp -> Earth Rhythm Reply -> Continent Heart
  private lampLit = false;
  private lampGlow = 0;
  private currentPressStart: number | null = null;
  private recordedPulses: SignalPulse[] = [];
  private replyQueue: SignalPulse[] = [];
  private replyHeartTimer = 0;
  private replyHeartGlow = 0;
  private signalComplete = false;
  private endingActive = false;
  private ribbonProgress = 0;

  private onEndingCb?: () => void;

  constructor(opts: { reducedMotion: boolean; onEnding?: () => void }) {
    this.reducedMotion = opts.reducedMotion;
    this.onEndingCb = opts.onEnding;
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

    this.horizonY = this.isPortrait ? this.height * 0.57 : this.height * 0.60;
    this.maxPanX = this.isPortrait ? Math.max(110, this.width * 0.28) : Math.max(140, this.width * 0.18);
    this.panX = clamp(this.panX, -this.maxPanX, this.maxPanX);
    this.targetPanX = clamp(this.targetPanX, -this.maxPanX, this.maxPanX);

    this.earthCx = this.isPortrait ? this.width * 0.52 : this.width * 0.52;
    this.earthCy = this.isPortrait ? this.height * 0.25 : this.height * 0.27;
    this.earthR = this.isPortrait
      ? clamp(this.width * 0.27, 74, 130)
      : clamp(this.height * 0.20, 88, 155);

    this.lampWx = this.isPortrait ? -this.width * 0.23 : -Math.min(185, this.width * 0.18);
    this.lampY = this.horizonY + (this.height - this.horizonY) * 0.44;
    this.flowerWx = this.isPortrait ? this.width * 0.23 : Math.min(185, this.width * 0.18);
    this.flowerY = this.horizonY + (this.height - this.horizonY) * 0.52;

    this.buildSkyCache();
    this.buildTerrainDetails();
  }

  private worldToScreenX(wx: number, parallax = 1): number {
    return this.width * 0.5 + wx - this.panX * parallax;
  }

  public panBy(dx: number): void {
    this.targetPanX = clamp(this.targetPanX - dx, -this.maxPanX, this.maxPanX);
  }

  public plantMoonflower(): boolean {
    if (this.flowerPlanted) return false;
    this.flowerPlanted = true;
    if (this.reducedMotion) {
      this.flowerGrowth = 1;
    }
    this.checkEnding();
    return true;
  }

  public startLampSignal(): void {
    this.lampLit = true;
    this.currentPressStart = this.time;
  }

  public endLampSignal(): void {
    if (!this.lampLit) return;
    this.lampLit = false;
    const dur = clamp(this.time - (this.currentPressStart ?? this.time), 0.18, 1.8);
    this.currentPressStart = null;
    // Queue Earth's village light reply 1.0s later in the exact same rhythm!
    const pulse: SignalPulse = { startSec: this.time + 1.0, durationSec: dur };
    this.recordedPulses.push(pulse);
    this.replyQueue.push(pulse);
    // Schedule continent HEART glow right after the reply pulse finishes
    this.replyHeartTimer = Math.max(this.replyHeartTimer, this.time + 1.0 + dur + 0.35);
    this.signalComplete = true;
    this.checkEnding();
  }

  /** Accessibility / Replay helper: sends a graceful 3-pulse rhythmic signal */
  public sendStandardSignal(): void {
    const now = this.time;
    const offsets = [0, 0.45, 0.95];
    const durs = [0.22, 0.22, 0.48];
    this.lampGlow = 1;
    for (let i = 0; i < offsets.length; i++) {
      this.replyQueue.push({ startSec: now + 1.0 + offsets[i], durationSec: durs[i] });
    }
    this.replyHeartTimer = now + 2.55;
    this.signalComplete = true;
    this.checkEnding();
  }

  private checkEnding(): void {
    if (this.flowerPlanted && this.signalComplete && !this.endingActive) {
      this.endingActive = true;
      this.onEndingCb?.();
    }
  }

  public handleTap(sx: number, sy: number): "flower" | "lamp" | "none" {
    const fx = this.worldToScreenX(this.flowerWx, 1);
    if (Math.hypot(sx - fx, sy - (this.flowerY - 18)) <= 52) {
      this.plantMoonflower();
      return "flower";
    }
    const lx = this.worldToScreenX(this.lampWx, 1);
    if (Math.hypot(sx - lx, sy - (this.lampY - 26)) <= 52) {
      this.sendStandardSignal();
      return "lamp";
    }
    return "none";
  }

  public isOverLamp(sx: number, sy: number): boolean {
    const lx = this.worldToScreenX(this.lampWx, 1);
    return Math.hypot(sx - lx, sy - (this.lampY - 26)) <= 52;
  }

  public getHUDState(): MoonHUDState {
    return {
      flowerX: this.worldToScreenX(this.flowerWx, 1),
      flowerY: this.flowerY - 18,
      lampX: this.worldToScreenX(this.lampWx, 1),
      lampY: this.lampY - 26,
      flowerPlanted: this.flowerPlanted,
      signalComplete: this.signalComplete,
      endingActive: this.endingActive,
    };
  }

  private buildSkyCache(): void {
    const c = createOffscreen(this.width * this.dpr, this.height * this.dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;
    ctx.fillStyle = "#02030a";
    ctx.fillRect(0, 0, w, h);

    // Bright Milky Way band diagonally across pure space
    ctx.save();
    ctx.translate(w * 0.5, h * 0.34);
    ctx.rotate(-0.36);
    const bw = Math.hypot(w, h) * 1.15;
    const bh = Math.min(w, h) * 0.28;
    const mw = ctx.createLinearGradient(0, -bh, 0, bh);
    mw.addColorStop(0, "rgba(148, 163, 255, 0)");
    mw.addColorStop(0.35, "rgba(129, 140, 248, 0.11)");
    mw.addColorStop(0.5, "rgba(224, 231, 255, 0.16)");
    mw.addColorStop(0.65, "rgba(196, 181, 253, 0.10)");
    mw.addColorStop(1, "rgba(148, 163, 255, 0)");
    ctx.fillStyle = mw;
    ctx.fillRect(-bw * 0.5, -bh, bw, bh * 2);

    const rng = createSeededRandom(8221);
    const dustCount = this.isMobile ? 110 : 240;
    for (let i = 0; i < dustCount; i++) {
      const dx = randomRange(rng, -bw * 0.48, bw * 0.48);
      const dy = (rng() + rng() - 1) * bh * 0.72;
      ctx.fillStyle = `rgba(241, 245, 255, ${randomRange(rng, 0.12, 0.42).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(dx, dy, randomRange(rng, 0.45, 1.3), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Pure starfield
    const sRng = createSeededRandom(1409);
    const starCount = this.isMobile ? 130 : 260;
    const starCols = ["#ffffff", "#e0f2fe", "#fef3c7", "#e9d5ff"];
    for (let i = 0; i < starCount; i++) {
      ctx.fillStyle = starCols[i % starCols.length];
      ctx.globalAlpha = randomRange(sRng, 0.32, 0.95);
      ctx.beginPath();
      ctx.arc(sRng() * w, sRng() * (this.horizonY + 40), randomRange(sRng, 0.5, 1.75), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.skyCanvas = c;
  }

  private buildTerrainDetails(): void {
    const rng = createSeededRandom(4910);
    const span = this.width + this.maxPanX * 2 + 100;
    const groundH = this.height - this.horizonY;

    this.craters = [];
    for (let i = 0; i < (this.isMobile ? 12 : 20); i++) {
      const layer = (i % 3) as 0 | 1 | 2;
      const yFrac = layer === 0 ? randomRange(rng, 0.08, 0.28) : layer === 1 ? randomRange(rng, 0.28, 0.62) : randomRange(rng, 0.62, 0.92);
      const rx = layer === 0 ? randomRange(rng, 16, 32) : layer === 1 ? randomRange(rng, 22, 46) : randomRange(rng, 28, 58);
      this.craters.push({
        wx: randomRange(rng, -span * 0.46, span * 0.46),
        y: this.horizonY + groundH * yFrac,
        rx,
        ry: rx * randomRange(rng, 0.26, 0.34),
        depth: randomRange(rng, 0.25, 0.5),
        layer,
      });
    }

    this.rocks = [];
    for (let i = 0; i < (this.isMobile ? 14 : 26); i++) {
      const layer = (i % 2 === 0 ? 1 : 2) as 1 | 2;
      this.rocks.push({
        wx: randomRange(rng, -span * 0.46, span * 0.46),
        y: this.horizonY + groundH * (layer === 1 ? randomRange(rng, 0.25, 0.58) : randomRange(rng, 0.58, 0.94)),
        rx: randomRange(rng, 4, 12),
        ry: randomRange(rng, 3, 8),
        layer,
      });
    }

    this.dust = Array.from({ length: this.isMobile ? 16 : 36 }, () => ({
      wx: randomRange(rng, -span * 0.48, span * 0.48),
      y: randomRange(rng, this.horizonY - 90, this.height - 10),
      vx: randomRange(rng, -5, 5),
      vy: randomRange(rng, -8, -2),
      r: randomRange(rng, 1.0, 2.4),
      phase: rng() * TAU,
    }));
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += clampedDt;
    this.earthSpin = (this.earthSpin + clampedDt * 0.045) % TAU;
    this.panX = lerp(this.panX, this.targetPanX, Math.min(1, clampedDt * 6));

    // Low-gravity Moonflower growth
    if (this.flowerPlanted && this.flowerGrowth < 1) {
      this.flowerGrowth = Math.min(1, this.flowerGrowth + clampedDt / (this.reducedMotion ? 0.5 : 3.2));
    }

    // Spawn silver-blue petals drifting slowly toward Earth once moonflower blooms
    if (this.flowerGrowth > 0.78 && !this.reducedMotion) {
      const rate = this.endingActive ? (this.isMobile ? 0.14 : 0.28) : (this.isMobile ? 0.04 : 0.08);
      if (Math.random() < rate && this.petals.length < (this.isMobile ? 22 : 46)) {
        this.petals.push({
          x: this.worldToScreenX(this.flowerWx, 1),
          y: this.flowerY - 62,
          t: 0,
          speed: this.endingActive ? 0.22 + Math.random() * 0.14 : 0.12 + Math.random() * 0.08,
          offset: (Math.random() - 0.5) * (this.endingActive ? 22 : 65),
          size: 4 + Math.random() * 4,
          rot: Math.random() * TAU,
          onRibbon: this.endingActive,
        });
      }
    }

    // Signal lamp glow
    const targetLamp = this.lampLit ? 1 : 0;
    this.lampGlow = lerp(this.lampGlow, targetLamp, Math.min(1, clampedDt * (this.lampLit ? 12 : 4.5)));

    // Earth reply continent heart glow
    if (this.replyHeartTimer > 0 && this.time >= this.replyHeartTimer) {
      const since = this.time - this.replyHeartTimer;
      if (since < 5.5) {
        const inT = clamp(since / 0.7, 0, 1);
        const outT = clamp((5.5 - since) / 1.2, 0, 1);
        this.replyHeartGlow = Math.min(inT, outT);
      } else {
        this.replyHeartGlow = 0;
        this.replyHeartTimer = 0;
      }
    }

    // Clean expired reply pulses
    this.replyQueue = this.replyQueue.filter((p) => this.time <= p.startSec + p.durationSec + 0.5);

    // Silver ribbon growth on ending
    if (this.endingActive && this.ribbonProgress < 1) {
      this.ribbonProgress = Math.min(1, this.ribbonProgress + clampedDt * 0.42);
    }

    // Low-gravity drifting dust motes
    if (!this.reducedMotion) {
      for (const m of this.dust) {
        m.wx += (m.vx + Math.sin(this.time * 0.8 + m.phase) * 3) * clampedDt;
        m.y += m.vy * clampedDt;
        if (m.y < this.horizonY - 120) m.y = this.height - 6;
      }
    }

    // Update petals floating toward Earth
    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      p.t += p.speed * clampedDt;
      p.rot += clampedDt * 1.4;
      if (p.t >= 1) this.petals.splice(i, 1);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const w = this.width;
    const h = this.height;

    // 1. Pre-rendered starfield + bright Milky Way band
    if (this.skyCanvas) {
      ctx.drawImage(this.skyCanvas, 0, 0, w, h);
    }

    // 2. Huge Flowering Earth hanging in the sky (reusing drawFloweringEarthGlobe!)
    let villagePulse = 0;
    for (const p of this.replyQueue) {
      if (this.time >= p.startSec && this.time <= p.startSec + p.durationSec) {
        villagePulse = 1;
        break;
      }
    }
    const ex = this.earthCx - this.panX * 0.14;
    const ey = this.earthCy;
    const cafePos = drawFloweringEarthGlobe(ctx, {
      cx: ex,
      cy: ey,
      radius: this.earthR,
      spin: this.earthSpin,
      sunAngle2D: -0.55,
      lx: 0.72,
      ly: -0.45,
      lz: 0.52,
      cosYaw: 1,
      sinYaw: 0,
      cosElev: 0.92,
      sinElev: 0.39,
      overallAlpha: 1,
      villagePulse,
      heartGlow: this.replyHeartGlow,
      showCafeGlow: true,
    });
    this.cafeScreenX = cafePos.cafeX;
    this.cafeScreenY = cafePos.cafeY;

    // 3. Three curved parallax lunar ground layers tinted by blue-green earthshine
    const layers = [
      { p: 0.32, baseY: this.horizonY + 2, curve: 32, topCol: "#364558", botCol: "#1e293b" },
      { p: 0.62, baseY: this.horizonY + 34, curve: 26, topCol: "#47586c", botCol: "#253142" },
      { p: 1.0, baseY: this.horizonY + 70, curve: 22, topCol: "#5a6c80", botCol: "#2d3b4d" },
    ];
    for (const ly of layers) {
      const grad = ctx.createLinearGradient(0, ly.baseY - 24, 0, h);
      grad.addColorStop(0, ly.topCol);
      grad.addColorStop(1, ly.botCol);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-20, h + 20);
      ctx.lineTo(-20, ly.baseY + ly.curve);
      ctx.quadraticCurveTo(w * 0.5 - this.panX * ly.p * 0.25, ly.baseY - ly.curve, w + 20, ly.baseY + ly.curve);
      ctx.lineTo(w + 20, h + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Soft blue-green earthshine wash on the lunar surface
    const shine = ctx.createRadialGradient(ex, this.horizonY + 40, 20, ex, this.horizonY + 120, Math.max(w, h) * 0.65);
    shine.addColorStop(0, "rgba(125, 211, 252, 0.16)");
    shine.addColorStop(0.5, "rgba(56, 189, 248, 0.06)");
    shine.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, this.horizonY - 20, w, h - this.horizonY + 30);

    // 4. Lunar craters with rim highlights & long soft shadows + scattered rocks
    for (const cr of this.craters) {
      const p = cr.layer === 0 ? 0.35 : cr.layer === 1 ? 0.65 : 1.0;
      const sx = this.worldToScreenX(cr.wx, p);
      if (sx < -80 || sx > w + 80) continue;
      ctx.fillStyle = `rgba(15, 23, 42, ${cr.depth.toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(sx, cr.y, cr.rx, cr.ry, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(226, 232, 240, 0.26)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(sx, cr.y, cr.rx, cr.ry, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    for (const rk of this.rocks) {
      const sx = this.worldToScreenX(rk.wx, rk.layer === 1 ? 0.65 : 1.0);
      if (sx < -30 || sx > w + 30) continue;
      // Long soft shadow
      ctx.fillStyle = "rgba(10, 15, 30, 0.45)";
      ctx.beginPath();
      ctx.ellipse(sx - rk.rx * 1.4, rk.y + 2, rk.rx * 2.0, rk.ry * 0.55, 0, 0, TAU);
      ctx.fill();
      // Rock body
      ctx.fillStyle = "#7b8ca0";
      ctx.beginPath();
      ctx.ellipse(sx, rk.y, rk.rx, rk.ry, -0.2, 0, TAU);
      ctx.fill();
    }

    // 5. Ending Silver Light Ribbon connecting Moonflower to Earth's village!
    const fx = this.worldToScreenX(this.flowerWx, 1);
    const fy = this.flowerY - 58;
    const ctrlX = (fx + this.cafeScreenX) * 0.5 + 48;
    const ctrlY = (fy + this.cafeScreenY) * 0.5 - 30;
    if (this.ribbonProgress > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const steps = 40;
      const maxStep = Math.floor(steps * easeInOutCubic(this.ribbonProgress));
      ctx.strokeStyle = "rgba(186, 230, 253, 0.42)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= maxStep; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const px = mt * mt * fx + 2 * mt * t * ctrlX + t * t * this.cafeScreenX;
        const py = mt * mt * fy + 2 * mt * t * ctrlY + t * t * this.cafeScreenY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Signal Lamp on a post (left foreground) + beam toward Earth
    this.renderSignalLamp(ctx);

    // 7. Moonflower in darker lunar soil patch (right foreground)
    this.renderMoonflower(ctx);

    // 8. Floating silver-blue Moonflower petals drifting toward Earth
    for (const p of this.petals) {
      const mt = 1 - p.t;
      const px = mt * mt * fx + 2 * mt * p.t * (ctrlX + p.offset) + p.t * p.t * this.cafeScreenX;
      const py = mt * mt * fy + 2 * mt * p.t * ctrlY + p.t * p.t * this.cafeScreenY;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.sin(p.t * Math.PI) * 0.88;
      ctx.fillStyle = "#bae6fd";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 9. Low-gravity floating dust motes
    if (!this.reducedMotion) {
      for (const m of this.dust) {
        const sx = this.worldToScreenX(m.wx, 0.9);
        const tw = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.time * 1.5 + m.phase));
        ctx.fillStyle = `rgba(224, 242, 254, ${tw.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, m.y, m.r, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderSignalLamp(ctx: CanvasRenderingContext2D): void {
    const lx = this.worldToScreenX(this.lampWx, 1);
    const ly = this.lampY;
    const headY = ly - 44;

    // Beam of light stretching toward Earth when lamp shines!
    if (this.lampGlow > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const beam = ctx.createLinearGradient(lx, headY, this.cafeScreenX, this.cafeScreenY);
      beam.addColorStop(0, `rgba(254, 240, 138, ${(this.lampGlow * 0.72).toFixed(3)})`);
      beam.addColorStop(0.6, `rgba(186, 230, 253, ${(this.lampGlow * 0.34).toFixed(3)})`);
      beam.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.strokeStyle = beam;
      ctx.lineWidth = 10 + this.lampGlow * 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lx, headY);
      ctx.lineTo(this.cafeScreenX, this.cafeScreenY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${(this.lampGlow * 0.65).toFixed(3)})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // Post shadow
    ctx.fillStyle = "rgba(10, 15, 30, 0.45)";
    ctx.beginPath();
    ctx.ellipse(lx - 18, ly + 2, 22, 5, 0, 0, TAU);
    ctx.fill();

    // Slender metallic post
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, headY);
    ctx.stroke();

    // Lantern housing & glowing core
    const idlePulse = 0.75 + 0.25 * Math.sin(this.time * 2.5);
    const glowR = (22 + this.lampGlow * 34) * idlePulse;
    const lg = ctx.createRadialGradient(lx, headY, 2, lx, headY, glowR);
    lg.addColorStop(0, "#fffbeb");
    lg.addColorStop(0.35, `rgba(253, 224, 71, ${(0.55 + this.lampGlow * 0.42).toFixed(3)})`);
    lg.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, headY, glowR, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#fef08a";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(lx - 7, headY - 9, 14, 18, 4);
    ctx.fill();
    ctx.stroke();
  }

  private renderMoonflower(ctx: CanvasRenderingContext2D): void {
    const fx = this.worldToScreenX(this.flowerWx, 1);
    const fy = this.flowerY;

    // Little patch of darker lunar soil
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(fx, fy + 2, 24, 8, 0, 0, TAU);
    ctx.fill();

    const g = easeOutCubic(this.flowerGrowth);
    const stemH = lerp(10, 56, clamp(g / 0.55, 0, 1));
    const sway = this.reducedMotion ? 0 : Math.sin(this.time * 1.1) * 3.5 * g;
    const tipX = fx + sway;
    const tipY = fy - stemH;

    // Slender luminous silver-teal stem
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx - 4, fy - stemH * 0.5, tipX, tipY);
    ctx.stroke();

    // Unfurling leaves
    const leafG = clamp((g - 0.25) / 0.45, 0, 1);
    if (leafG > 0.02) {
      ctx.fillStyle = "#7dd3fc";
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.ellipse(fx - 9 * leafG, fy - stemH * 0.48, 10 * leafG, 4.2 * leafG, -0.5, 0, TAU);
      ctx.ellipse(fx + 9 * leafG, fy - stemH * 0.36, 10 * leafG, 4.2 * leafG, 0.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Glowing silver-blue flower bloom (or inviting pulsing bud before planted)
    const bloomG = clamp((g - 0.48) / 0.52, 0, 1);
    const haloR = lerp(16, 44, bloomG) * (0.9 + 0.1 * Math.sin(this.time * 2.8));
    const hg = ctx.createRadialGradient(tipX, tipY, 2, tipX, tipY, haloR);
    hg.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    hg.addColorStop(0.4, "rgba(186, 230, 253, 0.52)");
    hg.addColorStop(1, "rgba(186, 230, 253, 0)");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(tipX, tipY, haloR, 0, TAU);
    ctx.fill();

    if (bloomG <= 0.08) {
      // Closed luminous bud
      ctx.fillStyle = "#e0f2fe";
      ctx.beginPath();
      ctx.ellipse(tipX, tipY - 3, 5, 8.5, 0, 0, TAU);
      ctx.fill();
    } else {
      // Opening 6-petal luminous silver-blue moonflower
      const petalLen = lerp(9, 22, bloomG);
      const petalW = lerp(4, 9, bloomG);
      for (let p = 0; p < 6; p++) {
        const ang = (p / 6) * TAU - Math.PI * 0.5 + sway * 0.03;
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(ang);
        const pg = ctx.createLinearGradient(0, 0, 0, -petalLen);
        pg.addColorStop(0, "#ffffff");
        pg.addColorStop(0.6, "#bae6fd");
        pg.addColorStop(1, "#60a5fa");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(0, -petalLen * 0.55, petalW * 0.55, petalLen * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4.2, 0, TAU);
      ctx.fill();
    }
  }
}
