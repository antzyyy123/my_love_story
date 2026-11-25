"use client";

import { useEffect } from "react";
import { content } from "@/lib/content";

let hasLoggedDevWarning = false;

function countPlaceholders(value: unknown): number {
  if (typeof value === "string") {
    const matches = value.match(/\[[^\]\n]{2,}\]/g);
    return matches ? matches.length : 0;
  }
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) total += countPlaceholders(item);
    return total;
  }
  if (value && typeof value === "object") {
    let total = 0;
    for (const v of Object.values(value)) total += countPlaceholders(v);
    return total;
  }
  return 0;
}

/**
 * Development-only startup console warning listing remaining [placeholders]
 * in lib/content.ts. Renders nothing and never runs in production builds.
 */
export default function DevPlaceholderNotice() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || hasLoggedDevWarning) return;
    hasLoggedDevWarning = true;

    const remaining = countPlaceholders(content);
    if (remaining > 0) {
      console.warn(
        `[Our Cosmos] ${remaining} [placeholder] item${remaining === 1 ? "" : "s"} still need personalization in lib/content.ts. Run "npm run check:content" to see exact line numbers.`
      );
    }
  }, []);

  return null;
}
