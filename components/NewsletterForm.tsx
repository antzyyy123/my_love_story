"use client";

import { SITE_CONTENT, TOGETHER_SINCE } from "@/lib/content";

/**
 * Displays a live "Together for X days" pill calculated from TOGETHER_SINCE.
 * Renders nothing while TOGETHER_SINCE is empty.
 */
export default function NewsletterForm() {
  if (!TOGETHER_SINCE.trim()) {
    return null;
  }

  const startDate = new Date(`${TOGETHER_SINCE.trim()}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const unit =
    days === 1 ? SITE_CONTENT.common.daySingular : SITE_CONTENT.common.dayPlural;

  return (
    <div
      aria-label={`${SITE_CONTENT.common.togetherPrefix} ${days} ${unit}`}
      className="inline-flex items-center rounded-full border border-star-white/25 bg-cosmos-deep/70 px-4 py-1.5 text-xs font-sans tracking-[0.08em] text-star-white/85 shadow-glow"
    >
      {SITE_CONTENT.common.togetherPrefix}{" "}
      <span className="mx-1.5 font-semibold text-nebula-teal">{days}</span>{" "}
      {unit}
    </div>
  );
}
