/**
 * Procedural HTML5 Canvas 2D botanical flower renderer & offscreen sprite cache.
 * Zero images or external assets — every bloom is drawn with Bezier curves,
 * ellipses, radial/linear gradients, and bioluminescent halos.
 */

import { createSeededRandom, GOLDEN_ANGLE, TAU } from "./math";

export type FlowerType =
  | "rose"
  | "lily"
  | "orchid"
  | "hydrangea"
  | "delphinium"
  | "lotus"
  | "tulip"
  | "peony"
  | "filler"
  | "leaf";

export interface FlowerPalette {
  name: string;
  primary: string;
  secondary: string;
  highlight: string;
  glow: string;
  core: string;
}

export const COSMIC_PALETTES: Record<string, FlowerPalette> = {
  purple: {
    name: "Nebula Purple",
    primary: "#7c3aed",
    secondary: "#a855f7",
    highlight: "#e9d5ff",
    glow: "rgba(168, 85, 247, 0.7)",
    core: "#fef08a",
  },
  violet: {
    name: "Astral Violet",
    primary: "#5b21b6",
    secondary: "#8b5cf6",
    highlight: "#ddd6fe",
    glow: "rgba(139, 92, 246, 0.68)",
    core: "#f5d0fe",
  },
  blue: {
    name: "Celestial Blue",
    primary: "#1d4ed8",
    secondary: "#38bdf8",
    highlight: "#e0f2fe",
    glow: "rgba(56, 189, 248, 0.7)",
    core: "#fde68a",
  },
  magenta: {
    name: "Supernova Magenta",
    primary: "#be185d",
    secondary: "#ec4899",
    highlight: "#fbcfe8",
    glow: "rgba(236, 72, 153, 0.72)",
    core: "#fef08a",
  },
  pink: {
    name: "Rose Quartz",
    primary: "#db2777",
    secondary: "#f472b6",
    highlight: "#fce7f3",
    glow: "rgba(244, 114, 182, 0.7)",
    core: "#fffbeb",
  },
  orange: {
    name: "Solar Amber",
    primary: "#ea580c",
    secondary: "#fb923c",
    highlight: "#ffedd5",
    glow: "rgba(251, 146, 60, 0.72)",
    core: "#fef9c3",
  },
  gold: {
    name: "Starlight Gold",
    primary: "#ca8a04",
    secondary: "#facc15",
    highlight: "#fef9c3",
    glow: "rgba(250, 204, 21, 0.72)",
    core: "#ffffff",
  },
  teal: {
    name: "Aurora Teal",
    primary: "#0f766e",
    secondary: "#2dd4bf",
    highlight: "#ccfbf1",
    glow: "rgba(45, 212, 191, 0.7)",
    core: "#e0f2fe",
  },
  leafTeal: {
    name: "Cosmic Foliage",
    primary: "#064e3b",
    secondary: "#14b8a6",
    highlight: "#99f6e4",
    glow: "rgba(20, 184, 166, 0.45)",
    core: "#5eead4",
  },
};

export const PALETTE_LIST: FlowerPalette[] = [
  COSMIC_PALETTES.purple,
  COSMIC_PALETTES.violet,
  COSMIC_PALETTES.blue,
  COSMIC_PALETTES.magenta,
  COSMIC_PALETTES.pink,
  COSMIC_PALETTES.orange,
  COSMIC_PALETTES.gold,
  COSMIC_PALETTES.teal,
];

export interface FlowerSprite {
  canvas: HTMLCanvasElement;
  logicalSize: number;
  type: FlowerType;
  palette: FlowerPalette;
}

/**
 * Draws a soft bioluminescent halo behind a flower centered at (0, 0).
 */
function drawFlowerHalo(
  ctx: CanvasRenderingContext2D,
  radius: number,
  glowColor: string,
  intensity = 0.6
) {
  const grad = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius * 1.45);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(0.55, glowColor.replace(/[\d.]+\)$/, `${(intensity * 0.35).toFixed(2)})`));
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.45, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Rose: layered spiral of cupped Bezier petals with luminous rims.
 */
