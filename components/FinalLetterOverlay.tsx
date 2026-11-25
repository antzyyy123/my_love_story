"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { SITE_CONTENT } from "@/lib/content";

export interface FinalLetterOverlayProps {
  phase: "envelope" | "letter";
  onOpenLetter: () => void;
  onClose: () => void;
  onReplayFinale: () => void;
  returnFocusTo?: RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Grand Finale Sealed Envelope + Full-Screen Letter View.
 * - "envelope": glowing procedural SVG envelope with flower wax seal gently bobbing at center;
 *   tapping breaks the seal (petal burst), lifts the flap, and unfolds the full-screen letter.
 * - "letter": deep violet glass, warm gold hairline border, max-w 640px, ivory serif display
 *   type (20-22px desktop, 18px mobile), decorative drop-cap first letter, drifting petals,
 *   staggered 0.8s reveal (instant on reduced motion), focus trap, ESC closes & restores focus.
 */
export default function FinalLetterOverlay({
  phase,
  onOpenLetter,
  onClose,
  onReplayFinale,
  returnFocusTo,
}: FinalLetterOverlayProps) {
  const copy = SITE_CONTENT.finalLetter;
  const solarCopy = SITE_CONTENT.solarSystem;
  const backLabel = SITE_CONTENT.common.backToSky;

  const [openingSeal, setOpeningSeal] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const petalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current);
      }
    };
  }, []);

  // Focus trap, ESC close, and focus restoration to bottom-right envelope button
  useEffect(() => {
    if (phase !== "letter") return;

    const returnTarget = returnFocusTo?.current ?? null;
    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? dialog).focus();
    }, 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !dialogRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      if (returnTarget && typeof returnTarget.focus === "function") {
        window.setTimeout(() => returnTarget.focus(), 40);
      }
    };
  }, [phase, onClose, returnFocusTo]);

  // Soft drifting petals behind the full-screen letter
  useEffect(() => {
    if (phase !== "letter" || reducedMotion) return;
    const canvas = petalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const isMobile = w < 680;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#fde68a", "#fbcfe8", "#e9d5ff", "#fffbeb"];
    const count = isMobile ? 16 : 32;
    const petals = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: -10 + Math.random() * 20,
      vy: 14 + Math.random() * 22,
      size: 4 + Math.random() * 5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.4,
      alpha: 0.16 + Math.random() * 0.28,
      color: colors[i % colors.length],
    }));

    let rafId = 0;
    let lastTs = performance.now();
    const tick = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const p of petals) {
        p.x += (p.vx + Math.sin(ts * 0.0012 + p.angle) * 10) * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        if (p.y > h + 16) {
          p.y = -16;
          p.x = Math.random() * w;
        }
        if (p.x < -16) p.x = w + 16;
        if (p.x > w + 16) p.x = -16;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [phase, reducedMotion]);

  const handleEnvelopeTap = useCallback(() => {
    if (openingSeal) return;
    if (reducedMotion) {
      onOpenLetter();
      return;
    }
    setOpeningSeal(true);
    openTimerRef.current = window.setTimeout(() => {
      setOpeningSeal(false);
      onOpenLetter();
    }, 560);
  }, [openingSeal, reducedMotion, onOpenLetter]);

  const handleReadAgain = useCallback(() => {
    setRevealKey((k) => k + 1);
  }, []);

  if (phase === "envelope") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040310]/40 backdrop-blur-[2px] px-4"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <button
          type="button"
          onClick={handleEnvelopeTap}
          aria-label={solarCopy.openLetterAria}
          className="group relative flex flex-col items-center focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-amber-200 rounded-2xl"
        >
          {/* Warm golden halo behind sealed envelope */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-12 rounded-full transition-all duration-500 ${
              openingSeal ? "scale-150 opacity-100" : "scale-100 opacity-80 group-hover:scale-110"
            }`}
            style={{
              background:
                "radial-gradient(circle, rgba(254,240,138,0.42) 0%, rgba(244,114,182,0.18) 45%, rgba(0,0,0,0) 72%)",
            }}
          />

          {/* Procedural SVG Envelope with Flower Wax Seal */}
          <div
            className={`relative transition-all duration-500 ${
              openingSeal
                ? "scale-110 -translate-y-4 opacity-0"
                : "animate-[bounce_3.8s_ease-in-out_infinite] motion-reduce:animate-none"
            }`}
          >
            <svg
              width="176"
              height="124"
              viewBox="0 0 176 124"
              fill="none"
              aria-hidden="true"
              className="drop-shadow-[0_14px_38px_rgba(253,224,71,0.35)]"
            >
              <defs>
                <linearGradient id="envBody" x1="0" y1="0" x2="176" y2="124" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e1338" />
                  <stop offset="50%" stopColor="#150d2b" />
                  <stop offset="100%" stopColor="#261542" />
                </linearGradient>
                <linearGradient id="envFlap" x1="88" y1="6" x2="88" y2="74" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2e1b52" />
                  <stop offset="100%" stopColor="#1a1033" />
                </linearGradient>
                <radialGradient id="waxSeal" cx="50%" cy="45%" r="55%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="55%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </radialGradient>
              </defs>

              {/* Envelope body */}
              <rect
                x="6"
                y="12"
                width="164"
                height="104"
                rx="12"
                fill="url(#envBody)"
                stroke="#fde68a"
                strokeOpacity="0.6"
                strokeWidth="1.4"
              />

              {/* Inner diagonal fold lines */}
              <path
                d="M10 112 L88 60 L166 112"
                stroke="#fde68a"
                strokeOpacity="0.22"
                strokeWidth="1.1"
              />

              {/* Top envelope flap (lifts slightly when opening) */}
              <path
                d={openingSeal ? "M10 16 L88 -10 L166 16" : "M10 16 L88 70 L166 16"}
                fill="url(#envFlap)"
                stroke="#fde68a"
                strokeOpacity="0.55"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />

              {/* Flower-shaped golden wax seal */}
              <g transform="translate(88 66)">
                <circle r="16" fill="url(#waxSeal)" />
                {[0, 72, 144, 216, 288].map((deg) => (
                  <ellipse
                    key={deg}
                    cx="0"
                    cy="-6.5"
                    rx="3.4"
                    ry="5.4"
                    fill="#fffbeb"
                    fillOpacity="0.88"
                    transform={`rotate(${deg})`}
                  />
                ))}
                <circle r="3.2" fill="#f59e0b" />
              </g>
            </svg>
          </div>

          <span
            className="relative mt-5 rounded-full border border-amber-200/35 bg-[#0d0820]/80 px-5 py-2 font-sans text-xs uppercase tracking-[0.22em] text-amber-100 backdrop-blur-md transition-colors group-hover:border-amber-200/75"
            style={{ textShadow: "0 0 14px rgba(254, 240, 138, 0.5)" }}
          >
            {solarCopy.openLetterHint}
          </span>
        </button>
      </div>
    );
  }

  // Full-Screen Final Letter View
  const totalBlocks = 1 + copy.paragraphs.length; // greeting + paragraphs

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={copy.dialogAriaLabel}
      tabIndex={-1}
      className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-[#060412]/88 backdrop-blur-lg outline-none"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* Soft drifting petals canvas behind the letter */}
      <canvas
        ref={petalCanvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full"
      />

      {/* Centered Deep-Violet Glass Letter Sheet (max-w 640px) */}
      <article
        key={revealKey}
        className="relative z-10 my-auto w-full max-w-[640px] rounded-3xl border border-amber-200/35 bg-[#110a24]/92 px-6 py-8 text-[#fdfbf7] shadow-[0_24px_80px_rgba(0,0,0,0.68),0_0_48px_rgba(253,224,71,0.12)] backdrop-blur-xl sm:px-11 sm:py-12"
      >
        <p className="font-sans text-[11px] uppercase tracking-[0.28em] text-amber-200/80">
          {copy.eyebrow}
        </p>

        {/* Greeting */}
        <h2
          className={`mt-4 font-serif text-2xl font-light tracking-wide text-amber-50 sm:text-3xl ${
            reducedMotion ? "" : "opacity-0 animate-fade-in-up"
          }`}
          style={reducedMotion ? undefined : { animationDelay: "120ms" }}
        >
          {copy.greeting}
        </h2>

        {/* Paragraphs (each fades in ~0.8s apart with gentle upward drift) */}
        <div className="mt-6 space-y-5 font-serif text-[18px] leading-[1.85] font-light text-[#f8f4ec]/95 sm:text-[21px]">
          {copy.paragraphs.map((para, idx) => {
            const delayMs = 120 + (idx + 1) * 800;
            const isFirst = idx === 0 && para.length > 1;
            return (
              <p
                key={idx}
                className={reducedMotion ? "" : "opacity-0 animate-fade-in-up"}
                style={reducedMotion ? undefined : { animationDelay: `${delayMs}ms` }}
              >
                {isFirst ? (
                  <>
                    <span className="float-left mr-2.5 mt-1 font-serif text-5xl leading-[0.82] font-light text-amber-200 sm:text-6xl">
                      {para.charAt(0)}
                    </span>
                    {para.slice(1)}
                  </>
                ) : (
                  para
                )}
              </p>
            );
          })}
        </div>

        {/* Closing & Signature */}
        <div
          className={`mt-8 border-t border-amber-200/15 pt-6 ${
            reducedMotion ? "" : "opacity-0 animate-fade-in-up"
          }`}
          style={
            reducedMotion
              ? undefined
              : { animationDelay: `${120 + totalBlocks * 800}ms` }
          }
        >
          <p className="font-serif text-[18px] font-light italic text-[#f8f4ec]/85 sm:text-[20px]">
            {copy.closing}
          </p>
          <p className="mt-1.5 font-serif text-xl font-normal tracking-wide text-amber-100 sm:text-2xl">
            {copy.signature}
          </p>

          {copy.ps.trim() && (
            <p
              className={`mt-5 font-serif text-base font-light italic leading-relaxed text-amber-100/75 sm:text-lg ${
                reducedMotion ? "" : "opacity-0 animate-fade-in-up"
              }`}
              style={
                reducedMotion
                  ? undefined
                  : { animationDelay: `${120 + (totalBlocks + 1) * 800}ms` }
              }
            >
              {copy.ps}
            </p>
          )}
        </div>

        {/* Bottom Actions: Back to our sky, Read again, Replay the finale */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-gradient-to-r from-amber-200 via-yellow-100 to-pink-200 px-5 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#110a24] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              {backLabel}
            </button>
            <button
              type="button"
              onClick={handleReadAgain}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-amber-200/35 bg-white/5 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-amber-100/90 transition hover:border-amber-200/70 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              {copy.readAgainLabel}
            </button>
          </div>

          <button
            type="button"
            onClick={onReplayFinale}
            className="font-sans text-[11px] uppercase tracking-[0.16em] text-amber-200/70 underline-offset-4 transition hover:text-amber-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200 rounded-sm"
          >
            {copy.replayFinaleLabel}
          </button>
        </div>
      </article>
    </div>
  );
}
