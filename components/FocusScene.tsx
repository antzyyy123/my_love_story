"use client";

import {
  Component,
  useEffect,
  useRef,
  type ErrorInfo,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { SITE_CONTENT } from "@/lib/content";

interface FocusSceneErrorBoundaryProps {
  onExit: () => void;
  children: ReactNode;
}

interface FocusSceneErrorBoundaryState {
  hasError: boolean;
}

class FocusSceneErrorBoundary extends Component<
  FocusSceneErrorBoundaryProps,
  FocusSceneErrorBoundaryState
> {
  state: FocusSceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FocusSceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FocusScene render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#04040e] p-6 text-center text-star-white">
          <p className="font-serif text-xl font-light text-star-white">
            {SITE_CONTENT.common.memoryFallbackTitle}
          </p>
          <button
            type="button"
            onClick={this.props.onExit}
            className="inline-flex min-h-[44px] items-center rounded-full border border-star-white/30 bg-cosmos-navy/80 px-5 py-2 font-sans text-[11px] uppercase tracking-[0.2em] text-star-white hover:border-star-white"
          >
            {SITE_CONTENT.common.backToSky}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface FocusSceneProps {
  isOpen: boolean;
  onExit: () => void;
  ariaLabel: string;
  returnFocusTo?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Reusable Full-Screen Focus Scene container (100dvh, zero window chrome).
 * Used by the Sun now and ready for every planet's "Open this memory" scene later.
 * Provides portal mounting, focus trap, ESC & browser Back button handling,
 * scroll lock, and focus restoration.
 */
export default function FocusScene({
  isOpen,
  onExit,
  ariaLabel,
  returnFocusTo,
  children,
}: FocusSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onExitRef = useRef(onExit);
  const pushedHistoryRef = useRef(false);
  const exitingViaPopRef = useRef(false);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  // Body scroll lock, focus trap, ESC, browser back button (popstate), and focus return
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevActive = document.activeElement as HTMLElement | null;
    const returnTarget = returnFocusTo?.current ?? null;
    document.body.style.overflow = "hidden";

    // Push a lightweight history entry so browser Back exits the scene gracefully
    exitingViaPopRef.current = false;
    pushedHistoryRef.current = false;
    try {
      window.history.pushState({ focusScene: true }, "");
      pushedHistoryRef.current = true;
    } catch {
      // Ignore if restricted in sandboxed iframes
    }

    // Move initial focus inside the scene for keyboard users
    const focusTimer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? container).focus();
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onExitRef.current();
        return;
      }

      if (e.key === "Tab" && containerRef.current) {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !containerRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !containerRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handlePopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        exitingViaPopRef.current = true;
        onExitRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = prevOverflow;

      // Clean up the pushed history entry if closed via button/ESC rather than browser Back
      if (pushedHistoryRef.current && !exitingViaPopRef.current) {
        pushedHistoryRef.current = false;
        try {
          if (window.history.state && (window.history.state as { focusScene?: boolean }).focusScene) {
            window.history.back();
          }
        } catch {
          // Ignore
        }
      }

      const target = returnTarget ?? prevActive;
      if (target && typeof target.focus === "function") {
        window.setTimeout(() => target.focus(), 40);
      }
    };
  }, [isOpen, returnFocusTo]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="fixed inset-0 z-60 flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#04040e] outline-none"
    >
      <FocusSceneErrorBoundary onExit={onExit}>
        {children}
      </FocusSceneErrorBoundary>
    </div>,
    document.body
  );
}
