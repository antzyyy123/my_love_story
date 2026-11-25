"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import {
  COSMIC_PALETTES,
  createFlowerSprite,
  type FlowerPalette,
  type FlowerSprite,
  type FlowerType,
} from "@/lib/flowers";
import { SITE_CONTENT } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { getRegisteredScene } from "@/scenes/registry";
import FinalLetterOverlay from "./FinalLetterOverlay";
import FocusScene from "./FocusScene";
import {
  CAMERA_ELEVATION,
  clamp,
  createSeededRandom,
  dist,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  GALAXY_BRIGHTNESS,
  GOLDEN_ANGLE,
  lerp,
  phyllotaxisPoint,
  pickRandom,
  randomRange,
  TAU,
} from "@/lib/math";

export interface PlanetConfig {
  id: string;
  name: string;
  flowerName: string;
  flowerType: FlowerType;
  palette: FlowerPalette;
  orbitFactor: number; // desktop fraction of outer orbit radius
  mobileOrbitFactor: number; // wider inner spacing for portrait mobile
  radiusFactor: number; // base 3D radius
  orbitSpeed: number; // rad/s (inner faster)
  spinSpeed: number;
  initialAngle: number;
  inclinationDeg: number; // 1° to 6° orbital tilt
  nodeAngle: number; // ascending node orientation
  hasRings?: boolean;
  moon?: {
    name: string;
    distMult: number;
    speed: number;
    sizeMult: number;
    palette: FlowerPalette;
    flowerType: FlowerType;
  };
  tagline: string;
  description: string;
  orbitPeriodLabel: string;
}

interface CelestialSelection {
  id: string;
  isSun?: boolean;
  name: string;
  subtitle: string;
  description: string;
  paletteName: string;
  cycleLabel: string;
}

const SUN_INFO: CelestialSelection = {
  id: SITE_CONTENT.solarSystem.sun.id,
  isSun: true,
  name: SITE_CONTENT.solarSystem.sun.name,
  subtitle: SITE_CONTENT.solarSystem.sun.subtitle,
  description: SITE_CONTENT.solarSystem.sun.description,
  paletteName: SITE_CONTENT.solarSystem.sun.detailValue1,
  cycleLabel: SITE_CONTENT.solarSystem.sun.detailValue2,
};

const PLANET_TEXT = SITE_CONTENT.solarSystem.planets;

const PLANETS: PlanetConfig[] = [
  {
    id: PLANET_TEXT[0].id,
    name: PLANET_TEXT[0].name,
    flowerName: PLANET_TEXT[0].subtitle,
    flowerType: "rose",
    palette: COSMIC_PALETTES.magenta,
    orbitFactor: 0.24,
    mobileOrbitFactor: 0.28,
    radiusFactor: 20,
    orbitSpeed: 0.22,
    spinSpeed: 0.42,
    initialAngle: 0.6,
    inclinationDeg: 4.5,
    nodeAngle: 0.4,
    tagline: PLANET_TEXT[0].tagline,
    description: PLANET_TEXT[0].description,
    orbitPeriodLabel: PLANET_TEXT[0].detailValue2,
  },
  {
    id: PLANET_TEXT[1].id,
    name: PLANET_TEXT[1].name,
    flowerName: PLANET_TEXT[1].subtitle,
    flowerType: "lily",
    palette: COSMIC_PALETTES.blue,
    orbitFactor: 0.33,
    mobileOrbitFactor: 0.38,
    radiusFactor: 23,
    orbitSpeed: 0.17,
    spinSpeed: -0.34,
    initialAngle: 2.2,
    inclinationDeg: 2.8,
    nodeAngle: 1.9,
    tagline: PLANET_TEXT[1].tagline,
    description: PLANET_TEXT[1].description,
    orbitPeriodLabel: PLANET_TEXT[1].detailValue2,
  },
  {
    id: PLANET_TEXT[2].id,
    name: PLANET_TEXT[2].name,
    flowerName: PLANET_TEXT[2].subtitle,
    flowerType: "orchid",
    palette: COSMIC_PALETTES.purple,
    orbitFactor: 0.43,
    mobileOrbitFactor: 0.48,
    radiusFactor: 26,
    orbitSpeed: 0.135,
    spinSpeed: 0.3,
    initialAngle: 3.9,
    inclinationDeg: 5.2,
    nodeAngle: 3.1,
    moon: {
      name: "Vanda Bud",
      distMult: 1.95,
      speed: 1.15,
      sizeMult: 0.28,
      palette: COSMIC_PALETTES.pink,
      flowerType: "filler",
    },
    tagline: PLANET_TEXT[2].tagline,
    description: PLANET_TEXT[2].description,
    orbitPeriodLabel: PLANET_TEXT[2].detailValue2,
  },
  {
    id: PLANET_TEXT[3].id,
    name: PLANET_TEXT[3].name,
    flowerName: PLANET_TEXT[3].subtitle,
    flowerType: "hydrangea",
    palette: COSMIC_PALETTES.violet,
    orbitFactor: 0.52,
    mobileOrbitFactor: 0.58,
    radiusFactor: 29,
    orbitSpeed: 0.105,
    spinSpeed: -0.26,
    initialAngle: 5.3,
    inclinationDeg: 1.8,
    nodeAngle: 4.5,
    moon: {
      name: "Floret Minor",
      distMult: 2.05,
      speed: -0.92,
      sizeMult: 0.26,
      palette: COSMIC_PALETTES.blue,
      flowerType: "filler",
    },
    tagline: PLANET_TEXT[3].tagline,
    description: PLANET_TEXT[3].description,
    orbitPeriodLabel: PLANET_TEXT[3].detailValue2,
  },
  {
    id: PLANET_TEXT[4].id,
    name: PLANET_TEXT[4].name,
    flowerName: PLANET_TEXT[4].subtitle,
    flowerType: "delphinium",
    palette: COSMIC_PALETTES.teal,
    orbitFactor: 0.66,
    mobileOrbitFactor: 0.70,
    radiusFactor: 25,
    orbitSpeed: 0.08,
    spinSpeed: 0.34,
    initialAngle: 1.35,
    inclinationDeg: 3.6,
    nodeAngle: 2.4,
    tagline: PLANET_TEXT[4].tagline,
    description: PLANET_TEXT[4].description,
    orbitPeriodLabel: PLANET_TEXT[4].detailValue2,
  },
  {
    id: PLANET_TEXT[5].id,
    name: PLANET_TEXT[5].name,
    flowerName: PLANET_TEXT[5].subtitle,
    flowerType: "lotus",
    palette: COSMIC_PALETTES.gold,
    orbitFactor: 0.77,
    mobileOrbitFactor: 0.80,
    radiusFactor: 28,
    orbitSpeed: 0.062,
    spinSpeed: -0.24,
    initialAngle: 4.45,
    inclinationDeg: 5.8,
    nodeAngle: 0.9,
    hasRings: true,
    tagline: PLANET_TEXT[5].tagline,
    description: PLANET_TEXT[5].description,
    orbitPeriodLabel: PLANET_TEXT[5].detailValue2,
  },
  {
    id: PLANET_TEXT[6].id,
    name: PLANET_TEXT[6].name,
    flowerName: PLANET_TEXT[6].subtitle,
    flowerType: "tulip",
    palette: COSMIC_PALETTES.orange,
    orbitFactor: 0.88,
    mobileOrbitFactor: 0.90,
    radiusFactor: 23,
    orbitSpeed: 0.048,
    spinSpeed: 0.31,
    initialAngle: 2.9,
    inclinationDeg: 2.4,
    nodeAngle: 5.1,
    tagline: PLANET_TEXT[6].tagline,
    description: PLANET_TEXT[6].description,
    orbitPeriodLabel: PLANET_TEXT[6].detailValue2,
  },
  {
    id: PLANET_TEXT[7].id,
    name: PLANET_TEXT[7].name,
    flowerName: PLANET_TEXT[7].subtitle,
    flowerType: "peony",
    palette: COSMIC_PALETTES.pink,
    orbitFactor: 1.0,
    mobileOrbitFactor: 1.0,
    radiusFactor: 27,
    orbitSpeed: 0.036,
    spinSpeed: -0.22,
    initialAngle: 0.18,
    inclinationDeg: 4.1,
    nodeAngle: 3.8,
    moon: {
      name: "Quartz Petal",
      distMult: 2.0,
      speed: 0.78,
      sizeMult: 0.27,
      palette: COSMIC_PALETTES.gold,
      flowerType: "lotus",
    },
    tagline: PLANET_TEXT[7].tagline,
    description: PLANET_TEXT[7].description,
    orbitPeriodLabel: PLANET_TEXT[7].detailValue2,
  },
];

function planetToSelection(p: PlanetConfig): CelestialSelection {
  const matched = PLANET_TEXT.find((item) => item.id === p.id);
  return {
    id: p.id,
    name: p.name,
    subtitle: p.flowerName,
    description: p.description,
    paletteName: matched ? matched.detailValue1 : p.palette.name,
    cycleLabel: p.orbitPeriodLabel,
  };
}

interface BgStar {
  nx: number;
  ny: number;
  radius: number;
  baseAlpha: number;
  speed: number;
  phase: number;
  color: string;
  sparkle: boolean;
  depth: number;
}

interface TrailPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  sprite: HTMLCanvasElement;
  rot: number;
  spin: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  tailLength: number;
  colorRgb: string;
  headSize: number;
  isPetal: boolean;
  bloomSprite: FlowerSprite;
  trailSprite: HTMLCanvasElement;
  spawnAccum: number;
}

interface PollenParticle {
  angle: number;
  dist: number;
  zOff: number;
  speed: number;
  size: number;
  phase: number;
  alpha: number;
}

interface BurstSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface SpherePoint {
  x: number;
  y: number;
  z: number;
  isBloom: boolean;
  sizeMult: number;
  rotOffset: number;
}

interface RingPetal {
  angle: number;
  rMult: number;
  size: number;
  colorIdx: number;
}

interface BeltPetal {
  orbitFactor: number;
  mobileOrbitFactor: number;
  angle: number;
  zOff: number;
  speed: number;
  size: number;
  colorIdx: number;
  rot: number;
  spin: number;
}

interface DriftingPetal {
  angle: number;
  dist: number;
  zTilt: number;
  speed: number;
  size: number;
  rot: number;
}

interface PlanetRuntime {
  config: PlanetConfig;
  flowerSprite: FlowerSprite;
  petalSprite: HTMLCanvasElement;
  moonSprite: FlowerSprite | null;
  spherePoints: SpherePoint[];
  ringPetals: RingPetal[];
  driftingPetals: DriftingPetal[];
  angle: number;
  spin: number;
  moonAngle: number;
  currentScale: number;
  wx: number;
  wy: number;
  wz: number;
  screenX: number;
  screenY: number;
  screenRadius: number;
  depth: number;
  pScale: number;
  depthFade: number;
}

const STAR_COLORS = [
  "248, 250, 252",
  "248, 250, 252",
  "186, 230, 253",
  "254, 240, 138",
  "251, 207, 232",
];

function createRadialPuffSprite(
  stops: Array<[number, string]>,
  size = 256
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, color] of stops) {
    grad.addColorStop(offset, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function createSmallPetalSprite(palette: FlowerPalette, size = 14): HTMLCanvasElement {
  const pad = Math.ceil(size * 1.15) + 2;
  const dim = pad * 2;
  const c = document.createElement("canvas");
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  ctx.translate(pad, pad);
  const w = size * 0.45;
  const h = size * 0.65;
  const grad = ctx.createLinearGradient(0, h, 0, -h);
  grad.addColorStop(0, palette.primary);
  grad.addColorStop(0.55, palette.secondary);
  grad.addColorStop(1, palette.highlight);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(-w, h * 0.25, -w * 0.85, -h * 0.8, 0, -h);
  ctx.bezierCurveTo(w * 0.85, -h * 0.8, w, h * 0.25, 0, h);
  ctx.closePath();
  ctx.fill();
  return c;
}

function createFibonacciSphere(count: number, seed: number): SpherePoint[] {
  const rng = createSeededRandom(seed);
  const pts: SpherePoint[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * GOLDEN_ANGLE;
    pts.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      isBloom: i % 5 === 0,
      sizeMult: 0.78 + rng() * 0.44,
      rotOffset: rng() * TAU,
    });
  }
  return pts;
}

