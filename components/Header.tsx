"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { SITE_CONTENT } from "@/lib/content";

const NAV_ITEMS = SITE_CONTENT.nav;

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key and lock body scroll while open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-cosmos-navy/90 via-cosmos-navy/65 to-transparent backdrop-blur-[2px]">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-5 pb-3">
        {/* Top row: Logo left + Mobile hamburger right */}
        <div className="flex items-center justify-between pb-3.5 border-b border-star-white/15">
          <Link
            href="/"
            className="font-serif text-xl sm:text-2xl font-light uppercase tracking-[0.26em] text-star-white transition-all duration-300 hover:text-shadow-glow-subtle focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple rounded-sm"
          >
            {SITE_CONTENT.brand.logo}
          </Link>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="lg:hidden inline-flex items-center justify-center p-2 text-star-white/90 hover:text-star-white hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.75)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple rounded-md"
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        {/* Desktop Centered Navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center justify-center pt-3.5"
        >
          <ul className="flex items-center justify-center gap-x-3.5 text-[11px] font-sans uppercase tracking-[0.18em]">
            {NAV_ITEMS.map((item, index) => {
              const active = isActive(item.href);
              return (
                <Fragment key={item.href}>
                  <li>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`px-1 py-1 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple rounded-sm ${
                        active
                          ? "text-star-white font-semibold text-shadow-glow-subtle"
                          : "text-star-white/75 font-normal hover:text-star-white hover:text-shadow-glow-subtle"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                  {index < NAV_ITEMS.length - 1 && (
                    <li
                      aria-hidden="true"
                      className="select-none text-star-white/30 font-light"
                    >
                      |
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Mobile Full-Screen Navigation Overlay */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-50 flex flex-col bg-cosmos-navy/95 backdrop-blur-xl lg:hidden"
        >
          {/* Ambient nebula glow inside mobile overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.22),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(236,72,153,0.16),transparent_50%)]"
          />

          <div className="relative flex items-center justify-between px-6 sm:px-10 pt-5 pb-3.5 border-b border-star-white/15">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="font-serif text-xl sm:text-2xl font-light uppercase tracking-[0.26em] text-star-white"
            >
              {SITE_CONTENT.brand.logo}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="inline-flex items-center justify-center p-2 text-star-white/90 hover:text-star-white hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.75)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple rounded-md"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <nav
            aria-label="Mobile primary navigation"
            className="relative flex flex-1 flex-col items-center justify-center px-6"
          >
            <ul className="flex flex-col items-center gap-6 text-sm font-sans uppercase tracking-[0.22em]">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block py-1 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple rounded-sm ${
                        active
                          ? "text-star-white font-semibold text-shadow-glow"
                          : "text-star-white/75 hover:text-star-white hover:text-shadow-glow-subtle"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
