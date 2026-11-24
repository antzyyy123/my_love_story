"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import GalaxyCanvas from "./GalaxyCanvas";
import GlowButton from "./GlowButton";
import { SITE_CONTENT } from "@/lib/content";

const FORWARD_DURATION_MS = 2900;
const REVERSE_DURATION_MS = 2000;
const REDUCED_DURATION_MS = 420;
const FAILSAFE_TIMEOUT_MS = 4000;
// In GalaxyCanvas: warpScale = 1 + easeInOutCubic(warp) * 8.5 -> warp = 0.56 gives ~6x zoom
const REVERSE_START_WARP = 0.56;

export default function GalaxyTransition() {
  const router = useRouter();

  // Strictly component-scoped refs (fresh on every real mount, cleaned up on unmount)
  const warpProgressRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const navTimerRef = useRef<number>(0);
  const failsafeTimerRef = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  // Preserves the consumed sessionStorage flag across React 19 StrictMode dev double-mount
  const pendingReturnRef = useRef<boolean>(false);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [contentKey, setContentKey] = useState(0);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [flashScale, setFlashScale] = useState(0.2);

  const clearAllTimers = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    window.clearTimeout(navTimerRef.current);
    navTimerRef.current = 0;
    window.clearTimeout(failsafeTimerRef.current);
    failsafeTimerRef.current = 0;
  }, []);

  /**
   * Forces the normal resting Home state (zoom = 1, warp = 0, no overlay in DOM, text visible).
   */
  const forceNormalHomeState = useCallback(
    (retriggerStagger = false) => {
      clearAllTimers();
      warpProgressRef.current = 0;
      isTransitioningRef.current = false;
      pendingReturnRef.current = false;
      setIsTransitioning(false);
      setFlashOpacity(0);
      setFlashScale(0.2);
      setOverlayMounted(false);
      if (retriggerStagger) {
        setContentKey((k) => k + 1);
      }
      setShowContent(true);
    },
    [clearAllTimers]
  );

  // Lifecycle: fresh reset on mount + optional reverse transition when arrivedFrom === "solar"
  useEffect(() => {
    warpProgressRef.current = 0;
    isTransitioningRef.current = false;

    const flagSet =
      typeof window !== "undefined" &&
      sessionStorage.getItem("arrivedFrom") === "solar";

    if (flagSet) {
      sessionStorage.removeItem("arrivedFrom");
      pendingReturnRef.current = true;
    }

    if (!pendingReturnRef.current) {
      // Direct load, refresh, or browser Back button -> normal Home immediately
      return () => {
        clearAllTimers();
        warpProgressRef.current = 0;
        isTransitioningRef.current = false;
      };
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    isTransitioningRef.current = true;

    // 4-second failsafe guarantees we can never get stuck in a transition state
    failsafeTimerRef.current = window.setTimeout(() => {
      forceNormalHomeState(true);
    }, FAILSAFE_TIMEOUT_MS);

    if (reducedMotion) {
      let fadeTimer = 0;
      const startFrame = requestAnimationFrame(() => {
        setIsTransitioning(true);
        setShowContent(false);
        setOverlayMounted(true);
        setFlashScale(2);
        setFlashOpacity(1);

        fadeTimer = window.setTimeout(() => {
          setFlashOpacity(0);
          navTimerRef.current = window.setTimeout(() => {
            forceNormalHomeState(true);
          }, REDUCED_DURATION_MS);
        }, 40);
      });

      return () => {
        cancelAnimationFrame(startFrame);
        window.clearTimeout(fadeTimer);
        clearAllTimers();
        warpProgressRef.current = 0;
        isTransitioningRef.current = false;
      };
    }

    // Smooth ~2s reverse zoom-out (zoom ~6x -> 1x, warp streaks shrink to stars, glow fades out)
    warpProgressRef.current = REVERSE_START_WARP;
    const start = performance.now();

    const startFrame = requestAnimationFrame(() => {
      setIsTransitioning(true);
      setShowContent(false);
      setOverlayMounted(true);
      setFlashOpacity(0.95);
      setFlashScale(1.85);

      const stepReturn = (now: number) => {
        const t = Math.min(1, (now - start) / REVERSE_DURATION_MS);
        // Cubic ease-out from 1 -> 0
        const remaining = Math.pow(1 - t, 3);

        warpProgressRef.current = REVERSE_START_WARP * remaining;

        // Glow fades out over the first 65% of the zoom-out
        const glowRemaining = Math.max(0, 1 - t / 0.65);
        setFlashOpacity(glowRemaining * glowRemaining * 0.95);
        setFlashScale(0.25 + glowRemaining * 1.6);

        if (t < 1) {
          rafRef.current = requestAnimationFrame(stepReturn);
        } else {
          // Animation complete: remove overlay from DOM & stagger-reveal hero text
          forceNormalHomeState(true);
        }
      };

      rafRef.current = requestAnimationFrame(stepReturn);
    });

    return () => {
      cancelAnimationFrame(startFrame);
      clearAllTimers();
      warpProgressRef.current = 0;
      isTransitioningRef.current = false;
    };
  }, [clearAllTimers, forceNormalHomeState]);

  const handleEnterGalaxy = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setShowContent(false);
    setOverlayMounted(true);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (typeof window !== "undefined") {
      sessionStorage.setItem("floral-cosmos-arrival", "1");
    }

    // 4-second failsafe in case navigation or animation stalls
    failsafeTimerRef.current = window.setTimeout(() => {
      forceNormalHomeState(false);
    }, FAILSAFE_TIMEOUT_MS);

    if (reducedMotion) {
      setFlashScale(2);
      setFlashOpacity(1);
      navTimerRef.current = window.setTimeout(() => {
        clearAllTimers();
        warpProgressRef.current = 0;
        isTransitioningRef.current = false;
        router.push("/solar-system");
      }, REDUCED_DURATION_MS);
      return;
    }

    const start = performance.now();

    const stepForward = (now: number) => {
      const progress = Math.min(1, (now - start) / FORWARD_DURATION_MS);
      warpProgressRef.current = progress;

      if (progress > 0.52) {
        const flashT = Math.min(1, (progress - 0.52) / 0.44);
        const easedFlash = flashT * flashT * (3 - 2 * flashT);
        setFlashOpacity(easedFlash);
        setFlashScale(0.25 + easedFlash * 2.1);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(stepForward);
      } else {
        setFlashOpacity(1);
        clearAllTimers();
        warpProgressRef.current = 0;
        isTransitioningRef.current = false;
        router.push("/solar-system");
      }
    };

    rafRef.current = requestAnimationFrame(stepForward);
  }, [clearAllTimers, forceNormalHomeState, router]);

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-cosmos-navy px-6 py-12">
      {/* Full-Screen Procedural Flower Galaxy Canvas */}
      <GalaxyCanvas warpProgressRef={warpProgressRef} />

      {/* Centered Hero Copy slightly lowered so the bright golden core glows visibly around it */}
      {showContent && (
        <div
          key={contentKey}
          className={`relative z-10 mx-auto mt-14 sm:mt-24 flex max-w-[900px] flex-col items-center text-center transition-all duration-500 ease-out ${
            isTransitioning
              ? "pointer-events-none scale-95 opacity-0"
              : "scale-100 opacity-100"
          }`}
        >
          <h1
            className="opacity-0 animate-fade-in-up font-serif font-light uppercase text-star-white text-shadow-glow tracking-[0.07em] leading-[1.12] [font-size:clamp(2rem,3.6vw,4rem)] motion-reduce:opacity-100"
            style={{ animationDelay: "120ms" }}
          >
            {SITE_CONTENT.home.titleLine1}
            <br />
            {SITE_CONTENT.home.titleLine2}
          </h1>

          <p
            className="mt-5 opacity-0 animate-fade-in-up font-sans font-light uppercase text-star-white/85 tracking-[0.26em] [font-size:clamp(0.72rem,1.3vw,1rem)] motion-reduce:opacity-100"
            style={{ animationDelay: "320ms" }}
          >
            {SITE_CONTENT.home.subtitle}
          </p>

          <div
            className="mt-10 opacity-0 animate-fade-in-up motion-reduce:opacity-100"
            style={{ animationDelay: "520ms" }}
          >
            <GlowButton
              type="button"
              onClick={handleEnterGalaxy}
              ariaLabel={SITE_CONTENT.home.ctaAriaLabel}
            >
              {SITE_CONTENT.home.ctaLabel}
            </GlowButton>
          </div>
        </div>
      )}

      {/* White-Violet Warp Flash Overlay — unmounted from DOM when not transitioning */}
      {overlayMounted && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center transition-opacity duration-300"
          style={{
            opacity: flashOpacity,
          }}
        >
          <div
            className="h-[140vmax] w-[140vmax] rounded-full"
            style={{
              transform: `scale(${flashScale})`,
              background:
                "radial-gradient(circle at center, #ffffff 0%, #f5f3ff 28%, #c084fc 58%, #6d28d9 85%, #05050f 100%)",
            }}
          />
        </div>
      )}
    </main>
  );
}