function drawSolarFlower3D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  timeSec: number,
  bloomProgress: number,
  hoverAmount: number,
  parallaxX: number,
  parallaxY: number
) {
  const pulse = 1 + Math.sin(timeSec * 1.45) * 0.028 + hoverAmount * 0.12;
  const r = radius * pulse;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const coronaR = r * (2.55 + hoverAmount * 0.48);
  const coronaGrad = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, coronaR);
  coronaGrad.addColorStop(0, "rgba(255, 248, 220, 0.64)");
  coronaGrad.addColorStop(0.28, "rgba(251, 191, 36, 0.36)");
  coronaGrad.addColorStop(0.58, "rgba(234, 88, 12, 0.14)");
  coronaGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coronaGrad;
  ctx.beginPath();
  ctx.arc(0, 0, coronaR, 0, TAU);
  ctx.fill();

  const rayCount = 24;
  ctx.rotate(timeSec * 0.055);
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * TAU;
    const rayLen =
      r * (1.5 + (i % 2 === 0 ? 0.5 : 0.22) + hoverAmount * 0.44) * bloomProgress;
    const rayW = r * (i % 2 === 0 ? 0.085 : 0.045);
    ctx.save();
    ctx.rotate(angle);
    const rayGrad = ctx.createLinearGradient(0, 0, 0, -rayLen);
    rayGrad.addColorStop(0, `rgba(254, 240, 138, ${0.28 + hoverAmount * 0.18})`);
    rayGrad.addColorStop(0.6, `rgba(251, 146, 60, ${0.12 + hoverAmount * 0.10})`);
    rayGrad.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(-rayW, 0);
    ctx.lineTo(0, -rayLen);
    ctx.lineTo(rayW, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const layers = [
    { count: 22, len: 1.18, width: 0.23, speed: 0.055, z: -2.5, c0: "#9a3412", c1: "#ea580c", c2: "#fbbf24" },
    { count: 18, len: 1.02, width: 0.24, speed: -0.075, z: -1.5, c0: "#c2410c", c1: "#f97316", c2: "#fde047" },
    { count: 16, len: 0.86, width: 0.23, speed: 0.095, z: -0.5, c0: "#d97706", c1: "#fbbf24", c2: "#fef08a" },
    { count: 14, len: 0.70, width: 0.22, speed: -0.115, z: 0.5, c0: "#ea580c", c1: "#facc15", c2: "#fef9c3" },
    { count: 12, len: 0.54, width: 0.20, speed: 0.14, z: 1.5, c0: "#f59e0b", c1: "#fde047", c2: "#fffbeb" },
    { count: 10, len: 0.39, width: 0.18, speed: -0.16, z: 2.5, c0: "#fbbf24", c1: "#fef08a", c2: "#ffffff" },
  ];

  layers.forEach((layer, idx) => {
    const layerDelay = idx * 0.09;
    const layerOpen = easeOutBack(clamp((bloomProgress - layerDelay) / 0.55, 0, 1));
    if (layerOpen <= 0.01) return;

    const petalLen = r * layer.len * layerOpen;
    const petalW = r * layer.width * layerOpen;

    ctx.save();
    ctx.translate(parallaxX * layer.z * 2.2, parallaxY * layer.z * 2.2);
    ctx.rotate(timeSec * layer.speed + idx * 0.28);
    ctx.shadowColor = "rgba(234, 88, 12, 0.45)";
    ctx.shadowBlur = 7 + hoverAmount * 6;

    for (let i = 0; i < layer.count; i++) {
      ctx.save();
      ctx.rotate((i / layer.count) * TAU);
      const grad = ctx.createLinearGradient(0, 0, 0, -petalLen);
      grad.addColorStop(0, layer.c0);
      grad.addColorStop(0.6, layer.c1);
      grad.addColorStop(1, layer.c2);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-petalW, -petalLen * 0.32, -petalW * 0.65, -petalLen * 0.8, 0, -petalLen);
      ctx.bezierCurveTo(petalW * 0.65, -petalLen * 0.8, petalW, -petalLen * 0.32, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });

  const coreR = r * 0.28 * easeOutCubic(bloomProgress);
  if (coreR > 1) {
    ctx.save();
    ctx.translate(parallaxX * 6, parallaxY * 6);
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    coreGrad.addColorStop(0, "#fffbeb");
    coreGrad.addColorStop(0.5, "#fde047");
    coreGrad.addColorStop(0.85, "#d97706");
    coreGrad.addColorStop(1, "#92400e");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, TAU);
    ctx.fill();

    const seedCount = 46;
    for (let i = 0; i < seedCount; i++) {
      const pt = phyllotaxisPoint(i, seedCount, coreR * 0.86);
      const dotR = Math.max(0.9, coreR * 0.065 * (1 - (pt.r / coreR) * 0.35));
      ctx.fillStyle = i % 3 === 0 ? "#fffbeb" : "#fde047";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, dotR, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

export default function SolarSystemCanvas() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    visitedIds,
    visitedCount,
    totalMemories,
    totalRequired,
    finaleSeen,
    moonFound,
    hydrated,
    markVisited,
    markFinaleSeen,
    markMoonFound,
    markMoonVisited,
  } = useProgress();

  const [hoveredPlanet, setHoveredPlanet] = useState<{
    planet: PlanetConfig;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredMoon, setHoveredMoon] = useState<{ x: number; y: number } | null>(null);
  const [moonNote, setMoonNote] = useState<{ x: number; y: number } | null>(null);
  const [moonAnnouncement, setMoonAnnouncement] = useState("");
  const [selectedItem, setSelectedItem] = useState<CelestialSelection | null>(null);
  const [focusPhase, setFocusPhase] = useState<"idle" | "entering" | "open" | "exiting">("idle");
  const [finalePhase, setFinalePhase] = useState<"idle" | "sequence" | "envelope" | "letter">("idle");
  const [activeSceneTarget, setActiveSceneTarget] = useState<CelestialSelection | null>(null);
  const [sceneMounted, setSceneMounted] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [veilMounted, setVeilMounted] = useState(false);
  const [arrivalFlashOpacity, setArrivalFlashOpacity] = useState(0);
  const isLeavingRef = useRef<boolean>(false);
  const leaveTimerRef = useRef<number>(0);
  const sunTriggerRef = useRef<HTMLButtonElement | null>(null);
  const envelopeBtnRef = useRef<HTMLButtonElement | null>(null);
  const goldenVeilRef = useRef<HTMLDivElement | null>(null);
  const earthDiveRef = useRef<HTMLDivElement | null>(null);
  const moonDiveRef = useRef<HTMLDivElement | null>(null);
  const visitedPlanetsRef = useRef<Set<string>>(new Set());
  const moonFoundRef = useRef<boolean>(false);
  const moonHoveredRef = useRef<boolean>(false);
  const earthMoonRef = useRef<{ wx: number; wy: number; wz: number; x: number; y: number; r: number }>({
    wx: 0,
    wy: 0,
    wz: 0,
    x: -9999,
    y: -9999,
    r: 10,
  });
  const moonHeartsRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; age: number; life: number; isHeart: boolean }>>([]);
  const finaleFailsafeRef = useRef<number | null>(null);
  const pendingFinaleCheckRef = useRef<boolean>(false);
  const progressRef = useRef({ visitedCount: 0, totalRequired: 9, finaleSeen: false });

  const finaleRef = useRef<{
    phase: "idle" | "sequence" | "envelope" | "letter";
    elapsed: number;
    startAngles: number[];
    burstDone: boolean;
    rainPetals: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      rot: number;
      spin: number;
      size: number;
      alpha: number;
      color: string;
    }>;
  }>({
    phase: "idle",
    elapsed: 0,
    startAngles: [],
    burstDone: false,
    rainPetals: [],
  });

  // Keep refs synced with React progress store for 60fps Canvas reads
  useEffect(() => {
    visitedPlanetsRef.current = new Set(visitedIds);
    moonFoundRef.current = moonFound;
    progressRef.current = { visitedCount, totalRequired, finaleSeen };
  }, [visitedIds, visitedCount, totalRequired, finaleSeen, moonFound]);

  // Swipe-down tracking for mobile bottom sheet
  const sheetTouchStartYRef = useRef<number | null>(null);
  const [sheetDragY, setSheetDragY] = useState(0);

  const selectedIdRef = useRef<string | null>(null);
  const solarPausedRef = useRef<boolean>(false);
  const focusDiveRef = useRef<{
    mode: "idle" | "entering" | "open" | "exiting";
    progress: number;
    targetId: string | null;
  }>({ mode: "idle", progress: 0, targetId: null });
  const focusTimersRef = useRef<number[]>([]);
  const hoveredIdRef = useRef<string | null>(null);
  const sunHoveredRef = useRef<boolean>(false);
  const sunBurstPulseRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const clearFocusTimers = useCallback(() => {
    focusTimersRef.current.forEach((id) => window.clearTimeout(id));
    focusTimersRef.current = [];
  }, []);

  const clearFinaleFailsafe = useCallback(() => {
    if (finaleFailsafeRef.current !== null) {
      window.clearTimeout(finaleFailsafeRef.current);
      finaleFailsafeRef.current = null;
    }
  }, []);

  const enterEnvelopeState = useCallback(() => {
    clearFinaleFailsafe();
    finaleRef.current.phase = "envelope";
    setFinalePhase("envelope");
  }, [clearFinaleFailsafe]);

  const startFinaleSequence = useCallback(() => {
    clearFinaleFailsafe();
    setSelectedItem(null);
    setHoveredPlanet(null);
    selectedIdRef.current = null;
    hoveredIdRef.current = null;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      enterEnvelopeState();
      return;
    }

    finaleRef.current = {
      phase: "sequence",
      elapsed: 0,
      startAngles: [],
      burstDone: false,
      rainPetals: [],
    };
    setFinalePhase("sequence");

    // 20-second failsafe guarantees we always reach the envelope state
    finaleFailsafeRef.current = window.setTimeout(() => {
      if (finaleRef.current.phase === "sequence") {
        enterEnvelopeState();
      }
    }, 20000);
  }, [clearFinaleFailsafe, enterEnvelopeState]);

  const markPlanetVisited = useCallback(
    (planetId: string) => {
      visitedPlanetsRef.current.add(planetId);
      markVisited(planetId);
    },
    [markVisited]
  );

  const enterMemoryScene = useCallback(
    (target: CelestialSelection) => {
      if (focusDiveRef.current.mode !== "idle") return;
      if (!getRegisteredScene(target.id)) return;
      clearFocusTimers();
      setActiveSceneTarget(target);

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        focusDiveRef.current = { mode: "open", progress: 1, targetId: target.id };
        solarPausedRef.current = true;
        setFocusPhase("open");
        if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "1";
        setSceneMounted(true);
        const t1 = window.setTimeout(() => {
          if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
        }, 220);
        focusTimersRef.current.push(t1);
        return;
      }

      const isEarth = target.id === "our-first-date";
      const isMoon = target.id === "moon";
      const diveMs = isEarth ? 4000 : isMoon ? 3000 : 1600;
      const mountMs = isEarth ? 2650 : isMoon ? 2000 : 1050;
      const failsafeMs = isEarth || isMoon ? 6000 : 4000;

      // Smooth zoom INTO the selected celestial body (4s Earth, 3s Moon, 1.6s others)
      focusDiveRef.current = { mode: "entering", progress: 0, targetId: target.id };
      solarPausedRef.current = false;
      setFocusPhase("entering");

      const tMount = window.setTimeout(() => {
        setSceneMounted(true);
      }, mountMs);

      const tDone = window.setTimeout(() => {
        focusDiveRef.current = { mode: "open", progress: 1, targetId: target.id };
        solarPausedRef.current = true;
        setFocusPhase("open");
        if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
        if (earthDiveRef.current) earthDiveRef.current.style.opacity = "0";
        if (moonDiveRef.current) moonDiveRef.current.style.opacity = "0";
      }, diveMs);

      const tFailsafe = window.setTimeout(() => {
        if (focusDiveRef.current.mode === "entering") {
          focusDiveRef.current = { mode: "open", progress: 1, targetId: target.id };
          solarPausedRef.current = true;
          setSceneMounted(true);
          setFocusPhase("open");
          if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
          if (earthDiveRef.current) earthDiveRef.current.style.opacity = "0";
          if (moonDiveRef.current) moonDiveRef.current.style.opacity = "0";
        }
      }, failsafeMs);

      focusTimersRef.current.push(tMount, tDone, tFailsafe);
    },
    [clearFocusTimers]
  );

  const enterMoonScene = useCallback(() => {
    setMoonNote(null);
    setHoveredMoon(null);
    setSelectedItem(null);
    clearFocusTimers();
    const moonSelection: CelestialSelection = {
      id: "moon",
      isSun: false,
      name: SITE_CONTENT.moon.name,
      subtitle: SITE_CONTENT.moon.eyebrow,
      description: SITE_CONTENT.moon.noteLine1,
      paletteName: "",
      cycleLabel: "",
    };
    // Allow direct handoff from Earth landscape or from Solar System
    if (focusDiveRef.current.mode === "open") {
      focusDiveRef.current = { mode: "idle", progress: 0, targetId: null };
      setSceneMounted(false);
    }
    enterMemoryScene(moonSelection);
  }, [clearFocusTimers, enterMemoryScene]);

  const exitMemoryScene = useCallback(() => {
    if (focusDiveRef.current.mode === "idle" || focusDiveRef.current.mode === "exiting") return;
    clearFocusTimers();

    const targetId = focusDiveRef.current.targetId;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Restore the exact selected celestial panel on return
    if (activeSceneTarget) {
      setSelectedItem(activeSceneTarget);
    }

    const finalizeReturn = () => {
      focusDiveRef.current = { mode: "idle", progress: 0, targetId: null };
      solarPausedRef.current = false;
      setSceneMounted(false);
      setFocusPhase("idle");
      if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
      if (earthDiveRef.current) earthDiveRef.current.style.opacity = "0";
      if (moonDiveRef.current) moonDiveRef.current.style.opacity = "0";
      pendingFinaleCheckRef.current = true;
    };

    if (reduced) {
      if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "1";
      finalizeReturn();
      const t1 = window.setTimeout(() => {
        if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
      }, 240);
      focusTimersRef.current.push(t1);
      return;
    }

    const isEarth = targetId === "our-first-date";
    const isMoon = targetId === "moon";
    const exitMs = isEarth ? 3200 : isMoon ? 2600 : 1600;
    const unmountMs = isEarth ? 850 : isMoon ? 680 : 420;
    const failsafeMs = isEarth || isMoon ? 6000 : 4000;

    // Smooth zoom BACK OUT -> solar system with celestial panel restored
    focusDiveRef.current = { mode: "exiting", progress: 1, targetId };
    solarPausedRef.current = false;
    setFocusPhase("exiting");
    if (isEarth) {
      if (earthDiveRef.current) earthDiveRef.current.style.opacity = "1";
    } else if (isMoon) {
      if (moonDiveRef.current) moonDiveRef.current.style.opacity = "1";
    } else if (goldenVeilRef.current) {
      goldenVeilRef.current.style.opacity = "1";
    }

    const tUnmount = window.setTimeout(() => {
      setSceneMounted(false);
    }, unmountMs);

    const tDone = window.setTimeout(() => {
      finalizeReturn();
    }, exitMs);

    const tFailsafe = window.setTimeout(() => {
      if (focusDiveRef.current.mode === "exiting") {
        finalizeReturn();
      }
    }, failsafeMs);

    focusTimersRef.current.push(tUnmount, tDone, tFailsafe);
  }, [activeSceneTarget, clearFocusTimers]);

  // Trigger the Grand Finale sequence right after zoom-out finishes when required visits are reached
  useEffect(() => {
    if (focusPhase !== "idle" || !pendingFinaleCheckRef.current) return;
    pendingFinaleCheckRef.current = false;
    if (visitedCount >= totalRequired && !finaleSeen) {
      markFinaleSeen();
      const t = window.setTimeout(() => {
        startFinaleSequence();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [focusPhase, visitedCount, totalRequired, finaleSeen, markFinaleSeen, startFinaleSequence]);

  useEffect(() => {
    return () => {
      clearFocusTimers();
      clearFinaleFailsafe();
    };
  }, [clearFocusTimers, clearFinaleFailsafe]);

  useEffect(() => {
    selectedIdRef.current = selectedItem?.id ?? null;
  }, [selectedItem]);

  // Fade out mobile hint pill automatically after 6 seconds
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowHint(false);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, []);

  // Fade out white-violet arrival veil when entering from Home, then unmount it from DOM
  useEffect(() => {
    const arrived =
      typeof window !== "undefined" &&
      sessionStorage.getItem("floral-cosmos-arrival") === "1";

    if (!arrived) return;
    sessionStorage.removeItem("floral-cosmos-arrival");

    let innerFrame = 0;
    let unmountTimer = 0;
    const outerFrame = requestAnimationFrame(() => {
      setVeilMounted(true);
      setArrivalFlashOpacity(1);
      innerFrame = requestAnimationFrame(() => {
        setArrivalFlashOpacity(0);
        unmountTimer = window.setTimeout(() => {
          setVeilMounted(false);
        }, 750);
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(leaveTimerRef.current);
      isLeavingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItem]);

  const handleBackToGalaxy = useCallback(() => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    setVeilMounted(true);
    setArrivalFlashOpacity(1);

    if (typeof window !== "undefined") {
      sessionStorage.setItem("arrivedFrom", "solar");
    }

    leaveTimerRef.current = window.setTimeout(
      () => {
        isLeavingRef.current = false;
        router.push("/");
      },
      reducedMotion ? 350 : 800
    );
  }, [router]);

  // Bottom sheet swipe-down handlers (mobile)
  const handleSheetTouchStart = (e: TouchEvent<HTMLElement>) => {
    sheetTouchStartYRef.current = e.touches[0].clientY;
    setSheetDragY(0);
  };

  const handleSheetTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (sheetTouchStartYRef.current === null) return;
    const delta = e.touches[0].clientY - sheetTouchStartYRef.current;
    if (delta > 0) {
      setSheetDragY(delta);
    }
  };

  const handleSheetTouchEnd = () => {
    if (sheetDragY > 55) {
      setSelectedItem(null);
    }
    setSheetDragY(0);
    sheetTouchStartYRef.current = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const initialIsMobile = window.innerWidth < 768;

    const bgNebulaSprites = [
      createRadialPuffSprite([
        [0, "rgba(109, 40, 217, 0.09)"],
        [0.6, "rgba(109, 40, 217, 0.02)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
      createRadialPuffSprite([
        [0, "rgba(29, 78, 216, 0.08)"],
        [0.6, "rgba(15, 118, 110, 0.018)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
      createRadialPuffSprite([
        [0, "rgba(190, 24, 93, 0.08)"],
        [0.6, "rgba(190, 24, 93, 0.018)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    ];

    const beltPetalSprites = [
      createSmallPetalSprite(COSMIC_PALETTES.purple, 10),
      createSmallPetalSprite(COSMIC_PALETTES.pink, 10),
      createSmallPetalSprite(COSMIC_PALETTES.blue, 10),
      createSmallPetalSprite(COSMIC_PALETTES.gold, 10),
      createSmallPetalSprite(COSMIC_PALETTES.teal, 10),
    ];

    const rng = createSeededRandom(20240909);

    // 150 particles per planet on mobile, 180 on desktop
    const sphereParticleCount = initialIsMobile ? 150 : 180;
    const planetRuntimes: PlanetRuntime[] = PLANETS.map((config, idx) => {
      const flowerSprite = createFlowerSprite(config.flowerType, config.palette, 12, 400 + idx * 19, dpr);
      const petalSprite = createSmallPetalSprite(config.palette, 11);
      const moonSprite = config.moon
        ? createFlowerSprite(config.moon.flowerType, config.moon.palette, 10, 800 + idx * 23, dpr)
        : null;

      const spherePoints = createFibonacciSphere(sphereParticleCount, 1200 + idx * 37);

      const ringPetals: RingPetal[] = config.hasRings
        ? Array.from({ length: 72 }, (_, ri) => ({
            angle: (ri / 72) * TAU + randomRange(rng, -0.04, 0.04),
            rMult: randomRange(rng, 1.48, 2.08),
            size: randomRange(rng, 4.5, 8.5),
            colorIdx: ri % beltPetalSprites.length,
          }))
        : [];

      const driftingPetals: DriftingPetal[] = Array.from({ length: 5 }, () => ({
        angle: randomRange(rng, 0, TAU),
        dist: randomRange(rng, 1.32, 1.85),
        zTilt: randomRange(rng, -0.45, 0.45),
        speed: randomRange(rng, 0.35, 0.85) * (rng() > 0.5 ? 1 : -1),
        size: randomRange(rng, 2.4, 4.2),
        rot: randomRange(rng, 0, TAU),
      }));

      return {
        config,
        flowerSprite,
        petalSprite,
        moonSprite,
        spherePoints,
        ringPetals,
        driftingPetals,
        angle: config.initialAngle,
        spin: rng() * TAU,
        moonAngle: rng() * TAU,
        currentScale: 1,
        wx: 0,
        wy: 0,
        wz: 0,
        screenX: 0,
        screenY: 0,
        screenRadius: 20,
        depth: 0,
        pScale: 1,
        depthFade: 1,
      };
    });

    // ~300 belt petals orbiting between Hydra Cluster and Delphinus Spire
    const beltPetals: BeltPetal[] = Array.from({ length: 300 }, () => ({
      orbitFactor: randomRange(rng, 0.565, 0.62),
      mobileOrbitFactor: randomRange(rng, 0.62, 0.665),
      angle: rng() * TAU,
      zOff: randomRange(rng, -0.022, 0.022),
      speed: randomRange(rng, 0.055, 0.095),
      size: randomRange(rng, 4.2, 7.8),
      colorIdx: Math.floor(rng() * beltPetalSprites.length),
      rot: rng() * TAU,
      spin: randomRange(rng, -1.5, 1.5),
    }));

    const pollen: PollenParticle[] = Array.from({ length: 40 }, () => ({
      angle: randomRange(rng, 0, TAU),
      dist: randomRange(rng, 1.15, 2.25),
      zOff: randomRange(rng, -0.45, 0.45),
      speed: randomRange(rng, 0.12, 0.32) * (rng() > 0.5 ? 1 : -1),
      size: randomRange(rng, 1.1, 2.4),
      phase: randomRange(rng, 0, TAU),
      alpha: randomRange(rng, 0.35, 0.72),
    }));

    const burstSparkles: BurstSparkle[] = [];
    const shootingStars: ShootingStar[] = [];
    const trailPetals: TrailPetal[] = [];
    let nextShootTimer = 1.8;

    let width = 0;
    let height = 0;
    let maxOrbitR = 300;
    let isMobileViewport = false;
    let isPortraitMobile = false;
    let sunScreenX = 0;
    let sunScreenY = 0;
    let sunScreenRadius = 30;
    let stars: BgStar[] = [];

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    let camZoom = 1;
    let camOffsetX = 0;
    let camOffsetY = 0;
    let sunHoverLerp = 0;

    let rafId = 0;
    let lastTime = 0;
    let elapsed = 0;
    let arrivalProgress = reducedMotionQuery.matches ? 1 : 0;
    let isHidden = document.hidden;

    const buildStars = (mobile: boolean) => {
      const sRng = createSeededRandom(994422);
      // ~500 stars on mobile, 1,200 on desktop
      const count = mobile ? 500 : 1200;
      stars = Array.from({ length: count }, () => {
        const layerRoll = sRng();
        if (layerRoll < 0.60) {
          return {
            nx: randomRange(sRng, -0.56, 0.56),
            ny: randomRange(sRng, -0.56, 0.56),
            radius: randomRange(sRng, 0.3, 0.72),
            baseAlpha: randomRange(sRng, 0.14, 0.38),
            speed: randomRange(sRng, 0.5, 1.8),
            phase: randomRange(sRng, 0, TAU),
            color: pickRandom(sRng, STAR_COLORS),
            sparkle: false,
            depth: 0.25,
          };
        }
        if (layerRoll < 0.90) {
          return {
            nx: randomRange(sRng, -0.56, 0.56),
            ny: randomRange(sRng, -0.56, 0.56),
            radius: randomRange(sRng, 0.65, 1.15),
            baseAlpha: randomRange(sRng, 0.34, 0.64),
            speed: randomRange(sRng, 0.8, 2.4),
            phase: randomRange(sRng, 0, TAU),
            color: pickRandom(sRng, STAR_COLORS),
            sparkle: false,
            depth: 0.65,
          };
        }
        const isGlint = sRng() < 0.12;
        return {
          nx: randomRange(sRng, -0.56, 0.56),
          ny: randomRange(sRng, -0.56, 0.56),
          radius: randomRange(sRng, 1.05, 1.75),
          baseAlpha: randomRange(sRng, 0.58, 0.88),
          speed: randomRange(sRng, 1.1, 3.0),
          phase: randomRange(sRng, 0, TAU),
          color: pickRandom(sRng, STAR_COLORS),
          sparkle: isGlint,
          depth: 1.25,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      isMobileViewport = width < 768;
      isPortraitMobile = width < 768 && height > width;

      // Portrait mobile: outer orbit spans ~94% of screen width (radius = 0.47 * width)
      // Desktop & landscape: unchanged (~70% of screen width, safely clamped to height)
      if (isPortraitMobile) {
        maxOrbitR = Math.min(width * 0.47, height * 0.58);
      } else {
        maxOrbitR = Math.min(width * 0.35, height * 0.66);
      }

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars(isMobileViewport);
    };

    const spawnSunBurst = (cx: number, cy: number) => {
      for (let i = 0; i < 22; i++) {
        const angle = (i / 22) * TAU + Math.random() * 0.3;
        const speed = 45 + Math.random() * 95;
        burstSparkles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 0.75 + Math.random() * 0.45,
          size: 1.4 + Math.random() * 2.2,
          color: i % 2 === 0 ? "254, 240, 138" : "251, 146, 60",
        });
      }
    };

    const spawnShootingStar = () => {
      if (shootingStars.length >= 3) return;
      const fromLeft = Math.random() > 0.45;
      const startX = fromLeft
        ? Math.random() * width * 0.75
        : width * 0.25 + Math.random() * width * 0.75;
      const startY = Math.random() * height * 0.55;
      const speed = 600 + Math.random() * 600;
      const diagAngle = fromLeft
        ? 0.28 + Math.random() * 0.52
        : Math.PI - (0.28 + Math.random() * 0.52);

      const isPetal = Math.random() < 0.45;
      const colorOptions = ["248, 250, 252", "186, 230, 253", "254, 240, 138", "244, 114, 182"];
      const pIdx = Math.floor(Math.random() * planetRuntimes.length);

      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(diagAngle) * speed,
        vy: Math.sin(diagAngle) * speed,
        life: 0,
        maxLife: 0.65 + Math.random() * 0.48,
        tailLength: 80 + Math.random() * 120,
        colorRgb: colorOptions[Math.floor(Math.random() * colorOptions.length)],
        headSize: 1.7 + Math.random() * 1.3,
        isPetal,
        bloomSprite: planetRuntimes[pIdx].flowerSprite,
        trailSprite: beltPetalSprites[pIdx % beltPetalSprites.length],
        spawnAccum: 0,
      });
    };

    const drawPlanet3D = (
      p: PlanetRuntime,
      sinElev: number,
      cosElev: number,
      cosYaw: number,
      sinYaw: number,
      isHovered: boolean,
      isSelected: boolean,
      animate: boolean
    ) => {
      const px = p.screenX;
      const py = p.screenY;
      const r = p.screenRadius;
      if (r <= 1.5) return;

      const lenW = Math.hypot(p.wx, p.wy, p.wz) || 1;
      const lx = -p.wx / lenW;
      const ly = -p.wy / lenW;
      const lz = -p.wz / lenW;

      const lxr = lx * cosYaw - ly * sinYaw;
      const lyr = lx * sinYaw + ly * cosYaw;
      const lScreenX = lxr;
      const lScreenY = lyr * sinElev - lz * cosElev;
      const sunAngle2D = Math.atan2(lScreenY, lScreenX);

      let shadowDim = 1;
      if (p.depth < 0) {
        const distFromSunLine = Math.hypot(px - sunScreenX, py - sunScreenY);
        if (distFromSunLine < r * 4.5) {
          shadowDim = 0.72 + 0.28 * (distFromSunLine / (r * 4.5));
        }
      }

      const overallAlpha = clamp(p.depthFade * shadowDim, 0.45, 1);

      const drawRingHalf = (frontHalf: boolean) => {
        if (!p.config.hasRings) return;
        const ringTilt = 0.42;
        const ringRoll = -0.35;
        const cosRR = Math.cos(ringRoll);
        const sinRR = Math.sin(ringRoll);

        ctx.save();
        ctx.translate(px, py);
        for (const rp of p.ringPetals) {
          const ang = rp.angle + (animate ? elapsed * 0.22 : 0);
          const rx0 = Math.cos(ang) * r * rp.rMult;
          const ry0 = Math.sin(ang) * r * rp.rMult * ringTilt;
          const isFront = Math.sin(ang) >= 0;
          if (isFront !== frontHalf) continue;

          const rx = rx0 * cosRR - ry0 * sinRR;
          const ry = rx0 * sinRR + ry0 * cosRR;
          const sp = beltPetalSprites[rp.colorIdx];
          const sz = rp.size * p.pScale * (isMobileViewport ? 0.65 : 0.9) * (camZoom > 1.1 ? 1.25 : 1);
          ctx.globalAlpha = (isFront ? 0.75 : 0.42) * overallAlpha;
          ctx.drawImage(sp, rx - sz / 2, ry - sz / 2, sz, sz);
        }
        ctx.restore();
      };

      drawRingHalf(false);

      // Visited warm golden aura + drifting sparkles (subtle, never harsh)
      const isVisited = visitedPlanetsRef.current.has(p.config.id);
      const finaleWavePulse =
        finaleRef.current.phase === "sequence" &&
        finaleRef.current.elapsed >= 1.5 &&
        finaleRef.current.elapsed <= 5.2
          ? Math.max(
              0,
              1 -
                Math.abs(
                  (finaleRef.current.elapsed - 1.5) / 3.0 -
                    (isPortraitMobile ? p.config.mobileOrbitFactor : p.config.orbitFactor)
                ) *
                  7.5
            )
          : 0;

      if (isVisited || finaleWavePulse > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const pulse = 0.85 + 0.15 * Math.sin(elapsed * 1.9 + p.config.initialAngle);
        const auraR = r * (2.2 + finaleWavePulse * 0.9);
        const goldAura = ctx.createRadialGradient(px, py, r * 0.4, px, py, auraR);
        const auraStrength = (isVisited ? 0.28 * pulse : 0) + finaleWavePulse * 0.42;
        goldAura.addColorStop(0, `rgba(254, 240, 138, ${(auraStrength * 0.85).toFixed(3)})`);
        goldAura.addColorStop(0.5, `rgba(245, 158, 11, ${(auraStrength * 0.35).toFixed(3)})`);
        goldAura.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.globalAlpha = overallAlpha;
        ctx.fillStyle = goldAura;
        ctx.beginPath();
        ctx.arc(px, py, auraR, 0, TAU);
        ctx.fill();

        if (isVisited && animate) {
          // 3 tiny warm golden sparkles drifting softly off visited planets
          const sparkCount = isMobileViewport ? 2 : 3;
          for (let si = 0; si < sparkCount; si++) {
            const sAng = elapsed * (0.55 + si * 0.22) + p.config.initialAngle + si * 2.1;
            const sDist = r * (1.28 + 0.32 * Math.sin(elapsed * 1.3 + si * 1.7));
            const sx = px + Math.cos(sAng) * sDist;
            const sy = py + Math.sin(sAng) * sDist * 0.85 - ((elapsed * 4 + si * 9) % 10) * 0.4;
            const sAlpha = (0.35 + 0.35 * Math.sin(elapsed * 2.6 + si * 2)) * overallAlpha;
            ctx.fillStyle = `rgba(254, 240, 138, ${sAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, isMobileViewport ? 1.15 : 1.45, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Atmosphere halo (soft sky-blue rim for Earth planet "our-first-date")
      const isEarthPlanet = p.config.id === "our-first-date";
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const glowR = r * (isHovered || isSelected ? 2.25 : 1.65);
      const halo = ctx.createRadialGradient(px, py, r * 0.45, px, py, glowR);
      if (isEarthPlanet) {
        halo.addColorStop(0, "rgba(96, 165, 250, 0.48)");
        halo.addColorStop(0.55, "rgba(56, 189, 248, 0.16)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      } else {
        halo.addColorStop(0, p.config.palette.glow.replace(/[\d.]+\)$/, "0.45)"));
        halo.addColorStop(0.55, p.config.palette.glow.replace(/[\d.]+\)$/, "0.14)"));
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      }
      ctx.globalAlpha = (isHovered || isSelected ? 0.95 : 0.62) * overallAlpha;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Shaded 3D sphere base
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      const litCenterX = px + Math.cos(sunAngle2D) * r * 0.42;
      const litCenterY = py + Math.sin(sunAngle2D) * r * 0.42;
      const sphereGrad = ctx.createRadialGradient(
        litCenterX,
        litCenterY,
        r * 0.08,
        px,
        py,
        r * 1.05
      );
      if (isEarthPlanet) {
        sphereGrad.addColorStop(0, "#38bdf8");
        sphereGrad.addColorStop(0.35, "#1d4ed8");
        sphereGrad.addColorStop(0.75, "#0c2d6b");
        sphereGrad.addColorStop(1, "#040d24");
      } else {
        sphereGrad.addColorStop(0, p.config.palette.secondary);
        sphereGrad.addColorStop(0.55, p.config.palette.primary);
        sphereGrad.addColorStop(1, "#09081a");
      }
      ctx.globalAlpha = overallAlpha;
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.clip();

      const cosSpin = Math.cos(p.spin);
      const sinSpin = Math.sin(p.spin);
      const baseParticleSz = Math.max(3.5, r * 0.34);

      if (isEarthPlanet) {
        // Flowering Earth: rotating continents with limb foreshortening, blossoms, polar caps, faster clouds & night city lights
        const landClusters = [
          { lon: 0.3, lat: 0.28, rx: 0.34, ry: 0.22, col: "#2e8b57", bloom: "#f9a8d4" },
          { lon: 0.72, lat: -0.18, rx: 0.26, ry: 0.24, col: "#3f9142", bloom: "#fde68a" },
          { lon: 1.95, lat: 0.14, rx: 0.38, ry: 0.26, col: "#2f7d4d", bloom: "#ddd6fe" },
          { lon: 2.38, lat: 0.36, rx: 0.22, ry: 0.16, col: "#a47c48", bloom: "#fbcfe8" },
          { lon: 3.45, lat: -0.26, rx: 0.32, ry: 0.20, col: "#348a54", bloom: "#fde68a" },
          { lon: 4.55, lat: 0.22, rx: 0.35, ry: 0.25, col: "#2b7a4b", bloom: "#f472b6" },
          { lon: 5.25, lat: -0.12, rx: 0.24, ry: 0.18, col: "#8c6d46", bloom: "#c4b5fd" },
        ];

        for (let ci = 0; ci < landClusters.length; ci++) {
          const lc = landClusters[ci];
          const lon = lc.lon + p.spin;
          const cosLat = Math.cos(lc.lat);
          const sx = Math.cos(lon) * cosLat;
          const sy = Math.sin(lon) * cosLat;
          const sz = Math.sin(lc.lat);

          const cxn = sx * cosYaw - sy * sinYaw;
          const cyn = sx * sinYaw + sy * cosYaw;
          const viewZ = cyn * cosElev + sz * sinElev;
          if (viewZ < 0.05) continue;

          const lxPos = px + cxn * r;
          const lyPos = py + (cyn * sinElev - sz * cosElev) * r;
          const nDotL = sx * lx + sy * ly + sz * lz;
          const lit = 0.26 + 0.74 * clamp((nDotL + 0.25) / 1.0, 0, 1);

          // Continent patch with spherical limb foreshortening
          ctx.globalAlpha = clamp(lit * viewZ * 1.15 * overallAlpha, 0.15, 0.94);
          ctx.fillStyle = lc.col;
          ctx.beginPath();
          ctx.ellipse(lxPos, lyPos, r * lc.rx * (0.28 + 0.72 * viewZ), r * lc.ry, 0.25 * ci, 0, TAU);
          ctx.fill();

          // Tiny pink, violet & gold blossom clusters dotting the sunlit continent
          if (nDotL > -0.08) {
            ctx.fillStyle = lc.bloom;
            ctx.globalAlpha = clamp(lit * viewZ * 0.9 * overallAlpha, 0.15, 0.9);
            const bR = Math.max(1.1, r * 0.055);
            ctx.beginPath();
            ctx.arc(lxPos - r * 0.07 * viewZ, lyPos - r * 0.04, bR, 0, TAU);
            ctx.arc(lxPos + r * 0.08 * viewZ, lyPos + r * 0.05, bR * 0.85, 0, TAU);
            ctx.arc(lxPos + r * 0.02 * viewZ, lyPos - r * 0.08, bR * 0.75, 0, TAU);
            ctx.fill();
          }

          // Warm golden village & city lights glowing on the night side!
          if (nDotL < -0.04) {
            const nightStrength = clamp((-nDotL - 0.04) / 0.45, 0, 1);
            ctx.fillStyle = `rgba(254, 240, 138, ${(nightStrength * 0.92 * overallAlpha).toFixed(3)})`;
            const dotR = Math.max(0.85, r * 0.036);
            ctx.beginPath();
            ctx.arc(lxPos, lyPos, dotR, 0, TAU);
            ctx.arc(lxPos + r * 0.06 * viewZ, lyPos - r * 0.03, dotR * 0.8, 0, TAU);
            ctx.arc(lxPos - r * 0.05 * viewZ, lyPos + r * 0.04, dotR * 0.7, 0, TAU);
            ctx.fill();
          }
        }

        // Polar ice caps (north & south)
        ctx.globalAlpha = 0.78 * overallAlpha;
        ctx.fillStyle = "#f1f5f9";
        ctx.beginPath();
        ctx.ellipse(px, py - r * 0.90, r * 0.44, r * 0.14, 0, 0, TAU);
        ctx.ellipse(px, py + r * 0.92, r * 0.36, r * 0.11, 0, 0, TAU);
        ctx.fill();

        // Separate cloud layer rotating slightly faster than the surface (1.28x spin)
        const cloudBands = [
          { lon: 0.4, lat: 0.35, rx: 0.30, ry: 0.09 },
          { lon: 1.5, lat: -0.05, rx: 0.36, ry: 0.10 },
          { lon: 2.8, lat: 0.22, rx: 0.28, ry: 0.08 },
          { lon: 3.9, lat: -0.32, rx: 0.34, ry: 0.09 },
          { lon: 5.1, lat: 0.10, rx: 0.32, ry: 0.09 },
        ];
        const cloudSpin = p.spin * 1.28;
        for (const cb of cloudBands) {
          const lon = cb.lon + cloudSpin;
          const cosLat = Math.cos(cb.lat);
          const sx = Math.cos(lon) * cosLat;
          const sy = Math.sin(lon) * cosLat;
          const sz = Math.sin(cb.lat);
          const cxn = sx * cosYaw - sy * sinYaw;
          const cyn = sx * sinYaw + sy * cosYaw;
          const viewZ = cyn * cosElev + sz * sinElev;
          if (viewZ < 0.06) continue;
          const nDotL = sx * lx + sy * ly + sz * lz;
          const lit = 0.22 + 0.78 * clamp((nDotL + 0.2) / 1.0, 0, 1);
          ctx.globalAlpha = clamp(lit * viewZ * 0.56 * overallAlpha, 0.08, 0.62);
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.ellipse(
            px + cxn * r,
            py + (cyn * sinElev - sz * cosElev) * r,
            r * cb.rx * (0.25 + 0.75 * viewZ),
            r * cb.ry,
            0.12,
            0,
            TAU
          );
          ctx.fill();
        }
      } else {
        for (let i = 0; i < p.spherePoints.length; i++) {
          const sp = p.spherePoints[i];
          const sx = sp.x * cosSpin - sp.y * sinSpin;
          const sy = sp.x * sinSpin + sp.y * cosSpin;
          const sz = sp.z;

          const cxn = sx * cosYaw - sy * sinYaw;
          const cyn = sx * sinYaw + sy * cosYaw;
          const viewZ = cyn * cosElev + sz * sinElev;

          if (viewZ < 0.02) continue;

          const screenOffX = cxn * r;
          const screenOffY = (cyn * sinElev - sz * cosElev) * r;

          const nDotL = sx * lx + sy * ly + sz * lz;
          const lit = 0.28 + 0.72 * clamp((nDotL + 0.25) / 1.0, 0, 1);

          const limbFactor = 0.42 + 0.58 * viewZ;
          const drawW = baseParticleSz * sp.sizeMult * (sp.isBloom ? 1.45 : 1.0);
          const drawH = drawW * (0.48 + 0.52 * viewZ);

          const alpha = clamp(lit * limbFactor * overallAlpha * (isHovered || isSelected ? 1.15 : 0.95), 0.14, 0.98);
          ctx.globalAlpha = alpha;

          if (sp.isBloom) {
            ctx.drawImage(
              p.flowerSprite.canvas,
              px + screenOffX - drawW * 0.5,
              py + screenOffY - drawH * 0.5,
              drawW,
              drawH
            );
          } else {
            ctx.drawImage(
              p.petalSprite,
              px + screenOffX - drawW * 0.5,
              py + screenOffY - drawH * 0.5,
              drawW,
              drawH
            );
          }
        }
      }

      const nightX = px - Math.cos(sunAngle2D) * r * 0.5;
      const nightY = py - Math.sin(sunAngle2D) * r * 0.5;
      const termGrad = ctx.createRadialGradient(nightX, nightY, r * 0.05, nightX, nightY, r * 1.25);
      termGrad.addColorStop(0, "rgba(5, 5, 18, 0.58)");
      termGrad.addColorStop(0.55, "rgba(5, 5, 18, 0.20)");
      termGrad.addColorStop(1, "rgba(5, 5, 18, 0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = termGrad;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
      ctx.restore();

      // Sunlit rim arc
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = p.config.palette.highlight;
      ctx.globalAlpha = (isHovered || isSelected ? 0.88 : 0.55) * overallAlpha;
      ctx.lineWidth = Math.max(1.3, r * 0.075);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px, py, r * 0.99, sunAngle2D - 0.95, sunAngle2D + 0.95);
      ctx.stroke();
      ctx.restore();

      drawRingHalf(true);

      // Drifting petals around planet
      ctx.save();
      ctx.translate(px, py);
      for (const dp of p.driftingPetals) {
        const dAng = dp.angle + (animate ? elapsed * dp.speed : 0);
        const dx = Math.cos(dAng) * r * dp.dist;
        const dy = Math.sin(dAng) * r * dp.dist * 0.52 + Math.cos(dAng) * r * dp.zTilt;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(dAng + dp.rot);
        ctx.fillStyle = p.config.palette.highlight;
        ctx.globalAlpha = 0.62 * overallAlpha;
        const sz = dp.size * Math.min(1.35, camZoom * p.pScale) * (isMobileViewport ? 0.72 : 1);
        ctx.beginPath();
        ctx.ellipse(0, 0, sz * 0.52, sz, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawFrame = (dt: number, animate: boolean) => {
      const cx = width / 2;
      // Portrait mobile: vertically centered at 45% of screen height to leave space for bottom sheet
      const baseCy = isPortraitMobile ? height * 0.45 : height / 2;

      // Keep the Sun clearly the largest object on both mobile and desktop
      const sunRadius = isPortraitMobile
        ? Math.max(24, width * 0.068)
        : Math.max(26, Math.min(width, height) * 0.062);

      if (animate && arrivalProgress < 1) {
        arrivalProgress = Math.min(1, arrivalProgress + dt / 2.4);
      }

      if (animate) {
        mouseX += (targetMouseX - mouseX) * 0.045;
        mouseY += (targetMouseY - mouseY) * 0.045;
        if (sunBurstPulseRef.current > 0) {
          sunBurstPulseRef.current = Math.max(0, sunBurstPulseRef.current - dt * 1.4);
        }
      }

      const swayElev = animate ? Math.cos(elapsed * 0.22) * 1.1 : 0;
      const swayYaw = animate ? Math.sin(elapsed * 0.18) * 0.035 : 0;
      const elevRad = ((CAMERA_ELEVATION + mouseY * 4 + swayElev) * Math.PI) / 180;
      const sinElev = Math.sin(elevRad);
      const cosElev = Math.cos(elevRad);
      const camYaw = mouseX * 0.09 + swayYaw;
      const cosYaw = Math.cos(camYaw);
      const sinYaw = Math.sin(camYaw);

      const project3D = (
        wx: number,
        wy: number,
        wz: number,
        originX: number,
        originY: number,
        zoom: number
      ) => {
        const xr = wx * cosYaw - wy * sinYaw;
        const yr = wx * sinYaw + wy * cosYaw;
        const depth = yr * cosElev + wz * sinElev;
        const dNorm = clamp(depth / Math.max(1, maxOrbitR), -1.1, 1.1);
        const pScale = 1 + dNorm * 0.15;
        const screenX = originX + xr * zoom * pScale;
        const screenY = originY + (yr * sinElev - wz * cosElev) * zoom * pScale;
        const depthFade = dNorm < 0 ? 1 + dNorm * 0.22 : 1;
        return { screenX, screenY, depth, pScale, depthFade };
      };

      // Advance Grand Finale 14s sequence timeline if active
      const fin = finaleRef.current;
      let finWaveOrbit = -1;
      let finSunBloom = 0;
      let finLightRingR = 0;
      let finLightRingAlpha = 0;
      if (fin.phase === "sequence" && animate) {
        fin.elapsed += dt;
        const ft = fin.elapsed;

        if (ft >= 1.5 && ft <= 4.7) {
          finWaveOrbit = (ft - 1.5) / 3.0;
        }
        if (ft >= 4.5 && fin.startAngles.length === 0) {
          fin.startAngles = planetRuntimes.map((pr) => pr.angle);
        }
        if (ft >= 6.8 && ft <= 9.6) {
          // Sun blooms to its largest size during alignment hold (7.0-9.0s)
          const inT = clamp((ft - 6.8) / 0.7, 0, 1);
          const outT = clamp((9.6 - ft) / 0.7, 0, 1);
          finSunBloom = easeInOutCubic(Math.min(inT, outT));
        }
        if (ft >= 7.0 && ft <= 9.5) {
          const ringT = clamp((ft - 7.0) / 2.2, 0, 1);
          finLightRingR = easeOutCubic(ringT) * maxOrbitR * 1.45;
          finLightRingAlpha = (1 - ringT) * 0.72;
        }
        if (ft >= 7.1 && !fin.burstDone) {
          fin.burstDone = true;
          const petalCount = isMobileViewport ? 34 : 72;
          const colors = ["#fef08a", "#fde047", "#fbcfe8", "#e9d5ff", "#ffffff"];
          for (let i = 0; i < petalCount; i++) {
            const ang = (i / petalCount) * TAU + (Math.random() - 0.5) * 0.2;
            const spd = 45 + Math.random() * 145;
            fin.rainPetals.push({
              x: width * 0.5 + (Math.random() - 0.5) * 30,
              y: height * 0.5 + (Math.random() - 0.5) * 30,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 25,
              rot: Math.random() * TAU,
              spin: (Math.random() - 0.5) * 3.2,
              size: (isMobileViewport ? 3.5 : 5) + Math.random() * 4.5,
              alpha: 0.75 + Math.random() * 0.25,
              color: colors[i % colors.length],
            });
          }
        }
        if (ft >= 12.2) {
          enterEnvelopeState();
        }
      }

      for (let idx = 0; idx < planetRuntimes.length; idx++) {
        const p = planetRuntimes[idx];
        const isHovered = hoveredIdRef.current === p.config.id && fin.phase === "idle";
        const isSelected = selectedIdRef.current === p.config.id && fin.phase === "idle";

        if (fin.phase === "sequence" && animate) {
          const ft = fin.elapsed;
          if (ft < 4.5) {
            p.angle = (p.angle + p.config.orbitSpeed * dt) % TAU;
          } else if (ft < 7.0) {
            // Smoothly glide into a straight-line alignment through the Sun (alternating 0 and PI)
            const alignT = easeInOutCubic(clamp((ft - 4.5) / 2.5, 0, 1));
            const targetAngle = idx % 2 === 0 ? 0 : Math.PI;
            const startAng = fin.startAngles[idx] ?? p.angle;
            // Shortest angular delta
            let delta = ((targetAngle - startAng + Math.PI * 3) % TAU) - Math.PI;
            if (Math.abs(delta) < 0.001) delta = 0;
            p.angle = (startAng + delta * alignT + TAU) % TAU;
          } else if (ft < 9.0) {
            // Hold alignment for 2 seconds
            p.angle = idx % 2 === 0 ? 0 : Math.PI;
          } else {
            // Ease smoothly back into natural orbital speeds
            const resumeT = easeInOutCubic(clamp((ft - 9.0) / 2.6, 0, 1));
            p.angle = (p.angle + p.config.orbitSpeed * resumeT * dt) % TAU;
          }
        } else if (animate && !isHovered && !isSelected) {
          p.angle = (p.angle + p.config.orbitSpeed * dt) % TAU;
        }
        if (animate) {
          p.spin = (p.spin + p.config.spinSpeed * dt) % TAU;
          if (p.config.moon) {
            const slowEarthMoon =
              p.config.id === "our-first-date" && moonHoveredRef.current && !reducedMotionQuery.matches
                ? 0.16
                : 1;
            p.moonAngle = (p.moonAngle + p.config.moon.speed * slowEarthMoon * dt) % TAU;
          }
        }

        const targetScale = isSelected ? 1.24 : isHovered ? 1.15 : 1;
        p.currentScale = lerp(p.currentScale, targetScale, animate ? Math.min(1, dt * 8) : 1);

        const flyDelay = 0.2 + idx * 0.055;
        const orbitFly = lerp(1.5, 1, clamp((arrivalProgress - flyDelay) / 0.5, 0, 1));
        const orbitFrac = isPortraitMobile ? p.config.mobileOrbitFactor : p.config.orbitFactor;
        const orbitR = maxOrbitR * orbitFrac * orbitFly;

        const incRad = (p.config.inclinationDeg * Math.PI) / 180;
        const localX = Math.cos(p.angle) * orbitR;
        const localY = Math.sin(p.angle) * orbitR;
        const cosN = Math.cos(p.config.nodeAngle);
        const sinN = Math.sin(p.config.nodeAngle);

        const yTilted = localY * Math.cos(incRad);
        const zTilted = localY * Math.sin(incRad);

        p.wx = localX * cosN - yTilted * sinN;
        p.wy = localX * sinN + yTilted * cosN;
        p.wz = zTilted;
      }

      // Camera focus zoom/re-center when a planet or sun is selected
      let targetZoom = 1;
      let targetOffX = 0;
      let targetOffY = 0;
      const selectedRuntime = planetRuntimes.find((p) => p.config.id === selectedIdRef.current);

      if (fin.phase === "sequence" || fin.phase === "envelope") {
        // Ease camera back slightly during the Grand Finale so all orbits shine in full view
        targetZoom = isPortraitMobile ? 0.88 : 0.86;
        targetOffX = 0;
        targetOffY = 0;
      } else if (selectedRuntime) {
        targetZoom = isPortraitMobile ? 1.75 : isMobileViewport ? 1.8 : 2.15;
        const proj = project3D(selectedRuntime.wx, selectedRuntime.wy, selectedRuntime.wz, 0, 0, targetZoom);
        const panelShiftX = width >= 1024 ? -width * 0.12 : 0;
        // On portrait mobile, bias the focused planet upward so it sits cleanly above the bottom sheet
        const sheetShiftY = isPortraitMobile ? -height * 0.10 : 0;
        targetOffX = -proj.screenX + panelShiftX;
        targetOffY = -proj.screenY + sheetShiftY;
      } else if (selectedIdRef.current === SUN_INFO.id) {
        targetZoom = isPortraitMobile ? 1.45 : 1.6;
        targetOffX = width >= 1024 ? -width * 0.1 : 0;
        targetOffY = isPortraitMobile ? -height * 0.08 : 0;
      }

      const dive = focusDiveRef.current;
      const isEarthDive = dive.targetId === "our-first-date";
      const isMoonDive = dive.targetId === "moon";
      if (animate) {
        const enterDur = isEarthDive ? 4.0 : isMoonDive ? 3.0 : 1.6;
        const exitDur = isEarthDive ? 3.2 : isMoonDive ? 2.6 : 1.6;
        if (dive.mode === "entering") {
          dive.progress = Math.min(1, dive.progress + dt / enterDur);
        } else if (dive.mode === "exiting") {
          dive.progress = Math.max(0, dive.progress - dt / exitDur);
        }
      }

      if (dive.mode === "entering" || dive.mode === "exiting") {
        // Drive the solar system camera smoothly INTO or OUT OF the selected Sun, Planet, or Moon
        const divePlanet = planetRuntimes.find((p) => p.config.id === dive.targetId);
        const eased = easeInOutCubic(dive.progress);

        if (isMoonDive) {
          const em = earthMoonRef.current;
          const zoomNow = lerp(1.5, 24.0, eased * eased);
          const projNow = project3D(em.wx, em.wy, em.wz, 0, 0, zoomNow);
          camZoom = zoomNow;
          camOffsetX = -projNow.screenX;
          camOffsetY = -projNow.screenY;
        } else if (divePlanet) {
          const baseZoom = isPortraitMobile ? 1.75 : isMobileViewport ? 1.8 : 2.15;
          const maxZoom = isEarthDive ? 22.0 : 13.5;
          const zoomNow = lerp(baseZoom, maxZoom, eased * eased);
          const projNow = project3D(divePlanet.wx, divePlanet.wy, divePlanet.wz, 0, 0, zoomNow);
          const panelShiftX = width >= 1024 ? -width * 0.12 : 0;
          const sheetShiftY = isPortraitMobile ? -height * 0.1 : 0;
          camZoom = zoomNow;
          camOffsetX = -projNow.screenX + lerp(panelShiftX, 0, eased);
          camOffsetY = -projNow.screenY + lerp(sheetShiftY, 0, eased);
        } else {
          const baseSunZoom = isPortraitMobile ? 1.45 : 1.6;
          const baseSunOffX = width >= 1024 ? -width * 0.1 : 0;
          const baseSunOffY = isPortraitMobile ? -height * 0.08 : 0;
          camZoom = lerp(baseSunZoom, 11.5, eased * eased);
          camOffsetX = lerp(baseSunOffX, 0, eased);
          camOffsetY = lerp(baseSunOffY, 0, eased);
        }

        if (isEarthDive && earthDiveRef.current) {
          // Soft blue atmospheric entry + streaming clouds parting past camera
          const cloudGlow =
            dive.mode === "entering"
              ? dive.progress < 0.70
                ? clamp((dive.progress - 0.34) / 0.36, 0, 1)
                : clamp(1 - (dive.progress - 0.70) / 0.30, 0, 1)
              : dive.progress > 0.68
                ? 1
                : clamp((dive.progress - 0.22) / 0.46, 0, 1);
          const cloudScale = 0.85 + eased * 1.45;
          earthDiveRef.current.style.opacity = cloudGlow.toFixed(3);
          earthDiveRef.current.style.transform = `scale(${cloudScale.toFixed(3)})`;
          if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
        } else if (isMoonDive && moonDiveRef.current) {
          // Silver-blue cratered lunar surface swell on 3s Moon landing
          const mGlow =
            dive.mode === "entering"
              ? dive.progress < 0.68
                ? clamp((dive.progress - 0.34) / 0.34, 0, 1)
                : clamp(1 - (dive.progress - 0.68) / 0.32, 0, 1)
              : dive.progress > 0.68
                ? 1
                : clamp((dive.progress - 0.22) / 0.46, 0, 1);
          moonDiveRef.current.style.opacity = mGlow.toFixed(3);
          moonDiveRef.current.style.transform = `scale(${(0.9 + eased * 0.9).toFixed(3)})`;
          if (goldenVeilRef.current) goldenVeilRef.current.style.opacity = "0";
        } else if (goldenVeilRef.current) {
          // Warm golden swell peaks around dive.progress ~ 0.65..0.82 then crossfades cleanly
          let glow = 0;
          if (dive.mode === "entering") {
            glow =
              dive.progress < 0.72
                ? clamp((dive.progress - 0.32) / 0.4, 0, 1)
                : clamp(1 - (dive.progress - 0.72) / 0.28, 0, 1);
          } else {
            glow =
              dive.progress > 0.72
                ? 1
                : clamp((dive.progress - 0.18) / 0.54, 0, 1);
          }
          goldenVeilRef.current.style.opacity = glow.toFixed(3);
        }
      } else {
        const camSmooth = animate ? Math.min(1, dt * 4.5) : 1;
        camZoom = lerp(camZoom, targetZoom, camSmooth);
        camOffsetX = lerp(camOffsetX, targetOffX, camSmooth);
        camOffsetY = lerp(camOffsetY, targetOffY, camSmooth);
      }

      const sysCenterX = cx + camOffsetX;
      const sysCenterY = baseCy + camOffsetY;
      sunScreenX = sysCenterX;
      sunScreenY = sysCenterY;
      sunScreenRadius = sunRadius * camZoom;

      // 1. Deep-space background
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#05050f";
      ctx.fillRect(0, 0, width, height);

      // 2. Soft Dim Nebula Clouds
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const bgNebPositions = [
        { x: 0.22, y: 0.24, r: 0.46, idx: 0 },
        { x: 0.78, y: 0.26, r: 0.42, idx: 1 },
        { x: 0.74, y: 0.78, r: 0.44, idx: 2 },
        { x: 0.24, y: 0.76, r: 0.40, idx: 1 },
      ];
      for (const bn of bgNebPositions) {
        const size = Math.max(width, height) * bn.r;
        const bx = width * bn.x + mouseX * -10 + camOffsetX * 0.12;
        const by = height * bn.y + mouseY * -10 + camOffsetY * 0.12;
        ctx.drawImage(bgNebulaSprites[bn.idx], bx - size / 2, by - size / 2, size, size);
      }
      ctx.restore();

      // 3. Background Starfield (500 on mobile, 1200 on desktop)
      ctx.save();
      for (const s of stars) {
        const px = cx + s.nx * width + mouseX * 14 * s.depth + camOffsetX * 0.1 * s.depth;
        const py = height / 2 + s.ny * height + mouseY * 14 * s.depth + camOffsetY * 0.1 * s.depth;
        const twinkle = animate
          ? 0.56 + 0.44 * Math.sin(elapsed * s.speed + s.phase)
          : 1;
        const alpha = Math.min(1, s.baseAlpha * twinkle);

        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, s.radius, 0, TAU);
        ctx.fill();

        if (s.sparkle) {
          const ray = s.radius * (2.2 + twinkle * 1.2);
          ctx.strokeStyle = `rgba(${s.color}, ${alpha * 0.55})`;
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.moveTo(px - ray, py);
          ctx.lineTo(px + ray, py);
          ctx.moveTo(px, py - ray);
          ctx.lineTo(px, py + ray);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 4. Shooting Stars
      if (animate) {
        nextShootTimer -= dt;
        if (nextShootTimer <= 0) {
          spawnShootingStar();
          nextShootTimer = 1.5 + Math.random() * 2.5;
        }
      }
      if (animate && (shootingStars.length > 0 || trailPetals.length > 0)) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        for (let i = trailPetals.length - 1; i >= 0; i--) {
          const tp = trailPetals[i];
          tp.life += dt;
          if (tp.life >= tp.maxLife) {
            trailPetals.splice(i, 1);
            continue;
          }
          tp.x += tp.vx * dt;
          tp.y += tp.vy * dt;
          tp.rot += tp.spin * dt;
          const fade = 1 - tp.life / tp.maxLife;
          ctx.save();
          ctx.translate(tp.x, tp.y);
          ctx.rotate(tp.rot);
          ctx.globalAlpha = fade * 0.72;
          const sz = tp.sprite.width * 0.55;
          ctx.drawImage(tp.sprite, -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const st = shootingStars[i];
          st.life += dt;
          if (st.life >= st.maxLife) {
            shootingStars.splice(i, 1);
            continue;
          }
          st.x += st.vx * dt;
          st.y += st.vy * dt;

          const speedMag = Math.hypot(st.vx, st.vy);
          const dirX = st.vx / speedMag;
          const dirY = st.vy / speedMag;
          const tailX = st.x - dirX * st.tailLength;
          const tailY = st.y - dirY * st.tailLength;

          const tNorm = st.life / st.maxLife;
          const envelope = tNorm < 0.15 ? tNorm / 0.15 : 1 - (tNorm - 0.15) / 0.85;

          const tailGrad = ctx.createLinearGradient(st.x, st.y, tailX, tailY);
          tailGrad.addColorStop(0, `rgba(${st.colorRgb}, ${(envelope * 0.88).toFixed(3)})`);
          tailGrad.addColorStop(0.35, `rgba(${st.colorRgb}, ${(envelope * 0.40).toFixed(3)})`);
          tailGrad.addColorStop(1, `rgba(${st.colorRgb}, 0)`);

          ctx.globalAlpha = 1;
          ctx.strokeStyle = tailGrad;
          ctx.lineWidth = st.headSize;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(st.x, st.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          if (st.isPetal) {
            const headSz = 15;
            ctx.globalAlpha = envelope * 0.92;
            ctx.drawImage(st.bloomSprite.canvas, st.x - headSz / 2, st.y - headSz / 2, headSz, headSz);

            st.spawnAccum += dt;
            if (st.spawnAccum >= 0.03) {
              st.spawnAccum = 0;
              trailPetals.push({
                x: st.x + (Math.random() - 0.5) * 5,
                y: st.y + (Math.random() - 0.5) * 5,
                vx: -dirX * (35 + Math.random() * 45) + (Math.random() - 0.5) * 35,
                vy: -dirY * (35 + Math.random() * 45) + (Math.random() - 0.5) * 35,
                life: 0,
                maxLife: 0.45 + Math.random() * 0.32,
                sprite: st.trailSprite,
                rot: Math.random() * TAU,
                spin: (Math.random() - 0.5) * 6,
              });
            }
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${envelope})`;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.headSize * 0.95, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 5. Inclined 3D Elliptical Orbit Rings
      const orbitDrawT = easeOutCubic(clamp(arrivalProgress / 0.65, 0, 1));
      const segments = 64;
      const drawOrbitRings = (frontArc: boolean) => {
        ctx.save();
        for (const p of planetRuntimes) {
          const orbitFrac = isPortraitMobile ? p.config.mobileOrbitFactor : p.config.orbitFactor;
          const orbitR = maxOrbitR * orbitFrac;
          const incRad = (p.config.inclinationDeg * Math.PI) / 180;
          const cosInc = Math.cos(incRad);
          const sinInc = Math.sin(incRad);
          const cosN = Math.cos(p.config.nodeAngle);
          const sinN = Math.sin(p.config.nodeAngle);

          const isHighlighted =
            fin.phase === "idle" &&
            (hoveredIdRef.current === p.config.id ||
              selectedIdRef.current === p.config.id);
          const isVisitedOrbit = visitedPlanetsRef.current.has(p.config.id);
          const waveHit =
            finWaveOrbit >= 0
              ? Math.max(0, 1 - Math.abs(finWaveOrbit - orbitFrac) * 8.5)
              : 0;

          if (waveHit > 0.05) {
            ctx.strokeStyle = `rgba(254, 240, 138, ${(0.28 + waveHit * 0.62).toFixed(3)})`;
            ctx.lineWidth = frontArc ? 1.5 + waveHit * 2.0 : 0.9 + waveHit * 1.1;
          } else if (isHighlighted) {
            ctx.strokeStyle = p.config.palette.highlight;
            ctx.lineWidth = frontArc ? 1.8 : 1.0;
          } else if (isVisitedOrbit) {
            ctx.strokeStyle = frontArc
              ? "rgba(253, 224, 71, 0.34)"
              : "rgba(253, 224, 71, 0.13)";
            ctx.lineWidth = frontArc ? 1.35 : 0.78;
          } else {
            ctx.strokeStyle = frontArc
              ? "rgba(248, 250, 252, 0.24)"
              : "rgba(248, 250, 252, 0.08)";
            ctx.lineWidth = frontArc ? 1.25 : 0.7;
          }

          const maxSeg = Math.floor(segments * orbitDrawT);
          let drawing = false;
          ctx.beginPath();
          for (let s = 0; s <= maxSeg; s++) {
            const ang = (s / segments) * TAU;
            const lx = Math.cos(ang) * orbitR;
            const ly = Math.sin(ang) * orbitR;
            const yT = ly * cosInc;
            const zT = ly * sinInc;
            const wx = lx * cosN - yT * sinN;
            const wy = lx * sinN + yT * cosN;
            const proj = project3D(wx, wy, zT, sysCenterX, sysCenterY, camZoom);

            const isFront = proj.depth >= 0;
            if (isFront === frontArc) {
              if (!drawing) {
                ctx.moveTo(proj.screenX, proj.screenY);
                drawing = true;
              } else {
                ctx.lineTo(proj.screenX, proj.screenY);
              }
            } else {
              drawing = false;
            }
          }
          ctx.stroke();
        }
        ctx.restore();
      };

      drawOrbitRings(false);

      // 6. Depth-Sorted 3D Scene List
      type Drawable = { depth: number; draw: () => void };
      const drawables: Drawable[] = [];
      // Scale planet radii down ~35% relative to orbits on mobile so planets don't crowd the sun or overlap
      const baseUnitScale = clamp(maxOrbitR / 440, 0.56, 1.16);
      const planetUnitScale = isMobileViewport ? baseUnitScale * 0.65 : baseUnitScale;

      const sunActiveTarget =
        sunHoveredRef.current || selectedIdRef.current === SUN_INFO.id
          ? 1
          : sunBurstPulseRef.current;
      sunHoverLerp = lerp(sunHoverLerp, sunActiveTarget, animate ? Math.min(1, dt * 6) : 1);
      const sunBloomT = clamp((arrivalProgress - 0.15) / 0.85, 0, 1);

      drawables.push({
        depth: 0,
        draw: () => {
          const sunVisited = visitedPlanetsRef.current.has(SUN_INFO.id);
          const effectiveSunR = sunScreenRadius * (1 + finSunBloom * 0.42);

          // Slightly larger soft golden corona once Sun is visited (or during finale bloom)
          if (sunVisited || finSunBloom > 0.02) {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            const coronaR = effectiveSunR * (sunVisited ? 3.55 : 3.2) * (1 + finSunBloom * 0.45);
            const coronaPulse = 0.88 + 0.12 * Math.sin(elapsed * 1.4);
            const cGrad = ctx.createRadialGradient(
              sysCenterX,
              sysCenterY,
              effectiveSunR * 0.35,
              sysCenterX,
              sysCenterY,
              coronaR
            );
            const cAlpha = (sunVisited ? 0.22 * coronaPulse : 0) + finSunBloom * 0.44;
            cGrad.addColorStop(0, `rgba(255, 251, 235, ${(cAlpha * 0.95).toFixed(3)})`);
            cGrad.addColorStop(0.42, `rgba(253, 224, 71, ${(cAlpha * 0.48).toFixed(3)})`);
            cGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(sysCenterX, sysCenterY, coronaR, 0, TAU);
            ctx.fill();

            // Extra rotating golden petal rays during the Grand Finale alignment bloom
            if (finSunBloom > 0.04) {
              ctx.translate(sysCenterX, sysCenterY);
              ctx.rotate(elapsed * 0.35);
              ctx.globalAlpha = finSunBloom * 0.55;
              for (let rp = 0; rp < 16; rp++) {
                ctx.rotate(TAU / 16);
                ctx.fillStyle = rp % 2 === 0 ? "#fef08a" : "#fbcfe8";
                ctx.beginPath();
                ctx.ellipse(0, -effectiveSunR * 1.65, effectiveSunR * 0.24, effectiveSunR * 0.95, 0, 0, TAU);
                ctx.fill();
              }
            }
            ctx.restore();
          }

          drawSolarFlower3D(
            ctx,
            sysCenterX,
            sysCenterY,
            effectiveSunR,
            elapsed,
            sunBloomT,
            Math.max(sunHoverLerp, finSunBloom),
            mouseX,
            mouseY
          );

          ctx.save();
          ctx.globalCompositeOperation = "screen";
          for (const pol of pollen) {
            const ang = pol.angle + (animate ? elapsed * pol.speed : 0);
            const rad = sunRadius * pol.dist * (1 + sunHoverLerp * 0.14);
            const proj = project3D(
              Math.cos(ang) * rad,
              Math.sin(ang) * rad,
              pol.zOff * sunRadius,
              sysCenterX,
              sysCenterY,
              camZoom
            );
            const flicker = animate ? 0.45 + 0.55 * Math.sin(elapsed * 2.4 + pol.phase) : 0.8;
            ctx.fillStyle = `rgba(254, 240, 138, ${pol.alpha * flicker * sunBloomT * GALAXY_BRIGHTNESS * 1.4})`;
            ctx.beginPath();
            ctx.arc(proj.screenX, proj.screenY, pol.size * Math.min(1.4, camZoom), 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        },
      });

      // 300 Drifting Belt Petals
      for (const bp of beltPetals) {
        if (animate) {
          bp.angle = (bp.angle + bp.speed * dt) % TAU;
          bp.rot += bp.spin * dt;
        }
        const br = maxOrbitR * (isPortraitMobile ? bp.mobileOrbitFactor : bp.orbitFactor);
        const proj = project3D(
          Math.cos(bp.angle) * br,
          Math.sin(bp.angle) * br,
          bp.zOff * maxOrbitR,
          sysCenterX,
          sysCenterY,
          camZoom
        );
        const sp = beltPetalSprites[bp.colorIdx];
        const sz =
          bp.size *
          proj.pScale *
          (isMobileViewport ? 0.68 : 1) *
          Math.min(1.5, camZoom) *
          arrivalProgress;
        if (sz < 1) continue;

        drawables.push({
          depth: proj.depth,
          draw: () => {
            ctx.save();
            ctx.translate(proj.screenX, proj.screenY);
            ctx.rotate(bp.rot);
            ctx.globalAlpha = 0.54 * proj.depthFade * GALAXY_BRIGHTNESS * 1.35;
            ctx.drawImage(sp, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();
          },
        });
      }

      // 8 Planets + 3 Moons
      for (let idx = 0; idx < planetRuntimes.length; idx++) {
        const p = planetRuntimes[idx];
        const flyDelay = 0.2 + idx * 0.055;
        const flyT = easeOutBack(clamp((arrivalProgress - flyDelay) / 0.55, 0, 1));
        const proj = project3D(p.wx, p.wy, p.wz, sysCenterX, sysCenterY, camZoom);

        p.screenX = proj.screenX;
        p.screenY = proj.screenY;
        p.depth = proj.depth;
        p.pScale = proj.pScale;
        p.depthFade = proj.depthFade;
        p.screenRadius =
          p.config.radiusFactor *
          planetUnitScale *
          camZoom *
          proj.pScale *
          p.currentScale *
          Math.max(0.01, flyT);

        if (flyT <= 0.02) continue;

        const isHovered = hoveredIdRef.current === p.config.id;
        const isSelected = selectedIdRef.current === p.config.id;

        drawables.push({
          depth: proj.depth,
          draw: () =>
            drawPlanet3D(p, sinElev, cosElev, cosYaw, sinYaw, isHovered, isSelected, animate),
        });

        if (p.config.moon && p.moonSprite) {
          const m = p.config.moon;
          const mDist = p.config.radiusFactor * planetUnitScale * m.distMult;
          const mwx = p.wx + Math.cos(p.moonAngle) * mDist;
          const mwy = p.wy + Math.sin(p.moonAngle) * mDist;
          const mwz = p.wz + Math.sin(p.moonAngle * 1.2) * mDist * 0.28;
          const mProj = project3D(mwx, mwy, mwz, sysCenterX, sysCenterY, camZoom);
          const moonSprite = p.moonSprite;
          const mSize = p.screenRadius * m.sizeMult * 2.6;
          const isEarthMoon = p.config.id === "our-first-date";
          if (isEarthMoon) {
            earthMoonRef.current = {
              wx: mwx,
              wy: mwy,
              wz: mwz,
              x: mProj.screenX,
              y: mProj.screenY,
              r: Math.max(8, mSize * 0.5),
            };
          }

          drawables.push({
            depth: mProj.depth,
            draw: () => {
              ctx.save();
              if (isEarthMoon && (moonHoveredRef.current || moonFoundRef.current)) {
                const mgR = mSize * (moonHoveredRef.current ? 1.55 : 1.25);
                const mg = ctx.createRadialGradient(
                  mProj.screenX,
                  mProj.screenY,
                  mSize * 0.15,
                  mProj.screenX,
                  mProj.screenY,
                  mgR
                );
                mg.addColorStop(
                  0,
                  moonHoveredRef.current ? "rgba(254, 240, 138, 0.78)" : "rgba(254, 240, 138, 0.46)"
                );
                mg.addColorStop(1, "rgba(186, 230, 253, 0)");
                ctx.fillStyle = mg;
                ctx.beginPath();
                ctx.arc(mProj.screenX, mProj.screenY, mgR, 0, TAU);
                ctx.fill();
              }
              ctx.translate(mProj.screenX, mProj.screenY);
              ctx.rotate(p.moonAngle);
              ctx.globalAlpha = (isEarthMoon && moonHoveredRef.current ? 1 : 0.88) * mProj.depthFade;
              ctx.drawImage(moonSprite.canvas, -mSize / 2, -mSize / 2, mSize, mSize);
              ctx.restore();
            },
          });
        }
      }

      drawOrbitRings(true);

      drawables.sort((a, b) => a.depth - b.depth);
      for (let i = 0; i < drawables.length; i++) {
        drawables[i].draw();
      }

      if (burstSparkles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = burstSparkles.length - 1; i >= 0; i--) {
          const sp = burstSparkles[i];
          sp.life += dt;
          if (sp.life >= sp.maxLife) {
            burstSparkles.splice(i, 1);
            continue;
          }
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          const alpha = 1 - sp.life / sp.maxLife;
          ctx.fillStyle = `rgba(${sp.color}, ${alpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      // Finale expanding golden light ring & raining petals
      if (finLightRingAlpha > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = `rgba(254, 240, 138, ${finLightRingAlpha.toFixed(3)})`;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(sysCenterX, sysCenterY, finLightRingR, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${(finLightRingAlpha * 0.8).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      if (fin.rainPetals.length > 0) {
        ctx.save();
        for (let i = fin.rainPetals.length - 1; i >= 0; i--) {
          const rp = fin.rainPetals[i];
          rp.x += rp.vx * dt;
          rp.y += rp.vy * dt;
          rp.vx *= 0.985;
          rp.vy = Math.min(72, rp.vy + 26 * dt);
          rp.rot += rp.spin * dt;
          rp.alpha -= dt * 0.14;
          if (rp.alpha <= 0.01 || rp.y > height + 24) {
            fin.rainPetals.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.translate(rp.x, rp.y);
          ctx.rotate(rp.rot);
          ctx.globalAlpha = rp.alpha;
          ctx.fillStyle = rp.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, rp.size, rp.size * 0.48, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      // Tiny rising hearts & petals emitted from Earth's moon when tapped
      if (moonHeartsRef.current.length > 0) {
        ctx.save();
        for (let i = moonHeartsRef.current.length - 1; i >= 0; i--) {
          const mh = moonHeartsRef.current[i];
          mh.age += dt;
          if (mh.age >= mh.life) {
            moonHeartsRef.current.splice(i, 1);
            continue;
          }
          mh.x += mh.vx * dt;
          mh.y += mh.vy * dt;
          const a = 1 - mh.age / mh.life;
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = mh.isHeart ? "#fbcfe8" : "#fde68a";
          ctx.beginPath();
          if (mh.isHeart) {
            const s = 3.2;
            ctx.moveTo(mh.x, mh.y + s);
            ctx.bezierCurveTo(mh.x - s * 1.4, mh.y - s * 0.3, mh.x - s, mh.y - s * 1.5, mh.x, mh.y - s * 0.5);
            ctx.bezierCurveTo(mh.x + s, mh.y - s * 1.5, mh.x + s * 1.4, mh.y - s * 0.3, mh.x, mh.y + s);
          } else {
            ctx.ellipse(mh.x, mh.y, 3.2, 1.6, mh.age * 2, 0, TAU);
          }
          ctx.fill();
        }
        ctx.restore();
      }

      // Desktop-only hover hit-testing (touch uses direct tap; disabled during finale)
      if (pointerRef.current.active && !isMobileViewport && fin.phase === "idle") {
        const mx = pointerRef.current.x;
        const my = pointerRef.current.y;

        // Check Earth's hidden moon first (>= 48px hit area)
        const em = earthMoonRef.current;
        const hitMoon = dist(mx, my, em.x, em.y) <= Math.max(24, em.r + 12);
        if (hitMoon !== moonHoveredRef.current) {
          moonHoveredRef.current = hitMoon;
          setHoveredMoon(hitMoon ? { x: em.x, y: em.y } : null);
        } else if (hitMoon) {
          setHoveredMoon({ x: em.x, y: em.y });
        }

        const frontToBack = [...planetRuntimes].sort((a, b) => b.depth - a.depth);
        let foundPlanet: PlanetRuntime | null = null;
        if (!hitMoon) {
          for (const p of frontToBack) {
            if (dist(mx, my, p.screenX, p.screenY) <= Math.max(18, p.screenRadius * 1.22)) {
              foundPlanet = p;
              break;
            }
          }
        }

        const sunHit =
          !hitMoon &&
          (!foundPlanet || foundPlanet.depth < 0) &&
          dist(mx, my, sunScreenX, sunScreenY) <= sunScreenRadius * 1.25;
        if (sunHit) {
          foundPlanet = null;
          if (!sunHoveredRef.current && animate) {
            spawnSunBurst(sunScreenX, sunScreenY);
          }
        }
        sunHoveredRef.current = sunHit;

        const nextHoveredId = foundPlanet ? foundPlanet.config.id : null;
        if (nextHoveredId !== hoveredIdRef.current) {
          hoveredIdRef.current = nextHoveredId;
          if (foundPlanet) {
            setHoveredPlanet({
              planet: foundPlanet.config,
              x: foundPlanet.screenX,
              y: foundPlanet.screenY,
            });
          } else {
            setHoveredPlanet(null);
          }
        }

        canvas.style.cursor = hitMoon || foundPlanet || sunHit ? "pointer" : "default";
      }
    };

    const tick = (now: number) => {
      if (isHidden) return;
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Pause background solar system motion while the full-screen FocusScene is open
      if (!solarPausedRef.current) {
        elapsed += dt;
        drawFrame(dt, true);
      }
      rafId = requestAnimationFrame(tick);
    };

    const startOrStatic = () => {
      cancelAnimationFrame(rafId);
      lastTime = 0;
      if (reducedMotionQuery.matches) {
        arrivalProgress = 1;
        shootingStars.length = 0;
        trailPetals.length = 0;
        drawFrame(0, false);
        return;
      }
      if (!isHidden) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current = { x, y, active: true };

      if (!reducedMotionQuery.matches) {
        targetMouseX = (event.clientX / window.innerWidth - 0.5) * 2;
        targetMouseY = (event.clientY / window.innerHeight - 0.5) * 2;
      }
    };

    const handlePointerLeave = () => {
      pointerRef.current.active = false;
      hoveredIdRef.current = null;
      sunHoveredRef.current = false;
      setHoveredPlanet(null);
      targetMouseX = 0;
      targetMouseY = 0;
    };

    const handleCanvasClick = (event: MouseEvent) => {
      if (finaleRef.current.phase !== "idle") return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Dismiss hint pill on first tap/click
      setShowHint(false);

      // Check Earth's hidden moon first (>= 48px hit area)
      const em = earthMoonRef.current;
      if (dist(x, y, em.x, em.y) <= Math.max(24, em.r + 14)) {
        setSelectedItem(null);
        setHoveredPlanet(null);
        setMoonNote({ x: em.x, y: em.y });
        markMoonFound();
        setMoonAnnouncement(`${SITE_CONTENT.moon.noteLine1} ${SITE_CONTENT.moon.noteLine2}`);
        if (!reducedMotionQuery.matches) {
          for (let i = 0; i < 8; i++) {
            moonHeartsRef.current.push({
              x: em.x + (Math.random() - 0.5) * 14,
              y: em.y,
              vx: (Math.random() - 0.5) * 28,
              vy: -(24 + Math.random() * 34),
              age: 0,
              life: 1.4 + Math.random() * 0.6,
              isHeart: i % 2 === 0,
            });
          }
        }
        return;
      }
      setMoonNote(null);

      // Front-most planets win overlaps; generous touch hit area = radius + 18px (min 44px diameter)
      const frontToBack = [...planetRuntimes].sort((a, b) => b.depth - a.depth);
      let clicked: PlanetRuntime | null = null;
      for (const p of frontToBack) {
        const hitR = isMobileViewport
          ? Math.max(22, p.screenRadius + 18)
          : Math.max(22, p.screenRadius * 1.25);
        if (dist(x, y, p.screenX, p.screenY) <= hitR) {
          clicked = p;
          break;
        }
      }

      // Check Sun tap/click (wins over planets behind the sun)
      const sunHitR = isMobileViewport
        ? Math.max(28, sunScreenRadius + 14)
        : sunScreenRadius * 1.2;
      const hitSun =
        (!clicked || clicked.depth < 0) &&
        dist(x, y, sunScreenX, sunScreenY) <= sunHitR;

      if (hitSun) {
        if (!reducedMotionQuery.matches) {
          spawnSunBurst(sunScreenX, sunScreenY);
          sunBurstPulseRef.current = 1;
        }
        setSelectedItem(SUN_INFO);
        setHoveredPlanet(null);
        hoveredIdRef.current = null;
        return;
      }

      if (clicked) {
        setSelectedItem(planetToSelection(clicked.config));
        setHoveredPlanet(null);
        hoveredIdRef.current = null;
      } else {
        // Tap/click empty space closes selection and resumes orbits
        if (selectedIdRef.current) {
          setSelectedItem(null);
        }
        setHoveredPlanet(null);
        hoveredIdRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      isHidden = document.hidden;
      if (isHidden) {
        cancelAnimationFrame(rafId);
      } else {
        startOrStatic();
      }
    };

    const handleResize = () => {
      resize();
      if (reducedMotionQuery.matches) {
        drawFrame(0, false);
      }
    };

    resize();
    startOrStatic();

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("click", handleCanvasClick);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", startOrStatic);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("click", handleCanvasClick);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", startOrStatic);
    };
  }, [enterEnvelopeState, markMoonFound]);

  const isFocusActive = focusPhase !== "idle";
  const isFinaleActive = finalePhase !== "idle";
  const selectedSceneEntry = getRegisteredScene(selectedItem?.id);
  const selectedIsVisited = Boolean(selectedItem && visitedIds.has(selectedItem.id));
  const activeSceneEntry = getRegisteredScene(activeSceneTarget?.id);
  const ActiveSceneComponent = activeSceneEntry?.Scene ?? null;

  return (
    <main
      aria-hidden={sceneMounted || undefined}
      inert={sceneMounted || undefined}
      className="relative h-[100dvh] w-full overflow-hidden bg-cosmos-navy text-star-white select-none"
    >
      {/* Full-Screen 3D Procedural Floral Solar System Canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={SITE_CONTENT.solarSystem.canvasAriaLabel}
        className="fixed inset-0 block h-full w-full touch-manipulation"
      />

      {/* Top-Left Minimal "Back to Our Galaxy" Button (hidden during FocusScene or Finale) */}
      {!isFocusActive && !isFinaleActive && (
        <div
          className="fixed z-20"
          style={{
            top: "max(1rem, env(safe-area-inset-top))",
            left: "max(1rem, env(safe-area-inset-left))",
          }}
        >
          <button
            type="button"
            onClick={handleBackToGalaxy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-star-white/30 bg-cosmos-navy/75 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.2em] text-star-white/90 backdrop-blur-md transition-all duration-300 hover:border-star-white hover:bg-nebula-purple/20 hover:shadow-glow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple"
          >
            <span aria-hidden="true">&larr;</span>
            {SITE_CONTENT.solarSystem.backButton}
          </button>
        </div>
      )}

      {/* Top-Right Quiet Visited Counter Pill (shown after first visit) */}
      {hydrated && visitedCount > 0 && !isFocusActive && !isFinaleActive && (
        <div
          className="pointer-events-none fixed z-20"
          style={{
            top: "max(1rem, env(safe-area-inset-top))",
            right: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <div className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-amber-200/25 bg-cosmos-navy/70 px-3.5 py-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-amber-100/90 backdrop-blur-md sm:text-[11px]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(253,224,71,0.9)]"
            />
            <span>
              {SITE_CONTENT.solarSystem.memoriesOpenedLabel}{" "}
              <strong className="font-semibold text-amber-200">{visitedCount}</strong>{" "}
              {SITE_CONTENT.solarSystem.ofWord} {totalMemories}
            </span>
          </div>
        </div>
      )}

      {/* Hint Pill (fades out after first tap or 6s), positioned above safe area */}
      {!selectedItem && !hoveredPlanet && (
        <div
          className={`pointer-events-none fixed left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-star-white/15 bg-cosmos-navy/65 px-4 py-2 text-center font-sans text-[11px] uppercase tracking-[0.2em] text-star-white/75 backdrop-blur-md transition-opacity duration-700 ${
            showHint ? "opacity-100" : "opacity-0"
          }`}
          style={{
            bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          }}
        >
          <span className="md:hidden">{SITE_CONTENT.solarSystem.hintMobile}</span>
          <span className="hidden md:inline">
            {SITE_CONTENT.solarSystem.hintDesktop}
          </span>
        </div>
      )}

      {/* Accessible Keyboard Navigation Overlay (Sun + 8 Planets) */}
      <nav
        aria-label={SITE_CONTENT.solarSystem.keyboardNavAria}
        className="fixed z-20 flex flex-wrap justify-end gap-1.5 max-w-[55vw]"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <button
          ref={sunTriggerRef}
          type="button"
          onClick={() => setSelectedItem(SUN_INFO)}
          aria-label={`${SITE_CONTENT.solarSystem.openSunAriaPrefix} ${SUN_INFO.name}, ${SUN_INFO.subtitle}`}
          aria-pressed={selectedItem?.id === SUN_INFO.id || (sceneMounted && activeSceneTarget?.id === SUN_INFO.id)}
          className="sr-only focus:not-sr-only focus:rounded-full focus:border focus:border-star-white/40 focus:bg-cosmos-deep/90 focus:px-3 focus:py-1.5 focus:font-sans focus:text-[10px] focus:uppercase focus:tracking-[0.16em] focus:text-star-white focus:backdrop-blur-md focus:outline-2 focus:outline-offset-2 focus:outline-nebula-purple"
        >
          {SUN_INFO.name}
        </button>
        {PLANETS.map((planet) => {
          const active = selectedItem?.id === planet.id;
          return (
            <button
              key={planet.id}
              type="button"
              onClick={() => setSelectedItem(planetToSelection(planet))}
              aria-label={`${SITE_CONTENT.solarSystem.openPlanetAriaPrefix} ${planet.name}`}
              aria-pressed={active}
              className={`sr-only focus:not-sr-only focus:rounded-full focus:border focus:px-3 focus:py-1.5 focus:font-sans focus:text-[10px] focus:uppercase focus:tracking-[0.16em] focus:backdrop-blur-md focus:outline-2 focus:outline-offset-2 focus:outline-nebula-purple ${
                active
                  ? "focus:border-nebula-teal focus:bg-nebula-teal/20 focus:text-star-white"
                  : "focus:border-star-white/40 focus:bg-cosmos-deep/90 focus:text-star-white"
              }`}
            >
              {planet.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const em = earthMoonRef.current;
            setSelectedItem(null);
            setMoonNote({
              x: em.x > 0 ? em.x : typeof window !== "undefined" ? window.innerWidth * 0.5 : 400,
              y: em.y > 0 ? em.y : typeof window !== "undefined" ? window.innerHeight * 0.4 : 300,
            });
            markMoonFound();
            setMoonAnnouncement(`${SITE_CONTENT.moon.noteLine1} ${SITE_CONTENT.moon.noteLine2}`);
          }}
          aria-label={SITE_CONTENT.moon.moonAriaLabel}
          className="sr-only focus:not-sr-only focus:rounded-full focus:border focus:border-sky-200/50 focus:bg-cosmos-deep/90 focus:px-3 focus:py-1.5 focus:font-sans focus:text-[10px] focus:uppercase focus:tracking-[0.16em] focus:text-sky-100 focus:backdrop-blur-md focus:outline-2 focus:outline-offset-2 focus:outline-sky-200"
        >
          {SITE_CONTENT.moon.name}
        </button>
      </nav>

      {/* Screen-reader live region for Moon note */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {moonAnnouncement}
      </div>

      {/* Desktop Hover Tooltip for Earth's Hidden Moon */}
      {hoveredMoon && !moonNote && !isFocusActive && !isFinaleActive && (
        <div
          className="pointer-events-none hidden md:block fixed z-20 -translate-x-1/2 -translate-y-[140%] rounded-full border border-sky-200/35 bg-cosmos-deep/88 px-3.5 py-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-sky-100 backdrop-blur-md shadow-glow"
          style={{
            left: `${clamp(hoveredMoon.x, 90, typeof window !== "undefined" ? window.innerWidth - 90 : 800)}px`,
            top: `${clamp(hoveredMoon.y, 70, typeof window !== "undefined" ? window.innerHeight - 60 : 600)}px`,
          }}
        >
          {SITE_CONTENT.moon.name}
        </div>
      )}

      {/* Floating Secret Moon Note Near Earth's Moon */}
      {moonNote && !isFocusActive && !isFinaleActive && (
        <div
          role="dialog"
          aria-label={SITE_CONTENT.moon.name}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-30 w-68 -translate-x-1/2 rounded-2xl border border-sky-200/35 bg-cosmos-deep/92 p-4 text-left text-star-white shadow-glow-strong backdrop-blur-xl"
          style={{
            left: `${clamp(moonNote.x, 150, typeof window !== "undefined" ? window.innerWidth - 150 : 800)}px`,
            top: `${clamp(moonNote.y + 22, 80, typeof window !== "undefined" ? window.innerHeight - 210 : 500)}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-sky-200/85">
              {SITE_CONTENT.moon.name}
            </p>
            <button
              type="button"
              onClick={() => setMoonNote(null)}
              aria-label={SITE_CONTENT.moon.closeNoteAria}
              className="rounded-full px-1.5 py-0.5 text-xs text-star-white/60 hover:text-star-white"
            >
              ✕
            </button>
          </div>
          <p className="mt-1.5 font-serif text-base font-light text-star-white">
            {SITE_CONTENT.moon.noteLine1}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-sky-100/80">
            {SITE_CONTENT.moon.noteLine2}
          </p>
          <button
            type="button"
            onClick={enterMoonScene}
            className="mt-3.5 inline-flex min-h-[38px] items-center rounded-full border border-sky-200/45 bg-sky-200/15 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:border-sky-200 hover:bg-sky-200/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            {SITE_CONTENT.moon.landButtonLabel}
          </button>
        </div>
      )}

      {/* Desktop Floating Hover Tooltip */}
      {hoveredPlanet && !selectedItem && (
        <div
          className="hidden md:block fixed z-20 w-64 -translate-x-1/2 -translate-y-[118%] rounded-2xl border border-star-white/25 bg-cosmos-deep/88 p-4 backdrop-blur-xl shadow-glow transition-opacity duration-200"
          style={{
            left: `${clamp(hoveredPlanet.x, 150, typeof window !== "undefined" ? window.innerWidth - 150 : 800)}px`,
            top: `${clamp(hoveredPlanet.y, 180, typeof window !== "undefined" ? window.innerHeight - 80 : 600)}px`,
          }}
        >
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-nebula-blue">
            {hoveredPlanet.planet.flowerName}
          </p>
          <h2 className="mt-1 font-serif text-xl font-light tracking-[0.08em] text-star-white">
            {hoveredPlanet.planet.name}
          </h2>
          <p className="mt-1.5 text-xs font-light leading-relaxed text-star-white/75">
            {hoveredPlanet.planet.tagline}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-star-white/10 pt-2.5">
            <Link
              href={SITE_CONTENT.solarSystem.openMemoryHref}
              className="font-sans text-[10px] uppercase tracking-[0.2em] text-nebula-teal hover:text-star-white transition-colors"
            >
              {SITE_CONTENT.solarSystem.openMemoryCta} &rarr;
            </Link>
            <span className="font-sans text-[10px] text-star-white/45">
              {SITE_CONTENT.solarSystem.clickToZoomHint}
            </span>
          </div>
        </div>
      )}

      {/* Selected Planet / Sun Details: Swipeable Bottom Sheet on Mobile, Side Panel on Desktop */}
      {selectedItem && !isFocusActive && (
        <aside
          aria-label={`${selectedItem.name} ${SITE_CONTENT.solarSystem.memoryAsideAriaSuffix}`}
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-star-white/20 bg-cosmos-deep/92 p-5 backdrop-blur-xl shadow-glow-strong transition-transform duration-200 ease-out md:inset-x-auto md:top-1/2 md:right-7 md:bottom-auto md:w-88 md:-translate-y-1/2 md:p-6"
          style={{
            paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
            transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
          }}
        >
          {/* Mobile Swipe-Down Handle */}
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-star-white/30 md:hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-nebula-purple">
              {selectedItem.subtitle}
            </p>
            {selectedIsVisited && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-300/12 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.18em] text-amber-200">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-amber-300" />
                {SITE_CONTENT.solarSystem.openedBadge}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 font-serif text-2xl sm:text-3xl font-light tracking-[0.08em] text-star-white text-shadow-glow-subtle">
            {selectedItem.name}
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm font-light leading-relaxed text-star-white/80">
            {selectedItem.description}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-star-white/10 py-3.5 text-xs">
            <div>
              <dt className="font-sans text-[10px] uppercase tracking-[0.18em] text-star-white/50">
                {selectedItem.isSun
                  ? SITE_CONTENT.solarSystem.sun.detailLabel1
                  : SITE_CONTENT.solarSystem.keptLabel}
              </dt>
              <dd className="mt-1 text-star-white/90">
                {selectedItem.paletteName}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] uppercase tracking-[0.18em] text-star-white/50">
                {selectedItem.isSun
                  ? SITE_CONTENT.solarSystem.sun.detailLabel2
                  : SITE_CONTENT.solarSystem.inMyHeartLabel}
              </dt>
              <dd className="mt-1 text-star-white/90">
                {selectedItem.cycleLabel}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {selectedSceneEntry && (
              <button
                type="button"
                onClick={() => enterMemoryScene(selectedItem)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-star-white/55 bg-nebula-purple/25 px-5 py-2.5 font-sans text-[11px] uppercase tracking-[0.18em] text-star-white shadow-glow transition-all hover:border-star-white hover:shadow-glow-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
              >
                {selectedIsVisited
                  ? SITE_CONTENT.solarSystem.openAgainCta
                  : SITE_CONTENT.solarSystem.openMemoryCta}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-star-white/25 bg-star-white/5 px-4 py-2.5 font-sans text-[11px] uppercase tracking-[0.18em] text-star-white/80 transition-all hover:border-star-white/60 hover:text-star-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
            >
              {SITE_CONTENT.solarSystem.backToSystemCta}
            </button>
          </div>
        </aside>
      )}

      {/* Reusable Full-Screen Focus Scene driven by scenes/registry.ts */}
      <FocusScene
        isOpen={sceneMounted && Boolean(ActiveSceneComponent)}
        onExit={exitMemoryScene}
        ariaLabel={
          activeSceneEntry
            ? `${activeSceneEntry.title} — ${activeSceneEntry.eyebrow}`
            : SITE_CONTENT.common.memorySceneAriaFallback
        }
        returnFocusTo={activeSceneTarget?.isSun ? sunTriggerRef : undefined}
      >
        {ActiveSceneComponent && (
          <ActiveSceneComponent
            onExit={exitMemoryScene}
            onOpenMoon={enterMoonScene}
            onVisited={() => {
              if (!activeSceneTarget) return;
              if (activeSceneTarget.id === "moon") {
                markMoonVisited();
              } else {
                markPlanetVisited(activeSceneTarget.id);
              }
            }}
          />
        )}
      </FocusScene>

      {/* Skip Button During 14s Grand Finale Sequence */}
      {finalePhase === "sequence" && (
        <div
          className="fixed z-40"
          style={{
            bottom: "max(1.25rem, env(safe-area-inset-bottom))",
            right: "max(1.25rem, env(safe-area-inset-right))",
          }}
        >
          <button
            type="button"
            onClick={enterEnvelopeState}
            className="inline-flex min-h-[44px] items-center rounded-full border border-amber-200/35 bg-cosmos-navy/75 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.2em] text-amber-100/90 backdrop-blur-md transition hover:border-amber-200 hover:bg-amber-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            {SITE_CONTENT.solarSystem.skipFinaleLabel}
          </button>
        </div>
      )}

      {/* Persistent Bottom-Right Envelope Button After Finale Has Been Seen */}
      {hydrated && finaleSeen && !isFocusActive && !isFinaleActive && (
        <div
          className="fixed z-20"
          style={{
            bottom: "max(1.1rem, env(safe-area-inset-bottom))",
            right: "max(1.1rem, env(safe-area-inset-right))",
          }}
        >
          <button
            ref={envelopeBtnRef}
            type="button"
            onClick={() => {
              setSelectedItem(null);
              finaleRef.current.phase = "letter";
              setFinalePhase("letter");
            }}
            aria-label={SITE_CONTENT.solarSystem.readOurLetterAria}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/45 bg-cosmos-deep/85 text-amber-200 shadow-[0_0_24px_rgba(253,224,71,0.28)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-amber-200 hover:shadow-[0_0_32px_rgba(253,224,71,0.48)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M3.5 6.5 L12 13 L20.5 6.5" />
            </svg>
          </button>
        </div>
      )}

      {/* Grand Finale Sealed Envelope & Full-Screen Final Letter */}
      {(finalePhase === "envelope" || finalePhase === "letter") && (
        <FinalLetterOverlay
          phase={finalePhase}
          onOpenLetter={() => {
            finaleRef.current.phase = "letter";
            setFinalePhase("letter");
          }}
          onClose={() => {
            finaleRef.current.phase = "idle";
            setFinalePhase("idle");
          }}
          onReplayFinale={() => {
            startFinaleSequence();
          }}
          returnFocusTo={envelopeBtnRef}
        />
      )}

      {/* Moon Cratered Silver-Blue Descent Overlay (3s continuous landing zoom) */}
      <div
        ref={moonDiveRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-70 transition-opacity duration-300 ease-out"
        style={{
          opacity: 0,
          background:
            "radial-gradient(circle at 38% 42%, rgba(148,163,184,0.45) 0%, transparent 22%), radial-gradient(circle at 64% 58%, rgba(100,116,139,0.4) 0%, transparent 18%), radial-gradient(circle at center, rgba(226,232,240,0.92) 0%, rgba(148,163,184,0.88) 42%, rgba(30,41,59,0.92) 82%, rgba(2,3,10,0.98) 100%)",
        }}
      />

      {/* Earth Atmospheric Cloud-Dive Overlay (4s continuous spectate zoom for Our First Date) */}
      <div
        ref={earthDiveRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-70 transition-opacity duration-300 ease-out"
        style={{
          opacity: 0,
          background:
            "radial-gradient(circle at 30% 35%, rgba(255,255,255,0.85) 0%, rgba(224,242,254,0.5) 26%, transparent 56%), radial-gradient(circle at 72% 62%, rgba(255,255,255,0.82) 0%, rgba(186,230,253,0.45) 28%, transparent 58%), radial-gradient(circle at center, rgba(186,230,253,0.92) 0%, rgba(56,189,248,0.86) 46%, rgba(14,116,144,0.75) 85%, rgba(5,12,28,0.9) 100%)",
        }}
      />

      {/* Warm Golden Zoom-In / Zoom-Out Crossfade Glow */}
      <div
        ref={goldenVeilRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-70 transition-opacity duration-200 ease-out"
        style={{
          opacity: 0,
          background:
            "radial-gradient(circle at center, #fffbeb 0%, #fde047 34%, #f59e0b 68%, #04040e 100%)",
        }}
      />

      {/* White-Violet Arrival / Return Transition Veil — removed from DOM when inactive */}
      {veilMounted && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 transition-opacity duration-700 ease-out"
          style={{
            opacity: arrivalFlashOpacity,
            background:
              "radial-gradient(circle at center, #ffffff 0%, #f5f3ff 30%, #a855f7 68%, #05050f 100%)",
          }}
        />
      )}
    </main>
  );
}