function drawRose(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette,
  seed: number
) {
  const rng = createSeededRandom(seed);
  const layers = [
    { count: 7, r: radius * 0.96, w: radius * 0.56, rot: 0.15 },
    { count: 6, r: radius * 0.72, w: radius * 0.44, rot: 0.55 },
    { count: 5, r: radius * 0.48, w: radius * 0.32, rot: 1.05 },
    { count: 4, r: radius * 0.26, w: radius * 0.2, rot: 1.55 },
  ];

  layers.forEach((layer, layerIndex) => {
    for (let i = 0; i < layer.count; i++) {
      const angle = (i / layer.count) * TAU + layer.rot + (rng() - 0.5) * 0.18;
      ctx.save();
      ctx.rotate(angle);

      const grad = ctx.createRadialGradient(0, -layer.r * 0.35, layer.r * 0.08, 0, -layer.r * 0.5, layer.r);
      if (layerIndex >= 2) {
        grad.addColorStop(0, palette.highlight);
        grad.addColorStop(0.55, palette.secondary);
        grad.addColorStop(1, palette.primary);
      } else {
        grad.addColorStop(0, palette.primary);
        grad.addColorStop(0.62, palette.secondary);
        grad.addColorStop(1, palette.highlight);
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        -layer.w,
        -layer.r * 0.28,
        -layer.w * 0.92,
        -layer.r * 1.05,
        0,
        -layer.r
      );
      ctx.bezierCurveTo(
        layer.w * 0.92,
        -layer.r * 1.05,
        layer.w,
        -layer.r * 0.28,
        0,
        0
      );
      ctx.closePath();
      ctx.fill();

      // Delicate glowing edge highlight
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = Math.max(0.6, radius * 0.025);
      ctx.stroke();
      ctx.restore();
    }
  });

  // Glowing spiral heart
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.22);
  coreGrad.addColorStop(0, palette.highlight);
  coreGrad.addColorStop(0.6, palette.secondary);
  coreGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.22, 0, TAU);
  ctx.fill();
}

/**
 * Lily: 6 pointed graceful Bezier petals with central veins and glowing stamens.
 */
