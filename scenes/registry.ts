"use client";

import type { ComponentType } from "react";
import DayWeMetScene from "@/components/DayWeMetScene";
import FirstDateScene from "@/components/FirstDateScene";
import SafePlaceScene from "@/components/SafePlaceScene";
import SunBloomScene from "@/components/SunBloomScene";
import YourLaughScene from "@/components/YourLaughScene";
import { SITE_CONTENT } from "@/lib/content";

export interface MemorySceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

export interface SceneRegistryEntry {
  eyebrow: string;
  title: string;
  Scene: ComponentType<MemorySceneProps>;
}

/**
 * Central registry mapping celestial IDs (Sun & planets) to their full-screen
 * interactive memory scenes. Only planets registered here display the
 * "Open this memory" button in the Solar System side panel.
 */
export const SCENE_REGISTRY: Record<string, SceneRegistryEntry> = {
  [SITE_CONTENT.solarSystem.sun.id]: {
    eyebrow: SITE_CONTENT.solarSystem.sun.subtitle,
    title: SITE_CONTENT.solarSystem.sun.name,
    Scene: SunBloomScene,
  },
  "my-safe-place": {
    eyebrow: SITE_CONTENT.safePlace.eyebrow,
    title: SITE_CONTENT.safePlace.title,
    Scene: SafePlaceScene,
  },
  "our-first-date": {
    eyebrow: SITE_CONTENT.firstDate.eyebrow,
    title: SITE_CONTENT.firstDate.title,
    Scene: FirstDateScene,
  },
  "the-day-we-met": {
    eyebrow: SITE_CONTENT.dayWeMet.eyebrow,
    title: SITE_CONTENT.dayWeMet.title,
    Scene: DayWeMetScene,
  },
  "your-laugh": {
    eyebrow: SITE_CONTENT.yourLaugh.eyebrow,
    title: SITE_CONTENT.yourLaugh.title,
    Scene: YourLaughScene,
  },
};

export function getRegisteredScene(
  planetId: string | null | undefined
): SceneRegistryEntry | null {
  if (!planetId) return null;
  return SCENE_REGISTRY[planetId] ?? null;
}
