"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_CONTENT } from "@/lib/content";
import { MoonSurfaceRenderer, type MoonHUDState } from "@/lib/moonRenderer";
import type { MemorySceneProps } from "@/scenes/registry";

const COPY = SITE_CONTENT.moon;

export default function MoonScene({ onExit, onVisited }: MemorySceneProps) {
  const backLabel = SITE_CONTENT.common.backToSky;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<MoonSurfaceRenderer | null>(null);
  const visitedRef = useRef(false);
  const cardTimerRef = useRef<number | null>(null);

  const dragRef = useRef<{ active: boolean; lastX: number; moved: number; holdingLamp: boolean }>({
    active: false,
    lastX: 0,
    moved: 0,
    holdingLamp: false,
  });

  const [hud, setHud] = useState<MoonHUDState>({
    flowerX: 600,
    flowerY: 500,
    lampX: 300,
    lampY: 500,
    flowerPlanted: false,
    signalComplete: false,
    endingActive: false,
  });
  const [titleVisible, setTitleVisible] = useState(true);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setTitleVisible(false), 3200);
    return () => window.clearTimeout(t);
  }, []);

  // Main Canvas 2D rAF loop (StrictMode-safe)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const renderer = new MoonSurfaceRenderer({
      reducedMotion: rm.matches,
      onEnding: () => {
        if (!visitedRef.current) {
          visitedRef.current = true;
          onVisited?.();
        }
        if (cardTimerRef.current !== null) {
          window.clearTimeout(cardTimerRef.current);
        }
        cardTimerRef.current = window.setTimeout(() => {
          setShowCard(true);
        }, 3000);
      },
    });
    rendererRef.current = renderer;

    const onRmChange = () => renderer.setReducedMotion(rm.matches);
    rm.addEventListener("change", onRmChange);

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      renderer.resize(w, h, dpr);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    let rafId = 0;
    let lastTs = performance.now();
    let syncAccum = 0;

    const loop = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;

      renderer.update(dt);
      renderer.render(ctx);

      syncAccum += dt;
      if (syncAccum >= 0.05) {
        syncAccum = 0;
        setHud(renderer.getHUDState());
      }
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      rm.removeEventListener("change", onRmChange);
      if (cardTimerRef.current !== null) {
        window.clearTimeout(cardTimerRef.current);
        cardTimerRef.current = null;
      }
      rendererRef.current = null;
    };
  }, [onVisited]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const onLamp = rendererRef.current?.isOverLamp(x, y) ?? false;
    dragRef.current = { active: true, lastX: e.clientX, moved: 0, holdingLamp: onLamp };
    if (onLamp) {
      rendererRef.current?.startLampSignal();
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active || dragRef.current.holdingLamp) return;
    const dx = e.clientX - dragRef.current.lastX;
    dragRef.current.lastX = e.clientX;
    dragRef.current.moved += Math.abs(dx);
    rendererRef.current?.panBy(dx * 1.05);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const wasLamp = dragRef.current.holdingLamp;
    const wasTap = dragRef.current.active && dragRef.current.moved < 8;
    dragRef.current = { active: false, lastX: 0, moved: 0, holdingLamp: false };

    if (wasLamp) {
      rendererRef.current?.endLampSignal();
      if (rendererRef.current) setHud(rendererRef.current.getHUDState());
      return;
    }
    if (wasTap) {
      const rect = e.currentTarget.getBoundingClientRect();
      rendererRef.current?.handleTap(e.clientX - rect.left, e.clientY - rect.top);
      if (rendererRef.current) setHud(rendererRef.current.getHUDState());
    }
  }, []);

  const handleSendAnother = useCallback(() => {
    setShowCard(false);
    rendererRef.current?.sendStandardSignal();
  }, []);

  const activeHint = !hud.flowerPlanted
    ? COPY.hintFlower
    : !hud.signalComplete
      ? COPY.hintLamp
      : "";

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none bg-[#02030a]"
      style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Full-bleed lunar surface canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={COPY.canvasAriaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block w-full h-full cursor-grab active:cursor-grabbing outline-none"
        style={{ touchAction: "none" }}
      />

      {/* Keyboard-focusable targets for Moonflower & Signal Lamp (glow on shape, no boxes) */}
      <div className="pointer-events-none fixed inset-0 z-10">
        <button
          type="button"
          aria-label={COPY.flowerButtonAria}
          onClick={(e) => {
            e.stopPropagation();
            rendererRef.current?.plantMoonflower();
            if (rendererRef.current) setHud(rendererRef.current.getHUDState());
          }}
          className="pointer-events-auto absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent outline-none transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(186,230,253,0.9),0_0_24px_rgba(186,230,253,0.8)]"
          style={{ left: `${hud.flowerX}px`, top: `${hud.flowerY}px` }}
        />
        <button
          type="button"
          aria-label={COPY.lampButtonAria}
          onPointerDown={(e) => {
            e.stopPropagation();
            rendererRef.current?.startLampSignal();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            rendererRef.current?.endLampSignal();
            if (rendererRef.current) setHud(rendererRef.current.getHUDState());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              rendererRef.current?.sendStandardSignal();
              if (rendererRef.current) setHud(rendererRef.current.getHUDState());
            }
          }}
          className="pointer-events-auto absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent outline-none transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(254,240,138,0.9),0_0_24px_rgba(254,240,138,0.8)]"
          style={{ left: `${hud.lampX}px`, top: `${hud.lampY}px` }}
        />
      </div>

      {/* Top-left Back to our sky pill */}
      {onExit && (
        <div
          className="pointer-events-none fixed left-4 top-4 z-30 sm:left-6 sm:top-6"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingLeft: "env(safe-area-inset-left)",
          }}
        >
          <button
            type="button"
            onClick={onExit}
            aria-label={backLabel}
            className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs font-medium tracking-[0.16em] text-white/90 uppercase backdrop-blur-md transition hover:border-sky-200/60 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <span aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </button>
        </div>
      )}

      {/* Quiet 3s fading scene title */}
      <div
        aria-hidden={!titleVisible}
        className={`pointer-events-none fixed left-1/2 top-14 z-10 -translate-x-1/2 text-center transition-opacity duration-1000 sm:top-6 ${
          titleVisible ? "opacity-90" : "opacity-0"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <p className="text-[10px] tracking-[0.26em] text-sky-200/80 uppercase">{COPY.eyebrow}</p>
        <h1 className="mt-0.5 font-serif text-xl font-light tracking-wide text-white sm:text-2xl">
          {COPY.title}
        </h1>
      </div>

      {/* Sequential Hint (aria-live polite) */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-7"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {activeHint && (
          <p
            className="rounded-full border border-sky-200/20 bg-black/45 px-4 py-2 text-center text-xs tracking-[0.18em] text-sky-100/90 uppercase backdrop-blur-md"
            style={{ textShadow: "0 1px 10px rgba(0,0,0,0.8)" }}
          >
            {activeHint}
          </p>
        )}
      </div>

      {/* Ending Message Card — Planet Side-Panel Style */}
      <aside
        aria-label={`${COPY.title} — ${COPY.eyebrow}`}
        className={`fixed bottom-4 right-4 left-4 z-30 mx-auto max-w-sm rounded-2xl border border-sky-200/25 bg-[#090d1e]/88 p-5 text-white shadow-2xl backdrop-blur-xl transition-all duration-700 sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:p-6 ${
          showCard
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.6), 0 0 32px rgba(186,230,253,0.16)",
        }}
      >
        <p className="text-[10px] font-medium tracking-[0.24em] text-sky-200/85 uppercase">
          {COPY.eyebrow}
        </p>
        <h2 className="mt-1.5 font-serif text-2xl font-light tracking-wide text-white">
          {COPY.title}
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-white/85">
          <p>{COPY.messageLine1}</p>
          <p className="text-sky-100/95">{COPY.messageLine2}</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex-1 rounded-full bg-gradient-to-r from-sky-200 via-amber-200 to-pink-200 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[#090d1e] uppercase transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              {backLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handleSendAnother}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.12em] text-white/90 uppercase transition hover:border-sky-200/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70"
          >
            {COPY.sendAnotherLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
