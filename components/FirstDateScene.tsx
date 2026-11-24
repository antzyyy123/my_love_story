"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { SITE_CONTENT } from "@/lib/content";
import {
  createFirstDateState,
  releaseLantern,
  renderFirstDateFrame,
  triggerHeartFinale,
  type FirstDateState,
} from "@/lib/firstDateRenderer";

export interface FirstDateSceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

const FINALE_LANTERN_COUNT = 8;

/**
 * Full-bleed Canvas 2D Lantern Festival Scene for "Our First Date".
 * Tap sky or water to release glowing lanterns carrying first-date memories;
 * after the 8th lantern, sky lanterns glide into a heart above the lake.
 */
export default function FirstDateScene({ onExit, onVisited }: FirstDateSceneProps) {
  const copy = SITE_CONTENT.firstDate;
  const backLabel = SITE_CONTENT.solarSystem.backToSystemCta;

  const [titleVisible, setTitleVisible] = useState(true);
  const [releasedCount, setReleasedCount] = useState(0);
  const [finaleTriggered, setFinaleTriggered] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<FirstDateState | null>(null);
  const memoryIdxRef = useRef(0);
  const countRef = useRef(0);
  const onVisitedRef = useRef(onVisited);

  useEffect(() => {
    onVisitedRef.current = onVisited;
  }, [onVisited]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTitleVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  // Show ending card smoothly after the heart gathers and mark planet visited
  useEffect(() => {
    if (!finaleTriggered) return;
    onVisitedRef.current?.();
    const timer = window.setTimeout(() => setCardVisible(true), 2400);
    return () => window.clearTimeout(timer);
  }, [finaleTriggered]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

      const prevFinale = stateRef.current?.finaleActive ?? false;
      stateRef.current = createFirstDateState(cssW, cssH, dpr);
      if (prevFinale && stateRef.current) {
        triggerHeartFinale(stateRef.current);
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

      if (stateRef.current) {
        renderFirstDateFrame(ctx, stateRef.current, dt, elapsed, reduced);
      }
      rafId = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      isHidden = document.hidden;
      if (isHidden) {
        cancelAnimationFrame(rafId);
      } else {
        lastNow = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const spawnAt = useCallback(
    (x: number, y: number) => {
      const st = stateRef.current;
      if (!st) return;

      const mems = copy.memories;
      const memoryLine = mems[memoryIdxRef.current % mems.length];
      memoryIdxRef.current += 1;

      releaseLantern(st, x, y, memoryLine);

      countRef.current += 1;
      const nextCount = countRef.current;
      setReleasedCount(nextCount);

      if (nextCount === FINALE_LANTERN_COUNT && !st.finaleActive) {
        triggerHeartFinale(st);
        setFinaleTriggered(true);
      }
    },
    [copy.memories]
  );

  const handleScenePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    spawnAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleBasketRelease = () => {
    const st = stateRef.current;
    if (!st) return;
    // Release a sky lantern gently upward from the dock basket
    const jitter = ((countRef.current * 29) % 50) - 25;
    spawnAt(st.basketX + 42 + jitter, Math.max(60, st.horizonY - 38));
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={handleScenePointerDown}
      className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-[#07071a] text-star-white select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.canvasAriaLabel}
        className="block h-full w-full cursor-pointer"
      />

      {/* Top-Left "Back to our sky" Pill */}
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
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-[#07071a]/75 via-[#07071a]/25 to-transparent px-4 pb-5 pt-[max(4.1rem,calc(env(safe-area-inset-top)+3.35rem))] text-center transition-opacity duration-1000 ease-out sm:pt-[max(0.95rem,env(safe-area-inset-top))] ${
          titleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-amber-200/75 sm:text-[11px]">
          {copy.eyebrow}
        </p>
        <h1 className="mt-0.5 font-serif text-xl font-light tracking-[0.12em] text-star-white text-shadow-glow-subtle sm:text-2xl">
          {copy.subtitle}
        </h1>
      </div>

      {/* Bottom Progress Dots, Hint Line & Keyboard "Release a lantern" Button */}
      {!cardVisible && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2.5 bg-gradient-to-t from-[#050511]/92 via-[#050511]/55 to-transparent pl-14 pr-4 pt-7 sm:px-6"
          style={{ paddingBottom: "max(0.85rem, env(safe-area-inset-bottom))" }}
        >
          {/* 8 Progress Dots toward the Heart Finale */}
          {!finaleTriggered && (
            <div
              aria-label={`${Math.min(releasedCount, FINALE_LANTERN_COUNT)} of ${FINALE_LANTERN_COUNT} lanterns released`}
              className="flex items-center gap-2"
            >
              {Array.from({ length: FINALE_LANTERN_COUNT }, (_, i) => {
                const lit = i < releasedCount;
                return (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-all duration-500 ${
                      lit
                        ? "scale-110 bg-amber-300 shadow-[0_0_8px_rgba(253,224,71,0.9)]"
                        : "bg-star-white/25"
                    }`}
                  />
                );
              })}
            </div>
          )}

          <div className="flex w-full max-w-2xl items-center justify-between gap-3 sm:justify-center">
            <p className="min-w-0 truncate font-sans text-[10px] uppercase tracking-[0.16em] text-star-white/80 sm:text-[11px] sm:tracking-[0.2em]">
              {copy.hint}
            </p>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleBasketRelease();
              }}
              className="pointer-events-auto inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-amber-200/35 bg-cosmos-navy/80 px-3.5 py-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-amber-100 backdrop-blur-md transition-all hover:border-amber-200 hover:bg-amber-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:min-h-[44px] sm:px-4 sm:text-[11px]"
            >
              {copy.releaseButtonLabel}
            </button>
          </div>
        </div>
      )}

      {/* Heart Finale Ending Card — Planet-Panel Style */}
      <div aria-live="polite" className="contents">
        {cardVisible && (
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
                onClick={() => setCardVisible(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-amber-200/35 bg-amber-400/10 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-amber-100 transition-all hover:border-amber-200 hover:bg-amber-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                {copy.releaseMoreLabel}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
