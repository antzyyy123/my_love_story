"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_CONTENT } from "@/lib/content";
import { ThingsILoveRenderer, type ThingsILoveHUDState } from "@/lib/thingsILoveRenderer";
import type { MemorySceneProps } from "@/scenes/registry";

const COPY = SITE_CONTENT.thingsILove;
const TOTAL_FIREFLIES = COPY.reasons.length; // 12

interface SelectedStarCard {
  index: number;
  reasonIndex: number;
  x: number;
  y: number;
}

function clampNotePos(
  x: number,
  y: number,
  vw: number,
  vh: number,
  cardW: number,
  cardH: number
): { left: number; top: number } {
  const pad = 14;
  // Prefer placing note slightly above-right of firefly, flipping if near edge
  let left = x + 18;
  if (left + cardW > vw - pad) {
    left = x - cardW - 18;
  }
  left = Math.max(pad, Math.min(vw - cardW - pad, left));

  let top = y - cardH * 0.55;
  top = Math.max(66, Math.min(vh - cardH - 92, top));
  return { left, top };
}

export default function ThingsILoveScene({ onExit, onVisited }: MemorySceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ThingsILoveRenderer | null>(null);
  const visitedRef = useRef(false);
  const cardTimerRef = useRef<number | null>(null);

  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [hud, setHud] = useState<ThingsILoveHUDState>({
    fireflies: [],
    extraNotes: [],
    releasedCount: 0,
    finaleActive: false,
    jarTopY: 300,
    jarBottomY: 500,
  });
  const [titleVisible, setTitleVisible] = useState(true);
  const [showCard, setShowCard] = useState(false);
  const [selectedStar, setSelectedStar] = useState<SelectedStarCard | null>(null);
  const [extraCount, setExtraCount] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  // Quiet fading title after 3 seconds
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
    const renderer = new ThingsILoveRenderer({
      jarTagText: COPY.jarTag,
      reasonCount: TOTAL_FIREFLIES,
      extraReasonTotal: COPY.extraReasons.length,
      reducedMotion: rm.matches,
      onFinaleDone: () => {
        if (!visitedRef.current) {
          visitedRef.current = true;
          onVisited?.();
        }
        if (cardTimerRef.current !== null) {
          window.clearTimeout(cardTimerRef.current);
        }
        cardTimerRef.current = window.setTimeout(() => {
          setShowCard(true);
        }, 700);
      },
      onExtraRelease: (count, textIndex) => {
        setExtraCount(count);
        const text = COPY.extraReasons[textIndex];
        if (text) setAnnouncement(text);
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
    let hudSyncAccum = 0;

    const loop = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;

      renderer.update(dt);
      renderer.render(ctx);

      // Sync DOM overlays at ~20Hz for smooth note tracking without React thrashing
      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.048) {
        hudSyncAccum = 0;
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

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    rendererRef.current?.setPointerX(e.clientX - rect.left);
  }, []);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const res = rendererRef.current?.handleTap(x, y);
    if (!res) return;

    if (res.type === "released") {
      setSelectedStar(null);
      const r = COPY.reasons[res.reasonIndex];
      if (r) setAnnouncement(`${r.title}. ${r.body}`);
      setHud(rendererRef.current!.getHUDState());
    } else if (res.type === "star") {
      const ff = rendererRef.current?.getHUDState().fireflies[res.index];
      if (ff) {
        setSelectedStar({
          index: res.index,
          reasonIndex: res.reasonIndex,
          x: ff.x,
          y: ff.y,
        });
        const r = COPY.reasons[res.reasonIndex];
        if (r) setAnnouncement(`${r.title}. ${r.body}`);
      }
    } else if (res.type === "extra") {
      setSelectedStar(null);
      setHud(rendererRef.current!.getHUDState());
    } else {
      // Tapping elsewhere closes any open settled star card
      setSelectedStar(null);
    }
  }, []);

  const handleFireflyButtonActivate = useCallback((index: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const state = renderer.getHUDState();
    const ff = state.fireflies[index];
    if (!ff) return;

    if (ff.state === "jar") {
      const reasonIndex = renderer.releaseFireflyByIndex(index);
      if (reasonIndex !== null) {
        setSelectedStar(null);
        const r = COPY.reasons[reasonIndex];
        if (r) setAnnouncement(`${r.title}. ${r.body}`);
        setHud(renderer.getHUDState());
      }
    } else if (ff.state === "settled" && ff.reasonIndex >= 0) {
      setSelectedStar({
        index: ff.index,
        reasonIndex: ff.reasonIndex,
        x: ff.x,
        y: ff.y,
      });
      const r = COPY.reasons[ff.reasonIndex];
      if (r) setAnnouncement(`${r.title}. ${r.body}`);
    }
  }, []);

  const handleReplay = useCallback(() => {
    if (cardTimerRef.current !== null) {
      window.clearTimeout(cardTimerRef.current);
      cardTimerRef.current = null;
    }
    setShowCard(false);
    setSelectedStar(null);
    setExtraCount(0);
    setAnnouncement("");
    rendererRef.current?.refillJar();
    if (rendererRef.current) {
      setHud(rendererRef.current.getHUDState());
    }
  }, []);

  const isCompact = viewport.w < 640;
  const noteCardW = isCompact ? 228 : 264;
  const noteCardH = 96;

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none bg-[#030c14]"
      style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Full-bleed interactive meadow & firefly jar canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={COPY.canvasAriaLabel}
        onPointerMove={handleCanvasPointerMove}
        onPointerDown={handleCanvasPointerDown}
        className="block w-full h-full cursor-pointer outline-none"
        style={{ touchAction: "none" }}
      />

      {/* Screen-reader live region for unfolding notes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Keyboard-focusable 48px+ hit targets for each of the 12 fireflies (jar or settled star) */}
      <div className="pointer-events-none fixed inset-0 z-10">
        {hud.fireflies.map((ff) => {
          if (ff.state !== "jar" && ff.state !== "settled") return null;
          const label =
            ff.state === "jar"
              ? `${COPY.freeFireflyAriaPrefix} ${ff.index + 1}`
              : `${COPY.readReasonAriaPrefix} ${ff.reasonIndex + 1}: ${COPY.reasons[ff.reasonIndex]?.title ?? ""}`;
          return (
            <button
              key={ff.index}
              type="button"
              aria-label={label}
              onClick={(e) => {
                e.stopPropagation();
                handleFireflyButtonActivate(ff.index);
              }}
              className="pointer-events-auto absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent outline-none transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(254,240,138,0.9),0_0_24px_rgba(254,240,138,0.75)]"
              style={{ left: `${ff.x}px`, top: `${ff.y}px` }}
            />
          );
        })}
      </div>

      {/* Unfolding DOM reason notes following flying fireflies (~6 seconds) */}
      <div className="pointer-events-none fixed inset-0 z-20">
        {hud.fireflies.map((ff) => {
          if (ff.noteAlpha <= 0.02 || ff.reasonIndex < 0) return null;
          const reason = COPY.reasons[ff.reasonIndex];
          if (!reason) return null;
          const pos = clampNotePos(ff.x, ff.y, viewport.w, viewport.h, noteCardW, noteCardH);
          return (
            <div
              key={`note-${ff.index}`}
              className="absolute rounded-xl border border-amber-200/25 bg-[#061822]/82 px-3.5 py-2.5 text-left shadow-xl backdrop-blur-md"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
                width: `${noteCardW}px`,
                opacity: ff.noteAlpha,
                transform: `scale(${0.92 + ff.noteAlpha * 0.08})`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.45), 0 0 18px rgba(254, 240, 138, 0.12)",
              }}
            >
              <p className="font-serif text-sm font-medium tracking-wide text-amber-200">
                {reason.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/88">{reason.body}</p>
            </div>
          );
        })}

        {/* Floating notes for post-finale extra "countless more" fireflies */}
        {hud.extraNotes.map((ef) => {
          if (ef.noteAlpha <= 0.02) return null;
          const text = COPY.extraReasons[ef.textIndex];
          if (!text) return null;
          const pos = clampNotePos(ef.x, ef.y, viewport.w, viewport.h, 232, 68);
          return (
            <div
              key={`extra-${ef.id}`}
              className="absolute rounded-xl border border-amber-200/25 bg-[#061822]/80 px-3 py-2 text-xs leading-relaxed text-amber-50/95 shadow-lg backdrop-blur-md"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
                width: "232px",
                opacity: ef.noteAlpha,
              }}
            >
              {text}
            </div>
          );
        })}
      </div>

      {/* Reopened floating reason card when tapping any settled sky star */}
      {selectedStar && COPY.reasons[selectedStar.reasonIndex] && (() => {
        const reason = COPY.reasons[selectedStar.reasonIndex];
        const pos = clampNotePos(selectedStar.x, selectedStar.y, viewport.w, viewport.h, noteCardW, noteCardH + 14);
        return (
          <div
            role="dialog"
            aria-label={reason.title}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-30 rounded-xl border border-amber-200/35 bg-[#061822]/90 px-4 py-3 text-left shadow-2xl backdrop-blur-xl"
            style={{
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              width: `${noteCardW}px`,
              boxShadow: "0 14px 36px rgba(0,0,0,0.55), 0 0 22px rgba(254, 240, 138, 0.16)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif text-sm font-medium tracking-wide text-amber-200">
                {reason.title}
              </p>
              <button
                type="button"
                onClick={() => setSelectedStar(null)}
                aria-label={COPY.closeReasonAria}
                className="rounded-full px-1.5 py-0.5 text-xs text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-white/90">{reason.body}</p>
          </div>
        );
      })()}

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

      {/* Bottom 12-dot progress row, hint, and post-finale "and countless more" counter */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <p
          className="text-center text-xs tracking-[0.16em] text-white/85 uppercase"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85)" }}
        >
          {hud.finaleActive ? COPY.hintMeadow : COPY.hintTap}
        </p>

        {hud.finaleActive && extraCount > 0 ? (
          <p
            className="rounded-full border border-amber-200/25 bg-[#061822]/70 px-3.5 py-1 text-xs tracking-[0.14em] text-amber-200 backdrop-blur-md"
            aria-live="polite"
          >
            {COPY.countlessPrefix} <span className="font-semibold text-white">{extraCount}</span>
          </p>
        ) : (
          <div
            className="flex items-center gap-2"
            aria-label={`${hud.releasedCount} / ${TOTAL_FIREFLIES} ${COPY.progressAriaUnit}`}
          >
            {Array.from({ length: TOTAL_FIREFLIES }).map((_, i) => {
              const freed = i < hud.releasedCount;
              return (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: freed ? "#fde68a" : "rgba(255,255,255,0.22)",
                    boxShadow: freed ? "0 0 8px rgba(254, 240, 138, 0.9)" : "none",
                    transform: freed ? "scale(1.2)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Finale message card (Planet side-panel style) */}
      <aside
        aria-label={COPY.title}
        className={`fixed bottom-16 right-4 left-4 z-30 mx-auto max-w-sm rounded-2xl border border-white/15 bg-[#061822]/85 p-5 text-white shadow-2xl backdrop-blur-xl transition-all duration-700 sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:p-6 ${
          showCard
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.58), 0 0 32px rgba(254, 240, 138, 0.14)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium tracking-[0.24em] text-amber-200/85 uppercase">
            {COPY.eyebrow}
          </p>
          <button
            type="button"
            onClick={() => setShowCard(false)}
            aria-label={COPY.hideCardAria}
            className="rounded-full px-1.5 py-0.5 text-xs text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200"
          >
            ✕
          </button>
        </div>
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
            className="flex-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-teal-200 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[#05141c] uppercase transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
