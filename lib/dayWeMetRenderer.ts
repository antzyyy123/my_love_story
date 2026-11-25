/**
 * Canvas 2D Renderer for "The Day We Met" — Two Drifting Stars & Constellation of Us
 * Pre-renders deep-space nebula clouds & Milky Way galaxy band to an offscreen canvas,
 * and animates 3-layer parallax stars, shooting stars, spring-dragged Gold & Rose stars,
 * proximity light thread, magnetic merge burst, and the 6-star Constellation of Us
 * (with a blooming 5-petal light flower on the final star).
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

interface ParallaxStar {
  x: number;
  y: number;
  r: number;
  layer: 0 | 1 | 2; // 0=far, 1=mid, 2=near
  phase: number;
  color: string;
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

interface TrailDot {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  isPetal: boolean;
  rot: number;
  size: number;
}

interface MergeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  isPetal: boolean;
  rot: number;
  vRot: number;
  size: number;
}

export interface HeroStar {
  id: "gold" | "rose";
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  phase: number;
  coreColor: string;
  glowColor: string;
}

export interface ConstellationNode {
  index: number;
  x: number;
  y: number;
  igniteSec: number; // time after merge when this star ignites
}

export interface DayWeMetState {
  w: number;
  h: number;
  dpr: number;
  isPortrait: boolean;
  isMobile: boolean;
  staticCanvas: HTMLCanvasElement;
  bgStars: ParallaxStar[];
  shootingStar: ShootingStar;
  gold: HeroStar;
  rose: HeroStar;
  dragging: "gold" | "rose" | null;
  pointerX: number;
  pointerY: number;
  autoBring: boolean;
  trails: TrailDot[];
  trailAccum: number;
  mergeParticles: MergeParticle[];
  merged: boolean;
  mergeElapsed: number;
  mergeOriginX: number;
  mergeOriginY: number;
  splitting: boolean;
  splitElapsed: number;
  nodes: ConstellationNode[];
  selectedNodeIdx: number | null;
}

function computeConstellationNodes(
  w: number,
  h: number,
  isPortrait: boolean,
  count = 6
): ConstellationNode[] {
  const n = Math.max(2, count);
  if (isPortrait) {
    // Graceful vertical S-arc across the portrait sky (top-to-bottom, centered, leaving room for controls)
    if (n === 6) {
      const pts: Array<[number, number]> = [
        [0.34, 0.22],
        [0.62, 0.31],
        [0.42, 0.43],
        [0.66, 0.54],
        [0.38, 0.66],
        [0.54, 0.77],
      ];
      return pts.map(([fx, fy], index) => ({
        index,
        x: w * fx,
        y: h * fy,
        igniteSec: index * 1.2,
      }));
    }
    return Array.from({ length: n }, (_, index) => {
      const t = index / (n - 1);
      const fx = 0.5 + (index % 2 === 0 ? -0.14 : 0.14) * (1 - Math.abs(t - 0.5) * 0.4);
      const fy = lerp(0.22, 0.77, t);
      return { index, x: w * fx, y: h * fy, igniteSec: index * 1.2 };
    });
  }

  // Graceful rising arc across the landscape sky (shifted slightly left so desktop right panel never covers it)
  if (n === 6) {
    const pts: Array<[number, number]> = [
      [0.14, 0.64],
      [0.26, 0.52],
      [0.38, 0.58],
      [0.50, 0.42],
      [0.62, 0.47],
      [0.74, 0.31],
    ];
    return pts.map(([fx, fy], index) => ({
      index,
      x: w * fx,
      y: h * fy,
      igniteSec: index * 1.2,
    }));
  }
  return Array.from({ length: n }, (_, index) => {
    const t = index / (n - 1);
    const fx = lerp(0.14, 0.74, t);
    const wave = (index % 2 === 0 ? 0.045 : -0.045);
    const fy = lerp(0.62, 0.32, t) + wave;
    return { index, x: w * fx, y: h * fy, igniteSec: index * 1.2 };
  });
}

function buildStaticLayer(state: DayWeMetState) {
  const { w, h, dpr } = state;
  const off = state.staticCanvas;
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 1. Deep-Space Midnight Gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#040410");
  bg.addColorStop(0.5, "#090820");
  bg.addColorStop(1, "#050413");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 2. Faint Diagonal Galaxy Band
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-0.36);
  const bandGrad = ctx.createLinearGradient(0, -h * 0.28, 0, h * 0.28);
  bandGrad.addColorStop(0, "rgba(139, 92, 246, 0)");
  bandGrad.addColorStop(0.35, "rgba(99, 102, 241, 0.08)");
  bandGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.09)");
  bandGrad.addColorStop(0.65, "rgba(139, 92, 246, 0.07)");
  bandGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
  ctx.fillStyle = bandGrad;
  ctx.fillRect(-Math.max(w, h), -h * 0.28, Math.max(w, h) * 2, h * 0.56);
  ctx.restore();

  // 3. Soft Nebula Clouds in Violet, Blue & Rose
  const clouds = [
    { x: w * 0.22, y: h * 0.3, r: Math.max(w, h) * 0.36, color: "rgba(124, 58, 237, 0.14)" },
    { x: w * 0.78, y: h * 0.66, r: Math.max(w, h) * 0.38, color: "rgba(236, 72, 153, 0.12)" },
    { x: w * 0.62, y: h * 0.22, r: Math.max(w, h) * 0.32, color: "rgba(56, 189, 248, 0.10)" },
    { x: w * 0.34, y: h * 0.74, r: Math.max(w, h) * 0.3, color: "rgba(168, 85, 247, 0.11)" },
  ];
  for (const cl of clouds) {
    const g = ctx.createRadialGradient(cl.x, cl.y, 10, cl.x, cl.y, cl.r);
    g.addColorStop(0, cl.color);
    g.addColorStop(1, "rgba(4, 4, 16, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

export function createDayWeMetState(
  cssW: number,
  cssH: number,
  dpr: number,
  reducedMotion = false,
  starCount = 6,
  seed = 20261124
): DayWeMetState {
  const rng = createSeededRandom(seed + 909);
  const w = Math.max(320, cssW);
  const h = Math.max(320, cssH);
  const isPortrait = w / h <= 1.2;
  const isMobile = w < 768;

  const bgCount = isMobile ? 95 : 175;
  const bgStars: ParallaxStar[] = Array.from({ length: bgCount }, (_, i) => ({
    x: randomRange(rng, 0, w),
    y: randomRange(rng, 0, h),
    r: i % 5 === 0 ? randomRange(rng, 1.3, 2.0) : randomRange(rng, 0.45, 1.2),
    layer: (i % 3) as 0 | 1 | 2,
    phase: randomRange(rng, 0, TAU),
    color: i % 5 === 0 ? "#fde68a" : i % 4 === 0 ? "#fbcfe8" : i % 3 === 0 ? "#bae6fd" : "#f8fafc",
  }));

  // Starting positions:
  // Landscape: Gold far left, Rose far right. Portrait: Gold top-left, Rose bottom-right.
  // Reduced motion: start close near center so a single tap merges them cleanly.
  const goldHomeX = reducedMotion ? w * 0.43 : isPortrait ? w * 0.24 : w * 0.18;
  const goldHomeY = reducedMotion ? h * 0.48 : isPortrait ? h * 0.27 : h * 0.5;
  const roseHomeX = reducedMotion ? w * 0.57 : isPortrait ? w * 0.76 : w * 0.82;
  const roseHomeY = reducedMotion ? h * 0.52 : isPortrait ? h * 0.7 : h * 0.5;

  const state: DayWeMetState = {
    w,
    h,
    dpr,
    isPortrait,
    isMobile,
    staticCanvas: document.createElement("canvas"),
    bgStars,
    shootingStar: {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1.0,
      cooldown: 4.5,
    },
    gold: {
      id: "gold",
      x: goldHomeX,
      y: goldHomeY,
      vx: 0,
      vy: 0,
      homeX: goldHomeX,
      homeY: goldHomeY,
      phase: 0.4,
      coreColor: "#fef08a",
      glowColor: "rgba(251, 191, 36, 0.55)",
    },
    rose: {
      id: "rose",
      x: roseHomeX,
      y: roseHomeY,
      vx: 0,
      vy: 0,
      homeX: roseHomeX,
      homeY: roseHomeY,
      phase: 2.8,
      coreColor: "#fbcfe8",
      glowColor: "rgba(244, 114, 182, 0.55)",
    },
    dragging: null,
    pointerX: w * 0.5,
    pointerY: h * 0.5,
    autoBring: false,
    trails: [],
    trailAccum: 0,
    mergeParticles: [],
    merged: false,
    mergeElapsed: 0,
    mergeOriginX: w * 0.5,
    mergeOriginY: h * 0.5,
    splitting: false,
    splitElapsed: 0,
    nodes: computeConstellationNodes(w, h, isPortrait, starCount),
    selectedNodeIdx: null,
  };

  buildStaticLayer(state);
  return state;
}

export function triggerStarMerge(state: DayWeMetState) {
  if (state.merged) return;
  const mx = (state.gold.x + state.rose.x) * 0.5;
  const my = (state.gold.y + state.rose.y) * 0.5;
  state.merged = true;
  state.splitting = false;
  state.dragging = null;
  state.autoBring = false;
  state.mergeElapsed = 0;
  state.mergeOriginX = mx;
  state.mergeOriginY = my;
  state.gold.x = mx;
  state.gold.y = my;
  state.rose.x = mx;
  state.rose.y = my;

  // Expanding ring of petals and sparkles across the sky
  const count = state.isMobile ? 34 : 58;
  const palette = ["#fef08a", "#fbcfe8", "#fffbeb", "#c4b5fd", "#f472b6"];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * TAU + (i % 3) * 0.08;
    const speed = 75 + (i % 5) * 32;
    state.mergeParticles.push({
      x: mx,
      y: my,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0,
      maxLife: 1.5 + (i % 4) * 0.3,
      color: palette[i % palette.length],
      isPetal: i % 3 === 0,
      rot: ang,
      vRot: (i % 2 === 0 ? 1 : -1) * 2.4,
      size: i % 3 === 0 ? 5.5 : 2.1,
    });
  }
}

export function startReplaySplit(state: DayWeMetState) {
  state.merged = false;
  state.splitting = true;
  state.splitElapsed = 0;
  state.autoBring = false;
  state.dragging = null;
  state.selectedNodeIdx = null;
  const n0 = state.nodes[0];
  state.gold.x = n0.x;
  state.gold.y = n0.y;
  state.rose.x = n0.x;
  state.rose.y = n0.y;
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  coreColor: string,
  haloColor: string,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";

  // Soft outer halo
  const halo = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius * 3.6);
  halo.addColorStop(0, haloColor);
  halo.addColorStop(0.5, haloColor.replace(/[\d.]+\)$/, "0.14)"));
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.6, 0, TAU);
  ctx.fill();

  // 4-point sparkle flare
  ctx.fillStyle = coreColor;
  const spike = radius * 2.1;
  const thin = radius * 0.24;
  ctx.beginPath();
  ctx.moveTo(x, y - spike);
  ctx.quadraticCurveTo(x + thin, y - thin, x + spike, y);
  ctx.quadraticCurveTo(x + thin, y + thin, x, y + spike);
  ctx.quadraticCurveTo(x - thin, y + thin, x - spike, y);
  ctx.quadraticCurveTo(x - thin, y - thin, x, y - spike);
  ctx.closePath();
  ctx.fill();

  // Bright star core
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function renderDayWeMetFrame(
  ctx: CanvasRenderingContext2D,
  state: DayWeMetState,
  dt: number,
  elapsed: number,
  reducedMotion: boolean,
  onMerged?: () => void
) {
  const { w, h, gold, rose } = state;

  // 1. Pre-rendered Deep-Space Sky, Galaxy Band & Nebula
  ctx.drawImage(state.staticCanvas, 0, 0, w, h);

  // Compute proximity before merge (0 = far, 1 = touching)
  const maxSpan = Math.hypot(w, h) * 0.65;
  const starDist = Math.hypot(gold.x - rose.x, gold.y - rose.y);
  const prox = state.merged ? 1 : clamp(1 - starDist / maxSpan, 0, 1);

  // 2. Warming Nebula Glow as stars draw closer or merge
  if (prox > 0.08) {
    const mx = (gold.x + rose.x) * 0.5;
    const my = (gold.y + rose.y) * 0.5;
    const warmR = Math.max(w, h) * (0.35 + prox * 0.28);
    const wg = ctx.createRadialGradient(mx, my, 8, mx, my, warmR);
    wg.addColorStop(0, `rgba(253, 224, 71, ${(prox * 0.14).toFixed(3)})`);
    wg.addColorStop(0.45, `rgba(244, 114, 182, ${(prox * 0.11).toFixed(3)})`);
    wg.addColorStop(1, "rgba(139, 92, 246, 0)");
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, h);
  }

  // 3. Three Parallax Background Star Layers (nearby stars twinkle faster as proximity increases!)
  for (const st of state.bgStars) {
    if (!reducedMotion) {
      const drift = (st.layer + 1) * 1.6;
      st.x = (st.x + drift * dt) % w;
    }
    const nearDist = Math.min(
      Math.hypot(st.x - gold.x, st.y - gold.y),
      Math.hypot(st.x - rose.x, st.y - rose.y)
    );
    const boost = nearDist < 170 ? (1 - nearDist / 170) * prox * 4.5 : 0;
    const tw = 0.35 + 0.65 * Math.sin(elapsed * (1.2 + st.layer * 0.4 + boost) + st.phase);
    ctx.globalAlpha = (0.32 + st.layer * 0.22) * tw;
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 4. Occasional Distant Shooting Star
  if (!reducedMotion) {
    const ss = state.shootingStar;
    if (!ss.active) {
      ss.cooldown -= dt;
      if (ss.cooldown <= 0) {
        ss.active = true;
        ss.life = 0;
        ss.maxLife = 0.95;
        ss.x = w * (0.15 + ((Math.sin(elapsed * 5.7) * 0.5 + 0.5) * 0.5));
        ss.y = h * (0.08 + ((Math.cos(elapsed * 3.3) * 0.5 + 0.5) * 0.25));
        ss.vx = 340;
        ss.vy = 135;
        ss.cooldown = 6.5 + ((Math.sin(elapsed * 2.1) * 0.5 + 0.5) * 5.0);
      }
    } else {
      ss.life += dt;
      ss.x += ss.vx * dt;
      ss.y += ss.vy * dt;
      const p = ss.life / ss.maxLife;
      if (p >= 1) {
        ss.active = false;
      } else {
        const a = Math.sin(p * Math.PI) * 0.72;
        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * 0.2, ss.y - ss.vy * 0.2);
        grad.addColorStop(0, `rgba(255, 251, 235, ${a.toFixed(3)})`);
        grad.addColorStop(1, "rgba(196, 181, 253, 0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.vx * 0.2, ss.y - ss.vy * 0.2);
        ctx.stroke();
      }
    }
  }

  // 5. Physics & Interaction for the Two Stars (Before Merge)
  if (!state.merged) {
    if (state.splitting) {
      state.splitElapsed += dt;
      const sp = clamp(state.splitElapsed / 1.4, 0, 1);
      const e = easeOutCubic(sp);
      gold.x = lerp(state.nodes[0].x, gold.homeX, e);
      gold.y = lerp(state.nodes[0].y, gold.homeY, e);
      rose.x = lerp(state.nodes[0].x, rose.homeX, e);
      rose.y = lerp(state.nodes[0].y, rose.homeY, e);
      if (sp >= 1) state.splitting = false;
    } else if (state.autoBring) {
      const cx = w * 0.5;
      const cy = h * 0.48;
      const pull = Math.min(1, dt * 3.2);
      gold.x = lerp(gold.x, cx, pull);
      gold.y = lerp(gold.y, cy, pull);
      rose.x = lerp(rose.x, cx, pull);
      rose.y = lerp(rose.y, cy, pull);
    } else if (state.dragging) {
      const active = state.dragging === "gold" ? gold : rose;
      const other = state.dragging === "gold" ? rose : gold;
      // Soft spring toward pointer (smooth lag, never snapping)
      const spring = Math.min(1, dt * 9.5);
      active.x = lerp(active.x, clamp(state.pointerX, 24, w - 24), spring);
      active.y = lerp(active.y, clamp(state.pointerY, 24, h - 24), spring);
      // Other star gently drifts toward the dragged star (easy on phones!)
      const assist = Math.min(1, dt * 0.85);
      other.x = lerp(other.x, active.x, assist);
      other.y = lerp(other.y, active.y, assist);
    } else if (!reducedMotion) {
      // Gentle wandering drift back around their opposite sides
      const wanderGX = gold.homeX + Math.sin(elapsed * 0.55 + gold.phase) * 28;
      const wanderGY = gold.homeY + Math.cos(elapsed * 0.42 + gold.phase) * 24;
      const wanderRX = rose.homeX + Math.cos(elapsed * 0.5 + rose.phase) * 28;
      const wanderRY = rose.homeY + Math.sin(elapsed * 0.45 + rose.phase) * 24;
      const driftBack = Math.min(1, dt * 0.55);
      gold.x = lerp(gold.x, wanderGX, driftBack);
      gold.y = lerp(gold.y, wanderGY, driftBack);
      rose.x = lerp(rose.x, wanderRX, driftBack);
      rose.y = lerp(rose.y, wanderRY, driftBack);
    }

    // Gentle magnetic pull when close (< 105px) -> merge at 60px!
    const dNow = Math.hypot(gold.x - rose.x, gold.y - rose.y);
    if (dNow < 105 && !state.splitting) {
      const mag = clamp((105 - dNow) / 45, 0, 1) * Math.min(1, dt * 5.5);
      const midX = (gold.x + rose.x) * 0.5;
      const midY = (gold.y + rose.y) * 0.5;
      gold.x = lerp(gold.x, midX, mag);
      gold.y = lerp(gold.y, midY, mag);
      rose.x = lerp(rose.x, midX, mag);
      rose.y = lerp(rose.y, midY, mag);
    }
    if (dNow <= 60 && !state.splitting) {
      triggerStarMerge(state);
      onMerged?.();
    }

    // Spawn fading stardust & petal trails behind each star
    if (!reducedMotion) {
      state.trailAccum += dt;
      const interval = state.isMobile ? 0.06 : 0.038;
      if (state.trailAccum >= interval) {
        state.trailAccum = 0;
        const maxTrails = state.isMobile ? 42 : 76;
        if (state.trails.length < maxTrails) {
          state.trails.push(
            {
              x: gold.x + (Math.random() - 0.5) * 6,
              y: gold.y + (Math.random() - 0.5) * 6,
              life: 0,
              maxLife: 1.25,
              color: "#fde047",
              isPetal: Math.random() < 0.28,
              rot: Math.random() * TAU,
              size: 2.2,
            },
            {
              x: rose.x + (Math.random() - 0.5) * 6,
              y: rose.y + (Math.random() - 0.5) * 6,
              life: 0,
              maxLife: 1.25,
              color: "#f9a8d4",
              isPetal: Math.random() < 0.28,
              rot: Math.random() * TAU,
              size: 2.2,
            }
          );
        }
      }
    }

    // Thin glowing thread of light stretching between the two stars as they approach
    if (prox > 0.12) {
      const threadA = easeInOutCubic(clamp((prox - 0.12) / 0.88, 0, 1));
      const tGrad = ctx.createLinearGradient(gold.x, gold.y, rose.x, rose.y);
      tGrad.addColorStop(0, `rgba(254, 240, 138, ${(threadA * 0.78).toFixed(3)})`);
      tGrad.addColorStop(0.5, `rgba(255, 251, 235, ${(threadA * 0.92).toFixed(3)})`);
      tGrad.addColorStop(1, `rgba(249, 168, 212, ${(threadA * 0.78).toFixed(3)})`);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = 1.0 + threadA * 2.4;
      ctx.beginPath();
      const midX = (gold.x + rose.x) * 0.5;
      const midY = (gold.y + rose.y) * 0.5 - Math.sin(elapsed * 3) * 14 * (1 - threadA);
      ctx.moveTo(gold.x, gold.y);
      ctx.quadraticCurveTo(midX, midY, rose.x, rose.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 6. Update & Draw Fading Star Trails
  for (let i = state.trails.length - 1; i >= 0; i--) {
    const tr = state.trails[i];
    tr.life += dt;
    if (tr.life >= tr.maxLife) {
      state.trails.splice(i, 1);
      continue;
    }
    const p = tr.life / tr.maxLife;
    const a = (1 - p) * (0.55 + prox * 0.35);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = tr.color;
    if (tr.isPetal) {
      ctx.translate(tr.x, tr.y);
      ctx.rotate(tr.rot + p);
      ctx.beginPath();
      ctx.ellipse(0, 0, tr.size * 1.9 * (1 - p * 0.4), tr.size * 0.85 * (1 - p * 0.4), 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.size * (1 - p * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw the two separate stars when not merged
  if (!state.merged) {
    const syncPulse = 1 + Math.sin(elapsed * (2.6 + prox * 3.0)) * (0.08 + prox * 0.08);
    const baseR = (state.isMobile ? 12 : 14.5) * (1 + prox * 0.22) * syncPulse;
    drawFourPointStar(ctx, gold.x, gold.y, baseR, gold.coreColor, gold.glowColor, 1);
    drawFourPointStar(ctx, rose.x, rose.y, baseR, rose.coreColor, rose.glowColor, 1);
  }

  // 7. Merge Burst Ring + The 6-Star Constellation of Us
  if (state.merged) {
    state.mergeElapsed += dt;
    const me = state.mergeElapsed;

    // Soft golden-rose merge flash (0..0.9s)
    if (me < 0.95) {
      const fA = Math.sin((me / 0.95) * Math.PI) * 0.45;
      const fg = ctx.createRadialGradient(
        state.mergeOriginX,
        state.mergeOriginY,
        4,
        state.mergeOriginX,
        state.mergeOriginY,
        Math.max(w, h) * 0.45
      );
      fg.addColorStop(0, `rgba(255, 251, 235, ${fA.toFixed(3)})`);
      fg.addColorStop(0.45, `rgba(253, 224, 71, ${(fA * 0.55).toFixed(3)})`);
      fg.addColorStop(1, "rgba(244, 114, 182, 0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, h);
    }

    // Star 0 (the merged star) glides smoothly from merge point to nodes[0]
    const n0 = state.nodes[0];
    const settleG = easeInOutCubic(clamp(me / 1.15, 0, 1));
    const star0X = lerp(state.mergeOriginX, n0.x, settleG);
    const star0Y = lerp(state.mergeOriginY, n0.y, settleG);

    // Draw glowing constellation threads that draw themselves from star to star
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 1; i < state.nodes.length; i++) {
      const prev = i === 1 ? { x: star0X, y: star0Y } : state.nodes[i - 1];
      const curr = state.nodes[i];
      const threadStart = curr.igniteSec - 0.85;
      const tg = easeInOutCubic(clamp((me - threadStart) / 0.85, 0, 1));
      if (tg <= 0.01) continue;

      const ex = lerp(prev.x, curr.x, tg);
      const ey = lerp(prev.y, curr.y, tg);
      const grad = ctx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
      grad.addColorStop(0, "rgba(254, 240, 138, 0.72)");
      grad.addColorStop(0.5, "rgba(255, 251, 235, 0.85)");
      grad.addColorStop(1, "rgba(249, 168, 212, 0.72)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();

    // Draw all 6 Constellation Stars
    for (let i = 0; i < state.nodes.length; i++) {
      const nd = state.nodes[i];
      const sx = i === 0 ? star0X : nd.x;
      const sy = i === 0 ? star0Y : nd.y;
      const ig = i === 0 ? 1 : easeOutCubic(clamp((me - nd.igniteSec) / 0.6, 0, 1));
      if (ig <= 0.01) continue;

      const isSelected = state.selectedNodeIdx === i;
      const shimmer = 0.92 + 0.08 * Math.sin(elapsed * 2.4 + i * 1.1);
      const r = (i === 0 ? 15.5 : 11.5) * ig * shimmer * (isSelected ? 1.32 : 1);

      // Swirling dual-color halo on the merged first star
      if (i === 0) {
        const swAng = elapsed * 1.2;
        drawFourPointStar(
          ctx,
          sx + Math.cos(swAng) * 3,
          sy + Math.sin(swAng) * 3,
          r * 0.85,
          "#fbcfe8",
          "rgba(244, 114, 182, 0.42)",
          0.75
        );
      }

      // Final star (#6 "Today") blooms into a glowing 5-petal flower made of light!
      if (i === state.nodes.length - 1) {
        const bloomG = easeInOutCubic(clamp((me - (nd.igniteSec + 0.25)) / 1.15, 0, 1));
        if (bloomG > 0.02) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.globalCompositeOperation = "lighter";
          const pLen = (state.isMobile ? 18 : 22) * bloomG * (isSelected ? 1.2 : 1);
          const pW = (state.isMobile ? 7 : 8.5) * bloomG;
          for (let p = 0; p < 5; p++) {
            const ang = (p / 5) * TAU + (reducedMotion ? 0 : Math.sin(elapsed * 0.8) * 0.06);
            ctx.save();
            ctx.rotate(ang);
            const pGrad = ctx.createLinearGradient(0, 0, 0, -pLen);
            pGrad.addColorStop(0, "rgba(255, 251, 235, 0.92)");
            pGrad.addColorStop(0.5, "rgba(249, 168, 212, 0.72)");
            pGrad.addColorStop(1, "rgba(196, 181, 253, 0.25)");
            ctx.fillStyle = pGrad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-pW, -pLen * 0.35, -pW * 0.65, -pLen * 0.85, 0, -pLen);
            ctx.bezierCurveTo(pW * 0.65, -pLen * 0.85, pW, -pLen * 0.35, 0, 0);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }
      }

      drawFourPointStar(
        ctx,
        sx,
        sy,
        r,
        "#fffbeb",
        i % 2 === 0 ? "rgba(253, 224, 71, 0.55)" : "rgba(244, 114, 182, 0.52)",
        ig
      );
    }
  }

  // 8. Expanding Merge Ring of Petals & Sparkles
  if (state.mergeParticles.length > 0) {
    for (let i = state.mergeParticles.length - 1; i >= 0; i--) {
      const mp = state.mergeParticles[i];
      mp.life += dt;
      if (mp.life >= mp.maxLife) {
        state.mergeParticles.splice(i, 1);
        continue;
      }
      mp.vx *= 1 - 1.1 * dt;
      mp.vy *= 1 - 1.1 * dt;
      mp.x += mp.vx * dt;
      mp.y += mp.vy * dt;
      mp.rot += mp.vRot * dt;
      const p = mp.life / mp.maxLife;
      const a = (1 - p * p) * 0.92;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = mp.color;
      if (mp.isPetal) {
        ctx.translate(mp.x, mp.y);
        ctx.rotate(mp.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, mp.size, mp.size * 0.45, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, mp.size * (1 - p * 0.4), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