function drawLily(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette
) {
  const petalCount = 6;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * TAU;
    const isInner = i % 2 === 1;
    const length = isInner ? radius * 0.94 : radius * 1.04;
    const width = isInner ? radius * 0.3 : radius * 0.34;

    ctx.save();
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, 0, 0, -length);
    grad.addColorStop(0, palette.primary);
    grad.addColorStop(0.55, palette.secondary);
    grad.addColorStop(1, palette.highlight);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-width, -length * 0.28, -width * 0.72, -length * 0.74, 0, -length);
    ctx.bezierCurveTo(width * 0.72, -length * 0.74, width, -length * 0.28, 0, 0);
    ctx.closePath();
    ctx.fill();

    // Central luminous petal vein
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = Math.max(0.6, radius * 0.022);
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.08);
    ctx.lineTo(0, -length * 0.85);
    ctx.stroke();

    ctx.restore();
  }

  // 6 delicate stamens with glowing anthers
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU + Math.PI / 6;
    const stamenLen = radius * 0.46;
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(254, 249, 195, 0.75)";
    ctx.lineWidth = Math.max(0.7, radius * 0.025);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(radius * 0.08, -stamenLen * 0.55, 0, -stamenLen);
    ctx.stroke();

    ctx.fillStyle = palette.core;
    ctx.beginPath();
    ctx.ellipse(0, -stamenLen, radius * 0.045, radius * 0.075, 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Orchid: 3 slender outer sepals, 2 broad lateral petals, and a sculpted glowing lip.
 */
function drawOrchid(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette
) {
  // 3 Outer sepals (top, bottom-left, bottom-right)
  const sepalAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  sepalAngles.forEach((angle) => {
    ctx.save();
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, 0, -radius);
    grad.addColorStop(0, palette.primary);
    grad.addColorStop(0.7, palette.secondary);
    grad.addColorStop(1, palette.highlight);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-radius * 0.24, -radius * 0.35, -radius * 0.18, -radius * 0.8, 0, -radius * 0.98);
    ctx.bezierCurveTo(radius * 0.18, -radius * 0.8, radius * 0.24, -radius * 0.35, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // 2 Broad wing-like lateral petals
  [-1, 1].forEach((dir) => {
    ctx.save();
    ctx.rotate(dir * 1.12);
    const grad = ctx.createRadialGradient(0, -radius * 0.45, radius * 0.05, 0, -radius * 0.5, radius * 0.65);
    grad.addColorStop(0, palette.highlight);
    grad.addColorStop(0.55, palette.secondary);
    grad.addColorStop(1, palette.primary);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      -radius * 0.46,
      -radius * 0.18,
      -radius * 0.5,
      -radius * 0.85,
      0,
      -radius * 0.88
    );
    ctx.bezierCurveTo(
      radius * 0.5,
      -radius * 0.85,
      radius * 0.46,
      -radius * 0.18,
      0,
      0
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Sculpted lower lip (labellum)
  ctx.save();
  const lipGrad = ctx.createLinearGradient(0, 0, 0, radius * 0.72);
  lipGrad.addColorStop(0, palette.core);
  lipGrad.addColorStop(0.45, palette.highlight);
  lipGrad.addColorStop(1, palette.primary);
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-radius * 0.42, radius * 0.14, -radius * 0.34, radius * 0.7, 0, radius * 0.74);
  ctx.bezierCurveTo(radius * 0.34, radius * 0.7, radius * 0.42, radius * 0.14, 0, 0);
  ctx.closePath();
  ctx.fill();

  // Bright column center
  ctx.fillStyle = palette.core;
  ctx.beginPath();
  ctx.arc(0, radius * 0.08, radius * 0.11, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Hydrangea: dense round cluster of tiny 4-petal glowing florets.
 */
function drawHydrangea(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette,
  seed: number
) {
  const rng = createSeededRandom(seed + 17);
  const floretCount = 13;

  for (let i = 0; i < floretCount; i++) {
    const frac = (i + 0.5) / floretCount;
    const r = radius * 0.72 * Math.sqrt(frac);
    const angle = i * GOLDEN_ANGLE;
    const fx = Math.cos(angle) * r;
    const fy = Math.sin(angle) * r;
    const floretR = radius * (0.26 + rng() * 0.08);
    const baseRot = rng() * TAU;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(baseRot);

    for (let p = 0; p < 4; p++) {
      ctx.save();
      ctx.rotate((p * Math.PI) / 2);
      const grad = ctx.createRadialGradient(0, -floretR * 0.5, 0, 0, -floretR * 0.5, floretR * 0.8);
      grad.addColorStop(0, palette.highlight);
      grad.addColorStop(0.55, palette.secondary);
      grad.addColorStop(1, palette.primary);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, -floretR * 0.52, floretR * 0.38, floretR * 0.48, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = palette.core;
    ctx.beginPath();
    ctx.arc(0, 0, floretR * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Delphinium: tall graceful spire of small star-like florets tapering to a luminous tip.
 */
function drawDelphinium(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette,
  seed: number
) {
  const rng = createSeededRandom(seed + 31);

  // Subtle glowing stem
  ctx.save();
  ctx.strokeStyle = "rgba(45, 212, 191, 0.55)";
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, radius * 0.95);
  ctx.quadraticCurveTo(radius * 0.08, 0, 0, -radius * 0.95);
  ctx.stroke();
  ctx.restore();

  const count = 9;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0 bottom -> 1 top tip
    const y = radius * 0.8 - t * radius * 1.65;
    const x = Math.sin(t * Math.PI * 2.5) * radius * 0.14 + (rng() - 0.5) * radius * 0.08;
    const floretR = radius * (0.34 - t * 0.18);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * TAU);

    for (let p = 0; p < 5; p++) {
      ctx.save();
      ctx.rotate((p / 5) * TAU);
      const grad = ctx.createLinearGradient(0, 0, 0, -floretR);
      grad.addColorStop(0, palette.primary);
      grad.addColorStop(0.65, palette.secondary);
      grad.addColorStop(1, palette.highlight);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-floretR * 0.42, -floretR * 0.3, -floretR * 0.35, -floretR * 0.85, 0, -floretR);
      ctx.bezierCurveTo(floretR * 0.35, -floretR * 0.85, floretR * 0.42, -floretR * 0.3, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = palette.core;
    ctx.beginPath();
    ctx.arc(0, 0, floretR * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Lotus: concentric geometric rings of pointed petals with a glowing golden core.
 */
function drawLotus(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette
) {
  const rings = [
    { count: 10, len: radius * 1.0, width: radius * 0.28, offset: 0 },
    { count: 8, len: radius * 0.74, width: radius * 0.24, offset: Math.PI / 8 },
    { count: 6, len: radius * 0.48, width: radius * 0.18, offset: 0 },
  ];

  rings.forEach((ring, idx) => {
    for (let i = 0; i < ring.count; i++) {
      ctx.save();
      ctx.rotate((i / ring.count) * TAU + ring.offset);
      const grad = ctx.createLinearGradient(0, 0, 0, -ring.len);
      grad.addColorStop(0, idx === 2 ? palette.core : palette.primary);
      grad.addColorStop(0.55, palette.secondary);
      grad.addColorStop(1, palette.highlight);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-ring.width, -ring.len * 0.35, -ring.width * 0.6, -ring.len * 0.78, 0, -ring.len);
      ctx.bezierCurveTo(ring.width * 0.6, -ring.len * 0.78, ring.width, -ring.len * 0.35, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.22);
  coreGrad.addColorStop(0, "#ffffff");
  coreGrad.addColorStop(0.5, palette.core);
  coreGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.22, 0, TAU);
  ctx.fill();
}

/**
 * Tulip: lush sculpted chalice of overlapping silky petals.
 */
function drawTulip(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette
) {
  const petals = [
    { rot: -0.34, scaleX: 0.72, scaleY: 0.94 },
    { rot: 0.34, scaleX: 0.72, scaleY: 0.94 },
    { rot: 0, scaleX: 0.85, scaleY: 1.02 },
  ];

  petals.forEach((p, idx) => {
    ctx.save();
    ctx.translate(0, radius * 0.42);
    ctx.rotate(p.rot);
    const len = radius * 1.25 * p.scaleY;
    const w = radius * 0.56 * p.scaleX;
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, palette.primary);
    grad.addColorStop(0.6, palette.secondary);
    grad.addColorStop(1, idx === 2 ? palette.highlight : palette.secondary);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -len * 0.25, -w * 0.85, -len * 0.9, 0, -len);
    ctx.bezierCurveTo(w * 0.85, -len * 0.9, w, -len * 0.25, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

/**
 * Peony: sumptuous ruffled cloud of multi-layered scalloped petals.
 */
function drawPeony(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette,
  seed: number
) {
  const rng = createSeededRandom(seed + 53);
  const rings = [
    { count: 11, r: radius * 0.96 },
    { count: 9, r: radius * 0.72 },
    { count: 7, r: radius * 0.48 },
    { count: 5, r: radius * 0.26 },
  ];

  rings.forEach((ring, idx) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * TAU + idx * 0.45 + (rng() - 0.5) * 0.22;
      const w = ring.r * 0.58;
      ctx.save();
      ctx.rotate(angle);
      const grad = ctx.createRadialGradient(0, -ring.r * 0.45, 0, 0, -ring.r * 0.45, ring.r * 0.85);
      grad.addColorStop(0, idx >= 2 ? palette.highlight : palette.secondary);
      grad.addColorStop(0.65, palette.secondary);
      grad.addColorStop(1, palette.primary);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-w, -ring.r * 0.35, -w * 0.8, -ring.r * 1.08, -w * 0.2, -ring.r * 0.94);
      ctx.quadraticCurveTo(0, -ring.r * 1.06, w * 0.2, -ring.r * 0.94);
      ctx.bezierCurveTo(w * 0.8, -ring.r * 1.08, w, -ring.r * 0.35, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  ctx.fillStyle = palette.core;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.14, 0, TAU);
  ctx.fill();
}

/**
 * Filler bloom: luminous 5-petal star blossom for spiral arm texture.
 */
function drawFiller(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette
) {
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * TAU);
    const grad = ctx.createLinearGradient(0, 0, 0, -radius);
    grad.addColorStop(0, palette.secondary);
    grad.addColorStop(1, palette.highlight);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.52, radius * 0.26, radius * 0.46, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = palette.core;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.18, 0, TAU);
  ctx.fill();
}

/**
 * Leaf & curling cosmic vine with luminous vein.
 */
function drawLeaf(
  ctx: CanvasRenderingContext2D,
  radius: number,
  palette: FlowerPalette
) {
  ctx.save();
  // Curling tendril vine
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(1, radius * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.85, radius * 0.45);
  ctx.bezierCurveTo(-radius * 0.2, radius * 0.3, radius * 0.25, -radius * 0.1, radius * 0.65, -radius * 0.55);
  ctx.bezierCurveTo(radius * 0.92, -radius * 0.85, radius * 0.45, -radius * 1.05, radius * 0.35, -radius * 0.72);
  ctx.stroke();

  // Main luminous leaf blade
  const grad = ctx.createLinearGradient(-radius * 0.5, radius * 0.4, radius * 0.5, -radius * 0.6);
  grad.addColorStop(0, palette.primary);
  grad.addColorStop(0.65, palette.secondary);
  grad.addColorStop(1, palette.highlight);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.65, radius * 0.35);
  ctx.bezierCurveTo(-radius * 0.45, -radius * 0.45, radius * 0.25, -radius * 0.65, radius * 0.6, -radius * 0.52);
  ctx.bezierCurveTo(radius * 0.35, 0.15 * radius, -radius * 0.15, radius * 0.55, -radius * 0.65, radius * 0.35);
  ctx.closePath();
  ctx.fill();

  // Central leaf vein
  ctx.strokeStyle = "rgba(204, 251, 241, 0.55)";
  ctx.lineWidth = Math.max(0.6, radius * 0.025);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.58, radius * 0.3);
  ctx.quadraticCurveTo(0, -radius * 0.12, radius * 0.5, -radius * 0.45);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws any procedural flower centered at (0, 0) on the provided Canvas 2D context.
 */
export function drawFlowerDirect(
  ctx: CanvasRenderingContext2D,
  type: FlowerType,
  palette: FlowerPalette,
  radius: number,
  seed = 1
) {
  ctx.save();
  drawFlowerHalo(ctx, radius, palette.glow, type === "leaf" ? 0.35 : 0.62);

  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = Math.max(4, radius * 0.26);

  switch (type) {
    case "rose":
      drawRose(ctx, radius, palette, seed);
      break;
    case "lily":
      drawLily(ctx, radius, palette);
      break;
    case "orchid":
      drawOrchid(ctx, radius, palette);
      break;
    case "hydrangea":
      drawHydrangea(ctx, radius, palette, seed);
      break;
    case "delphinium":
      drawDelphinium(ctx, radius, palette, seed);
      break;
    case "lotus":
      drawLotus(ctx, radius, palette);
      break;
    case "tulip":
      drawTulip(ctx, radius, palette);
      break;
    case "peony":
      drawPeony(ctx, radius, palette, seed);
      break;
    case "filler":
      drawFiller(ctx, radius, palette);
      break;
    case "leaf":
      drawLeaf(ctx, radius, palette);
      break;
  }

  ctx.restore();
}

/**
 * Pre-renders a flower variant onto an offscreen canvas ONCE for fast 60fps stamping.
 */
export function createFlowerSprite(
  type: FlowerType,
  palette: FlowerPalette,
  radius: number,
  seed = 1,
  dpr = 2
): FlowerSprite {
  const safeDpr = Math.min(2, Math.max(1, dpr));
  // Padding accommodates glow halo and elongated petals
  const logicalSize = Math.ceil(radius * 3.4);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(logicalSize * safeDpr);
  canvas.height = Math.ceil(logicalSize * safeDpr);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(safeDpr, safeDpr);
    ctx.translate(logicalSize / 2, logicalSize / 2);
    drawFlowerDirect(ctx, type, palette, radius, seed);
  }

  return {
    canvas,
    logicalSize,
    type,
    palette,
  };
}
