/**
 * Single Canvas 2D Atmosphere & Particle Layer for SunBloomScene
 * Renders fireflies, drifting cosmic petals/pollen, occasional shooting stars,
 * and (in Steps 3 & 5) the 150-particle celebrating firefly heart & click bursts
 * all in one unified pass synchronized to the SVG viewBox.
 */

import { HERO_BASE_X, HERO_BASE_Y, WORLD_H, WORLD_W } from "@/lib/flowerGrowth";
import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

export interface ViewBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
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
  isHeroAmbient: boolean; // first ~10 visible during growing/asking
}

interface FloatingPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  scale: number;
  color: string;
  phase: number;
}

interface ShootingStar {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  cooldown: number;
}

interface HeartParticle {
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  targetX: number;
  targetY: number;
  gatherDelay: number;
  gatherDur: number;
  burstX: number;
  burstY: number;
  landX: number;
  landY: number;
  r: number;
  color: string;
  phase: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
  isPetal: boolean;
}

export interface AtmosphereState {
  fireflies: Firefly[];
  petals: FloatingPetal[];
  heartParticles: HeartParticle[];
  burstParticles: BurstParticle[];
  shootingStar: ShootingStar;
  isMobile: boolean;
  seed: number;
}

const HEART_CENTER_X = HERO_BASE_X;
const HEART_CENTER_Y = 154;
const HEART_SCALE = 4.6;

function heartPoint(u: number): { x: number; y: number } {
  const s = Math.sin(u);
  const hx = 16 * s * s * s;
  const hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
  return {
    x: HEART_CENTER_X + hx * HEART_SCALE,
    y: HEART_CENTER_Y + hy * HEART_SCALE,
  };
}

/**
 * Realistic double-thump heartbeat envelope (lub-dub) for 3 beats across [0, 1].
 */
function heartbeatScale(u: number): number {
  const beat = (u * 3) % 1;
  const lub = Math.exp(-Math.pow((beat - 0.16) / 0.085, 2)) * 0.11;
  const dub = Math.exp(-Math.pow((beat - 0.34) / 0.075, 2)) * 0.065;
  return 1 + lub + dub;
}

