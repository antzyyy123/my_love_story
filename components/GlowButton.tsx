import Link from "next/link";
import type { ReactNode } from "react";

interface GlowButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  ariaLabel?: string;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center rounded-full border border-star-white/60 bg-cosmos-navy/70 px-8 py-3.5 font-sans text-xs sm:text-[13px] font-medium uppercase tracking-[0.22em] text-star-white backdrop-blur-md shadow-glow transition-all duration-300 ease-out hover:scale-[1.03] hover:border-star-white hover:bg-cosmos-deep/85 hover:shadow-glow-strong active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple";

export default function GlowButton({
  children,
  href,
  onClick,
  type = "button",
  className = "",
  ariaLabel,
}: GlowButtonProps) {
  const combinedClasses = `${BASE_CLASSES} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={combinedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className={combinedClasses}
    >
      {children}
    </button>
  );
}
