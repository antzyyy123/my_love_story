/**
 * Canvas 2D Renderer for "Your Laugh" — Musical Night Pond Garden
 * Pre-renders sky, aurora haze, pale moon, 3 layered hills, calm pond, and lily pads
 * to an offscreen canvas; animates 12 bell-shaped instrument flowers (teal -> violet -> rose),
 * mirrored pond reflections, swaying stems & swinging bells, pond ripples, rising light notes
 * & petals, fireflies flying toward played flowers, and the giant pond-flower Laugh finale.
 */

import { clamp, createSeededRandom, easeInOutCubic, easeOutCubic, lerp, randomRange, TAU } from "@/lib/math";

export type BellKind = "bluebell" | "tulip" | "lily";

export interface InstrumentFlower {
  index: number;
  kind: BellKind;
  baseX: number;
  baseY: number;
  stemH: number;
  headX: number;
  headY: number;
  scale: number;
  color: string;
  glowColor: string;
  phase: number;
  // Interactive spring animation state
  bend: number;
  bendVel: number;
  swing: number;
  swingVel: number;
  shimmer: number; // 0..1 glow burst when played
}

interface BgStar {
  x: number;
  y: number;
  r: number;
  phase: number;
  color: string;
}

interface PondRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

interface RisingNote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  isPetal: boolean;
  rot: number;
  size: number;
}

interface GardenFirefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number | null;
  targetY: number | null;
  r: number;
  phase: number;
  blinkSpeed: number;
  color: string;
}

export interface YourLaughState {
  w: number;
  h: number;
  dpr: number;
  isPortrait: boolean;
  isMobile: boolean;
  pondY: number;
  moonX: number;
  moonY: number;
  moonR: number;
  staticCanvas: HTMLCanvasElement;
  stars: BgStar[];
  flowers: InstrumentFlower[];
  ripples: PondRipple[];
  notes: RisingNote[];
  fireflies: GardenFirefly[];
  focusedFlowerIdx: number | null;
  joy: number; // 0..1
  laughActive: boolean;
  laughElapsed: number;
}

// 12 colors flowing smoothly from teal -> cyan -> blue -> violet -> magenta -> rose
const FLOWER_PALETTE: Array<{ main: string; glow: string }> = [
  { main: "#2dd4bf", glow: "rgba(45, 212, 191, 0.55)" },
  { main: "#22d3ee", glow: "rgba(34, 211, 238, 0.55)" },
  { main: "#38bdf8", glow: "rgba(56, 189, 248, 0.55)" },
  { main: "#60a5fa", glow: "rgba(96, 165, 250, 0.55)" },
  { main: "#818cf8", glow: "rgba(129, 140, 248, 0.55)" },
  { main: "#a78bfa", glow: "rgba(167, 139, 250, 0.55)" },
  { main: "#c084fc", glow: "rgba(192, 132, 252, 0.55)" },
  { main: "#d946ef", glow: "rgba(217, 70, 239, 0.52)" },
  { main: "#e879f9", glow: "rgba(232, 121, 249, 0.55)" },
  { main: "#f472b6", glow: "rgba(244, 114, 182, 0.55)" },
  { main: "#fb7185", glow: "rgba(251, 113, 133, 0.55)" },
  { main: "#fda4af", glow: "rgba(253, 164, 175, 0.55)" },
];