export function createAtmosphereState(isMobile: boolean, seed = 20261124): AtmosphereState {
  const rng = createSeededRandom(seed);
  const fireflyCount = isMobile ? 20 : 42;
  const petalCount = isMobile ? 10 : 18;

  const fireflies: Firefly[] = Array.from({ length: fireflyCount }, (_, i) => {
    const isHeroAmbient = i < 10;
    return {
      x: isHeroAmbient
        ? randomRange(rng, WORLD_W * 0.32, WORLD_W * 0.68)
        : randomRange(rng, -240, WORLD_W + 240),
      y: isHeroAmbient
        ? randomRange(rng, 140, 510)
        : randomRange(rng, -180, 680),
      vx: randomRange(rng, -11, 11),
      vy: randomRange(rng, -8, 8),
      r: randomRange(rng, 1.5, 3.0),
      phase: randomRange(rng, 0, TAU),
      blinkSpeed: randomRange(rng, 1.2, 2.4),
      color: i % 3 === 0 ? "#fef08a" : i % 3 === 1 ? "#99f6e4" : "#fbcfe8",
      isHeroAmbient,
    };
  });

  const petals: FloatingPetal[] = Array.from({ length: petalCount }, (_, i) => ({
    x: randomRange(rng, -220, WORLD_W + 220),
    y: randomRange(rng, -160, 640),
    vx: randomRange(rng, 6, 16),
    vy: randomRange(rng, 12, 24),
    rot: randomRange(rng, 0, TAU),
    vRot: randomRange(rng, -0.9, 0.9),
    scale: randomRange(rng, 0.6, 1.15),
    color: i % 3 === 0 ? "#f472b6" : i % 3 === 1 ? "#c084fc" : "#fde047",
    phase: randomRange(rng, 0, TAU),
  }));

  const heartCount = isMobile ? 96 : 156;
  const heartPalette = ["#fef08a", "#f9a8d4", "#fbcfe8", "#fde68a", "#c4b5fd"];

  const heartParticles: HeartParticle[] = Array.from({ length: heartCount }, (_, i) => {
    const u = (i / heartCount) * TAU;
    const hp = heartPoint(u);
    const jitterR = randomRange(rng, -4.5, 4.5);
    const targetX = hp.x + Math.cos(u) * jitterR;
    const targetY = hp.y + Math.sin(u) * jitterR;

    // Gather from all across the visible scene along sweeping curved Bezier paths
    const startAngle = randomRange(rng, 0, TAU);
    const startDist = randomRange(rng, 210, 440);
    const startX = clamp(HEART_CENTER_X + Math.cos(startAngle) * startDist, 60, WORLD_W - 60);
    const startY = clamp(320 + Math.sin(startAngle) * startDist * 0.65, 85, 580);

    const midX = (startX + targetX) * 0.5;
    const midY = (startY + targetY) * 0.5;
    const swirlSign = i % 2 === 0 ? 1 : -1;
    const ctrlX = midX + swirlSign * randomRange(rng, 55, 135);
    const ctrlY = midY - randomRange(rng, 30, 110);

    // Burst outward from the heart center, then rain sparkles down onto the wide ground
    const dx = targetX - HEART_CENTER_X;
    const dy = targetY - HEART_CENTER_Y;
    const outLen = Math.hypot(dx, dy) || 1;
    const burstDist = randomRange(rng, 45, 135);
    const burstX = targetX + (dx / outLen) * burstDist;
    const burstY = targetY + (dy / outLen) * burstDist - randomRange(rng, 10, 35);

    const landX = clamp(
      HERO_BASE_X + (dx / outLen) * randomRange(rng, 70, 460) + randomRange(rng, -60, 60),
      80,
      WORLD_W - 80
    );
    const landY = HERO_BASE_Y + randomRange(rng, -12, 34);

    return {
      startX,
      startY,
      ctrlX,
      ctrlY,
      targetX,
      targetY,
      gatherDelay: randomRange(rng, 0, 0.52),
      gatherDur: randomRange(rng, 1.35, 1.65),
      burstX,
      burstY,
      landX,
      landY,
      r: randomRange(rng, 1.4, 2.9),
      color: heartPalette[i % heartPalette.length],
      phase: randomRange(rng, 0, TAU),
    };
  });

  return {
    fireflies,
    petals,
    heartParticles,
    burstParticles: [],
    shootingStar: {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1.1,
      cooldown: 4.5,
    },
    isMobile,
    seed,
  };
}

/**
 * Spawns a gentle decorative burst of petals and sparkles at (worldX, worldY)
 * when the user clicks a garden flower in the `alive` state.
 */
export function spawnGardenBurst(
  state: AtmosphereState,
  worldX: number,
  worldY: number,
  accentColor: string
) {
  const count = state.isMobile ? 12 : 18;
  const palette = [accentColor, "#fef08a", "#fbcfe8", "#c4b5fd", "#fffbeb"];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + (Math.random() - 0.5) * 0.4;
    const speed = 38 + Math.random() * 68;
    const isPetal = i % 3 === 0;
    state.burstParticles.push({
      x: worldX,
      y: worldY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 26,
      rot: Math.random() * TAU,
      vRot: (Math.random() - 0.5) * 4.5,
      r: isPetal ? 0.75 + Math.random() * 0.45 : 1.3 + Math.random() * 1.6,
      life: 0,
      maxLife: 1.15 + Math.random() * 0.65,
      color: palette[i % palette.length],
      isPetal,
    });
  }
  // Keep pool bounded for guaranteed 60fps even on rapid clicking
  if (state.burstParticles.length > 90) {
    state.burstParticles.splice(0, state.burstParticles.length - 90);
  }
}

