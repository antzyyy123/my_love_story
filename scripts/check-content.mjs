#!/usr/bin/env node
/**
 * Scans lib/content.ts for any remaining [bracketed placeholders] inside string values,
 * prints each one with its section and line number, and exits with the warning count.
 */

import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve(process.cwd(), "lib/content.ts");
const source = fs.readFileSync(filePath, "utf8");
const lines = source.split(/\r?\n/);

let currentSection = "SETTINGS";
let inBlockComment = false;
let contentStarted = false;

/** @type {Array<{ section: string; line: number; match: string }>} */
const warnings = [];

const SECTION_RE = /^\s*\/\/\s*(SECTION\s+\d+\s+—\s+.*|6\.\d+\s+.*)$/;
const PLACEHOLDER_RE = /\[[^\]\n]{2,}\]/g;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNo = i + 1;

  // Start scanning from SECTION 1 onward (skip header instructions & TypeScript interfaces)
  if (!contentStarted) {
    if (line.includes("SECTION 1 — SETTINGS")) {
      contentStarted = true;
      currentSection = "SECTION 1 — SETTINGS";
    }
    continue;
  }

  // Track section / sub-section banners
  const secMatch = SECTION_RE.exec(line);
  if (secMatch) {
    currentSection = secMatch[1].trim();
    continue;
  }

  // Track block comments
  if (inBlockComment) {
    if (line.includes("*/")) {
      inBlockComment = false;
    }
    continue;
  }
  const trimmed = line.trim();
  if (trimmed.startsWith("/*")) {
    if (!trimmed.includes("*/")) inBlockComment = true;
    continue;
  }
  if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
    continue;
  }

  // Track SECTION 7 sub-pages cleanly
  if (/^\s*(ourMemories|flowersForYou|ourStory|loveLetters|myPromises|writeToMe)\s*:\s*\{/.test(line)) {
    const pageNames = {
      ourMemories: "SECTION 7 — OUR MEMORIES PAGE",
      flowersForYou: "SECTION 7 — FLOWERS FOR YOU PAGE",
      ourStory: "SECTION 7 — OUR STORY PAGE",
      loveLetters: "SECTION 7 — LOVE LETTERS PAGE",
      myPromises: "SECTION 7 — MY PROMISES PAGE",
      writeToMe: "SECTION 7 — WRITE TO ME PAGE",
    };
    const key = /^\s*(\w+)\s*:/.exec(line)?.[1];
    if (key && key in pageNames) {
      currentSection = pageNames[key];
    }
  }

  // Extract string literals on this line so we never match TypeScript array brackets
  const stringLiterals = line.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g);
  if (!stringLiterals) continue;

  for (const lit of stringLiterals) {
    const matches = lit.match(PLACEHOLDER_RE);
    if (!matches) continue;
    for (const m of matches) {
      warnings.push({ section: currentSection, line: lineNo, match: m });
    }
  }
}

if (warnings.length === 0) {
  console.log("All placeholders in lib/content.ts are filled! (0 warnings)");
  process.exit(0);
}

// Group by section for clean readability
/** @type {Map<string, Array<{ line: number; match: string }>>} */
const bySection = new Map();
for (const w of warnings) {
  const list = bySection.get(w.section) ?? [];
  list.push({ line: w.line, match: w.match });
  bySection.set(w.section, list);
}

console.log(`\nRemaining [placeholders] in lib/content.ts:\n`);
for (const [section, items] of bySection.entries()) {
  console.log(`  ${section} (${items.length})`);
  for (const item of items) {
    console.log(`    line ${String(item.line).padStart(4, " ")}: ${item.match}`);
  }
  console.log("");
}

console.warn(
  `Found ${warnings.length} remaining placeholder warning${warnings.length === 1 ? "" : "s"} in lib/content.ts.`
);

// Exit with the warning count (clamped to valid POSIX exit status range)
process.exit(Math.min(warnings.length, 125));
