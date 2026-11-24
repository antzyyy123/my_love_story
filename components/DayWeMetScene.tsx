"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SITE_CONTENT } from "@/lib/content";
import {
  createDayWeMetState,
  renderDayWeMetFrame,
  startReplaySplit,
  triggerStarMerge,
  type DayWeMetState,
} from "@/lib/dayWeMetRenderer";
import { clamp } from "@/lib/math";

export interface DayWeMetSceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

/**
 * Full-bleed Canvas 2D Interactive Memory Scene for "The Day We Met".
 * Drag the Gold and Rose stars together to ignite the 6-star Constellation of Us,
 * tap any star to read its milestone memory, and replay anytime.
 */
export default function DayWeMetScene({ onExit, onVisited }: DayWeMetSceneProps) {
  const copy = SITE_CONTENT.dayWeMet;
  const backLabel = SITE_CONTENT.solarSystem.backToSystemCta;

  const [titleVisible, setTitleVisible] = useState(true);
  const [merged, setMerged] = useState(false);
  const [finaleCardVisible, setFinaleCardVisible] = useState(false);
  const [selectedStarIdx, setSelectedStarIdx] = useState<number | null>(null);
  const [starCardPos, setStarCardPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [constellationReady, setConstellationReady] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<DayWeMetState | null>(null);
  const onVisitedRef = useRef(onVisited);

  useEffect(() => {
    onVisitedRef.current = onVisited;
  }, [onVisited]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTitleVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  // After stars merge, unlock constellation clicks & reveal finale card after all 6 stars ignite (~7.4s)
  useEffect(() => {
    if (!merged) return;
    onVisitedRef.current?.();
    const tReady = window.setTimeout(() => setConstellationReady(true), 1200);
    const tCard = window.setTimeout(() => setFinaleCardVisible(true), 7400);
    return () => {
      window.clearTimeout(tReady);
      window.clearTimeout(tCard);
    };
  }, [merged]);

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

      const prevMerged = stateRef.current?.merged ?? false;
      const prevElapsed = stateRef.current?.mergeElapsed ?? 0;
      const next = createDayWeMetState(cssW, cssH, dpr, reduced);
      if (prevMerged) {
        next.merged = true;
        next.mergeElapsed = prevElapsed;
        next.mergeOriginX = next.nodes[0].x;
        next.mergeOriginY = next.nodes[0].y;
      }
      stateRef.current = next;
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
        renderDayWeMetFrame(ctx, stateRef.current, dt, elapsed, reduced, () => {
          setMerged(true);
        });
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
      cancelAnimationFrame(rmFrame);
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const selectConstellationStar = (idx: number | null) => {
    const st = stateRef.current;
    if (st) st.selectedNodeIdx = idx;
    if (idx === null || !st) {
      setSelectedStarIdx(null);
      return;
    }
    const nd = st.nodes[idx];
    // Clamp floating card cleanly inside viewport bounds
    const cardW = Math.min(270, st.w - 28);
    const safeX = clamp(nd.x, cardW * 0.5 + 14, st.w - cardW * 0.5 - 14);
    const safeY = clamp(nd.y, 130, st.h - 150);
    setStarCardPos({ x: safeX, y: safeY });
    setSelectedStarIdx(idx);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const st = stateRef.current;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!st || !rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (st.merged) {
      // Check if user tapped one of the 6 ignited constellation stars (generous 40px radius)
      for (let i = 0; i < st.nodes.length; i++) {
        const nd = st.nodes[i];
        if (st.mergeElapsed < nd.igniteSec) continue;
        if (Math.hypot(x - nd.x, y - nd.y) <= 40) {
          selectConstellationStar(selectedStarIdx === i ? null : i);
          return;
        }
      }
      if (selectedStarIdx !== null) selectConstellationStar(null);
      return;
    }

    if (isReducedMotion) {
      triggerStarMerge(st);
      setMerged(true);
      return;
    }

    // Generous hit area (>= 56px radius) on Gold or Rose star
    const dGold = Math.hypot(x - st.gold.x, y - st.gold.y);
    const dRose = Math.hypot(x - st.rose.x, y - st.rose.y);
    const hitR = 64;
    if (dGold <= hitR || dRose <= hitR) {
      st.dragging = dGold <= dRose ? "gold" : "rose";
      st.pointerX = x;
      st.pointerY = y;
      st.autoBring = false;
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!st || !rect || !st.dragging) return;
    st.pointerX = e.clientX - rect.left;
    st.pointerY = e.clientY - rect.top;
  };

  const handlePointerUp = () => {
    if (stateRef.current) {
      stateRef.current.dragging = null;
    }
  };

  const handleStarKeyNudge = (starId: "gold" | "rose", e: KeyboardEvent<HTMLButtonElement>) => {
    const st = stateRef.current;
    if (!st || st.merged) return;
    const step = 28;
    const target = starId === "gold" ? st.gold : st.rose;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      target.x = clamp(target.x + step, 24, st.w - 24);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      target.x = clamp(target.x - step, 24, st.w - 24);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      target.y = clamp(target.y - step, 24, st.h - 24);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      target.y = clamp(target.y + step, 24, st.h - 24);
    }
  };

  const handleBringTogether = () => {
    const st = stateRef.current;
    if (!st || st.merged) return;
    if (isReducedMotion) {
      triggerStarMerge(st);
      setMerged(true);
    } else {
      st.autoBring = true;
    }
  };

  const handleReplay = () => {
    const st = stateRef.current;
    if (!st) return;
    setSelectedStarIdx(null);
    setFinaleCardVisible(false);
    setConstellationReady(false);
    setMerged(false);
    startReplaySplit(st);
  };

  const activeMilestone = selectedStarIdx !== null ? copy.stars[selectedStarIdx] : null;

  return (
    <div
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-[#040410] text-star-white select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.canvasAriaLabel}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Keyboard-Accessible Controls for Arrow-Key Nudging the Stars Before Merge */}
      {!merged && (
        <div className="sr-only">
          <button
            type="button"
            onKeyDown={(e) => handleStarKeyNudge("gold", e)}
            onClick={handleBringTogether}
          >
            Move gold star with arrow keys or press Enter to bring together
          </button>
          <button
            type="button"
            onKeyDown={(e) => handleStarKeyNudge("rose", e)}
            onClick={handleBringTogether}
          >
            Move rose star with arrow keys or press Enter to bring together
          </button>
        </div>
      )}

      {/* Keyboard-Accessible Buttons for the 6 Constellation Stars After Merge */}
      {merged && constellationReady && (
        <div className="sr-only">
          {copy.stars.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectConstellationStar(idx)}
            >
              {s.title} — {s.date}
            </button>
          ))}
        </div>
      )}

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
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-[#040410]/75 via-[#040410]/25 to-transparent px-4 pb-5 pt-[max(4.1rem,calc(env(safe-area-inset-top)+3.35rem))] text-center transition-opacity duration-1000 ease-out sm:pt-[max(0.95rem,env(safe-area-inset-top))] ${
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

      {/* Bottom Hint & Accessible "Bring them together" Button (Before Merge) */}
      {!merged && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-[#040410]/90 via-[#040410]/50 to-transparent pl-14 pr-4 pt-7 sm:px-6"
          style={{ paddingBottom: "max(0.95rem, env(safe-area-inset-bottom))" }}
        >
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-star-white/80 sm:text-[11px] sm:tracking-[0.22em]">
            {isReducedMotion ? copy.reducedMotionHint : copy.hint}
          </p>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleBringTogether();
            }}
            className="pointer-events-auto inline-flex min-h-[44px] items-center rounded-full border border-amber-200/40 bg-cosmos-navy/80 px-4 py-2 font-sans text-[10px] uppercase tracking-[0.18em] text-amber-100 backdrop-blur-md transition-all hover:border-amber-200 hover:bg-amber-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:text-[11px]"
          >
            {copy.bringTogetherLabel}
          </button>
        </div>
      )}

      {/* Floating Milestone Memory Card Near Tapped Constellation Star */}
      {activeMilestone && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={activeMilestone.title}
          className="fixed z-30 w-[min(270px,calc(100vw-28px))] -translate-x-1/2 -translate-y-full rounded-2xl border border-amber-200/35 bg-cosmos-deep/94 p-4 backdrop-blur-xl shadow-glow-strong"
          style={{
            left: `${starCardPos.x}px`,
            top: `${Math.max(120, starCardPos.y - 18)}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                {activeMilestone.date}
              </p>
              <h3 className="mt-0.5 font-serif text-lg font-light tracking-[0.06em] text-star-white">
                {activeMilestone.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => selectConstellationStar(null)}
              aria-label="Close star memory"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-star-white/20 text-star-white/75 hover:border-star-white/50 hover:text-star-white"
            >
              &times;
            </button>
          </div>
          <p className="mt-2 text-xs font-light leading-relaxed text-star-white/85">
            {activeMilestone.memory}
          </p>
        </div>
      )}

      {/* Finale Message Card — Planet-Panel Style */}
      <div aria-live="polite" className="contents">
        {finaleCardVisible && !activeMilestone && (
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${copy.title} — ${copy.eyebrow}`}
            className="fixed inset-x-3 bottom-3 z-30 max-h-[42dvh] overflow-y-auto rounded-2xl border border-nebula-purple/45 bg-cosmos-deep/92 p-5 backdrop-blur-xl shadow-glow-strong transition-all duration-500 ease-out md:inset-x-auto md:top-1/2 md:right-7 md:bottom-auto md:max-h-[80dvh] md:w-88 md:-translate-y-1/2 md:p-6"
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
            <p className="mt-3 font-sans text-[10px] uppercase tracking-[0.18em] text-amber-200/75">
              Tap any star in the constellation to read its memory
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
                onClick={handleReplay}
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
