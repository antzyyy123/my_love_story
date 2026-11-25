"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { SITE_CONTENT } from "@/lib/content";
import {
  createYourSmileState,
  renderYourSmileFrame,
  type YourSmileState,
} from "@/lib/yourSmileRenderer";
import { clamp } from "@/lib/math";

export interface YourSmileSceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

const PROGRESS_PETALS = 5;

/**
 * Full-bleed Canvas 2D Sunrise Field Scene for "Your Smile".
 * Move your light across the pre-dawn field to make flowers turn and bloom;
 * at 85% bloom, the sun rises and reveals a glowing golden smile hidden across the hill.
 */
export default function YourSmileScene({ onExit, onVisited }: YourSmileSceneProps) {
  const copy = SITE_CONTENT.yourSmile;
  const backLabel = SITE_CONTENT.solarSystem.backToSystemCta;

  const [titleVisible, setTitleVisible] = useState(true);
  const [litPetals, setLitPetals] = useState(0);
  const [roaming, setRoaming] = useState(false);
  const [finaleStarted, setFinaleStarted] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<YourSmileState | null>(null);
  const onVisitedRef = useRef(onVisited);

  useEffect(() => {
    onVisitedRef.current = onVisited;
  }, [onVisited]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTitleVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  // Reveal Planet-Panel-style ending card after the sunrise & hidden smile wave (~4.2s)
  useEffect(() => {
    if (!finaleStarted) return;
    onVisitedRef.current?.();
    const timer = window.setTimeout(() => setCardVisible(true), 4200);
    return () => window.clearTimeout(timer);
  }, [finaleStarted]);

  // Keyboard arrow keys move the light smoothly across the field
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = stateRef.current;
      if (!st || st.finaleActive) return;
      const step = 36;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        st.autoRoam = false;
        setRoaming(false);
        st.lightActive = true;
        st.idleSec = 0;
        st.targetLightX = clamp(st.targetLightX + step, 20, st.w - 20);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        st.autoRoam = false;
        setRoaming(false);
        st.lightActive = true;
        st.idleSec = 0;
        st.targetLightX = clamp(st.targetLightX - step, 20, st.w - 20);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        st.autoRoam = false;
        setRoaming(false);
        st.lightActive = true;
        st.idleSec = 0;
        st.targetLightY = clamp(st.targetLightY - step, st.horizonY, st.h - 20);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        st.autoRoam = false;
        setRoaming(false);
        st.lightActive = true;
        st.idleSec = 0;
        st.targetLightY = clamp(st.targetLightY + step, st.horizonY, st.h - 20);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // StrictMode-safe rAF loop & ResizeObserver
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
    let lastPetalSync = 0;
    let isHidden = document.hidden;

    const syncSize = () => {
      const cssW = Math.max(1, root.clientWidth);
      const cssH = Math.max(1, root.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const prevFinale = stateRef.current?.finaleActive ?? false;
      const prevFrac = stateRef.current?.bloomFraction ?? 0;
      const next = createYourSmileState(cssW, cssH, dpr);
      if (prevFinale) {
        next.finaleActive = true;
        next.finaleElapsed = 3.5;
        next.flowers.forEach((f) => {
          f.bloom = 1;
        });
      } else if (prevFrac > 0.1) {
        const toOpen = Math.floor(next.flowers.length * prevFrac);
        for (let i = 0; i < toOpen; i++) next.flowers[i].bloom = 1;
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

      const st = stateRef.current;
      if (st) {
        renderYourSmileFrame(ctx, st, dt, elapsed, reduced, () => {
          setRoaming(false);
          setFinaleStarted(true);
        });
        if (now - lastPetalSync > 120) {
          lastPetalSync = now;
          setLitPetals(Math.min(PROGRESS_PETALS, Math.round((st.bloomFraction / 0.85) * PROGRESS_PETALS)));
        }
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

  const updatePointer = (e: PointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!st || !rect || st.finaleActive) return;
    st.targetLightX = e.clientX - rect.left;
    st.targetLightY = e.clientY - rect.top;
    st.lightActive = true;
    st.idleSec = 0;
    if (st.autoRoam) {
      st.autoRoam = false;
      setRoaming(false);
    }
  };

  const handlePointerLeave = () => {
    const st = stateRef.current;
    if (st && !st.autoRoam) {
      st.lightActive = false;
    }
  };

  const handleToggleRoam = () => {
    const st = stateRef.current;
    if (!st || st.finaleActive) return;
    const next = !roaming;
    st.autoRoam = next;
    st.lightActive = next;
    st.idleSec = 0;
    setRoaming(next);
  };

  const handleReplay = () => {
    const st = stateRef.current;
    if (!st) return;
    st.replaying = true;
    st.finaleActive = false;
    st.finaleElapsed = 0;
    st.autoRoam = false;
    st.lightActive = false;
    st.idleSec = 0;
    setRoaming(false);
    setFinaleStarted(false);
    setCardVisible(false);
    setLitPetals(0);
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={updatePointer}
      onPointerMove={updatePointer}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") handlePointerLeave();
      }}
      onPointerCancel={handlePointerLeave}
      onPointerLeave={handlePointerLeave}
      className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-[#06091e] text-star-white select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.canvasAriaLabel}
        className="block h-full w-full cursor-none sm:cursor-crosshair"
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

      {/* Subtle Row of 5 Bloom Progress Petals Along Top Center + Quiet 3s Fading Title */}
      <div
        aria-label={`${copy.progressAriaPrefix} ${litPetals} / ${PROGRESS_PETALS}`}
        className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center pt-[max(4.15rem,calc(env(safe-area-inset-top)+3.4rem))] sm:pt-[max(1.2rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-center gap-2 rounded-full border border-star-white/14 bg-cosmos-navy/55 px-3.5 py-1.5 backdrop-blur-md">
          {Array.from({ length: PROGRESS_PETALS }, (_, i) => {
            const lit = i < litPetals;
            return (
              <span
                key={i}
                className={`h-2.5 w-2 rounded-full transition-all duration-500 ${
                  lit
                    ? "scale-110 bg-gradient-to-t from-amber-300 via-pink-300 to-amber-100 shadow-[0_0_8px_rgba(253,224,71,0.9)]"
                    : "bg-star-white/22"
                }`}
              />
            );
          })}
        </div>

        <div
          aria-hidden={!titleVisible}
          className={`mt-2 text-center transition-opacity duration-1000 ease-out ${
            titleVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="font-serif text-lg font-light tracking-[0.12em] text-star-white text-shadow-glow-subtle sm:text-xl">
            {copy.title}
          </h1>
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
            {copy.subtitle}
          </p>
        </div>
      </div>

      {/* Bottom Hint & Accessible "Let the light roam" Button (Never Covering the Smile) */}
      {!finaleStarted && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-[#040b14]/90 via-[#040b14]/50 to-transparent pl-14 pr-4 pt-7 sm:px-6"
          style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
        >
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-star-white/85 sm:text-[11px] sm:tracking-[0.22em]">
            <span className="md:hidden">{copy.hintTouch}</span>
            <span className="hidden md:inline">{copy.hintDesktop}</span>
          </p>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleRoam();
            }}
            aria-pressed={roaming}
            className={`pointer-events-auto inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 font-sans text-[10px] uppercase tracking-[0.18em] backdrop-blur-md transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:text-[11px] ${
              roaming
                ? "border-amber-200 bg-amber-400/20 text-amber-100 shadow-glow"
                : "border-amber-200/35 bg-cosmos-navy/80 text-amber-100 hover:border-amber-200 hover:bg-amber-400/15"
            }`}
          >
            {copy.roamLabel}
          </button>
        </div>
      )}

      {/* Sunrise & Hidden Smile Ending Card — Planet-Panel Style */}
      <div aria-live="polite" className="contents">
        {cardVisible && (
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${copy.title} — ${copy.eyebrow}`}
            className="fixed inset-x-3 bottom-3 z-30 max-h-[40dvh] overflow-y-auto rounded-2xl border border-nebula-purple/45 bg-cosmos-deep/92 p-5 backdrop-blur-xl shadow-glow-strong transition-all duration-500 ease-out md:inset-x-auto md:top-1/2 md:right-7 md:bottom-auto md:max-h-[80dvh] md:w-88 md:-translate-y-1/2 md:p-6"
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
                onClick={handleReplay}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-amber-200/35 bg-amber-400/10 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-amber-100 transition-all hover:border-amber-200 hover:bg-amber-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
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