function buildStaticLayer(state: YourLaughState) {
  const { w, h, dpr, pondY, moonX, moonY, moonR, isPortrait } = state;
  const off = state.staticCanvas;
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 1. Deep Teal-to-Indigo Night Sky
  const sky = ctx.createLinearGradient(0, 0, 0, pondY);
  sky.addColorStop(0, "#040a16");
  sky.addColorStop(0.45, "#0b1930");
  sky.addColorStop(0.82, "#142442");
  sky.addColorStop(1, "#1e2348");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, pondY + 2);

  // Gentle Aurora Haze Ribbons
  const aur = ctx.createLinearGradient(0, pondY * 0.14, w, pondY * 0.45);
  aur.addColorStop(0, "rgba(45, 212, 191, 0)");
  aur.addColorStop(0.28, "rgba(45, 212, 191, 0.12)");
  aur.addColorStop(0.62, "rgba(139, 92, 246, 0.11)");
  aur.addColorStop(0.88, "rgba(244, 114, 182, 0.08)");
  aur.addColorStop(1, "rgba(244, 114, 182, 0)");
  ctx.fillStyle = aur;
  ctx.beginPath();
  ctx.moveTo(-40, pondY * 0.34);
  ctx.quadraticCurveTo(w * 0.3, pondY * 0.1, w * 0.65, pondY * 0.28);
  ctx.quadraticCurveTo(w * 0.88, pondY * 0.36, w + 40, pondY * 0.16);
  ctx.lineTo(w + 40, pondY * 0.56);
  ctx.quadraticCurveTo(w * 0.5, pondY * 0.42, -40, pondY * 0.58);
  ctx.closePath();
  ctx.fill();

  // 2. Pale Luminous Moon
  const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.25, moonX, moonY, moonR * 3.5);
  halo.addColorStop(0, "rgba(240, 253, 250, 0.36)");
  halo.addColorStop(0.45, "rgba(167, 139, 250, 0.14)");
  halo.addColorStop(1, "rgba(167, 139, 250, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 3.5, 0, TAU);
  ctx.fill();

  const disc = ctx.createRadialGradient(
    moonX - moonR * 0.22,
    moonY - moonR * 0.22,
    moonR * 0.1,
    moonX,
    moonY,
    moonR
  );
  disc.addColorStop(0, "#ffffff");
  disc.addColorStop(0.65, "#e0f2fe");
  disc.addColorStop(1, "#bae6fd");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, TAU);
  ctx.fill();

  // 3. Three Overscanned Layered Hill Silhouettes + Mist
  const hills = [
    { yOff: -46, peak: 52, color: "#0f1e36" },
    { yOff: -24, peak: 36, color: "#0b1629" },
    { yOff: -6, peak: 20, color: "#071020" },
  ];
  hills.forEach((hl, idx) => {
    ctx.fillStyle = hl.color;
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, pondY + 4);
    ctx.quadraticCurveTo(
      w * (0.2 + idx * 0.05),
      pondY + hl.yOff - hl.peak,
      w * 0.5,
      pondY + hl.yOff * 0.4
    );
    ctx.quadraticCurveTo(
      w * (0.8 - idx * 0.04),
      pondY + hl.yOff - hl.peak * 0.78,
      w * 1.15,
      pondY + 4
    );
    ctx.closePath();
    ctx.fill();
  });

  // Mist hovering over the pond shore
  const mist = ctx.createLinearGradient(0, pondY - 34, 0, pondY + 14);
  mist.addColorStop(0, "rgba(45, 212, 191, 0)");
  mist.addColorStop(0.65, "rgba(45, 212, 191, 0.09)");
  mist.addColorStop(1, "rgba(45, 212, 191, 0)");
  ctx.fillStyle = mist;
  ctx.fillRect(-w * 0.1, pondY - 34, w * 1.2, 48);

  // 4. Calm Pond (lower 35% of screen)
  const pond = ctx.createLinearGradient(0, pondY, 0, h);
  pond.addColorStop(0, "#10213d");
  pond.addColorStop(0.35, "#0a162b");
  pond.addColorStop(0.75, "#060e1e");
  pond.addColorStop(1, "#040812");
  ctx.fillStyle = pond;
  ctx.fillRect(0, pondY, w, h - pondY + 4);

  ctx.strokeStyle = "rgba(153, 246, 228, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, pondY);
  ctx.lineTo(w, pondY);
  ctx.stroke();

  // 5. Delicate Lily Pads resting on the pond surface
  const pads = isPortrait
    ? [
        { x: w * 0.18, y: pondY + (h - pondY) * 0.36, rx: 22, ry: 8, rot: 0.4 },
        { x: w * 0.8, y: pondY + (h - pondY) * 0.42, rx: 25, ry: 9, rot: 2.3 },
        { x: w * 0.34, y: pondY + (h - pondY) * 0.72, rx: 28, ry: 10, rot: -0.6 },
        { x: w * 0.72, y: pondY + (h - pondY) * 0.76, rx: 24, ry: 8.5, rot: 1.5 },
      ]
    : [
        { x: w * 0.14, y: pondY + (h - pondY) * 0.42, rx: 30, ry: 10, rot: 0.3 },
        { x: w * 0.28, y: pondY + (h - pondY) * 0.68, rx: 36, ry: 12, rot: -0.5 },
        { x: w * 0.56, y: pondY + (h - pondY) * 0.76, rx: 32, ry: 11, rot: 1.2 },
        { x: w * 0.76, y: pondY + (h - pondY) * 0.48, rx: 28, ry: 9.5, rot: 2.4 },
        { x: w * 0.88, y: pondY + (h - pondY) * 0.66, rx: 34, ry: 11.5, rot: -1.1 },
      ];

  for (const pad of pads) {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.fillStyle = "rgba(15, 118, 110, 0.48)";
    ctx.strokeStyle = "rgba(94, 234, 212, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.ellipse(0, 0, pad.rx, pad.ry, 0, pad.rot + 0.28, pad.rot + TAU - 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function createYourLaughState(
  cssW: number,
  cssH: number,
  dpr: number,
  seed = 20261124
): YourLaughState {
  const rng = createSeededRandom(seed + 515);
  const w = Math.max(320, cssW);
  const h = Math.max(320, cssH);
  const isPortrait = w / h <= 1.2;
  const isMobile = w < 768;

  const pondY = h * 0.65;
  const moonR = isPortrait ? clamp(w * 0.095, 28, 44) : clamp(h * 0.072, 34, 54);
  const moonX = w * (isPortrait ? 0.78 : 0.8);
  const moonY = h * (isPortrait ? 0.16 : 0.18);

  const stars: BgStar[] = Array.from({ length: isMobile ? 55 : 95 }, (_, i) => ({
    x: randomRange(rng, 0.02, 0.98),
    y: randomRange(rng, 0.03, 0.58),
    r: randomRange(rng, 0.5, 1.5),
    phase: randomRange(rng, 0, TAU),
    color: i % 4 === 0 ? "#99f6e4" : i % 3 === 0 ? "#fbcfe8" : "#f8fafc",
  }));

  // 12 Musical Bell Flowers:
  // Landscape: 1 graceful curved row across 86% of width.
  // Portrait: 2 curved rows (6 back + 6 front) so every flower is generous (>=56px wide) to tap!
  const kinds: BellKind[] = ["bluebell", "tulip", "lily"];
  const flowers: InstrumentFlower[] = Array.from({ length: 12 }, (_, i) => {
    const pal = FLOWER_PALETTE[i];
    let baseX: number;
    let baseY: number;
    let stemH: number;
    let scale: number;

    if (isPortrait) {
      const isFront = i >= 6;
      const col = i % 6;
      const frac = col / 5; // 0..1
      const arch = Math.sin(frac * Math.PI) * 18;
      baseX = w * (0.12 + frac * 0.76);
      baseY = isFront ? pondY + 26 + arch : pondY - 26 + arch * 0.6;
      stemH = (isFront ? 92 : 122) + Math.sin(col * 1.4) * 14;
      scale = isFront ? 0.98 : 0.82;
    } else {
      const frac = i / 11; // 0..1
      const arch = Math.sin(frac * Math.PI) * 26;
      baseX = w * (0.07 + frac * 0.86);
      baseY = pondY + 12 + (i % 2 === 0 ? -10 : 12) + arch * 0.45;
      stemH = clamp(h * (0.2 + Math.sin(frac * Math.PI) * 0.09 + (i % 3) * 0.028), 110, 235);
      scale = clamp(w / 1180, 0.82, 1.12) * (i % 2 === 0 ? 0.95 : 1.06);
    }

    return {
      index: i,
      kind: kinds[i % 3],
      baseX,
      baseY,
      stemH,
      headX: baseX,
      headY: baseY - stemH,
      scale,
      color: pal.main,
      glowColor: pal.glow,
      phase: randomRange(rng, 0, TAU),
      bend: 0,
      bendVel: 0,
      swing: 0,
      swingVel: 0,
      shimmer: 0,
    };
  });

  const ffCount = isMobile ? 16 : 30;
  const fireflies: GardenFirefly[] = Array.from({ length: ffCount }, (_, i) => ({
    x: randomRange(rng, w * 0.08, w * 0.92),
    y: randomRange(rng, h * 0.22, pondY + 20),
    vx: randomRange(rng, -16, 16),
    vy: randomRange(rng, -12, 12),
    targetX: null,
    targetY: null,
    r: randomRange(rng, 1.4, 2.7),
    phase: randomRange(rng, 0, TAU),
    blinkSpeed: randomRange(rng, 1.5, 2.8),
    color: i % 3 === 0 ? "#fef08a" : i % 3 === 1 ? "#99f6e4" : "#fbcfe8",
  }));

  const state: YourLaughState = {
    w,
    h,
    dpr,
    isPortrait,
    isMobile,
    pondY,
    moonX,
    moonY,
    moonR,
    staticCanvas: document.createElement("canvas"),
    stars,
    flowers,
    ripples: [],
    notes: [],
    fireflies,
    focusedFlowerIdx: null,
    joy: 0,
    laughActive: false,
    laughElapsed: 0,
  };

  buildStaticLayer(state);
  return state;
}

