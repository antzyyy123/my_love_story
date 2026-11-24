"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { BellAudioEngine } from "@/lib/bellAudioEngine";
import { SITE_CONTENT } from "@/lib/content";
import {
  createYourLaughState,
  renderYourLaughFrame,
  triggerFlowerVisual,
  type YourLaughState,
} from "@/lib/yourLaughRenderer";
import { clamp } from "@/lib/math";

export interface YourLaughSceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

const JOY_PETAL_COUNT = 12;

/**
 * Full-bleed Canvas 2D + Web Audio Musical Night Pond Garden for "Your Laugh".
 * Touch, hover, or drag across 12 pentatonic bell flowers to chime; rhythmic play
 * fills the 12-petal joy meter and unleashes the cascading arpeggio Laugh finale.
 */
export default function YourLaughScene({ onExit, onVisited }: YourLaughSceneProps) {
  const copy = SITE_CONTENT.yourLaugh;
  const backLabel = SITE_CONTENT.solarSystem.backToSystemCta;

  const [titleVisible, setTitleVisible] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [joyLitCount, setJoyLitCount] = useState(0);
  const [cardVisible, setCardVisible] = useState(false);
  const [flowerButtons, setFlowerButtons] = useState<Array<{ x: number; y: number }>>([]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<YourLaughState | null>(null);
  const audioRef = useRef<BellAudioEngine | null>(null);

  // Multi-touch & hover tracking: pointerId -> last triggered flower index
  const pointerLastFlowerRef = useRef<Map<number, number>>(new Map());
  const pointerLastPosRef = useRef<Map<number, { x: number; y: number; t: number }>>(new Map());
  const lastPlayTimeRef = useRef<number>(0);
  const laughTimersRef = useRef<number[]>([]);
  const reducedMotionRef = useRef<boolean>(false);
  const onVisitedRef = useRef(onVisited);

  useEffect(() => {
    onVisitedRef.current = onVisited;
  }, [onVisited]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTitleVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  const clearLaughTimers = useCallback(() => {
    laughTimersRef.current.forEach((id) => window.clearTimeout(id));
    laughTimersRef.current = [];
  }, []);

  const triggerLaughFinale = useCallback(() => {
    const st = stateRef.current;
    if (!st || st.laughActive) return;
    st.laughActive = true;
    st.laughElapsed = 0;
    clearLaughTimers();
    onVisitedRef.current?.();

    // Cascading arpeggio up (0..11) and down (11..0), twice!
    const up = Array.from({ length: 12 }, (_, i) => i);
    const down = [...up].reverse().slice(1);
    const sequence = [...up, ...down, ...up.slice(1), ...down];
    const stepMs = 88;

    sequence.forEach((flowerIdx, step) => {
      const id = window.setTimeout(() => {
        const cur = stateRef.current;
        if (!cur) return;
        audioRef.current?.playNote(flowerIdx, 0.72, true);
        triggerFlowerVisual(cur, flowerIdx, 0.9, reducedMotionRef.current);
      }, 120 + step * stepMs);
      laughTimersRef.current.push(id);
    });

    const cardTimer = window.setTimeout(() => {
      setCardVisible(true);
    }, 120 + sequence.length * stepMs + 550);
    laughTimersRef.current.push(cardTimer);
  }, [clearLaughTimers]);

  const playFlower = useCallback(
    (flowerIdx: number, velocity = 0.8) => {
      const st = stateRef.current;
      if (!st) return;

      audioRef.current?.playNote(flowerIdx, velocity);
      triggerFlowerVisual(st, flowerIdx, velocity, reducedMotionRef.current);
      setHasPlayed(true);

      if (!st.laughActive) {
        const now = performance.now();
        const gap = now - lastPlayTimeRef.current;
        lastPlayTimeRef.current = now;
        // Rhythmic quick playing (like a laugh!) fills joy faster
        const rhythmBonus = gap > 70 && gap < 520 ? 1.55 : 1.0;
        st.joy = Math.min(1, st.joy + 0.085 * rhythmBonus);
        setJoyLitCount(Math.round(st.joy * JOY_PETAL_COUNT));

        if (st.joy >= 1) {
          triggerLaughFinale();
        }
      }
    },
    [triggerLaughFinale]
  );

  // StrictMode-safe rAF loop, ResizeObserver & AudioEngine lifecycle
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedMotionRef.current = reduced;

    const engine = new BellAudioEngine();
    audioRef.current = engine;

    let rafId = 0;
    let lastNow = 0;
    let elapsed = 0;
    let lastJoySync = 0;
    let isHidden = document.hidden;

    const syncSize = () => {
      const cssW = Math.max(1, root.clientWidth);
      const cssH = Math.max(1, root.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const prevJoy = stateRef.current?.joy ?? 0;
      const prevLaugh = stateRef.current?.laughActive ?? false;
      const next = createYourLaughState(cssW, cssH, dpr);
      next.joy = prevJoy;
      next.laughActive = prevLaugh;
      stateRef.current = next;
      setFlowerButtons(next.flowers.map((f) => ({ x: f.headX, y: f.headY })));
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
        // Gentle joy drain when she pauses playing
        if (!st.laughActive && st.joy > 0 && now - lastPlayTimeRef.current > 1100) {
          st.joy = Math.max(0, st.joy - dt * 0.085);
          if (now - lastJoySync > 120) {
            lastJoySync = now;
            setJoyLitCount(Math.round(st.joy * JOY_PETAL_COUNT));
          }
        }
        renderYourLaughFrame(ctx, st, dt, elapsed, reduced);
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
      clearLaughTimers();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
      audioRef.current = null;
    };
  }, [clearLaughTimers]);

  const hitTestFlower = (x: number, y: number): number => {
    const st = stateRef.current;
    if (!st) return -1;
    let bestIdx = -1;
    let bestDist = Infinity;
    const hitR = st.isPortrait ? 36 : 38; // >= 72px diameter hit target!
    for (const f of st.flowers) {
      const d = Math.hypot(x - f.headX, y - f.headY);
      if (d <= hitR && d < bestDist) {
        bestDist = d;
        bestIdx = f.index;
      }
    }
    return bestIdx;
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointerLastPosRef.current.set(e.pointerId, { x, y, t: performance.now() });

    const idx = hitTestFlower(x, y);
    pointerLastFlowerRef.current.set(e.pointerId, idx);
    if (idx !== -1) {
      playFlower(idx, 0.86);
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isPressed = e.buttons > 0 || e.pointerType === "touch";
    // Allow both mouse hover glissando AND touch/mouse drag glissando!
    if (!isPressed && e.pointerType !== "mouse") return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    const prev = pointerLastPosRef.current.get(e.pointerId);
    let velocity = 0.72;
    if (prev) {
      const dtMs = Math.max(8, now - prev.t);
      const speedPxPerMs = Math.hypot(x - prev.x, y - prev.y) / dtMs;
      velocity = clamp(0.42 + speedPxPerMs * 0.55, 0.42, 1.0);
    }
    pointerLastPosRef.current.set(e.pointerId, { x, y, t: now });

    const idx = hitTestFlower(x, y);
    const lastIdx = pointerLastFlowerRef.current.get(e.pointerId) ?? -1;
    if (idx !== lastIdx) {
      pointerLastFlowerRef.current.set(e.pointerId, idx);
      if (idx !== -1) {
        playFlower(idx, velocity);
      }
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointerLastFlowerRef.current.delete(e.pointerId);
    pointerLastPosRef.current.delete(e.pointerId);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRef.current?.setMuted(next);
  };

  const handleKeepPlaying = () => {
    setCardVisible(false);
    if (stateRef.current) {
      stateRef.current.joy = 0;
      stateRef.current.laughActive = false;
      stateRef.current.laughElapsed = 0;
    }
    setJoyLitCount(0);
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-[#040a14] text-star-white select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.canvasAriaLabel}
        className="block h-full w-full cursor-pointer"
      />

      {/* Keyboard-Accessible Flower Targets (focus glow drawn on flower shape in Canvas, never a box) */}
      {flowerButtons.map((pos, idx) => (
        <button
          key={idx}
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            playFlower(idx, 0.85);
          }}
          onFocus={() => {
            if (stateRef.current) stateRef.current.focusedFlowerIdx = idx;
          }}
          onBlur={() => {
            if (stateRef.current && stateRef.current.focusedFlowerIdx === idx) {
              stateRef.current.focusedFlowerIdx = null;
            }
          }}
          aria-label={`Play musical flower ${idx + 1} of 12`}
          className="pointer-events-none fixed z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent outline-none focus-visible:outline-none"
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        />
      ))}

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

      {/* Top-Right Sound On/Off Button (44px, aria-pressed) */}
      <div
        className="fixed z-30"
        style={{
          top: "max(0.85rem, env(safe-area-inset-top))",
          right: "max(0.85rem, env(safe-area-inset-right))",
        }}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-pressed={!muted}
          aria-label={muted ? copy.soundOffAriaLabel : copy.soundOnAriaLabel}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-star-white/30 bg-cosmos-navy/75 text-star-white/90 backdrop-blur-md transition-all hover:border-star-white hover:bg-nebula-purple/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      </div>

      {/* Subtle Joy Meter Along Top Center (12 luminous petals) */}
      <div
        aria-label={`Garden joy: ${joyLitCount} of ${JOY_PETAL_COUNT}`}
        className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center pt-[max(4.15rem,calc(env(safe-area-inset-top)+3.4rem))] sm:pt-[max(1.25rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-center gap-1.5 rounded-full border border-star-white/12 bg-cosmos-navy/55 px-3 py-1.5 backdrop-blur-md">
          {Array.from({ length: JOY_PETAL_COUNT }, (_, i) => {
            const lit = i < joyLitCount;
            return (
              <span
                key={i}
                className={`h-2.5 w-1.5 rounded-full transition-all duration-300 ${
                  lit
                    ? "scale-110 bg-gradient-to-t from-teal-300 via-purple-300 to-rose-300 shadow-[0_0_8px_rgba(244,114,182,0.85)]"
                    : "bg-star-white/20"
                }`}
              />
            );
          })}
        </div>

        {/* Quiet Subtitle that fades out after 3 seconds */}
        <div
          aria-hidden={!titleVisible}
          className={`mt-2 text-center transition-opacity duration-1000 ease-out ${
            titleVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="font-serif text-lg font-light tracking-[0.12em] text-star-white text-shadow-glow-subtle sm:text-xl">
            {copy.title}
          </h1>
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-teal-200/75">
            {copy.subtitle}
          </p>
        </div>
      </div>

      {/* Bottom Hint Pill */}
      {!cardVisible && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-[#040812]/88 via-[#040812]/40 to-transparent px-4 pt-7"
          style={{ paddingBottom: "max(0.95rem, env(safe-area-inset-bottom))" }}
        >
          <p className="rounded-full border border-star-white/18 bg-cosmos-navy/70 px-4 py-2 font-sans text-[10px] uppercase tracking-[0.2em] text-star-white/85 backdrop-blur-md sm:text-[11px]">
            {hasPlayed ? copy.hintKeep : copy.hintTouch}
          </p>
        </div>
      )}

      {/* Ending Message Card — Planet-Panel Style */}
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
                onClick={handleKeepPlaying}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-teal-200/35 bg-teal-400/10 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-teal-100 transition-all hover:border-teal-200 hover:bg-teal-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
              >
                {copy.keepPlayingLabel}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
