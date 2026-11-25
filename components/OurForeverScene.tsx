"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_CONTENT, TOGETHER_SINCE } from "@/lib/content";
import { OurForeverRenderer } from "@/lib/ourForeverRenderer";
import type { MemorySceneProps } from "@/scenes/registry";

const COPY = SITE_CONTENT.ourForever;
const PETAL_COUNT = 5;

interface ElapsedTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function parseTogetherSince(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Parse YYYY-MM-DD in local time to avoid UTC off-by-one shifts
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const d = new Date(year, month, day, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function computeElapsed(start: Date): ElapsedTime {
  const diffMs = Math.max(0, Date.now() - start.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default function OurForeverScene({ onExit, onVisited }: MemorySceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<OurForeverRenderer | null>(null);
  const visitedRef = useRef(false);
  const cardTimerRef = useRef<number | null>(null);

  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [titleVisible, setTitleVisible] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHoldingGrow, setIsHoldingGrow] = useState(false);
  const [elapsed, setElapsed] = useState<ElapsedTime | null>(() => {
    const start = parseTogetherSince(TOGETHER_SINCE);
    return start ? computeElapsed(start) : null;
  });

  // Detect touch & prefers-reduced-motion
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setIsTouch(coarse.matches || "ontouchstart" in window);
      setReducedMotion(rm.matches);
      rendererRef.current?.setReducedMotion(rm.matches);
    };
    sync();
    coarse.addEventListener("change", sync);
    rm.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      rm.removeEventListener("change", sync);
    };
  }, []);

  // Quiet fading title after 3 seconds
  useEffect(() => {
    const t = window.setTimeout(() => setTitleVisible(false), 3200);
    return () => window.clearTimeout(t);
  }, []);

  // Live 1-second counter timer (strictly cleaned up on unmount)
  useEffect(() => {
    const startDate = parseTogetherSince(TOGETHER_SINCE);
    if (!startDate) return;
    const tick = () => setElapsed(computeElapsed(startDate));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Main Canvas 2D rAF loop (StrictMode-safe)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new OurForeverRenderer({
      reducedMotion: rm,
      onComplete: () => {
        setCompleted(true);
        if (!visitedRef.current) {
          visitedRef.current = true;
          onVisited?.();
        }
        if (cardTimerRef.current !== null) {
          window.clearTimeout(cardTimerRef.current);
        }
        cardTimerRef.current = window.setTimeout(() => {
          setShowCard(true);
        }, 1250);
      },
    });
    rendererRef.current = renderer;

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
    let lastProgressReport = -1;

    const loop = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;

      renderer.update(dt);
      renderer.render(ctx);

      const snap = renderer.getSnapshot();
      if (Math.abs(snap.progress - lastProgressReport) >= 0.01 || snap.progress === 0 || snap.progress === 1) {
        lastProgressReport = snap.progress;
        setProgress(snap.progress);
      }

      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      if (cardTimerRef.current !== null) {
        window.clearTimeout(cardTimerRef.current);
        cardTimerRef.current = null;
      }
      rendererRef.current = null;
    };
  }, [onVisited]);

  // Keyboard arrow keys advance the growth front
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        rendererRef.current?.advanceBy(0.055);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    rendererRef.current?.onPointerDown(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    rendererRef.current?.onPointerMove(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    rendererRef.current?.onPointerUp();
  }, []);

  const startAutoGrow = useCallback(() => {
    if (reducedMotion) {
      rendererRef.current?.completeImmediately();
      return;
    }
    setIsHoldingGrow(true);
    rendererRef.current?.setAutoGrow(true);
  }, [reducedMotion]);

  const stopAutoGrow = useCallback(() => {
    setIsHoldingGrow(false);
    rendererRef.current?.setAutoGrow(false);
  }, []);

  const handleReplay = useCallback(() => {
    if (cardTimerRef.current !== null) {
      window.clearTimeout(cardTimerRef.current);
      cardTimerRef.current = null;
    }
    setShowCard(false);
    setCompleted(false);
    setProgress(0);
    rendererRef.current?.replay();
  }, []);

  const hintText = reducedMotion
    ? COPY.hintReducedMotion
    : isTouch
      ? COPY.hintTouch
      : COPY.hintDesktop;

  const hasDate = Boolean(elapsed);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none bg-[#040614]"
      style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Full-bleed interactive infinity canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={COPY.canvasAriaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block w-full h-full cursor-crosshair outline-none"
        style={{ touchAction: "none" }}
      />

      {/* Top-left Back to our sky pill */}
      <div
        className="pointer-events-none fixed left-4 top-4 z-20 sm:left-6 sm:top-6"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-medium tracking-[0.14em] text-white/90 uppercase backdrop-blur-md transition hover:border-amber-200/45 hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
        >
          <span aria-hidden="true">←</span>
          <span>{SITE_CONTENT.common.backToSky}</span>
        </button>
      </div>

      {/* Top-center 5-petal progress indicator */}
      <div
        className="pointer-events-none fixed left-1/2 top-5 z-20 -translate-x-1/2 sm:top-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        aria-label={`${COPY.progressAriaPrefix} ${Math.round(progress * 100)}%`}
      >
        <div className="flex items-center gap-2.5">
          {Array.from({ length: PETAL_COUNT }).map((_, i) => {
            const threshold = (i + 1) / PETAL_COUNT;
            const fill = Math.max(0, Math.min(1, (progress - i / PETAL_COUNT) * PETAL_COUNT));
            const lit = progress >= threshold - 0.02;
            return (
              <svg
                key={i}
                width="14"
                height="18"
                viewBox="0 0 14 18"
                aria-hidden="true"
                className="transition-transform duration-300"
                style={{
                  transform: lit ? "scale(1.14)" : "scale(0.95)",
                  filter: lit ? "drop-shadow(0 0 6px rgba(254, 240, 138, 0.85))" : "none",
                }}
              >
                <path
                  d="M7 1 C10.8 4.8 12.2 10 7 17 C1.8 10 3.2 4.8 7 1 Z"
                  fill={fill > 0.05 ? (i % 2 === 0 ? "#fde68a" : "#fbcfe8") : "rgba(255,255,255,0.14)"}
                  fillOpacity={fill > 0.05 ? 0.35 + fill * 0.65 : 1}
                  stroke={lit ? "#fffbeb" : "rgba(255,255,255,0.32)"}
                  strokeWidth="0.9"
                />
              </svg>
            );
          })}
        </div>
      </div>

      {/* Quiet fading scene title */}
      <div
        className={`pointer-events-none fixed left-1/2 top-14 z-10 -translate-x-1/2 text-center transition-opacity duration-1000 sm:top-16 ${
          titleVisible ? "opacity-90" : "opacity-0"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <p className="text-[10px] tracking-[0.28em] text-amber-200/75 uppercase">{COPY.eyebrow}</p>
        <h1 className="mt-1 font-serif text-xl font-light tracking-wide text-white/95 sm:text-2xl">
          {COPY.title}
        </h1>
      </div>

      {/* Center-crossing live counter (or glowing FOREVER) when loop is complete */}
      <div
        className={`pointer-events-none fixed left-1/2 top-[49%] z-20 -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-1000 ${
          completed ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        aria-live="polite"
      >
        <div
          className="rounded-full px-6 py-4 backdrop-blur-[3px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(6, 7, 24, 0.84) 0%, rgba(6, 7, 24, 0.56) 62%, rgba(6, 7, 24, 0) 100%)",
          }}
        >
          {hasDate && elapsed ? (
            <>
              <p className="text-[10px] font-medium tracking-[0.26em] text-amber-200/85 uppercase sm:text-xs">
                {COPY.counterPrefix}
              </p>
              <div className="mt-1 flex items-baseline justify-center gap-1.5">
                <span
                  className="font-serif text-4xl font-light tracking-tight text-white sm:text-5xl"
                  style={{ textShadow: "0 0 22px rgba(254, 240, 138, 0.65)" }}
                >
                  {elapsed.days.toLocaleString()}
                </span>
                <span className="font-serif text-base text-amber-100/85 sm:text-lg">
                  {COPY.counterDaysLabel}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs tracking-[0.18em] text-pink-100/85 sm:text-sm">
                {pad2(elapsed.hours)}h · {pad2(elapsed.minutes)}m · {pad2(elapsed.seconds)}s
              </p>
              <p className="mt-1 text-[10px] tracking-[0.24em] text-violet-200/75 uppercase sm:text-[11px]">
                {COPY.counterSuffix}
              </p>
            </>
          ) : (
            <p
              className="font-serif text-2xl font-light tracking-[0.34em] text-amber-100 uppercase sm:text-3xl"
              style={{ textShadow: "0 0 26px rgba(254, 240, 138, 0.85), 0 0 48px rgba(244, 114, 182, 0.55)" }}
            >
              {COPY.counterFallback}
            </p>
          )}
        </div>
      </div>

      {/* Bottom hint & accessible hold-to-grow control (before completion) */}
      {!completed && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex flex-col items-center gap-2.5 px-4 sm:bottom-7"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <p
            className="text-center text-xs tracking-[0.18em] text-white/80 uppercase sm:text-sm"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
          >
            {hintText}
          </p>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              startAutoGrow();
            }}
            onPointerUp={stopAutoGrow}
            onPointerLeave={stopAutoGrow}
            onPointerCancel={stopAutoGrow}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                startAutoGrow();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") {
                stopAutoGrow();
              }
            }}
            onBlur={stopAutoGrow}
            className={`pointer-events-auto rounded-full border px-4 py-1.5 text-[11px] font-medium tracking-[0.16em] uppercase backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 ${
              isHoldingGrow
                ? "border-amber-200/70 bg-amber-300/20 text-amber-100"
                : "border-white/15 bg-black/35 text-white/80 hover:border-pink-200/45 hover:bg-black/55"
            }`}
          >
            {COPY.growButtonLabel}
          </button>
        </div>
      )}

      {/* Finale message card (Planet side-panel style, positioned cleanly outside loop) */}
      <aside
        aria-label={COPY.title}
        className={`fixed bottom-4 right-4 left-4 z-30 mx-auto max-w-sm rounded-2xl border border-white/15 bg-[#09081c]/82 p-5 text-white shadow-2xl backdrop-blur-xl transition-all duration-700 sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:p-6 ${
          showCard
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.55), 0 0 32px rgba(244, 114, 182, 0.14)",
        }}
      >
        <p className="text-[10px] font-medium tracking-[0.26em] text-amber-200/85 uppercase">
          {COPY.eyebrow}
        </p>
        <h2 className="mt-1.5 font-serif text-2xl font-light tracking-wide text-white">
          {COPY.title}
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-white/80">
          <p>{COPY.messageLine1}</p>
          <p className="text-amber-100/90">{COPY.messageLine2}</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onExit}
            className="flex-1 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[#09081c] uppercase transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            {SITE_CONTENT.common.backToSky}
          </button>
          <button
            type="button"
            onClick={handleReplay}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.12em] text-white/90 uppercase transition hover:border-amber-200/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
          >
            {COPY.replayLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