/**
 * Triggers the visual chime response on flower `idx`:
 * bends stem, swings bell, shimmers petals, spawns pond ripple & rising light notes/petals,
 * and attracts nearby fireflies toward the played flower.
 */
export function triggerFlowerVisual(
  state: YourLaughState,
  idx: number,
  velocity = 0.8,
  reducedMotion = false
) {
  const f = state.flowers[idx];
  if (!f) return;

  const amp = clamp(velocity, 0.4, 1.1);
  f.shimmer = 1;
  if (!reducedMotion) {
    f.bendVel += (idx % 2 === 0 ? 1 : -1) * 14 * amp;
    f.swingVel += (idx % 2 === 0 ? -1 : 1) * 9.5 * amp;

    // Glowing ripple on the pond right below the flower
    if (state.ripples.length < (state.isMobile ? 12 : 24)) {
      state.ripples.push({
        x: f.baseX,
        y: Math.max(state.pondY + 12, f.baseY + 8),
        r: 4,
        maxR: (state.isMobile ? 42 : 64) * amp,
        life: 0,
        maxLife: 1.35,
        color: f.color,
      });
    }

    // Rising petals & tiny light notes
    const noteCount = state.isMobile ? 4 : 7;
    for (let i = 0; i < noteCount; i++) {
      state.notes.push({
        x: f.headX + (Math.random() - 0.5) * 16,
        y: f.headY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 32,
        vy: -(34 + Math.random() * 42),
        life: 0,
        maxLife: 1.3 + Math.random() * 0.6,
        color: i % 2 === 0 ? f.color : "#fef08a",
        isPetal: i % 2 === 0,
        rot: Math.random() * TAU,
        size: i % 2 === 0 ? 4.8 : 2.2,
      });
    }
    if (state.notes.length > 90) {
      state.notes.splice(0, state.notes.length - 90);
    }

    // Attract 3-5 fireflies to fly playfully toward the just-played flower
    for (let i = 0; i < state.fireflies.length; i++) {
      if ((i + idx) % 4 === 0) {
        state.fireflies[i].targetX = f.headX + (Math.random() - 0.5) * 42;
        state.fireflies[i].targetY = f.headY + (Math.random() - 0.5) * 36;
      }
    }
  }
}

