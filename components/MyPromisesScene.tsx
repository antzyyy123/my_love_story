"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_CONTENT } from "@/lib/content";
import { MyPromisesRenderer, type MyPromisesHUDState } from "@/lib/myPromisesRenderer";
import type { MemorySceneProps } from "@/scenes/registry";

const COPY = SITE_CONTENT.myPromisesScene;
const TOTAL_PROMISES = COPY.promises.length; // 8
const HOLD_DURATION_MS = 1200;

function clampNotePosition(
  x: number,
  y: number,
  vw: number,
  vh: number,
  cardW: number,
  cardH: number
): { left: number; top: number } {
  const pad = 16;
  // Prefer placing note to the left/below orb so it stays clear of the tree on the right
  let left = x - cardW * 0.5;
  left = Math.max(pad, Math.min(vw - cardW - pad, left));
  let top = y + 26;
  if (top + cardH > vh - 120) {
    top = Math.max(66, y - cardH - 26);
  }
  return { left, top };
}

export default function MyPromisesScene({ onExit, onVisited }: MemorySceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<MyPromisesRenderer | null>(null);
  const visitedRef = useRef(false);
  const cardTimerRef = useRef<number | null>(null);

  // Hold-to-seal state refs
  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number>(0);

  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [hud, setHud] = useState<MyPromisesHUDState>({
    sealedCount: 0,
    finaleActive: false,
    wishMode: false,
    caughtOrb: {
      active: false,
      sealing: false,
      x: 0,
      y: 0,
      promiseIndex: 0,
      isExtraWish: false,
      wishIndex: 0,
    },
    hasGuideStar: false,
  });
  const [titleVisible, setTitleVisible] = useState(true);
  const [showCard, setShowCard] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  // Quiet fading title after 3s
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
    const renderer = new MyPromisesRenderer({
      promiseCount: TOTAL_PROMISES,
      extraWishTotal: COPY.extraWishes.length,
      reducedMotion: rm.matches,
      onCatch: (promiseIndex, isExtraWish, wishIndex) => {
        if (isExtraWish) {
          const wish = COPY.extraWishes[wishIndex];
          if (wish) setAnnouncement(`${COPY.wishCaughtPrefix} ${wish}`);
        } else {
          const p = COPY.promises[promiseIndex];
          if (p) setAnnouncement(`${COPY.promiseCaughtPrefix} ${p.title}. ${p.body}`);
        }
      },
      onFinale: () => {
        if (!visitedRef.current) {
          visitedRef.current = true;
          onVisited?.();
        }
        if (cardTimerRef.current !== null) {
          window.clearTimeout(cardTimerRef.current);
        }
        cardTimerRef.current = window.setTimeout(() => {
          setShowCard(true);
        }, 1600);
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
      setViewport({ w, h });
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
      if (syncAccum >= 0.045) {
        syncAccum = 0;
        setHud(renderer.getHUDState());
      }

      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(holdRafRef.current);
      window.removeEventListener("resize", handleResize);
      rm.removeEventListener("change", onRmChange);
      if (cardTimerRef.current !== null) {
        window.clearTimeout(cardTimerRef.current);
        cardTimerRef.current = null;
      }
      rendererRef.current = null;
    };
  }, [onVisited]);

  const finishSeal = useCallback(() => {
    window.cancelAnimationFrame(holdRafRef.current);
    holdStartRef.current = null;
    setHoldProgress(0);
    rendererRef.current?.setSealHoldProgress(0);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(35);
      } catch {
        // Ignore vibration permission errors
      }
    }

    const sealed = rendererRef.current?.sealCaughtStar();
    if (sealed) {
      setAnnouncement(COPY.promiseSealedAnnouncement);
      if (rendererRef.current) setHud(rendererRef.current.getHUDState());
    }
  }, []);

  const cancelHold = useCallback(
    (allowTapSeal: boolean) => {
      if (holdStartRef.current === null) return;
      const elapsed = performance.now() - holdStartRef.current;
      window.cancelAnimationFrame(holdRafRef.current);
      holdStartRef.current = null;
      setHoldProgress(0);
      rendererRef.current?.setSealHoldProgress(0);

      // Plain quick tap also seals as accessibility alternative
      if (allowTapSeal && elapsed < 240) {
        finishSeal();
      }
    },
    [finishSeal]
  );

  const startHold = useCallback(() => {
    if (holdStartRef.current !== null) return;
    holdStartRef.current = performance.now();

    const tick = () => {
      if (holdStartRef.current === null) return;
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldProgress(p);
      rendererRef.current?.setSealHoldProgress(p);
      if (p >= 1) {
        finishSeal();
        return;
      }
      holdRafRef.current = window.requestAnimationFrame(tick);
    };
    holdRafRef.current = window.requestAnimationFrame(tick);
  }, [finishSeal]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    rendererRef.current?.setPointer(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const caught = rendererRef.current?.handleTap(e.clientX - rect.left, e.clientY - rect.top);
    if (caught && rendererRef.current) {
      setHud(rendererRef.current.getHUDState());
    }
  }, []);

  const handleCatchStarButton = useCallback(() => {
    const caught = rendererRef.current?.summonOrCatchGuideStar();
    if (caught) {
      if (rendererRef.current) setHud(rendererRef.current.getHUDState());
    } else {
      setAnnouncement(COPY.guideStarAnnouncement);
    }
  }, []);

  const handleMakeNewWish = useCallback(() => {
    setShowCard(false);
    rendererRef.current?.enterWishMode();
    if (rendererRef.current) setHud(rendererRef.current.getHUDState());
  }, []);

  const isCompact = viewport.w < 640;
  const cardW = isCompact ? 268 : 300;
  const cardH = 168;
  const orb = hud.caughtOrb;
  const activePromise = !orb.isExtraWish ? COPY.promises[orb.promiseIndex] : null;
  const activeWish = orb.isExtraWish ? COPY.extraWishes[orb.wishIndex] : null;
  const notePos = clampNotePosition(orb.x, orb.y, viewport.w, viewport.h, cardW, cardH);

  // SVG ring math for "Seal it" button
  const ringR = 20;
  const ringCirc = 2 * Math.PI * ringR;

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none bg-[#050618]"
      style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Full-bleed interactive meteor shower & promise tree canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={COPY.canvasAriaLabel}
        onPointerMove={handleCanvasPointerMove}
        onPointerDown={handleCanvasPointerDown}
        className="block w-full h-full cursor-crosshair outline-none"
        style={{ touchAction: "none" }}
      />

      {/* Screen-reader polite announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Top-left Back to our sky pill */}
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
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-medium tracking-[0.14em] text-white/90 uppercase backdrop-blur-md transition hover:border-amber-200/45 hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
        >
          <span aria-hidden="true">←</span>
          <span>{SITE_CONTENT.common.backToSky}</span>
        </button>
      </div>

      {/* Quiet fading scene title */}
      <div
        className={`pointer-events-none fixed left-1/2 top-14 z-10 -translate-x-1/2 text-center transition-opacity duration-1000 sm:top-6 ${
          titleVisible ? "opacity-90" : "opacity-0"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <p className="text-[10px] tracking-[0.26em] text-amber-200/80 uppercase">{COPY.eyebrow}</p>
        <h1 className="mt-0.5 font-serif text-xl font-light tracking-wide text-white/95 sm:text-2xl">
          {COPY.title}
        </h1>
      </div>

      {/* Unfolding Promise / Wish Note beside the caught glowing orb */}
      {orb.active && (activePromise || activeWish) && (
        <div
          role="dialog"
          aria-label={activePromise ? activePromise.title : COPY.newWishEyebrow}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-30 rounded-2xl border border-amber-200/30 bg-[#0b0820]/86 p-4 text-left text-white shadow-2xl backdrop-blur-xl transition-opacity duration-300"
          style={{
            left: `${notePos.left}px`,
            top: `${notePos.top}px`,
            width: `${cardW}px`,
            boxShadow: "0 14px 40px rgba(0,0,0,0.55), 0 0 24px rgba(254, 240, 138, 0.14)",
          }}
        >
          <p className="text-[10px] font-medium tracking-[0.22em] text-amber-200/80 uppercase">
            {orb.isExtraWish
              ? COPY.newWishEyebrow
              : `${COPY.promiseLabelPrefix} ${orb.promiseIndex + 1} / ${TOTAL_PROMISES}`}
          </p>
          {activePromise ? (
            <>
              <h2 className="mt-1 font-serif text-lg font-light tracking-wide text-white">
                {activePromise.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-white/85">{activePromise.body}</p>
            </>
          ) : (
            <p className="mt-2 font-serif text-sm leading-relaxed text-amber-50/95">{activeWish}</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                startHold();
              }}
              onPointerUp={() => cancelHold(true)}
              onPointerLeave={() => cancelHold(false)}
              onPointerCancel={() => cancelHold(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  finishSeal();
                }
              }}
              className="relative inline-flex items-center gap-2.5 rounded-full border border-amber-200/45 bg-amber-300/15 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-amber-100 uppercase transition hover:bg-amber-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              {/* Circular light ring that fills over 1.2s hold */}
              <svg width="24" height="24" viewBox="0 0 48 48" className="-ml-1 shrink-0" aria-hidden="true">
                <circle
                  cx="24"
                  cy="24"
                  r={ringR}
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={ringR}
                  fill="none"
                  stroke="#fde68a"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringCirc * (1 - holdProgress)}
                  transform="rotate(-90 24 24)"
                />
              </svg>
              <span>{COPY.sealButtonLabel}</span>
            </button>
            <span className="text-[11px] text-white/55">{COPY.sealHoldHint}</span>
          </div>
        </div>
      )}

      {/* Bottom hint, 8 sealed dots, and accessible "Catch a star" button */}
      {(!hud.finaleActive || hud.wishMode) && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2.5 px-4 sm:bottom-6"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <p
            className="text-center text-xs tracking-[0.16em] text-white/85 uppercase"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85)" }}
          >
            {hud.wishMode ? COPY.hintWish : COPY.hintCatch}
          </p>

          <div className="flex items-center gap-3">
            {!hud.wishMode && (
              <div
                className="flex items-center gap-2"
                aria-label={`${hud.sealedCount} / ${TOTAL_PROMISES} ${COPY.progressAriaUnit}`}
              >
                {Array.from({ length: TOTAL_PROMISES }).map((_, i) => {
                  const sealed = i < hud.sealedCount;
                  return (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: sealed ? "#fbcfe8" : "rgba(255,255,255,0.22)",
                        boxShadow: sealed ? "0 0 8px rgba(244, 114, 182, 0.9)" : "none",
                        transform: sealed ? "scale(1.22)" : "scale(1)",
                      }}
                    />
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={handleCatchStarButton}
              className="pointer-events-auto rounded-full border border-white/18 bg-black/40 px-3.5 py-1.5 text-[11px] font-medium tracking-[0.14em] text-amber-100/90 uppercase backdrop-blur-md transition hover:border-amber-200/50 hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/75"
            >
              {COPY.catchButtonLabel}
            </button>
          </div>
        </div>
      )}

      {/* Finale message card (Planet side-panel style) */}
      <aside
        aria-label={COPY.title}
        className={`fixed bottom-4 right-4 left-4 z-30 mx-auto max-w-sm rounded-2xl border border-white/15 bg-[#0b0820]/86 p-5 text-white shadow-2xl backdrop-blur-xl transition-all duration-700 sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:p-6 ${
          showCard
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.58), 0 0 32px rgba(244, 114, 182, 0.16)",
        }}
      >
        <p className="text-[10px] font-medium tracking-[0.24em] text-amber-200/85 uppercase">
          {COPY.eyebrow}
        </p>
        <h2 className="mt-1.5 font-serif text-2xl font-light tracking-wide text-white">
          {COPY.title}
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-white/85">
          <p>{COPY.messageLine1}</p>
          <p className="text-amber-100/95">{COPY.messageLine2}</p>
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
            onClick={handleMakeNewWish}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.12em] text-white/90 uppercase transition hover:border-amber-200/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
          >
            {COPY.wishButtonLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
