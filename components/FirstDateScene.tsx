"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_CONTENT } from "@/lib/content";
import { FirstDateValleyRenderer, type ValleyHUDState } from "@/lib/firstDateRenderer";
import { useProgress } from "@/lib/progress";
import type { MemorySceneProps } from "@/scenes/registry";

const COPY = SITE_CONTENT.firstDate;
const MOON_COPY = SITE_CONTENT.moon;
const TOTAL_MEMORIES = Math.max(1, COPY.memories.length);

interface ActiveNote {
  hotspotId: number;
  memoryIndex: number;
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
  const left = Math.max(pad, Math.min(vw - cardW - pad, x - cardW * 0.5));
  let top = y - cardH - 22;
  if (top < 66) {
    top = Math.min(vh - cardH - 96, y + 26);
  }
  return { left, top: Math.max(66, top) };
}

export default function FirstDateScene({ onExit, onVisited, onOpenMoon }: MemorySceneProps) {
  const backLabel = SITE_CONTENT.common.backToSky;
  const { moonFound, markMoonFound } = useProgress();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<FirstDateValleyRenderer | null>(null);
  const visitedRef = useRef(false);
  const cardTimerRef = useRef<number | null>(null);

  // Drag vs tap tracking
  const dragRef = useRef<{ active: boolean; startX: number; lastX: number; moved: number }>({
    active: false,
    startX: 0,
    lastX: 0,
    moved: 0,
  });

  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [hud, setHud] = useState<ValleyHUDState>({
    hotspots: [],
    discoveredCount: 0,
    duskActive: false,
    cafeScreenX: 500,
    cafeScreenY: 420,
    moonScreenX: 260,
    moonScreenY: 110,
  });
  const [titleVisible, setTitleVisible] = useState(true);
  const [activeNote, setActiveNote] = useState<ActiveNote | null>(null);
  const [moonNoteOpen, setMoonNoteOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    rendererRef.current?.setMoonFound(moonFound);
  }, [moonFound]);

  useEffect(() => {
    const t = window.setTimeout(() => setTitleVisible(false), 3200);
    const coarse = window.matchMedia("(pointer: coarse)");
    const syncTouch = () => setIsTouch(coarse.matches || "ontouchstart" in window);
    syncTouch();
    coarse.addEventListener("change", syncTouch);
    return () => {
      window.clearTimeout(t);
      coarse.removeEventListener("change", syncTouch);
    };
  }, []);

  // Main Canvas 2D rAF loop (StrictMode-safe)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const renderer = new FirstDateValleyRenderer({
      totalMemories: TOTAL_MEMORIES,
      reducedMotion: rm.matches,
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
        }, 4200);
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
    dragRef.current = {
      active: true,
      startX: e.clientX,
      lastX: e.clientX,
      moved: 0,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      dragRef.current.lastX = e.clientX;
      dragRef.current.moved += Math.abs(dx);
      renderer.panBy(dx * 1.1);
    } else if (e.pointerType === "mouse") {
      const normX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      const normY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      renderer.setMouseTilt(normX, normY);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const wasTap = dragRef.current.active && dragRef.current.moved < 8;
    dragRef.current.active = false;

    if (!wasTap) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const res = rendererRef.current?.handleTap(x, y);
    if (!res) return;

    if (res.type === "hotspot") {
      setMoonNoteOpen(false);
      setActiveNote({
        hotspotId: res.hotspotId,
        memoryIndex: res.memoryIndex,
        x: res.x,
        y: res.y,
      });
      const mem = COPY.memories[res.memoryIndex % COPY.memories.length];
      if (mem) setAnnouncement(`${mem.hotspot}: ${mem.title}. ${mem.body}`);
      if (rendererRef.current) setHud(rendererRef.current.getHUDState());
    } else {
      setActiveNote(null);
      setMoonNoteOpen(false);
      if (res.type === "planted") {
        setAnnouncement(COPY.plantedAnnouncement);
      }
    }
  }, []);

  const handleHotspotButtonClick = useCallback((hotspotId: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const memIdx = renderer.activateHotspot(hotspotId);
    if (memIdx === null) return;
    const nextHud = renderer.getHUDState();
    setHud(nextHud);
    const hs = nextHud.hotspots.find((h) => h.id === hotspotId);
    if (hs) {
      setActiveNote({ hotspotId, memoryIndex: memIdx, x: hs.x, y: hs.y });
      const mem = COPY.memories[memIdx % COPY.memories.length];
      if (mem) setAnnouncement(`${mem.hotspot}: ${mem.title}. ${mem.body}`);
    }
  }, []);

  const handleFindNext = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const next = renderer.focusNextUndiscovered();
    if (next) {
      setActiveNote(null);
      const nextHud = renderer.getHUDState();
      setHud(nextHud);
    }
  }, []);

  const isCompact = viewport.w < 640;
  const noteCardW = isCompact ? 248 : 284;
  const noteCardH = 122;
  const currentMem =
    activeNote !== null
      ? COPY.memories[activeNote.memoryIndex % COPY.memories.length]
      : null;

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none bg-[#5c8ec8]"
      style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Full-bleed living valley canvas */}
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

      {/* Screen-reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Keyboard-focusable Hotspot Targets + Interactive Crescent Moon (circular glow, no boxes) */}
      <div className="pointer-events-none fixed inset-0 z-10">
        <button
          type="button"
          aria-label={MOON_COPY.moonAriaLabel}
          onClick={(e) => {
            e.stopPropagation();
            setActiveNote(null);
            setMoonNoteOpen((prev) => !prev);
            markMoonFound();
            setAnnouncement(`${MOON_COPY.noteLine1} ${MOON_COPY.noteLine2}`);
          }}
          className="pointer-events-auto absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent outline-none transition-shadow hover:shadow-[0_0_22px_rgba(254,240,138,0.55)] focus-visible:shadow-[0_0_0_2px_rgba(254,240,138,0.92),0_0_24px_rgba(254,240,138,0.8)]"
          style={{ left: `${hud.moonScreenX}px`, top: `${hud.moonScreenY}px` }}
        />
        {hud.hotspots.map((hs, idx) => {
          if (hs.x < -30 || hs.x > viewport.w + 30) return null;
          const mem = COPY.memories[idx % COPY.memories.length];
          return (
            <button
              key={hs.id}
              type="button"
              aria-label={mem ? mem.hotspot : COPY.title}
              onClick={(e) => {
                e.stopPropagation();
                handleHotspotButtonClick(hs.id);
              }}
              className="pointer-events-auto absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent outline-none transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(254,240,138,0.92),0_0_24px_rgba(254,240,138,0.8)]"
              style={{ left: `${hs.x}px`, top: `${hs.y}px` }}
            />
          );
        })}
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
            className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/25 bg-[#090d1f]/55 px-4 py-2 text-xs font-medium tracking-[0.16em] text-white/95 uppercase backdrop-blur-md transition hover:border-amber-200/65 hover:bg-[#090d1f]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
          titleVisible ? "opacity-95" : "opacity-0"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <p
          className="text-[10px] tracking-[0.26em] text-amber-100 uppercase"
          style={{ textShadow: "0 1px 8px rgba(10,16,35,0.65)" }}
        >
          {COPY.eyebrow}
        </p>
        <h1
          className="mt-0.5 font-serif text-xl font-light tracking-wide text-white sm:text-2xl"
          style={{ textShadow: "0 2px 12px rgba(10,16,35,0.65)" }}
        >
          {COPY.subtitle}
        </h1>
      </div>

      {/* Floating Moon Secret Note when Crescent Moon is tapped */}
      {moonNoteOpen && (() => {
        const pos = clampNotePos(hud.moonScreenX, hud.moonScreenY, viewport.w, viewport.h, noteCardW, 152);
        return (
          <div
            role="dialog"
            aria-label={MOON_COPY.name}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-30 rounded-2xl border border-sky-200/35 bg-[#090d1e]/90 p-4 text-left text-white shadow-2xl backdrop-blur-xl"
            style={{
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              width: `${noteCardW}px`,
              boxShadow: "0 16px 40px rgba(0,0,0,0.55), 0 0 24px rgba(186,230,253,0.18)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-sky-200/85">
                {MOON_COPY.name}
              </p>
              <button
                type="button"
                onClick={() => setMoonNoteOpen(false)}
                aria-label={MOON_COPY.closeNoteAria}
                className="rounded-full px-1.5 py-0.5 text-xs text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-200"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 font-serif text-base font-light text-white">{MOON_COPY.noteLine1}</p>
            <p className="mt-1 text-xs leading-relaxed text-sky-100/85">{MOON_COPY.noteLine2}</p>
            {onOpenMoon && (
              <button
                type="button"
                onClick={() => {
                  setMoonNoteOpen(false);
                  onOpenMoon();
                }}
                className="mt-3.5 inline-flex min-h-[38px] items-center rounded-full border border-sky-200/45 bg-sky-200/15 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:border-sky-200 hover:bg-sky-200/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {MOON_COPY.landButtonLabel}
              </button>
            )}
          </div>
        );
      })()}

      {/* Floating DOM Memory Note near tapped hotspot */}
      {activeNote && currentMem && (() => {
        const pos = clampNotePos(activeNote.x, activeNote.y, viewport.w, viewport.h, noteCardW, noteCardH);
        return (
          <div
            role="dialog"
            aria-label={currentMem.title}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-30 rounded-2xl border border-amber-200/35 bg-[#0b1024]/88 p-4 text-left text-white shadow-2xl backdrop-blur-xl"
            style={{
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              width: `${noteCardW}px`,
              boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 0 22px rgba(254,240,138,0.16)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-amber-200/85">
                  {currentMem.hotspot}
                </p>
                <h2 className="mt-0.5 font-serif text-base font-light tracking-wide text-white sm:text-lg">
                  {currentMem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveNote(null)}
                aria-label={COPY.closeNoteAria}
                className="rounded-full px-1.5 py-0.5 text-xs text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-white/88">{currentMem.body}</p>
          </div>
        );
      })()}

      {/* Bottom Progress Dots, Hint & "Find the next memory" Button */}
      {!showCard && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-4 sm:bottom-5"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div
            className="flex items-center gap-2 rounded-full border border-white/15 bg-[#090d1f]/55 px-3.5 py-1.5 backdrop-blur-md"
            aria-label={`${Math.min(hud.discoveredCount, TOTAL_MEMORIES)} / ${TOTAL_MEMORIES} ${COPY.progressAriaUnit}`}
          >
            {Array.from({ length: TOTAL_MEMORIES }).map((_, i) => {
              const found = i < hud.discoveredCount;
              return (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: found ? "#fde68a" : "rgba(255,255,255,0.28)",
                    boxShadow: found ? "0 0 8px rgba(254, 240, 138, 0.95)" : "none",
                    transform: found ? "scale(1.2)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <p
              className="text-center text-[10px] tracking-[0.16em] text-white/90 uppercase sm:text-[11px]"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.8)" }}
            >
              {isTouch ? COPY.hintTouch : COPY.hint}
            </p>
            {!hud.duskActive && (
              <button
                type="button"
                onClick={handleFindNext}
                className="pointer-events-auto rounded-full border border-amber-200/45 bg-[#090d1f]/65 px-3.5 py-1.5 text-[10px] font-medium tracking-[0.16em] text-amber-100 uppercase backdrop-blur-md transition hover:border-amber-200 hover:bg-[#090d1f]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:text-[11px]"
              >
                {COPY.findNextLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dusk Finale Ending Card — Planet Side-Panel Style */}
      <aside
        aria-label={`${COPY.title} — ${COPY.eyebrow}`}
        className={`fixed bottom-4 right-4 left-4 z-30 mx-auto max-w-sm rounded-2xl border border-amber-200/25 bg-[#0b0a20]/88 p-5 text-white shadow-2xl backdrop-blur-xl transition-all duration-700 sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:p-6 ${
          showCard
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.58), 0 0 32px rgba(253, 224, 71, 0.14)",
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
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex-1 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[#09081c] uppercase transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              {backLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCard(false)}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.12em] text-white/90 uppercase transition hover:border-amber-200/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
          >
            {COPY.stayLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