function drawBellHead(
  ctx: CanvasRenderingContext2D,
  kind: BellKind,
  scale: number,
  color: string,
  shimmer: number,
  isFocused: boolean
) {
  const s = scale;
  ctx.save();

  // Keyboard focus glow ring on the flower's own shape (never a rectangular box!)
  if (isFocused || shimmer > 0.05) {
    const glowA = Math.max(isFocused ? 0.72 : 0, shimmer * 0.78);
    const gr = (28 + shimmer * 16) * s;
    const gg = ctx.createRadialGradient(0, 6 * s, 2, 0, 6 * s, gr);
    gg.addColorStop(0, `rgba(255, 251, 235, ${(glowA * 0.85).toFixed(3)})`);
    gg.addColorStop(0.45, color);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = glowA * 0.55;
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(0, 6 * s, gr, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Bell body oriented hanging gently downward from (0,0) attachment
  const grad = ctx.createLinearGradient(0, 0, 0, 26 * s);
  grad.addColorStop(0, "#fffbeb");
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.strokeStyle =
    isFocused
      ? "rgba(254, 240, 138, 0.95)"
      : `rgba(255, 251, 235, ${(0.32 + shimmer * 0.58).toFixed(3)})`;
  ctx.lineWidth = isFocused ? 2.0 : 1.0;

  if (kind === "bluebell") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-9 * s, 4 * s, -15 * s, 16 * s, -17 * s, 24 * s);
    ctx.quadraticCurveTo(-7 * s, 20 * s, 0, 25 * s);
    ctx.quadraticCurveTo(7 * s, 20 * s, 17 * s, 24 * s);
    ctx.bezierCurveTo(15 * s, 16 * s, 9 * s, 4 * s, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === "tulip") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-14 * s, 5 * s, -16 * s, 18 * s, -9 * s, 24 * s);
    ctx.quadraticCurveTo(0, 28 * s, 9 * s, 24 * s);
    ctx.bezierCurveTo(16 * s, 18 * s, 14 * s, 5 * s, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Flared star-lily bell
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-8 * s, 7 * s, -18 * s, 15 * s, -20 * s, 22 * s);
    ctx.quadraticCurveTo(-8 * s, 21 * s, 0, 27 * s);
    ctx.quadraticCurveTo(8 * s, 21 * s, 20 * s, 22 * s);
    ctx.bezierCurveTo(18 * s, 15 * s, 8 * s, 7 * s, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Glowing inner chime clapper dot
  ctx.fillStyle = "#fffbeb";
  ctx.beginPath();
  ctx.arc(0, 21 * s, (2.6 + shimmer * 1.4) * s, 0, TAU);
  ctx.fill();

  ctx.restore();
}

export function renderYourLaughFrame(
  ctx: CanvasRenderingContext2D,
  state: YourLaughState,
  dt: number,
  elapsed: number,
  reducedMotion: boolean
) {
  const { w, h, pondY, moonX, moonY, moonR, joy } = state;

  if (state.laughActive) {
    state.laughElapsed += dt;
  }

  // 1. Pre-rendered Static Backdrop (Sky, Aurora, Moon, 3 Hills, Pond & Lily Pads)
  ctx.drawImage(state.staticCanvas, 0, 0, w, h);

  // Joy ambient sky glow + Laugh moon pulse
  const laughPulse = state.laughActive
    ? 1 + Math.sin(state.laughElapsed * 4.2) * 0.22 * clamp(1 - state.laughElapsed / 6.5, 0, 1)
    : 1;
  if (joy > 0.05 || state.laughActive) {
    const jGlow = ctx.createRadialGradient(
      moonX,
      moonY,
      moonR * 0.5,
      moonX,
      moonY,
      moonR * (3.8 + joy * 2.2) * laughPulse
    );
    jGlow.addColorStop(0, `rgba(254, 249, 195, ${(0.18 * joy * laughPulse).toFixed(3)})`);
    jGlow.addColorStop(0.5, `rgba(192, 132, 252, ${(0.12 * joy).toFixed(3)})`);
    jGlow.addColorStop(1, "rgba(192, 132, 252, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = jGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 6 * laughPulse, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 2. Twinkling Stars
  for (const st of state.stars) {
    const tw = 0.4 + 0.6 * Math.sin(elapsed * (1.4 + joy * 1.2) + st.phase);
    ctx.globalAlpha = (0.58 + joy * 0.32) * tw;
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 3. Wavy Moon Reflection on Pond
  const strips = state.isMobile ? 9 : 15;
  for (let i = 0; i < strips; i++) {
    const f = i / strips;
    const ry = pondY + 8 + f * Math.min(h - pondY - 14, moonR * 3.1);
    const wave = reducedMotion ? 0 : Math.sin(elapsed * 1.8 + i * 0.75) * (2.5 + f * 5);
    const rw = moonR * (1.0 - f * 0.52) * laughPulse;
    ctx.fillStyle = `rgba(224, 242, 254, ${((1 - f * 0.7) * (0.2 + joy * 0.12)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(moonX + wave, ry, rw, 2 + f * 1.1, 0, 0, TAU);
    ctx.fill();
  }

  // 4. Giant Radiant Flower of Light Opening in the Center of the Pond during THE LAUGH!
  if (state.laughActive) {
    const openG = easeInOutCubic(clamp(state.laughElapsed / 2.6, 0, 1));
    if (openG > 0.01) {
      const fx = w * 0.5;
      const fy = pondY + (h - pondY) * 0.52;
      const maxR = Math.min(w * 0.24, (h - pondY) * 0.85) * openG;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.globalCompositeOperation = "lighter";

      const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, maxR * 1.7);
      aura.addColorStop(0, "rgba(255, 251, 235, 0.55)");
      aura.addColorStop(0.45, "rgba(244, 114, 182, 0.26)");
      aura.addColorStop(0.8, "rgba(45, 212, 191, 0.12)");
      aura.addColorStop(1, "rgba(45, 212, 191, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(0, 0, maxR * 1.7, maxR * 0.65, 0, 0, TAU);
      ctx.fill();

      // 10 glowing water-lily petals opening gracefully on the pond surface
      const rotBase = reducedMotion ? 0 : state.laughElapsed * 0.12;
      for (let p = 0; p < 10; p++) {
        const ang = (p / 10) * TAU + rotBase;
        ctx.save();
        ctx.scale(1, 0.44);
        ctx.rotate(ang);
        const pg = ctx.createLinearGradient(0, 0, 0, -maxR);
        pg.addColorStop(0, "rgba(255, 251, 235, 0.88)");
        pg.addColorStop(0.55, p % 2 === 0 ? "rgba(244, 114, 182, 0.62)" : "rgba(45, 212, 191, 0.62)");
        pg.addColorStop(1, "rgba(196, 181, 253, 0.12)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-maxR * 0.26, -maxR * 0.35, -maxR * 0.2, -maxR * 0.82, 0, -maxR);
        ctx.bezierCurveTo(maxR * 0.2, -maxR * 0.82, maxR * 0.26, -maxR * 0.35, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // 5. Pond Ripples
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const rp = state.ripples[i];
    rp.life += dt;
    if (rp.life >= rp.maxLife) {
      state.ripples.splice(i, 1);
      continue;
    }
    const p = rp.life / rp.maxLife;
    const rx = lerp(rp.r, rp.maxR, easeOutCubic(p));
    ctx.strokeStyle = rp.color;
    ctx.globalAlpha = (1 - p) * 0.55;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, rx, rx * 0.28, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 6. 12 Bell-Shaped Instrument Flowers + Mirrored Pond Reflections
  for (const f of state.flowers) {
    // Damped spring physics for stem bend & bell swing
    const kBend = 34;
    const dBend = 5.2;
    f.bendVel += (-kBend * f.bend - dBend * f.bendVel) * dt;
    f.bend += f.bendVel * dt;

    const kSwing = 28;
    const dSwing = 4.0;
    f.swingVel += (-kSwing * f.swing - dSwing * f.swingVel) * dt;
    f.swing += f.swingVel * dt;

    f.shimmer = Math.max(0, f.shimmer - dt * 1.05);

    const idleSway = reducedMotion ? 0 : Math.sin(elapsed * 1.15 + f.phase) * (5 + joy * 4);
    const tipOffsetX = idleSway + f.bend * 12;
    const archTipX = f.baseX + tipOffsetX + (f.index < 6 ? 10 : -10) * f.scale;
    const archTipY = f.baseY - f.stemH;
    f.headX = archTipX;
    f.headY = archTipY + 12 * f.scale;

    // Mirrored dimmer reflection on pond below
    const distAbove = Math.max(6, pondY - f.headY);
    const refY = pondY + distAbove * 0.45;
    if (refY < h + 20) {
      const wave = reducedMotion ? 0 : Math.sin(elapsed * 2.1 + f.phase) * 3;
      ctx.save();
      ctx.globalAlpha = 0.22 + f.shimmer * 0.28;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(f.headX + wave, refY, 12 * f.scale, 5 * f.scale, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Graceful arched stem
    ctx.strokeStyle = f.shimmer > 0.2 ? "#5eead4" : "rgba(20, 120, 118, 0.85)";
    ctx.lineWidth = 2.2 * f.scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(f.baseX, f.baseY);
    ctx.bezierCurveTo(
      f.baseX + tipOffsetX * 0.35,
      f.baseY - f.stemH * 0.45,
      f.baseX + tipOffsetX * 0.8,
      f.baseY - f.stemH * 1.04,
      archTipX,
      archTipY
    );
    ctx.stroke();

    // Swinging bell head hanging from archTip
    ctx.save();
    ctx.translate(archTipX, archTipY);
    const totalSwing = (reducedMotion ? 0 : Math.sin(elapsed * 1.3 + f.phase) * 0.06) + f.swing * 0.14;
    ctx.rotate(totalSwing);
    drawBellHead(ctx, f.kind, f.scale, f.color, f.shimmer, state.focusedFlowerIdx === f.index);
    ctx.restore();
  }

  // 7. Rising Petals & Light Notes
  if (state.notes.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = state.notes.length - 1; i >= 0; i--) {
      const nt = state.notes[i];
      nt.life += dt;
      if (nt.life >= nt.maxLife) {
        state.notes.splice(i, 1);
        continue;
      }
      nt.x += (nt.vx + Math.sin(elapsed * 3.5 + nt.rot) * 14) * dt;
      nt.y += nt.vy * dt;
      nt.rot += 1.6 * dt;
      const p = nt.life / nt.maxLife;
      ctx.globalAlpha = (1 - p) * 0.88;
      ctx.fillStyle = nt.color;
      if (nt.isPetal) {
        ctx.save();
        ctx.translate(nt.x, nt.y);
        ctx.rotate(nt.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, nt.size, nt.size * 0.45, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(nt.x, nt.y, nt.size * (1 - p * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 8. Fireflies (flying playfully toward played flowers, bursting skyward during THE LAUGH!)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const ff of state.fireflies) {
    if (!reducedMotion) {
      if (state.laughActive && state.laughElapsed < 3.5) {
        ff.vy -= 26 * dt;
        ff.vx += Math.sin(elapsed * 3 + ff.phase) * 18 * dt;
      } else if (ff.targetX !== null && ff.targetY !== null) {
        const dx = ff.targetX - ff.x;
        const dy = ff.targetY - ff.y;
        const d = Math.hypot(dx, dy);
        if (d < 16) {
          ff.targetX = null;
          ff.targetY = null;
        } else {
          ff.vx = lerp(ff.vx, (dx / d) * 85, Math.min(1, dt * 4));
          ff.vy = lerp(ff.vy, (dy / d) * 85, Math.min(1, dt * 4));
        }
      } else {
        ff.vx += Math.sin(elapsed * 0.9 + ff.phase) * 12 * dt;
        ff.vy += Math.cos(elapsed * 0.8 + ff.phase) * 10 * dt;
        ff.vx = clamp(ff.vx, -28, 28);
        ff.vy = clamp(ff.vy, -22, 22);
      }

      ff.x += ff.vx * dt;
      ff.y += ff.vy * dt;
      if (ff.x < 12) ff.vx = Math.abs(ff.vx);
      if (ff.x > w - 12) ff.vx = -Math.abs(ff.vx);
      if (ff.y < 24) ff.y = pondY + 10;
      if (ff.y > h - 30) ff.vy = -Math.abs(ff.vy);
    }

    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * ff.blinkSpeed + ff.phase));
    const a = pulse * (0.72 + joy * 0.25);
    ctx.globalAlpha = a * 0.35;
    ctx.fillStyle = ff.color;
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.r * 3.1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.r * 0.85, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