/**
 * Advances and draws all atmosphere particles onto the single overlay canvas,
 * mapping SVG world coordinates accurately through the current `viewBox`.
 */
export function renderAtmosphereFrame(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  vb: ViewBoxRect,
  state: AtmosphereState,
  dt: number,
  timeSec: number,
  atmosG: number,
  deathD: number,
  celebrateSec = -1
) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (canvasW <= 0 || canvasH <= 0 || vb.w <= 0 || vb.h <= 0) return;

  // Match SVG preserveAspectRatio="xMidYMid meet"
  const scale = Math.min(canvasW / vb.w, canvasH / vb.h);
  const offsetX = (canvasW - vb.w * scale) * 0.5;
  const offsetY = (canvasH - vb.h * scale) * 0.5;

  const toCanvasX = (wx: number) => offsetX + (wx - vb.x) * scale;
  const toCanvasY = (wy: number) => offsetY + (wy - vb.y) * scale;

  const deathFade = deathD > 0 ? clamp(1 - deathD / 0.35, 0, 1) : 1;
  if (deathFade <= 0.005) return;

  ctx.save();

  // 1. Occasional shooting star (only when atmosphere is visible)
  const ss = state.shootingStar;
  if (atmosG > 0.35 && deathD <= 0.001) {
    if (!ss.active) {
      ss.cooldown -= dt;
      if (ss.cooldown <= 0) {
        ss.active = true;
        ss.life = 0;
        ss.maxLife = 1.05;
        ss.x = vb.x + vb.w * (0.12 + (Math.sin(timeSec * 12.7) * 0.5 + 0.5) * 0.42);
        ss.y = vb.y + vb.h * (0.06 + (Math.cos(timeSec * 7.3) * 0.5 + 0.5) * 0.16);
        ss.vx = 320;
        ss.vy = 115;
        ss.cooldown = 7.5 + ((Math.sin(timeSec * 3.1) * 0.5 + 0.5) * 4.5);
      }
    } else {
      ss.life += dt;
      ss.x += ss.vx * dt;
      ss.y += ss.vy * dt;
      const p = ss.life / ss.maxLife;
      if (p >= 1) {
        ss.active = false;
      } else {
        const alpha = Math.sin(p * Math.PI) * 0.78 * atmosG;
        const hx = toCanvasX(ss.x);
        const hy = toCanvasY(ss.y);
        const tx = toCanvasX(ss.x - ss.vx * 0.22);
        const ty = toCanvasY(ss.y - ss.vy * 0.22);
        const grad = ctx.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0, `rgba(255, 251, 235, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.4, `rgba(196, 181, 253, ${(alpha * 0.55).toFixed(3)})`);
        grad.addColorStop(1, "rgba(196, 181, 253, 0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.2, 2.0 * scale);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
  }

  // 2. Floating petals & pollen drifting on the shared wind (visible with garden atmosphere)
  if (atmosG > 0.01) {
    for (const p of state.petals) {
      const windX = Math.sin(timeSec * 0.85 - p.x * 0.004) * 14;
      p.x += (p.vx + windX) * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;

      if (p.x > WORLD_W + 260) p.x = -240;
      if (p.x < -260) p.x = WORLD_W + 240;
      if (p.y > 700) {
        p.y = -180;
        p.x = ((p.x + 340) % (WORLD_W + 400)) - 200;
      }

      const cx = toCanvasX(p.x);
      const cy = toCanvasY(p.y);
      const edgeFade =
        clamp((p.y - 30) / 70, 0, 1) * clamp((WORLD_H - 60 - p.y) / 90, 0, 1);
      const alpha = edgeFade * atmosG * 0.5 * deathFade;
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(p.rot);
      ctx.scale(p.scale * scale, p.scale * scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-3.5, -3.5, -2.5, -9.5, 0, -12);
      ctx.bezierCurveTo(2.5, -9.5, 3.5, -3.5, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  // 3. Ambient fireflies (~10 around hero during growing/asking; ~40 desktop / 20 mobile with garden)
  ctx.globalCompositeOperation = "lighter";
  for (const ff of state.fireflies) {
    const vis = ff.isHeroAmbient ? 1 : atmosG;
    if (vis <= 0.01) continue;

    // Gentle wandering drift with soft wind nudge
    ff.x += (ff.vx + Math.sin(timeSec * 0.7 + ff.phase) * 9) * dt;
    ff.y += (ff.vy + Math.cos(timeSec * 0.6 + ff.phase) * 7) * dt;

    const minX = ff.isHeroAmbient ? WORLD_W * 0.24 : -260;
    const maxX = ff.isHeroAmbient ? WORLD_W * 0.76 : WORLD_W + 260;
    if (ff.x < minX) ff.vx = Math.abs(ff.vx);
    if (ff.x > maxX) ff.vx = -Math.abs(ff.vx);
    if (ff.y < -190) ff.vy = Math.abs(ff.vy);
    if (ff.y > 685) ff.vy = -Math.abs(ff.vy);

    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * ff.blinkSpeed + ff.phase));
    const alpha = pulse * vis * deathFade * 0.85;
    if (alpha <= 0.01) continue;

    const cx = toCanvasX(ff.x);
    const cy = toCanvasY(ff.y);
    const rad = Math.max(1.2, ff.r * scale);

    // Soft outer glow
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = ff.color;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 3.2, 0, TAU);
    ctx.fill();

    // Bright core
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.85, 0, TAU);
    ctx.fill();
  }

  // 4. Celebrating Firefly Heart Finale (gather 0..2.1s -> 3 heartbeats 2.1..4.3s -> burst & rain 4.3..6.6s)
  if (celebrateSec >= 0 && celebrateSec <= 6.8 && deathD <= 0.001) {
    const pulseU = clamp((celebrateSec - 2.05) / 2.25, 0, 1);
    const beatScale = celebrateSec >= 2.05 && celebrateSec <= 4.35 ? heartbeatScale(pulseU) : 1;

    // Soft rose-gold radial halo breathing behind the heart during pulse phase
    if (celebrateSec > 1.2 && celebrateSec < 4.8) {
      const haloIn = clamp((celebrateSec - 1.2) / 0.9, 0, 1);
      const haloOut = celebrateSec > 4.25 ? clamp(1 - (celebrateSec - 4.25) / 0.55, 0, 1) : 1;
      const haloAlpha = haloIn * haloOut * (0.28 + (beatScale - 1) * 1.4);
      const hx = toCanvasX(HEART_CENTER_X);
      const hy = toCanvasY(HEART_CENTER_Y + 6);
      const hr = 118 * beatScale * scale;
      const haloGrad = ctx.createRadialGradient(hx, hy, 4, hx, hy, hr);
      haloGrad.addColorStop(0, `rgba(253, 224, 71, ${(haloAlpha * 0.75).toFixed(3)})`);
      haloGrad.addColorStop(0.45, `rgba(236, 72, 153, ${(haloAlpha * 0.52).toFixed(3)})`);
      haloGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, TAU);
      ctx.fill();
    }

    const burstStart = 4.3;
    for (const hp of state.heartParticles) {
      let wx = hp.targetX;
      let wy = hp.targetY;
      let alpha = 1;
      let radScale = 1;

      if (celebrateSec < burstStart) {
        const gRaw = clamp((celebrateSec - hp.gatherDelay) / hp.gatherDur, 0, 1);
        const g = easeInOutCubic(gRaw);
        const inv = 1 - g;
        // Quadratic Bezier curved gather path
        const bx = inv * inv * hp.startX + 2 * inv * g * hp.ctrlX + g * g * hp.targetX;
        const by = inv * inv * hp.startY + 2 * inv * g * hp.ctrlY + g * g * hp.targetY;

        // Apply heartbeat scale around heart center once settled
        const dx = bx - HEART_CENTER_X;
        const dy = by - HEART_CENTER_Y;
        const settledScale = lerp(1, beatScale, g);
        const shimmer = g > 0.85 ? Math.sin(timeSec * 4.5 + hp.phase) * 1.6 : 0;
        wx = HEART_CENTER_X + dx * settledScale + shimmer;
        wy = HEART_CENTER_Y + dy * settledScale + Math.cos(timeSec * 3.8 + hp.phase) * (g > 0.85 ? 1.4 : 0);

        const fadeIn = clamp(gRaw * 3.2, 0, 1);
        const twinkle = 0.72 + 0.28 * Math.sin(timeSec * 5.2 + hp.phase);
        alpha = fadeIn * twinkle * (0.85 + (beatScale - 1) * 1.2);
        radScale = 0.85 + 0.3 * g + (beatScale - 1) * 1.8;
      } else {
        // Burst outward (0..0.38s) then sparkle-shower down to the ground (0.38..2.2s)
        const bElapsed = celebrateSec - burstStart;
        const popG = easeOutCubic(clamp(bElapsed / 0.42, 0, 1));
        const fallG = clamp((bElapsed - 0.22) / 1.85, 0, 1);
        const grav = Math.pow(fallG, 1.55);

        const expX = lerp(hp.targetX, hp.burstX, popG);
        const expY = lerp(hp.targetY, hp.burstY, popG);
        wx = lerp(expX, hp.landX, easeOutCubic(fallG)) + Math.sin(fallG * Math.PI * 2 + hp.phase) * 12 * (1 - fallG);
        wy = lerp(expY, hp.landY, grav);

        const sparkFade = fallG > 0.72 ? clamp(1 - (fallG - 0.72) / 0.28, 0, 1) : 1;
        const twinkle = 0.65 + 0.35 * Math.sin(timeSec * 9.0 + hp.phase);
        alpha = sparkFade * twinkle;
        radScale = lerp(1.35, 0.55, fallG);
      }

      if (alpha <= 0.01) continue;
      const cx = toCanvasX(wx);
      const cy = toCanvasY(wy);
      const rad = Math.max(1.1, hp.r * radScale * scale);

      ctx.globalAlpha = clamp(alpha * 0.38, 0, 1);
      ctx.fillStyle = hp.color;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 3.1, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = "#fffbeb";
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 0.85, 0, TAU);
      ctx.fill();
    }
  }

  // 5. Decorative Click-Burst Petals & Sparkles from Garden Flowers (alive state)
  if (state.burstParticles.length > 0) {
    for (let i = state.burstParticles.length - 1; i >= 0; i--) {
      const bp = state.burstParticles[i];
      bp.life += dt;
      if (bp.life >= bp.maxLife) {
        state.burstParticles.splice(i, 1);
        continue;
      }
      bp.vy += 42 * dt; // soft gravity
      bp.vx *= 1 - 0.85 * dt;
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
      bp.rot += bp.vRot * dt;

      const p = bp.life / bp.maxLife;
      const alpha = (1 - p * p) * 0.9 * deathFade;
      const cx = toCanvasX(bp.x);
      const cy = toCanvasY(bp.y);

      if (bp.isPetal) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(bp.rot);
        ctx.scale(bp.r * scale, bp.r * scale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = bp.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-3.2, -3.2, -2.4, -8.5, 0, -11);
        ctx.bezierCurveTo(2.4, -8.5, 3.2, -3.2, 0, 0);
        ctx.fill();
        ctx.restore();
      } else {
        const rad = Math.max(1.0, bp.r * scale * (1 - p * 0.35));
        ctx.globalAlpha = alpha * 0.38;
        ctx.fillStyle = bp.color;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 2.8, 0, TAU);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fffbeb";
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.85, 0, TAU);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}
