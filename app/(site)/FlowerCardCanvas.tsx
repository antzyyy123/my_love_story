"use client";

import { useEffect, useRef } from "react";
import {
  COSMIC_PALETTES,
  drawFlowerDirect,
  type FlowerType,
} from "@/lib/flowers";
import { createSeededRandom, randomRange, TAU } from "@/lib/math";

interface FlowerCardCanvasProps {
  flowerType: FlowerType;
  paletteKey: keyof typeof COSMIC_PALETTES;
  seed?: number;
  label: string;
  className?: string;
}

/**
 * Renders a small procedural cosmic flower composition onto HTML5 Canvas 2D
 * for gallery, collection, blog, and shop cards (zero external images).
 */
export default function FlowerCardCanvas({
  flowerType,
  paletteKey,
  seed = 42,
  label,
  className = "h-52 w-full",
}: FlowerCardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = COSMIC_PALETTES[paletteKey] ?? COSMIC_PALETTES.purple;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || 320;
      const h = rect.height || 200;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = w / 2;
      const cy = h / 2;
      const minSide = Math.min(w, h);
      const rng = createSeededRandom(seed);

      // Deep-space gradient backdrop
      const bg = ctx.createRadialGradient(cx, cy, minSide * 0.06, cx, cy, Math.max(w, h) * 0.72);
      bg.addColorStop(0, "#10102a");
      bg.addColorStop(1, "#05050f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Soft nebula wash
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, minSide * 0.65);
      neb.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "0.35)"));
      neb.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = neb;
      ctx.beginPath();
      ctx.arc(cx, cy, minSide * 0.65, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Scattered background stars
      for (let i = 0; i < 42; i++) {
        const sx = rng() * w;
        const sy = rng() * h;
        const sr = randomRange(rng, 0.4, 1.5);
        ctx.fillStyle = `rgba(248, 250, 252, ${randomRange(rng, 0.25, 0.85)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }

      // Accent foliage & filler blooms framing the centerpiece
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * TAU + rng() * 0.6;
        const distR = minSide * 0.28;
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * distR, cy + Math.sin(ang) * distR);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.65;
        drawFlowerDirect(ctx, "leaf", COSMIC_PALETTES.leafTeal, minSide * 0.16, seed + i * 7);
        ctx.restore();
      }

      // Hero procedural flower centerpiece
      ctx.save();
      ctx.translate(cx, cy);
      drawFlowerDirect(ctx, flowerType, palette, minSide * 0.31, seed);
      ctx.restore();
    };

    render();
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [flowerType, paletteKey, seed]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={`block ${className}`.trim()}
    />
  );
}
