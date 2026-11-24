"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SITE_CONTENT } from "@/lib/content";
import {
  createSafePlaceState,
  renderSafePlaceFrame,
  type SafePlaceState,
} from "@/lib/safePlaceRenderer";

export interface SafePlaceSceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

const HOLD_TO_CALM_SEC = 5.0;
const DECAY_TO_STORM_SEC = 3.0;
const REPLAY_FADE_SEC = 1.6;

/**
 * Full-bleed Canvas 2D interactive memory scene for "My Safe Place" (Yellow Planet).
 * Hold to warm the stormy night into a calm starry garden, unlocking the ending card,
 * chimney-smoke heart, visited marker, and replay option.
 */
export default function SafePlaceScene({ onExit, onVisited }: SafePlaceSceneProps) {
  const copy = SITE_CONTENT.safePlace;
  const backLabel = SITE_CONTENT.solarSystem.backToSystemCta;

  const [titleVisible, setTitleVisible] = useState(true);
  const [hintVisible, setHintVisible] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isCalm, setIsCalm] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hintBarRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SafePlaceState | null>(null);

  const holdingRef = useRef(false);
  const warmthRef = useRef(0);
  const calmLockedRef = useRef(false);
  const replayingRef = useRef(false);
  const reducedTapRef = useRef(false);
  const onVisitedRef = useRef(onVisited);

  useEffect(() => {
    onVisitedRef.current = onVisited;
  }, [onVisited]);

  useEffect(() => {
    const tTitle = window.setTimeout(() => setTitleVisible(false), 3000);
    const tHint = window.setTimeout(() => setHintVisible(true), 2000);
    return () => {
      window.clearTimeout(tTitle);
      window.clearTimeout(tHint);
    };
  }, []);

  // Show ending card gently after calm locks in and mark planet as visited
  useEffect(() => {
    if (!isCalm) return;
    onVisitedRef.current?.();
    const timer = window.setTimeout(() => setCardVisible(true), 650);
    return () => window.clearTimeout(timer);
  }, [isCalm]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rmFrame = requestAnimationFrame(() => setIsReducedMotion(reduced));

    let rafId = 0;
    let lastNow = 0;
    let elapsed = 0;
    let isHidden = document.hidden;

    const syncSize = () => {
      const cssW = Math.max(1, root.clientWidth);
      const cssH = Math.max(1, root.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current = createSafePlaceState(cssW, cssH, dpr);
      if (stateRef.current) {
        renderSafePlaceFrame(ctx, stateRef.current, 0, elapsed || 1.2, warmthRef.current);
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(root);

    const tick = (now: number) => {
      if (isHidden) return;
      if (!lastNow) lastNow = now;
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      elapsed += dt;

      if (replayingRef.current) {
        warmthRef.current = Math.max(0, warmthRef.current - dt / REPLAY_FADE_SEC);
        if (warmthRef.current <= 0.001) {
          warmthRef.current = 0;
          replayingRef.current = false;
        }
      } else if (!calmLockedRef.current) {
        if (reduced && reducedTapRef.current) {
          warmthRef.current = Math.min(1, warmthRef.current + dt / 0.8);
        } else if (holdingRef.current) {
          warmthRef.current = Math.min(1, warmthRef.current + dt / HOLD_TO_CALM_SEC);
        } else if (warmthRef.current > 0) {
          warmthRef.current = Math.max(0, warmthRef.current - dt / DECAY_TO_STORM_SEC);
        }

        if (warmthRef.current >= 1) {
          warmthRef.current = 1;
          calmLockedRef.current = true;
          holdingRef.current = false;
          setIsHolding(false);
          setIsCalm(true);
        }
      }

      if (hintBarRef.current) {
        hintBarRef.current.style.transform = `scaleX(${warmthRef.current.toFixed(3)})`;
      }

      if (stateRef.current) {
        renderSafePlaceFrame(ctx, stateRef.current, dt, elapsed, warmthRef.current);
      }
      rafId = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      isHidden = document.hidden;
      if (isHidden) {
        cancelAnimationFrame(rafId);
        holdingRef.current = false;
        setIsHolding(false);
      } else {
        lastNow = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(rmFrame);
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const beginHold = () => {
    if (calmLockedRef.current || replayingRef.current) return;
    if (isReducedMotion) {
      reducedTapRef.current = true;
      return;
    }
    holdingRef.current = true;
    setIsHolding(true);
  };

  const endHold = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setIsHolding(false);
  };

  const handleReplayStorm = () => {
    calmLockedRef.current = false;
    holdingRef.current = false;
    reducedTapRef.current = false;
    replayingRef.current = true;
    setIsHolding(false);
    setCardVisible(false);
    setIsCalm(false);
    setHintVisible(true);
  };

  const handleScenePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    beginHold();
  };

  const handleHintKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      beginHold();
    }
  };

  const handleHintKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      endHold();
    }
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={handleScenePointerDown}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onPointerLeave={endHold}
      className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-[#050814] text-star-white select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.canvasAriaLabel}
        className="block h-full w-full"
      />

      {/* Top-Left "Back to our sky" Pill (same style as Sun scene) */}
      {onExit && (
        <div
          className="fixed z-30"
          style={{
            top: "max(0.85rem, env(safe-area-inset-top))",
            left: "max(0.85rem, env(safe-area-inset-left))",
          }}
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            aria-label={backLabel}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-star-white/30 bg-cosmos-navy/75 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.2em] text-star-white/90 backdrop-blur-md transition-all duration-300 hover:border-star-white hover:bg-nebula-purple/20 hover:shadow-glow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple"
          >
            <span aria-hidden="true">&larr;</span>
            {backLabel}
          </button>
        </div>
      )}

      {/* Quiet Top-Center Title that fades out after 3 seconds */}
      <div
        aria-hidden={!titleVisible}
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-[#040610]/70 via-[#040610]/25 to-transparent px-4 pb-5 pt-[max(4.1rem,calc(env(safe-area-inset-top)+3.35rem))] text-center transition-opacity duration-1000 ease-out sm:pt-[max(0.95rem,env(safe-area-inset-top))] ${
          titleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-amber-200/75 sm:text-[11px]">
          {copy.eyebrow}
        </p>
        <h1 className="mt-0.5 font-serif text-xl font-light tracking-[0.12em] text-star-white text-shadow-glow-subtle sm:text-2xl">
          {copy.title}
        </h1>
      </div>

      {/* Hold-to-Warm Hint Pill (fades in after 2s, supports Space/Enter hold or single tap on reduced motion) */}
      {!isCalm && (
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-[#040610]/85 via-[#040610]/40 to-transparent px-4 pt-8 transition-opacity duration-700 ease-out ${
            hintVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{ paddingBottom: "max(1.15rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              beginHold();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              endHold();
            }}
            onPointerCancel={endHold}
            onKeyDown={handleHintKeyDown}
            onKeyUp={handleHintKeyUp}
            onBlur={endHold}
            aria-label={copy.holdAriaLabel}
            className={`pointer-events-auto relative inline-flex min-h-[44px] items-center justify-center overflow-hidden rounded-full border px-6 py-2.5 font-sans text-[11px] uppercase tracking-[0.22em] backdrop-blur-md transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${
              isHolding
                ? "border-amber-200/80 bg-amber-400/15 text-amber-100 shadow-glow-strong"
                : "border-star-white/28 bg-cosmos-navy/75 text-star-white/88 hover:border-amber-200/60"
            }`}
          >
            <div
              ref={hintBarRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 origin-left bg-gradient-to-r from-amber-300/35 via-pink-300/30 to-purple-400/35"
              style={{ transform: "scaleX(0)" }}
            />
            <span className="relative z-10">
              {isReducedMotion ? copy.reducedMotionHint : copy.holdHint}
            </span>
          </button>
        </div>
      )}

      {/* Calm Ending Card — Planet-Panel Style (Right Side on Desktop, Compact Bottom Sheet on Mobile) */}
      <div aria-live="polite" className="contents">
        {isCalm && cardVisible && (
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${copy.title} — ${copy.eyebrow}`}
            className="fixed inset-x-3 bottom-3 z-30 max-h-[44dvh] overflow-y-auto rounded-2xl border border-nebula-purple/45 bg-cosmos-deep/92 p-5 backdrop-blur-xl shadow-glow-strong transition-all duration-500 ease-out md:inset-x-auto md:top-1/2 md:right-7 md:bottom-auto md:max-h-[80dvh] md:w-88 md:-translate-y-1/2 md:p-6"
            style={{
              paddingBottom: "calc(1.15rem + env(safe-area-inset-bottom))",
            }}
          >
            <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-nebula-purple">
              {copy.eyebrow}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-light tracking-[0.08em] text-star-white text-shadow-glow-subtle sm:text-3xl">
              {copy.title}
            </h2>
            <div aria-hidden="true" className="my-3 h-px w-full bg-star-white/10" />
            <p className="text-xs sm:text-sm font-light leading-relaxed text-star-white/88">
              {copy.messageLine1}
            </p>
            <p className="mt-2.5 text-xs sm:text-sm font-light leading-relaxed text-star-white/78">
              {copy.messageLine2}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-star-white/55 bg-nebula-purple/25 px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-star-white shadow-glow transition-all hover:border-star-white hover:shadow-glow-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
                >
                  {backLabel}
                </button>
              )}
              <button
                type="button"
                onClick={handleReplayStorm}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-star-white/25 bg-star-white/5 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-star-white/80 transition-all hover:border-star-white/60 hover:text-star-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
              >
                {copy.replayLabel}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
