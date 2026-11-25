"use client";

import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { SITE_CONTENT } from "@/lib/content";
import "./MemoryWindow.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class MemoryErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="font-serif text-2xl font-light text-star-white">
            {SITE_CONTENT.common.memoryWindowFallbackTitle}
          </p>
          <p className="mt-2 text-xs text-star-white/70">
            {SITE_CONTENT.common.memoryWindowFallbackBody}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface MemoryWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  returnFocusTo?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Reusable portal modal shell for celestial memory windows.
 * Renders into document.body with guaranteed entry transition, ESC/backdrop close,
 * focus trap, scroll lock, error boundary, and focus restoration.
 */
export default function MemoryWindow({
  isOpen,
  onClose,
  title,
  subtitle,
  returnFocusTo,
  children,
}: MemoryWindowProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const returnTarget = returnFocusTo?.current ?? null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Flip visible after first paint so CSS transition always reaches opacity: 1
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        setVisible(true);
        closeBtnRef.current?.focus();
      });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el instanceof SVGElement);

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      setVisible(false);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = originalOverflow;

      const target = returnTarget ?? previousFocusRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, [isOpen, onClose, returnFocusTo]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className={`mw-overlay ${visible ? "mw-overlay-visible" : ""}`}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mw-panel"
      >
        <header className="mw-header">
          <div className="mw-title-group">
            {subtitle && <p className="mw-subtitle">{subtitle}</p>}
            <h2 id={titleId} className="mw-title">
              {title}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={SITE_CONTENT.common.closeMemoryWindowAria}
            className="mw-close-button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>

        <div className="mw-body">
          <MemoryErrorBoundary>{children}</MemoryErrorBoundary>
        </div>
      </div>
    </div>,
    document.body
  );
}
