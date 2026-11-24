"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";
import {
  createAtmosphereState,
  renderAtmosphereFrame,
  spawnGardenBurst,
  type AtmosphereState,
  type ViewBoxRect,
} from "@/lib/atmosphereCanvas";
import {
  createGardenLayout,
  type GardenComposition,
  type GardenFlowerDef,
} from "@/lib/gardenLayout";
import { SITE_CONTENT } from "@/lib/content";
import {
  buildBudCorePath,
  buildCotyledonPath,
  buildPartialPolyline,
  buildPetalPaths,
  buildSepalPath,
  buildThornPath,
  buildTrueLeafPaths,
  computeStemCurve,
  computeWideCameraViewBox,
  HERO_BASE_X,
  HERO_BASE_Y,
  HERO_HEAD_Y,
  sampleCubic,
  sampleStemAtU,
  sampleWindWave,
  windowEase,
  WORLD_H,
  WORLD_W,
  type CurvePt,
  type StemParams,
} from "@/lib/flowerGrowth";
import {
  clamp,
  createSeededRandom,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  phyllotaxisPoint,
  randomRange,
  TAU,
} from "@/lib/math";
import "./SunBloomScene.css";

type FlowerPartId = (typeof SITE_CONTENT.sunFlower.parts)[number]["id"];
type FlowerPhase =
  | "growing"
  | "asking"
  | "celebrating"
  | "awakening"
  | "alive"
  | "dying"
  | "dead";

const TOTAL_GROWTH_SEC = 14.0;
const QUESTION_DELAY_SEC = 1.0;
const HEART_DURATION_SEC = 5.8;
const GARDEN_DURATION_SEC = 7.4;
const DEATH_DURATION_SEC = 6.0;
const PART_ZOOM_DURATION_SEC = 1.3;

const PART_ZOOM_LEVELS: Record<FlowerPartId, number> = {
  roots: 1.65,
  stem: 1.55,
  leaves: 1.68,
  thorns: 2.05,
  sepals: 1.95,
  "outer-petals": 1.62,
  "inner-petals": 1.82,
  core: 2.15,
  stamens: 1.95,
  pollen: 1.6,
};
const HINT_SWEEP_ORDER: FlowerPartId[] = [
  "roots",
  "stem",
  "leaves",
  "thorns",
  "sepals",
  "outer-petals",
  "inner-petals",
  "core",
  "stamens",
  "pollen",
];

const BASE_X = HERO_BASE_X;
const BASE_Y = HERO_BASE_Y;
const HEAD_X = HERO_BASE_X;
const HEAD_Y = HERO_HEAD_Y;

// Hero flower stem parameters (passed into the shared botanical growth engine)
const STEM_P0: CurvePt = { x: BASE_X, y: BASE_Y };
const STEM_P1: CurvePt = { x: BASE_X - 16, y: BASE_Y - 80 };
const STEM_P2: CurvePt = { x: BASE_X + 16, y: BASE_Y - 190 };
const STEM_P3: CurvePt = { x: HEAD_X, y: HEAD_Y };

const HERO_STEM_PARAMS: StemParams = {
  p0: STEM_P0,
  p1: STEM_P1,
  p2: STEM_P2,
  p3: STEM_P3,
  baseHalfW: 5.2,
  tipTaper: 0.68,
  sampleCount: 40,
  hookAmp: 18,
};

interface RootDef {
  id: string;
  parentIndex: number; // -1 for primary radicle
  attachU: number; // 0..1 along parent root where this lateral branches
  startTimeOffset: number;
  duration: number;
  maxWidth: number;
  points: CurvePt[]; // pre-sampled 18 points from (0,0) local or world
}

interface LeafDef {
  id: string;
  nodeU: number; // fixed position along full stem [0..1]
  side: -1 | 1; // -1 left, +1 right
  startT: number; // exact time when stemG passes nodeU
  duration: number;
  maxPetiole: number;
  maxLength: number;
  maxWidth: number;
  finalAngleDeg: number; // outward angle from stem tangent
}

interface ThornDef {
  id: string;
  nodeU: number;
  side: -1 | 1;
  startT: number;
  duration: number;
  maxLength: number;
}

interface SepalDef {
  id: string;
  // Angle offset when tightly wrapped in bud vs peeled open
  budTiltDeg: number;
  peelAngleDeg: number;
  budSpreadX: number;
  lengthScale: number;
  widthScale: number;
  isFront: boolean;
}

interface PetalDef {
  id: string;
  layer: 0 | 1 | 2 | 3; // 0=outer(8), 1=mid(8), 2=inner(6), 3=innermost(5)
  targetAngleDeg: number; // radial bloom angle around (0,0), 0 = straight up
  maxLength: number;
  maxWidth: number;
  startT: number;
  duration: number;
  opacity: number;
  gradId: string;
  partId: "outer-petals" | "inner-petals";
  phase: number;
  // Death fall parameters (some inner petals remain clinging to the drooping head)
  falls: boolean;
  detachD: number; // death progress [0..1] when this petal loosens and detaches
  fallDur: number; // death progress span for fall + landing
  fallDriftX: number; // total horizontal drift while falling
  fallSwayAmp: number;
  fallSpinDeg: number;
  landY: number; // ground landing Y
  restOpacity: number; // subtle resting opacity on the ground
}

interface CoreDotDef {
  id: string;
  targetX: number;
  targetY: number;
  maxR: number;
  startT: number;
  color: string;
}

interface StamenDef {
  id: string;
  points: CurvePt[];
  tip: CurvePt;
  startT: number;
  duration: number;
  phase: number;
}

interface SparkleDef {
  id: string;
  angle: number;
  dist: number;
  size: number;
  color: string;
  startT: number;
  driftSpeed: number;
  phase: number;
}

interface DriftPetalDef {
  id: string;
  startX: number;
  startY: number;
  driftX: number;
  fallDist: number;
  rotSpeed: number;
  scale: number;
  period: number;
  phase: number;
}

/**
 * Hero stem wrapper calling the shared parameterized `computeStemCurve` engine.
 */
function computeHeroStem(t: number, idleSec: number, d: number) {
  const stemG = windowEase(t, 3.0, 9.0);
  const maturity = 0.42 + 0.58 * windowEase(t, 3.0, 10.5);
  const hookFactor =
    t < 5.6
      ? Math.sin(clamp((t - 3.0) / 2.6, 0, 1) * Math.PI) * (1 - windowEase(t, 4.3, 5.6))
      : 0;
  const swayDamp = d > 0 ? 1 - windowEase(d, 0, 0.35) : 1;
  const swayAmp = (t > 14 ? 0.022 : 0.007 * stemG) * swayDamp;
  const swayAngle = sampleWindWave(t > 14 ? idleSec : t, BASE_X, swayAmp);
  const wiltG = d > 0 ? windowEase(d, 0.12, 0.85) : 0;

  return computeStemCurve(HERO_STEM_PARAMS, stemG, maturity, hookFactor, swayAngle, wiltG);
}

const PART_CALLOUTS: Record<
  FlowerPartId,
  { targetX: number; targetY: number; labelX: number; labelY: number; anchor: "start" | "end" }
> = {
  roots: { targetX: BASE_X + 32, targetY: BASE_Y + 45, labelX: BASE_X + 132, labelY: BASE_Y + 57, anchor: "start" },
  stem: { targetX: BASE_X + 4, targetY: BASE_Y - 130, labelX: BASE_X + 132, labelY: BASE_Y - 130, anchor: "start" },
  leaves: { targetX: BASE_X - 85, targetY: BASE_Y - 103, labelX: BASE_X - 152, labelY: BASE_Y - 103, anchor: "end" },
  thorns: { targetX: BASE_X + 14, targetY: BASE_Y - 153, labelX: BASE_X + 132, labelY: BASE_Y - 163, anchor: "start" },
  sepals: { targetX: BASE_X + 34, targetY: HEAD_Y + 38, labelX: BASE_X + 140, labelY: HEAD_Y + 62, anchor: "start" },
  "outer-petals": { targetX: BASE_X + 98, targetY: HEAD_Y - 35, labelX: BASE_X + 158, labelY: HEAD_Y - 68, anchor: "start" },
  "inner-petals": { targetX: BASE_X - 62, targetY: HEAD_Y - 32, labelX: BASE_X - 148, labelY: HEAD_Y - 68, anchor: "end" },
  core: { targetX: BASE_X + 22, targetY: HEAD_Y - 8, labelX: BASE_X + 158, labelY: HEAD_Y - 8, anchor: "start" },
  stamens: { targetX: BASE_X - 44, targetY: HEAD_Y + 22, labelX: BASE_X - 148, labelY: HEAD_Y + 36, anchor: "end" },
  pollen: { targetX: BASE_X + 96, targetY: HEAD_Y - 92, labelX: BASE_X + 158, labelY: HEAD_Y - 112, anchor: "start" },
};

/**
 * Step 1: Literal botanical growth — Seed, Germination & Branching Roots,
 * Hooked Emerging Shoot -> Tapered S-Curve Stem + Cotyledons, and Smooth Following Camera.
 */
export interface SunBloomSceneProps {
  onExit?: () => void;
  onVisited?: () => void;
}

export default function SunBloomScene({ onExit }: SunBloomSceneProps) {
  const copy = SITE_CONTENT.sunFlower;
  const sunCopy = SITE_CONTENT.solarSystem.sun;
  const backLabel = SITE_CONTENT.solarSystem.backToSystemCta;

  const [phase, setPhase] = useState<FlowerPhase>("growing");
  const [questionVisible, setQuestionVisible] = useState(false);
  const [titleVisible, setTitleVisible] = useState(true);
  const [hintSweepPartId, setHintSweepPartId] = useState<FlowerPartId | null>(null);
  const [hoveredPartId, setHoveredPartId] = useState<FlowerPartId | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<FlowerPartId | null>(null);
  const [hoveredGardenIdx, setHoveredGardenIdx] = useState<number>(-1);
  const [debugMode, setDebugMode] = useState(false);
  const [debugT, setDebugT] = useState(0);
  const [debugPaused, setDebugPaused] = useState(false);
  const [composition, setComposition] = useState<GardenComposition>("landscape");

  // Refs for direct 60fps SVG & Canvas DOM updates (zero React re-renders per frame)
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgNebulaRef = useRef<SVGRectElement | null>(null);
  const atmosphereGroupRef = useRef<SVGGElement | null>(null);
  const plantColorGroupRef = useRef<SVGGElement | null>(null);
  const desatMatrixRef = useRef<SVGFEColorMatrixElement | null>(null);
  const brightMatrixRef = useRef<SVGFEColorMatrixElement | null>(null);
  const seedGroupRef = useRef<SVGGElement | null>(null);
  const seedCrackRef = useRef<SVGPathElement | null>(null);
  const soilGlowRef = useRef<SVGEllipseElement | null>(null);
  const soilRippleRef = useRef<SVGEllipseElement | null>(null);
  const rootPathRefs = useRef<Array<SVGPathElement | null>>([]);
  const stemOutlineRef = useRef<SVGPathElement | null>(null);
  const stemSpineRef = useRef<SVGPathElement | null>(null);
  const cotLeftGroupRef = useRef<SVGGElement | null>(null);
  const cotLeftPathRef = useRef<SVGPathElement | null>(null);
  const cotRightGroupRef = useRef<SVGGElement | null>(null);
  const cotRightPathRef = useRef<SVGPathElement | null>(null);

  // Step 2 refs: 5 true leaves, 3 thorns, and riding/swelling bud (head anchored at stem.tip)
  const leafGroupRefs = useRef<Array<SVGGElement | null>>([]);
  const leafStalkRefs = useRef<Array<SVGPathElement | null>>([]);
  const leafBladeRefs = useRef<Array<SVGPathElement | null>>([]);
  const leafVeinRefs = useRef<Array<SVGPathElement | null>>([]);
  const thornGroupRefs = useRef<Array<SVGGElement | null>>([]);
  const thornPathRefs = useRef<Array<SVGPathElement | null>>([]);
  const headGroupRef = useRef<SVGGElement | null>(null);
  const receptacleRef = useRef<SVGEllipseElement | null>(null);
  const budInnerRef = useRef<SVGPathElement | null>(null);
  const budGlowRef = useRef<SVGCircleElement | null>(null);
  const sepalGroupRefs = useRef<Array<SVGGElement | null>>([]);
  const sepalPathRefs = useRef<Array<SVGPathElement | null>>([]);

  // Step 3 refs: 4 nested petal layers, golden phyllotaxis core, 12 stamens, sparkles & drifting petals
  const petalGroupRefs = useRef<Array<SVGGElement | null>>([]);
  const petalBladeRefs = useRef<Array<SVGPathElement | null>>([]);
  const petalVeinRefs = useRef<Array<SVGPathElement | null>>([]);
  const coreAuraRef = useRef<SVGCircleElement | null>(null);
  const coreDiscRef = useRef<SVGCircleElement | null>(null);
  const coreDotRefs = useRef<Array<SVGCircleElement | null>>([]);
  const stamenPathRefs = useRef<Array<SVGPathElement | null>>([]);
  const stamenTipRefs = useRef<Array<SVGCircleElement | null>>([]);
  const sparkleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const driftPetalRefs = useRef<Array<SVGGElement | null>>([]);

  // Step 4 refs: Ground ripple, ground flora, and staggered 3-row garden flowers
  const gardenRipple1Ref = useRef<SVGEllipseElement | null>(null);
  const gardenRipple2Ref = useRef<SVGEllipseElement | null>(null);
  const grassPathRefs = useRef<Array<SVGPathElement | null>>([]);
  const sproutDotRefs = useRef<Array<SVGCircleElement | null>>([]);
  const mushroomGroupRefs = useRef<Array<SVGGElement | null>>([]);
  const mossEllipseRefs = useRef<Array<SVGEllipseElement | null>>([]);
  const gardenSeedRefs = useRef<Array<SVGCircleElement | null>>([]);
  const gardenStemRefs = useRef<Array<SVGPathElement | null>>([]);
  const gardenLeafGroupRefs = useRef<Array<Array<SVGGElement | null>>>([]);
  const gardenLeafBladeRefs = useRef<Array<Array<SVGPathElement | null>>>([]);
  const gardenHeadRefs = useRef<Array<SVGGElement | null>>([]);
  const gardenBudRefs = useRef<Array<SVGPathElement | null>>([]);
  const gardenPetalGroupRefs = useRef<Array<Array<SVGGElement | null>>>([]);
  const gardenPetalBladeRefs = useRef<Array<Array<SVGPathElement | null>>>([]);
  const gardenCoreRefs = useRef<Array<SVGCircleElement | null>>([]);
  const gardenTipPositionsRef = useRef<Array<CurvePt>>([]);
  const gardenLeanAnglesRef = useRef<number[]>([]);
  const gardenFullGrownRef = useRef<boolean[]>([]);
  const hoveredGardenIdxRef = useRef<number>(-1);
  const pointerWorldXRef = useRef<number>(BASE_X);

  // Master timeline refs (StrictMode-safe, initialized fresh inside useEffect)
  const phaseRef = useRef<FlowerPhase>("growing");
  const tRef = useRef<number>(0);
  const idleRef = useRef<number>(0);
  const celebrateRef = useRef<number>(0);
  const awakenRef = useRef<number>(0);
  const deathRef = useRef<number>(0);
  const isMobileRef = useRef<boolean>(false);
  const aspectRef = useRef<number>(1.6);
  const compositionRef = useRef<GardenComposition>("landscape");
  const partCamRef = useRef<{
    targetPartId: FlowerPartId | null;
    fromVb: ViewBoxRect | null;
    elapsed: number;
    transitioning: boolean;
  }>({
    targetPartId: null,
    fromVb: null,
    elapsed: PART_ZOOM_DURATION_SEC,
    transitioning: false,
  });
  const vbRef = useRef<ViewBoxRect>({ x: 0, y: 0, w: WORLD_W, h: WORLD_H });
  const atmosStateRef = useRef<AtmosphereState | null>(null);
  const questionShownRef = useRef<boolean>(false);
  const skippingRef = useRef<{ active: boolean; startT: number; elapsed: number }>({
    active: false,
    startT: 0,
    elapsed: 0,
  });
  const manualPauseRef = useRef<boolean>(false);
  const debugModeRef = useRef<boolean>(false);
  const sweepTimersRef = useRef<number[]>([]);

  const cardTouchStartYRef = useRef<number | null>(null);
  const [cardDragY, setCardDragY] = useState(0);

  // Detect ?debug query param for dev-only timeline scrubber
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasDebug = new URLSearchParams(window.location.search).has("debug");
    if (hasDebug) {
      debugModeRef.current = true;
      const frame = requestAnimationFrame(() => setDebugMode(true));
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  // Pre-compute deterministic background stars and root curve polylines
  const staticData = useMemo(() => {
    const rng = createSeededRandom(20261124);

    const bgStars = Array.from({ length: 155 }, (_, i) => ({
      id: `star-${i}`,
      x: randomRange(rng, -380, WORLD_W + 380),
      y: randomRange(rng, -280, 560),
      r: randomRange(rng, 0.5, 1.65),
      opacity: randomRange(rng, 0.22, 0.82),
      sparkle: i % 11 === 0,
      color: i % 4 === 0 ? "#fde68a" : i % 3 === 0 ? "#fbcfe8" : "#f8fafc",
    }));

    // Primary radicle root pushing straight down from seed (BASE_X, BASE_Y + 1)
    const primaryPts = sampleCubic(
      { x: BASE_X, y: BASE_Y + 1 },
      { x: BASE_X - 2, y: BASE_Y + 31 },
      { x: BASE_X + 3, y: BASE_Y + 61 },
      { x: BASE_X, y: BASE_Y + 91 },
      20
    );

    const sampleRootAt = (pts: CurvePt[], u: number): CurvePt => {
      const idx = Math.min(pts.length - 1, Math.round(u * (pts.length - 1)));
      return pts[idx];
    };

    const pLeft1 = sampleRootAt(primaryPts, 0.14);
    const pRight1 = sampleRootAt(primaryPts, 0.18);
    const pLeft2 = sampleRootAt(primaryPts, 0.34);
    const pRight2 = sampleRootAt(primaryPts, 0.40);
    const pLeft3 = sampleRootAt(primaryPts, 0.58);
    const pRight3 = sampleRootAt(primaryPts, 0.64);

    const roots: RootDef[] = [
      {
        id: "radicle",
        parentIndex: -1,
        attachU: 0,
        startTimeOffset: 1.65,
        duration: 1.55,
        maxWidth: 2.8,
        points: primaryPts,
      },
      {
        id: "lat-l1",
        parentIndex: 0,
        attachU: 0.14,
        startTimeOffset: 0,
        duration: 1.15,
        maxWidth: 2.1,
        points: sampleCubic(
          pLeft1,
          { x: BASE_X - 26, y: BASE_Y + 19 },
          { x: BASE_X - 56, y: BASE_Y + 27 },
          { x: BASE_X - 92, y: BASE_Y + 35 }
        ),
      },
      {
        id: "lat-r1",
        parentIndex: 0,
        attachU: 0.18,
        startTimeOffset: 0,
        duration: 1.15,
        maxWidth: 2.1,
        points: sampleCubic(
          pRight1,
          { x: BASE_X + 26, y: BASE_Y + 21 },
          { x: BASE_X + 56, y: BASE_Y + 29 },
          { x: BASE_X + 92, y: BASE_Y + 37 }
        ),
      },
      {
        id: "lat-l2",
        parentIndex: 0,
        attachU: 0.34,
        startTimeOffset: 0,
        duration: 1.1,
        maxWidth: 1.9,
        points: sampleCubic(
          pLeft2,
          { x: BASE_X - 22, y: BASE_Y + 43 },
          { x: BASE_X - 48, y: BASE_Y + 57 },
          { x: BASE_X - 78, y: BASE_Y + 69 }
        ),
      },
      {
        id: "lat-r2",
        parentIndex: 0,
        attachU: 0.40,
        startTimeOffset: 0,
        duration: 1.1,
        maxWidth: 1.9,
        points: sampleCubic(
          pRight2,
          { x: BASE_X + 22, y: BASE_Y + 45 },
          { x: BASE_X + 48, y: BASE_Y + 59 },
          { x: BASE_X + 78, y: BASE_Y + 71 }
        ),
      },
      {
        id: "lat-l3",
        parentIndex: 0,
        attachU: 0.58,
        startTimeOffset: 0,
        duration: 0.95,
        maxWidth: 1.5,
        points: sampleCubic(
          pLeft3,
          { x: BASE_X - 16, y: BASE_Y + 65 },
          { x: BASE_X - 32, y: BASE_Y + 77 },
          { x: BASE_X - 48, y: BASE_Y + 89 }
        ),
      },
      {
        id: "lat-r3",
        parentIndex: 0,
        attachU: 0.64,
        startTimeOffset: 0,
        duration: 0.95,
        maxWidth: 1.5,
        points: sampleCubic(
          pRight3,
          { x: BASE_X + 16, y: BASE_Y + 67 },
          { x: BASE_X + 32, y: BASE_Y + 79 },
          { x: BASE_X + 48, y: BASE_Y + 91 }
        ),
      },
    ];

    // 5 true leaves at fixed stem arc-length nodes (lower leaves start earlier and end larger)
    // startT matches the exact moment windowEase(t, 3.0, 9.0) passes nodeU
    const leaves: LeafDef[] = [
      {
        id: "leaf-1",
        nodeU: 0.21,
        side: -1,
        startT: 4.82,
        duration: 2.35,
        maxPetiole: 16,
        maxLength: 82,
        maxWidth: 27,
        finalAngleDeg: 64,
      },
      {
        id: "leaf-2",
        nodeU: 0.35,
        side: 1,
        startT: 5.45,
        duration: 2.25,
        maxPetiole: 15,
        maxLength: 74,
        maxWidth: 24.5,
        finalAngleDeg: 62,
      },
      {
        id: "leaf-3",
        nodeU: 0.5,
        side: -1,
        startT: 6.02,
        duration: 2.15,
        maxPetiole: 13.5,
        maxLength: 64,
        maxWidth: 21.5,
        finalAngleDeg: 58,
      },
      {
        id: "leaf-4",
        nodeU: 0.65,
        side: 1,
        startT: 6.6,
        duration: 2.0,
        maxPetiole: 12,
        maxLength: 53,
        maxWidth: 18,
        finalAngleDeg: 54,
      },
      {
        id: "leaf-5",
        nodeU: 0.78,
        side: -1,
        startT: 7.15,
        duration: 1.85,
        maxPetiole: 10,
        maxLength: 42,
        maxWidth: 14.5,
        finalAngleDeg: 48,
      },
    ];

    // 3 cosmic thorns emerging from fixed stem nodes after the tip passes
    const thorns: ThornDef[] = [
      { id: "thorn-1", nodeU: 0.28, side: 1, startT: 5.15, duration: 0.9, maxLength: 11.5 },
      { id: "thorn-2", nodeU: 0.44, side: -1, startT: 5.78, duration: 0.85, maxLength: 10.5 },
      { id: "thorn-3", nodeU: 0.6, side: 1, startT: 6.4, duration: 0.8, maxLength: 9.5 },
    ];

    // 5 sepals wrapping the bud from base (0,0) — 2 behind, 3 in front
    // They peel gracefully outward/downward when the flower blooms (11.0s -> 12.6s)
    const sepals: SepalDef[] = [
      { id: "sep-back-l", budTiltDeg: -19, peelAngleDeg: -124, budSpreadX: -4, lengthScale: 0.96, widthScale: 0.95, isFront: false },
      { id: "sep-back-r", budTiltDeg: 19, peelAngleDeg: 124, budSpreadX: 4, lengthScale: 0.96, widthScale: 0.95, isFront: false },
      { id: "sep-front-l", budTiltDeg: -11, peelAngleDeg: -148, budSpreadX: -2.5, lengthScale: 1.0, widthScale: 1.0, isFront: true },
      { id: "sep-front-r", budTiltDeg: 11, peelAngleDeg: 148, budSpreadX: 2.5, lengthScale: 1.0, widthScale: 1.0, isFront: true },
      { id: "sep-front-c", budTiltDeg: 0, peelAngleDeg: 176, budSpreadX: 0, lengthScale: 1.04, widthScale: 1.05, isFront: true },
    ];

    // 4 nested petal layers sharing exact center (0,0) inside headGroup:
    // outer 8, middle 8 (offset half-step 22.5°), inner 6, innermost 5
    const layerConfigs: Array<{
      layer: 0 | 1 | 2 | 3;
      count: number;
      offsetDeg: number;
      baseLen: number;
      baseW: number;
      baseStart: number;
      duration: number;
      opacity: number;
      gradId: string;
      partId: "outer-petals" | "inner-petals";
    }> = [
      {
        layer: 0,
        count: 8,
        offsetDeg: 0,
        baseLen: 112,
        baseW: 36,
        baseStart: 11.05,
        duration: 1.55,
        opacity: 0.78,
        gradId: "sbsPetalOuterGrad",
        partId: "outer-petals",
      },
      {
        layer: 1,
        count: 8,
        offsetDeg: 22.5,
        baseLen: 94,
        baseW: 31,
        baseStart: 11.45,
        duration: 1.45,
        opacity: 0.85,
        gradId: "sbsPetalMidGrad",
        partId: "outer-petals",
      },
      {
        layer: 2,
        count: 6,
        offsetDeg: 10,
        baseLen: 72,
        baseW: 25,
        baseStart: 11.85,
        duration: 1.35,
        opacity: 0.9,
        gradId: "sbsPetalInnerGrad",
        partId: "inner-petals",
      },
      {
        layer: 3,
        count: 5,
        offsetDeg: 36,
        baseLen: 50,
        baseW: 19,
        baseStart: 12.25,
        duration: 1.2,
        opacity: 0.95,
        gradId: "sbsPetalInnermostGrad",
        partId: "inner-petals",
      },
    ];

    const petals: PetalDef[] = [];
    for (const cfg of layerConfigs) {
      const step = 360 / cfg.count;
      for (let i = 0; i < cfg.count; i++) {
        let angle = cfg.offsetDeg + i * step + randomRange(rng, -3.5, 3.5);
        // Normalize to [-180, 180] so petals hinge open via the shortest path from vertical (0°)
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        // Outer layers loosen & fall first; 6 inner/innermost petals remain clinging to the drooping plant
        const falls =
          cfg.layer === 0 ||
          cfg.layer === 1 ||
          (cfg.layer === 2 && i % 2 === 0) ||
          (cfg.layer === 3 && i === 0);
        const layerDetachBase =
          cfg.layer === 0 ? 0.2 : cfg.layer === 1 ? 0.34 : cfg.layer === 2 ? 0.48 : 0.56;
        const detachD = clamp(layerDetachBase + (i / cfg.count) * 0.22 + randomRange(rng, -0.02, 0.03), 0.18, 0.66);

        petals.push({
          id: `petal-L${cfg.layer}-${i}`,
          layer: cfg.layer,
          targetAngleDeg: angle,
          maxLength: cfg.baseLen * randomRange(rng, 0.94, 1.06),
          maxWidth: cfg.baseW * randomRange(rng, 0.94, 1.06),
          startT: cfg.baseStart + randomRange(rng, 0, 0.24),
          duration: cfg.duration,
          opacity: cfg.opacity,
          gradId: cfg.gradId,
          partId: cfg.partId,
          phase: randomRange(rng, 0, TAU),
          falls,
          detachD,
          fallDur: randomRange(rng, 0.28, 0.36),
          fallDriftX: randomRange(rng, -95, 85),
          fallSwayAmp: randomRange(rng, 10, 22),
          fallSpinDeg: randomRange(rng, 70, 155) * (i % 2 === 0 ? 1 : -1),
          landY: randomRange(rng, BASE_Y - 2, BASE_Y + 26),
          restOpacity: i % 3 === 0 ? randomRange(rng, 0.28, 0.42) : randomRange(rng, 0.08, 0.22),
        });
      }
    }

    // 56 golden-angle phyllotaxis seed dots growing radially from (0,0)
    const coreDots: CoreDotDef[] = Array.from({ length: 56 }, (_, i) => {
      const pt = phyllotaxisPoint(i, 56, 17.5);
      const frac = i / 55;
      return {
        id: `core-dot-${i}`,
        targetX: pt.x,
        targetY: pt.y,
        maxR: lerp(1.9, 1.15, frac),
        startT: 13.0 + frac * 0.45,
        color: i < 16 ? "#fffbeb" : i < 36 ? "#fde047" : "#f59e0b",
      };
    });

    // 12 thin curved stamen filaments evenly spread around (0,0)
    const stamens: StamenDef[] = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * TAU + randomRange(rng, -0.07, 0.07);
      const len = randomRange(rng, 34, 45);
      const curveSign = i % 2 === 0 ? 1 : -1;
      const p0 = { x: Math.cos(angle) * 6, y: Math.sin(angle) * 6 };
      const perpX = -Math.sin(angle) * curveSign;
      const perpY = Math.cos(angle) * curveSign;
      const p1 = {
        x: Math.cos(angle) * (len * 0.42) + perpX * 8,
        y: Math.sin(angle) * (len * 0.42) + perpY * 8,
      };
      const p2 = {
        x: Math.cos(angle) * (len * 0.78) + perpX * 6,
        y: Math.sin(angle) * (len * 0.78) + perpY * 6,
      };
      const p3 = { x: Math.cos(angle) * len, y: Math.sin(angle) * len };
      return {
        id: `stamen-${i}`,
        points: sampleCubic(p0, p1, p2, p3, 12),
        tip: p3,
        startT: 13.08 + (i % 4) * 0.06,
        duration: 0.65,
        phase: randomRange(rng, 0, TAU),
      };
    });

    // 28 cosmic pollen sparkles born at flower center (0,0) and drifting outward
    const sparkles: SparkleDef[] = Array.from({ length: 28 }, (_, i) => ({
      id: `sparkle-${i}`,
      angle: (i / 28) * TAU + randomRange(rng, -0.15, 0.15),
      dist: randomRange(rng, 58, 158),
      size: randomRange(rng, 1.1, 2.6),
      color: i % 3 === 0 ? "#fef08a" : i % 3 === 1 ? "#fbcfe8" : "#c4b5fd",
      startT: 13.15 + randomRange(rng, 0, 0.45),
      driftSpeed: randomRange(rng, 0.25, 0.55),
      phase: randomRange(rng, 0, TAU),
    }));

    // 6 detached tiny glowing petals drifting gently during idle (t > 14s)
    const driftPetals: DriftPetalDef[] = Array.from({ length: 6 }, (_, i) => ({
      id: `drift-${i}`,
      startX: randomRange(rng, BASE_X - 240, BASE_X + 240),
      startY: randomRange(rng, 70, 220),
      driftX: randomRange(rng, -55, 55),
      fallDist: randomRange(rng, 220, 340),
      rotSpeed: randomRange(rng, 18, 38) * (i % 2 === 0 ? 1 : -1),
      scale: randomRange(rng, 0.65, 1.05),
      period: randomRange(rng, 9.5, 14.5),
      phase: (i / 6) * 12,
    }));

    const gardenLandscape = createGardenLayout("landscape", 20261124);
    const gardenPortrait = createGardenLayout("portrait", 20261124);

    return {
      bgStars,
      roots,
      leaves,
      thorns,
      sepals,
      petals,
      coreDots,
      stamens,
      sparkles,
      driftPetals,
      gardenLandscape,
      gardenPortrait,
    };
  }, []);

  /**
   * Computes and applies the exact frame geometry for time `t` (0..14s+), `idleSec`,
   * death progress `d` (0..1), atmosphere fade `atmosG` (0..1), camera pull-back
   * `gardenPullG` (0..1), and garden awakening clock `awakenSec` directly to SVG nodes at 60fps.
   */
  const applyFrame = useCallback(
    (t: number, idleSec: number, d = 0, atmosG = 0, gardenPullG = 0, awakenSec = 0) => {
      const swayDamp = d > 0 ? 1 - windowEase(d, 0, 0.35) : 1;
      const glowDim = d > 0 ? 1 - windowEase(d, 0, 0.55) : 1;
      const sparkleFade = d > 0 ? 1 - windowEase(d, 0, 0.32) : 1;
      const wiltG = d > 0 ? windowEase(d, 0.12, 0.85) : 0;

      // Global grayscale desaturation + subtle darkening on the plant group during death
      if (plantColorGroupRef.current && desatMatrixRef.current && brightMatrixRef.current) {
        if (d > 0.002) {
          const sat = 1 - windowEase(d, 0.05, 0.58);
          const bright = lerp(1.0, 0.66, windowEase(d, 0.25, 0.85));
          desatMatrixRef.current.setAttribute("values", sat.toFixed(3));
          brightMatrixRef.current.setAttribute(
            "values",
            `${bright.toFixed(3)} 0 0 0 0  0 ${bright.toFixed(3)} 0 0 0  0 0 ${bright.toFixed(3)} 0 0  0 0 0 1 0`
          );
          plantColorGroupRef.current.setAttribute("filter", "url(#sbsDesaturateFilter)");
        } else {
          plantColorGroupRef.current.removeAttribute("filter");
        }
      }

      if (bgNebulaRef.current) {
        bgNebulaRef.current.setAttribute("opacity", glowDim.toFixed(3));
      }

      if (atmosphereGroupRef.current) {
        atmosphereGroupRef.current.setAttribute("opacity", (atmosG * glowDim).toFixed(3));
      }
      // --- 1. SEED (0.0s -> 1.5s fall + sink + pulse; 1.5s -> 3.0s swell & crack) ---
      if (seedGroupRef.current) {
        const fallG = easeOutCubic(clamp(t / 1.05, 0, 1));
        const sinkG = windowEase(t, 1.05, 1.35);
        const seedY = lerp(BASE_Y - 180, BASE_Y - 2, fallG) + sinkG * 5;
        const pulse =
          t >= 1.05 && t <= 1.55 ? 1 + Math.sin(((t - 1.05) / 0.5) * Math.PI) * 0.28 : 1;
        const swell = 1 + windowEase(t, 1.5, 2.3) * 0.25;
        // Seed stays nestled in the soil as the roots & stem emerge from it, gently receding into the base
        const fadeOut = 1 - windowEase(t, 3.6, 5.4);
        const scale = pulse * swell;
        seedGroupRef.current.setAttribute(
          "transform",
          `translate(${BASE_X}, ${seedY.toFixed(1)}) scale(${scale.toFixed(3)})`
        );
        seedGroupRef.current.setAttribute("opacity", fadeOut.toFixed(3));
      }

      if (seedCrackRef.current) {
        const crackG = windowEase(t, 1.55, 2.1);
        seedCrackRef.current.setAttribute("opacity", crackG.toFixed(3));
      }

      // Soil glow & landing pulse ripple
      if (soilGlowRef.current) {
        const ignite = windowEase(t, 0.95, 1.6);
        const breathe = t > 14 ? 0.88 + 0.12 * Math.sin(idleSec * 1.3) * swayDamp : 1;
        const rx = lerp(45, 180, windowEase(t, 1.0, 9.0));
        const ry = lerp(10, 36, windowEase(t, 1.0, 9.0));
        soilGlowRef.current.setAttribute("rx", rx.toFixed(1));
        soilGlowRef.current.setAttribute("ry", ry.toFixed(1));
        soilGlowRef.current.setAttribute("opacity", (ignite * breathe * glowDim).toFixed(3));
      }

      if (soilRippleRef.current) {
        if (t >= 1.02 && t <= 1.75) {
          const ripG = (t - 1.02) / 0.73;
          soilRippleRef.current.setAttribute("rx", (18 + ripG * 86).toFixed(1));
          soilRippleRef.current.setAttribute("ry", (4 + ripG * 18).toFixed(1));
          soilRippleRef.current.setAttribute("opacity", ((1 - ripG) * 0.65).toFixed(3));
        } else {
          soilRippleRef.current.setAttribute("opacity", "0");
        }
      }

      // --- 2. GERMINATION: PRIMARY RADICLE + BRANCHING LATERAL ROOTS (1.65s -> 4.2s) ---
      const radicle = staticData.roots[0];
      const radicleG = windowEase(
        t,
        radicle.startTimeOffset,
        radicle.startTimeOffset + radicle.duration
      );

      staticData.roots.forEach((root, idx) => {
        const el = rootPathRefs.current[idx];
        if (!el) return;
        let g = 0;
        if (root.parentIndex === -1) {
          g = radicleG;
        } else {
          // Lateral root begins growing ONLY AFTER the primary root tip passes its attachment node
          const passTime = radicle.startTimeOffset + root.attachU * radicle.duration;
          g = windowEase(t, passTime, passTime + root.duration);
        }

        if (g <= 0.002) {
          el.setAttribute("d", "");
        } else {
          el.setAttribute("d", buildPartialPolyline(root.points, g));
          el.setAttribute("stroke-width", (root.maxWidth * (0.45 + 0.55 * g)).toFixed(2));
        }
      });

      // --- 3. SHOOT HOOK -> TAPERED S-CURVE STEM (3.0s -> 9.0s) ---
      const stem = computeHeroStem(t, idleSec, d);
      if (stemOutlineRef.current) {
        stemOutlineRef.current.setAttribute("d", stem.taperedOutline);
      }
      if (stemSpineRef.current) {
        stemSpineRef.current.setAttribute("d", stem.centerLine);
      }

      // Two small seed leaves (cotyledons) unfolding from first node (u = 0.09)
      const cotNodeU = 0.09;
      if (stem.stemG > cotNodeU && stem.pts.length > 2) {
        const localFrac = clamp(cotNodeU / stem.stemG, 0, 1);
        const ptIdx = Math.min(stem.pts.length - 1, Math.round(localFrac * (stem.pts.length - 1)));
        const nodePt = stem.pts[ptIdx];
        const cotG = windowEase(t, 3.65, 5.15);
        const cotLen = 22 * easeOutCubic(clamp(cotG * 1.4, 0, 1));
        const cotW = 8.5 * easeOutCubic(clamp((cotG - 0.15) / 0.85, 0, 1));
        const openAngle = lerp(12, 68, easeInOutCubic(cotG));
        const cotD = buildCotyledonPath(cotLen, cotW);

        if (cotLeftGroupRef.current && cotLeftPathRef.current) {
          cotLeftGroupRef.current.setAttribute(
            "transform",
            `translate(${nodePt.x.toFixed(1)}, ${nodePt.y.toFixed(1)}) rotate(${(-openAngle).toFixed(1)})`
          );
          cotLeftPathRef.current.setAttribute("d", cotD);
        }
        if (cotRightGroupRef.current && cotRightPathRef.current) {
          cotRightGroupRef.current.setAttribute(
            "transform",
            `translate(${nodePt.x.toFixed(1)}, ${nodePt.y.toFixed(1)}) rotate(${openAngle.toFixed(1)})`
          );
          cotRightPathRef.current.setAttribute("d", cotD);
        }
      } else {
        cotLeftPathRef.current?.setAttribute("d", "");
        cotRightPathRef.current?.setAttribute("d", "");
      }

      // --- 4. TRUE LEAVES GROWING FROM FIXED STEM NODES (4.8s -> 9.0s) ---
      staticData.leaves.forEach((leaf, idx) => {
        const grp = leafGroupRefs.current[idx];
        const stalkEl = leafStalkRefs.current[idx];
        const bladeEl = leafBladeRefs.current[idx];
        const veinEl = leafVeinRefs.current[idx];
        if (!grp || !stalkEl || !bladeEl || !veinEl) return;

        const node = sampleStemAtU(stem.pts, stem.stemG, leaf.nodeU);
        if (!node) {
          stalkEl.setAttribute("d", "");
          bladeEl.setAttribute("d", "");
          veinEl.setAttribute("d", "");
          return;
        }

        const g = windowEase(t, leaf.startT, leaf.startT + leaf.duration);
        if (g <= 0.004) {
          stalkEl.setAttribute("d", "");
          bladeEl.setAttribute("d", "");
          veinEl.setAttribute("d", "");
          return;
        }

        // Rotate smoothly outward from folded along the stem to final graceful angle
        const foldAngle = leaf.side * 10;
        const targetAngle = leaf.side * leaf.finalAngleDeg;
        const rotG = easeInOutCubic(clamp((g - 0.14) / 0.86, 0, 1));
        // Subtle breeze lag on leaves during idle (stops during death) + downward droop during wilt
        const leafLag = t > 14 ? Math.sin(idleSec * 0.85 - 0.5 - idx * 0.25) * 1.6 * swayDamp : 0;
        const leafDroop = leaf.side * wiltG * 46;
        const angle = node.tangentDeg + lerp(foldAngle, targetAngle, rotG) + leafLag + leafDroop;

        grp.setAttribute(
          "transform",
          `translate(${node.pt.x.toFixed(1)}, ${node.pt.y.toFixed(1)}) rotate(${angle.toFixed(1)})`
        );

        const paths = buildTrueLeafPaths(
          g,
          leaf.side,
          leaf.maxPetiole,
          leaf.maxLength,
          leaf.maxWidth,
          wiltG
        );
        stalkEl.setAttribute("d", paths.stalk);
        bladeEl.setAttribute("d", paths.blade);
        veinEl.setAttribute("d", paths.veins);
      });

      // --- 5. THORNS EMERGING FROM FIXED STEM NODES ---
      staticData.thorns.forEach((thorn, idx) => {
        const grp = thornGroupRefs.current[idx];
        const pathEl = thornPathRefs.current[idx];
        if (!grp || !pathEl) return;

        const node = sampleStemAtU(stem.pts, stem.stemG, thorn.nodeU);
        if (!node) {
          pathEl.setAttribute("d", "");
          return;
        }
        const g = windowEase(t, thorn.startT, thorn.startT + thorn.duration);
        if (g <= 0.01) {
          pathEl.setAttribute("d", "");
          return;
        }
        grp.setAttribute(
          "transform",
          `translate(${node.pt.x.toFixed(1)}, ${node.pt.y.toFixed(1)}) rotate(${node.tangentDeg.toFixed(1)})`
        );
        pathEl.setAttribute("d", buildThornPath(g, thorn.side, thorn.maxLength));
      });

      // --- 6. RIDING & SWELLING BUD (5.0s -> 11.0s) ---
      // The bud exists from 5.0s as a tiny knob riding on the moving stem tip,
      // then swells to full pre-bloom size (9.0s -> 11.0s) with heavy gentle sway.
      if (headGroupRef.current) {
        const budRideG = windowEase(t, 4.9, 9.0); // 0..1 while riding upward on tip
        const budSwellG = windowEase(t, 9.0, 11.0); // 0..1 swelling after stem stops
        // Heavy bud pendulum sway (strongest during 9.0s..11.2s, soft secondary lag after 14s)
        const heavySway =
          t >= 8.8 && t <= 12.0
            ? Math.sin((t - 8.8) * 2.1) * 3.4 * Math.sin(clamp((t - 8.8) / 3.2, 0, 1) * Math.PI)
            : 0;
        const headLag = t > 14 ? Math.sin(idleSec * 0.85 - 0.55) * 2.1 * swayDamp : 0;
        const headDroop = wiltG * 42;
        const headAngle = stem.tipAngleDeg + heavySway + headLag + headDroop;

        headGroupRef.current.setAttribute(
          "transform",
          `translate(${stem.tip.x.toFixed(1)}, ${stem.tip.y.toFixed(1)}) rotate(${headAngle.toFixed(1)})`
        );

        // Receptacle cup at (0, 0) grows continuously from tiny 1.5px knob -> 11px mature calyx base
        if (receptacleRef.current) {
          if (budRideG <= 0.005) {
            receptacleRef.current.setAttribute("rx", "0");
            receptacleRef.current.setAttribute("ry", "0");
          } else {
            const rx = lerp(2.0, 7.2, budRideG) + budSwellG * 4.2;
            const ry = lerp(1.8, 5.4, budRideG) + budSwellG * 2.8;
            receptacleRef.current.setAttribute("rx", rx.toFixed(1));
            receptacleRef.current.setAttribute("ry", ry.toFixed(1));
          }
        }

        // Inner cosmic bud (hint of warm gold/pink/violet color peeking from parting sepal tips)
        // Hands off smoothly into the expanding nested petals at 11.0s -> 11.7s
        if (budInnerRef.current && budGlowRef.current) {
          const innerStart = windowEase(t, 6.2, 9.0);
          const handoff = 1 - windowEase(t, 11.05, 11.75);
          const innerLen = (innerStart * 16 + budSwellG * 38) * handoff;
          const innerW = (innerStart * 5.2 + budSwellG * 16.5) * handoff;
          budInnerRef.current.setAttribute("d", buildBudCorePath(innerLen, innerW));
          const peekGlow = windowEase(t, 9.3, 11.0) * handoff;
          budGlowRef.current.setAttribute("cy", (-Math.max(12, innerLen * 0.68)).toFixed(1));
          budGlowRef.current.setAttribute("r", (10 + peekGlow * 28).toFixed(1));
          budGlowRef.current.setAttribute("opacity", (peekGlow * 0.52).toFixed(3));
        }

        // 5 Sepals wrapping the bud from base (0, 0), then peeling smoothly back (11.0s -> 12.6s)
        const sepalLenBase = budRideG * 18 + budSwellG * 37;
        const sepalWBase = budRideG * 3.8 + budSwellG * 7.8;
        const tipPartG = windowEase(t, 9.6, 11.0);
        const peelG = windowEase(t, 11.0, 12.6);

        staticData.sepals.forEach((sep, idx) => {
          const grp = sepalGroupRefs.current[idx];
          const pathEl = sepalPathRefs.current[idx];
          if (!grp || !pathEl) return;

          if (sepalLenBase <= 0.8) {
            pathEl.setAttribute("d", "");
            return;
          }

          const len = sepalLenBase * sep.lengthScale * lerp(1, 0.82, peelG);
          const w = sepalWBase * sep.widthScale * lerp(1, 0.86, peelG);
          const budTilt = sep.budTiltDeg * (0.45 + 0.55 * budSwellG + 0.35 * tipPartG);
          // During death wilt, sepals close slightly back around the drooping calyx
          const targetPeel = lerp(sep.peelAngleDeg, sep.peelAngleDeg * 0.56, wiltG);
          const angle = lerp(budTilt, targetPeel, peelG);
          // Hugs bud inward before bloom, relaxes and reflexes outward as it peels back
          const curlX = lerp(-sep.budSpreadX * (2.6 - 1.1 * tipPartG), sep.budSpreadX * (1.4 - 0.9 * wiltG), peelG);

          grp.setAttribute("transform", `rotate(${angle.toFixed(1)})`);
          pathEl.setAttribute("d", buildSepalPath(len, w, curlX));
        });

        // --- 7. BLOOM: 4 NESTED PETAL LAYERS UNFURLING FROM CLOSED SPEARS (11.05s -> 13.5s) ---
        // During death (d > 0), outer petals loosen one by one, detach, fall with gravity + drift + spin,
        // and settle softly on the ground, while a few inner petals remain clinging to the drooping head.
        const invHeadRad = (-headAngle * Math.PI) / 180;
        const cosInv = Math.cos(invHeadRad);
        const sinInv = Math.sin(invHeadRad);

        staticData.petals.forEach((petal, idx) => {
          const grp = petalGroupRefs.current[idx];
          const bladeEl = petalBladeRefs.current[idx];
          const veinEl = petalVeinRefs.current[idx];
          if (!grp || !bladeEl || !veinEl) return;

          const g = windowEase(t, petal.startT, petal.startT + petal.duration);
          if (g <= 0.004) {
            bladeEl.setAttribute("d", "");
            veinEl.setAttribute("d", "");
            return;
          }

          // Starts as thin closed spear lengthening upward from (0,0), widens, then hinges open around (0,0)
          const lenG = easeOutCubic(clamp(g / 0.72, 0, 1));
          const widG = easeInOutCubic(clamp((g - 0.12) / 0.82, 0, 1));
          const openG = easeInOutCubic(clamp((g - 0.18) / 0.82, 0, 1));

          const wiltShrinkL = d > 0 ? 1 - wiltG * 0.14 : 1;
          const wiltShrinkW = d > 0 ? 1 - wiltG * 0.22 : 1;
          const len = petal.maxLength * lenG * wiltShrinkL;
          const width = petal.maxWidth * (0.14 + 0.86 * widG) * wiltShrinkW;
          const closedAngle = petal.targetAngleDeg * 0.06;
          const flutter = t > 14 ? Math.sin(idleSec * 1.15 + petal.phase) * 1.35 * swayDamp : 0;
          let angle = lerp(closedAngle, petal.targetAngleDeg, openG) + flutter;
          let localX = 0;
          let localY = 0;
          let petalOpacity = petal.opacity;

          if (d > 0) {
            if (petal.falls && d > petal.detachD) {
              const rawFall = clamp((d - petal.detachD) / petal.fallDur, 0, 1);
              // First 78% is accelerating gravity fall + sideways flutter; last 22% settles softly on ground
              const airT = clamp(rawFall / 0.78, 0, 1);
              const settleT = clamp((rawFall - 0.78) / 0.22, 0, 1);
              const gravityY = Math.pow(airT, 1.72);
              const wx =
                petal.fallDriftX * easeOutCubic(airT) +
                Math.sin(airT * Math.PI * 2.2 + petal.phase) * petal.fallSwayAmp * (1 - airT * 0.6);
              const wy = (petal.landY - stem.tip.y) * gravityY;

              // Transform world-space fall vector into headGroup's rotated local coordinates
              localX = wx * cosInv - wy * sinInv;
              localY = wx * sinInv + wy * cosInv;
              angle += petal.fallSpinDeg * easeOutCubic(airT);
              petalOpacity = lerp(petal.opacity, petal.restOpacity, easeInOutCubic(settleT));
            } else {
              // Petals still attached droop gently inward/downward as the flower wilts
              const loosen = petal.falls ? clamp((d - (petal.detachD - 0.08)) / 0.08, 0, 1) * 8 : 0;
              angle += wiltG * (petal.targetAngleDeg >= 0 ? 14 : -14) + loosen;
              petalOpacity = petal.opacity * lerp(1, 0.78, wiltG);
            }
          }

          grp.setAttribute(
            "transform",
            localX === 0 && localY === 0
              ? `rotate(${angle.toFixed(1)})`
              : `translate(${localX.toFixed(1)}, ${localY.toFixed(1)}) rotate(${angle.toFixed(1)})`
          );
          grp.setAttribute("opacity", petalOpacity.toFixed(3));

          const paths = buildPetalPaths(len, width);
          bladeEl.setAttribute("d", paths.blade);
          veinEl.setAttribute("d", paths.vein);
        });

        // --- 8. GOLDEN PHYLLOTAXIS CORE & 12 CURVED STAMENS (13.0s -> 14.0s) ---
        const coreG = windowEase(t, 12.95, 13.85);
        const coreBreathe = t > 14 ? 0.9 + 0.1 * Math.sin(idleSec * 1.6) * swayDamp : 1;
        const coreDeathShrink = d > 0 ? 1 - windowEase(d, 0.28, 0.88) * 0.54 : 1;
        const coreDeathDim = d > 0 ? 1 - windowEase(d, 0.2, 0.85) * 0.62 : 1;

        if (coreAuraRef.current) {
          coreAuraRef.current.setAttribute("r", (46 * coreG * coreBreathe * coreDeathShrink).toFixed(1));
          coreAuraRef.current.setAttribute("opacity", (coreG * 0.88 * glowDim).toFixed(3));
        }
        if (coreDiscRef.current) {
          coreDiscRef.current.setAttribute("r", (19.5 * coreG * coreDeathShrink).toFixed(1));
          coreDiscRef.current.setAttribute("opacity", (coreG * coreDeathDim).toFixed(3));
        }

        staticData.coreDots.forEach((dot, idx) => {
          const el = coreDotRefs.current[idx];
          if (!el) return;
          const dg = windowEase(t, dot.startT, dot.startT + 0.42);
          if (dg <= 0.01) {
            el.setAttribute("r", "0");
            return;
          }
          const scale = dg * coreDeathShrink;
          el.setAttribute("cx", (dot.targetX * scale).toFixed(1));
          el.setAttribute("cy", (dot.targetY * scale).toFixed(1));
          el.setAttribute("r", (dot.maxR * scale).toFixed(2));
          el.setAttribute("opacity", coreDeathDim.toFixed(3));
        });

        const stamenRetract = d > 0 ? 1 - windowEase(d, 0.24, 0.84) * 0.5 : 1;
        const stamenDim = d > 0 ? 1 - windowEase(d, 0.18, 0.78) * 0.82 : 1;

        staticData.stamens.forEach((stamen, idx) => {
          const pathEl = stamenPathRefs.current[idx];
          const tipEl = stamenTipRefs.current[idx];
          if (!pathEl || !tipEl) return;

          const filG = windowEase(t, stamen.startT, stamen.startT + stamen.duration) * stamenRetract;
          if (filG <= 0.01) {
            pathEl.setAttribute("d", "");
            tipEl.setAttribute("r", "0");
            return;
          }
          pathEl.setAttribute("d", buildPartialPolyline(stamen.points, filG));
          pathEl.setAttribute("opacity", (0.85 * stamenDim).toFixed(3));

          // Glowing pollen anther swells and ignites at the tip once filament extends, then shrinks & darkens
          const tipG = easeOutCubic(clamp((filG / Math.max(0.01, stamenRetract) - 0.65) / 0.35, 0, 1));
          if (tipG <= 0.01) {
            tipEl.setAttribute("r", "0");
          } else {
            const twinkle =
              t > 14 ? 0.72 + 0.28 * Math.sin(idleSec * 2.4 + stamen.phase) * swayDamp : 1;
            const tipIdx = Math.min(
              stamen.points.length - 1,
              Math.floor(filG * (stamen.points.length - 1))
            );
            const tipPt = d > 0 ? stamen.points[tipIdx] : stamen.tip;
            tipEl.setAttribute("cx", tipPt.x.toFixed(1));
            tipEl.setAttribute("cy", tipPt.y.toFixed(1));
            tipEl.setAttribute("r", (2.6 * tipG * stamenRetract * (0.88 + 0.12 * twinkle)).toFixed(2));
            tipEl.setAttribute("opacity", (tipG * twinkle * stamenDim).toFixed(3));
          }
        });

        // --- 9. SPARKLES RELEASING FROM CORE (13.15s -> 14.0s + Idle, fade out on death) ---
        staticData.sparkles.forEach((sp, idx) => {
          const el = sparkleRefs.current[idx];
          if (!el) return;
          const sg = windowEase(t, sp.startT, sp.startT + 0.85);
          if (sg <= 0.01 || sparkleFade <= 0.005) {
            el.setAttribute("r", "0");
            return;
          }
          const orbit = t > 14 ? idleSec * sp.driftSpeed : 0;
          const rad = sp.dist * easeOutCubic(sg) + Math.sin(orbit + sp.phase) * 7;
          const ang = sp.angle + orbit * 0.18;
          const twinkle = 0.45 + 0.55 * Math.sin((t > 14 ? idleSec : t) * 2.1 + sp.phase);
          el.setAttribute("cx", (Math.cos(ang) * rad).toFixed(1));
          el.setAttribute("cy", (Math.sin(ang) * rad).toFixed(1));
          el.setAttribute("r", (sp.size * sg).toFixed(2));
          el.setAttribute("opacity", (sg * twinkle * 0.85 * sparkleFade).toFixed(3));
        });
      }

      // --- 10. IDLE DRIFTING PETALS (only after t > 14s, fade out smoothly on death) ---
      const idleFade = clamp(idleSec / 2.2, 0, 1) * sparkleFade;
      staticData.driftPetals.forEach((dp, idx) => {
        const el = driftPetalRefs.current[idx];
        if (!el) return;
        if (idleFade <= 0.01) {
          el.setAttribute("opacity", "0");
          return;
        }
        const cycle = ((idleSec + dp.phase) % dp.period) / dp.period;
        const x = dp.startX + dp.driftX * cycle + Math.sin(cycle * TAU * 1.5 + dp.phase) * 16;
        const y = dp.startY + dp.fallDist * cycle;
        const rot = dp.rotSpeed * (idleSec + dp.phase);
        const edgeFade = Math.sin(cycle * Math.PI);
        el.setAttribute(
          "transform",
          `translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${dp.scale.toFixed(2)})`
        );
        el.setAttribute("opacity", (idleFade * edgeFade * 0.55).toFixed(3));
      });

      // --- 11. GARDEN AWAKENING: GROUND RIPPLE, GROUND FLORA & STAGGERED 3-ROW FLOWERS ---
      // Only active after answering "Yes" (awakenSec > 0 and d === 0)
      const showGarden = awakenSec > 0.002 && d <= 0.001;

      // Two concentric glowing ground ripples spreading outward from the hero
      if (gardenRipple1Ref.current) {
        if (showGarden && awakenSec < 2.9) {
          const r1 = clamp(awakenSec / 2.7, 0, 1);
          const e1 = easeOutCubic(r1);
          gardenRipple1Ref.current.setAttribute("rx", lerp(24, 570, e1).toFixed(1));
          gardenRipple1Ref.current.setAttribute("ry", lerp(6, 66, e1).toFixed(1));
          gardenRipple1Ref.current.setAttribute(
            "opacity",
            (Math.sin(r1 * Math.PI) * 0.62).toFixed(3)
          );
        } else {
          gardenRipple1Ref.current.setAttribute("opacity", "0");
        }
      }
      if (gardenRipple2Ref.current) {
        if (showGarden && awakenSec > 0.35 && awakenSec < 3.4) {
          const r2 = clamp((awakenSec - 0.35) / 2.8, 0, 1);
          const e2 = easeOutCubic(r2);
          gardenRipple2Ref.current.setAttribute("rx", lerp(18, 540, e2).toFixed(1));
          gardenRipple2Ref.current.setAttribute("ry", lerp(5, 58, e2).toFixed(1));
          gardenRipple2Ref.current.setAttribute(
            "opacity",
            (Math.sin(r2 * Math.PI) * 0.42).toFixed(3)
          );
        } else {
          gardenRipple2Ref.current.setAttribute("opacity", "0");
        }
      }

      // Active garden composition (Landscape 3-row vs Portrait 4-row)
      const activeGarden =
        compositionRef.current === "portrait"
          ? staticData.gardenPortrait
          : staticData.gardenLandscape;

      // Grass blades & tiny glowing sprouts swaying on the shared wind wave
      activeGarden.grass.forEach((gb, idx) => {
        const pathEl = grassPathRefs.current[idx];
        const dotEl = sproutDotRefs.current[idx];
        if (!pathEl) return;
        if (!showGarden) {
          pathEl.setAttribute("d", "");
          if (dotEl) dotEl.setAttribute("r", "0");
          return;
        }
        const gg = windowEase(awakenSec, gb.startSec, gb.startSec + 1.5);
        if (gg <= 0.01) {
          pathEl.setAttribute("d", "");
          if (dotEl) dotEl.setAttribute("r", "0");
          return;
        }
        const h = gb.height * gg;
        const wind = sampleWindWave(idleSec, gb.baseX, 6.5) * gg;
        const tipX = gb.baseX + gb.lean * gg + wind;
        const tipY = gb.baseY - h;
        const cx = gb.baseX + (gb.lean * 0.35 + wind * 0.4) * gg;
        const cy = gb.baseY - h * 0.55;
        pathEl.setAttribute(
          "d",
          `M ${gb.baseX.toFixed(1)} ${gb.baseY.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${tipX.toFixed(1)} ${tipY.toFixed(1)}`
        );
        if (dotEl) {
          dotEl.setAttribute("cx", tipX.toFixed(1));
          dotEl.setAttribute("cy", tipY.toFixed(1));
          dotEl.setAttribute("r", (2.1 * gg).toFixed(2));
        }
      });

      // Soft glowing moss tufts across the lower foreground
      activeGarden.moss.forEach((ms, idx) => {
        const el = mossEllipseRefs.current[idx];
        if (!el) return;
        if (!showGarden) {
          el.setAttribute("opacity", "0");
          return;
        }
        const mg = windowEase(awakenSec, ms.startSec, ms.startSec + 1.4);
        el.setAttribute("rx", (ms.rx * mg).toFixed(1));
        el.setAttribute("ry", (ms.ry * mg).toFixed(1));
        el.setAttribute("opacity", (mg * 0.55).toFixed(3));
      });

      // Subtle glowing mushrooms at the edges & lower foreground
      activeGarden.mushrooms.forEach((m, idx) => {
        const grp = mushroomGroupRefs.current[idx];
        if (!grp) return;
        if (!showGarden) {
          grp.setAttribute("opacity", "0");
          return;
        }
        const mg = windowEase(awakenSec, m.startSec, m.startSec + 1.3);
        if (mg <= 0.01) {
          grp.setAttribute("opacity", "0");
          return;
        }
        grp.setAttribute(
          "transform",
          `translate(${m.x.toFixed(1)}, ${m.y.toFixed(1)}) scale(${mg.toFixed(3)})`
        );
        grp.setAttribute("opacity", (mg * 0.82).toFixed(3));
      });

      // Staggered cosmic garden flowers reusing `computeStemCurve` + local petal/leaf builders
      activeGarden.flowers.forEach((f, fIdx) => {
        const seedEl = gardenSeedRefs.current[fIdx];
        const stemEl = gardenStemRefs.current[fIdx];
        const headEl = gardenHeadRefs.current[fIdx];
        const budEl = gardenBudRefs.current[fIdx];
        const coreEl = gardenCoreRefs.current[fIdx];
        if (!stemEl || !headEl) return;

        if (!showGarden) {
          gardenFullGrownRef.current[fIdx] = false;
          gardenLeanAnglesRef.current[fIdx] = 0;
          if (seedEl) seedEl.setAttribute("r", "0");
          stemEl.setAttribute("d", "");
          if (budEl) budEl.setAttribute("d", "");
          if (coreEl) coreEl.setAttribute("r", "0");
          const lBlades = gardenLeafBladeRefs.current[fIdx];
          if (lBlades) lBlades.forEach((el) => el?.setAttribute("d", ""));
          const pBlades = gardenPetalBladeRefs.current[fIdx];
          if (pBlades) pBlades.forEach((el) => el?.setAttribute("d", ""));
          return;
        }

        const p = clamp((awakenSec - f.startSec) / f.durationSec, 0, 1);
        if (p <= 0.002) {
          gardenFullGrownRef.current[fIdx] = false;
          if (seedEl) seedEl.setAttribute("r", "0");
          stemEl.setAttribute("d", "");
          if (budEl) budEl.setAttribute("d", "");
          if (coreEl) coreEl.setAttribute("r", "0");
          return;
        }

        // Smooth interactive hover lean toward cursor when in alive state
        const targetLean =
          phaseRef.current === "alive" && hoveredGardenIdxRef.current === fIdx
            ? clamp((pointerWorldXRef.current - f.baseX) / 140, -1, 1) * 0.11
            : 0;
        const prevLean = gardenLeanAnglesRef.current[fIdx] ?? 0;
        const lean = lerp(prevLean, targetLean, 0.12);
        gardenLeanAnglesRef.current[fIdx] = lean;

        // 1. Seed spark on ground (p: 0..0.18)
        if (seedEl) {
          const seedIn = clamp(p / 0.08, 0, 1);
          const seedOut = 1 - clamp((p - 0.1) / 0.16, 0, 1);
          seedEl.setAttribute("r", (3.6 * f.scale * seedIn * seedOut).toFixed(2));
        }

        // 2. Literal extending stem on shared rolling wind wave + hover lean (p: 0.06..0.56)
        const stemG = windowEase(p, 0.06, 0.56);
        const maturity = 0.45 + 0.55 * windowEase(p, 0.06, 0.72);
        const hookFactor =
          p < 0.34 ? Math.sin(clamp((p - 0.06) / 0.28, 0, 1) * Math.PI) : 0;
        const windAmp = (f.row === 0 ? 0.018 : f.row === 1 ? 0.025 : 0.031) * stemG;
        const swayAngle = sampleWindWave(idleSec, f.baseX, windAmp) + lean;

        const gStem = computeStemCurve(f.stem, stemG, maturity, hookFactor, swayAngle, 0);
        stemEl.setAttribute("d", gStem.taperedOutline);
        gardenTipPositionsRef.current[fIdx] = gStem.tip;

        const alreadyFull = Boolean(gardenFullGrownRef.current[fIdx]) && p >= 1;

        // 3. Leaves growing literally from fixed stem nodes (skip static blade `d` recompute once full)
        const lGrps = gardenLeafGroupRefs.current[fIdx];
        const lBlades = gardenLeafBladeRefs.current[fIdx];
        f.leaves.forEach((lf, lIdx) => {
          const lGrp = lGrps?.[lIdx];
          const lBlade = lBlades?.[lIdx];
          if (!lGrp || !lBlade) return;
          const node = sampleStemAtU(gStem.pts, gStem.stemG, lf.nodeU);
          if (!node) {
            lBlade.setAttribute("d", "");
            return;
          }
          const lStart = 0.18 + lf.nodeU * 0.32;
          const lg = windowEase(p, lStart, lStart + 0.36);
          if (lg <= 0.01) {
            lBlade.setAttribute("d", "");
            return;
          }
          const rot = node.tangentDeg + lerp(lf.side * 10, lf.side * lf.finalAngleDeg, easeInOutCubic(lg));
          lGrp.setAttribute(
            "transform",
            `translate(${node.pt.x.toFixed(1)}, ${node.pt.y.toFixed(1)}) rotate(${rot.toFixed(1)})`
          );
          if (!alreadyFull) {
            const lPaths = buildTrueLeafPaths(
              lg,
              lf.side,
              lf.maxPetiole,
              lf.maxLength,
              lf.maxWidth,
              0,
              false
            );
            lBlade.setAttribute("d", lPaths.blade);
          }
        });

        // 4. Head anchored strictly at moving stem.tip
        const headLag = sampleWindWave(idleSec - 0.35, f.baseX, 2.2);
        const headAngle = gStem.tipAngleDeg + headLag + lean * 38;
        headEl.setAttribute(
          "transform",
          `translate(${gStem.tip.x.toFixed(1)}, ${gStem.tip.y.toFixed(1)}) rotate(${headAngle.toFixed(1)})`
        );

        // 5-7. Bud, Petals & Core (skip static `d` recompute once fully bloomed for 60fps idle)
        if (!alreadyFull) {
          if (budEl) {
            const budGrow = windowEase(p, 0.34, 0.66);
            const budHandoff = 1 - windowEase(p, 0.64, 0.78);
            const bLen = 18 * f.scale * budGrow * budHandoff;
            const bW = 8.5 * f.scale * budGrow * budHandoff;
            budEl.setAttribute("d", buildBudCorePath(bLen, bW));
          }

          const pGrps = gardenPetalGroupRefs.current[fIdx];
          const pBlades = gardenPetalBladeRefs.current[fIdx];
          f.petals.forEach((pt, pIdx) => {
            const pGrp = pGrps?.[pIdx];
            const pBlade = pBlades?.[pIdx];
            if (!pGrp || !pBlade) return;
            const pg = windowEase(p, 0.58 + pt.stagger, 0.9 + pt.stagger * 0.8);
            if (pg <= 0.01) {
              pBlade.setAttribute("d", "");
              return;
            }
            const lenG = easeOutCubic(clamp(pg / 0.72, 0, 1));
            const widG = easeInOutCubic(clamp((pg - 0.14) / 0.82, 0, 1));
            const openG = easeInOutCubic(clamp((pg - 0.18) / 0.82, 0, 1));

            const len = pt.maxLength * lenG;
            const w = pt.maxWidth * (0.16 + 0.84 * widG);
            const angle = lerp(pt.targetAngleDeg * 0.08, pt.targetAngleDeg, openG);
            pGrp.setAttribute("transform", `rotate(${angle.toFixed(1)})`);
            pBlade.setAttribute("d", buildPetalPaths(len, w, f.shape).blade);
          });

          if (coreEl) {
            const cg = windowEase(p, 0.8, 0.98);
            coreEl.setAttribute("r", (f.coreR * cg).toFixed(2));
          }

          if (p >= 1) {
            gardenFullGrownRef.current[fIdx] = true;
          }
        }
      });

      // --- 12. FULL-BLEED DYNAMIC CAMERA VIEWBOX WITH 1.3s LIVE PART-TRACKING ZOOM ---
      const defaultVb = computeWideCameraViewBox(
        t,
        stem.tip.y,
        gardenPullG,
        aspectRef.current
      );

      let finalVb: ViewBoxRect = defaultVb;
      const pCam = partCamRef.current;

      // Compute live swaying world-space focus point for any clicked part
      const getLivePartGoalVb = (partId: FlowerPartId): ViewBoxRect => {
        let tx = stem.tip.x;
        let ty = stem.tip.y;
        if (partId === "roots") {
          tx = BASE_X;
          ty = BASE_Y + 42;
        } else if (partId === "stem") {
          const mid = sampleStemAtU(stem.pts, stem.stemG, 0.5);
          tx = mid ? mid.pt.x : BASE_X;
          ty = mid ? mid.pt.y : (BASE_Y + HEAD_Y) * 0.5;
        } else if (partId === "leaves") {
          const lfNode = sampleStemAtU(stem.pts, stem.stemG, 0.42);
          tx = (lfNode ? lfNode.pt.x : BASE_X) - 24;
          ty = lfNode ? lfNode.pt.y : BASE_Y - 115;
        } else if (partId === "thorns") {
          const thNode = sampleStemAtU(stem.pts, stem.stemG, 0.44);
          tx = thNode ? thNode.pt.x : BASE_X;
          ty = thNode ? thNode.pt.y : BASE_Y - 140;
        } else if (partId === "sepals") {
          tx = stem.tip.x;
          ty = stem.tip.y + 14;
        }
        // outer-petals, inner-petals, core, stamens, pollen all track live stem.tip!

        const zoom = PART_ZOOM_LEVELS[partId];
        const gw = defaultVb.w / zoom;
        const gh = defaultVb.h / zoom;
        const isCompact = isMobileRef.current || compositionRef.current === "portrait";
        // Desktop: sit part left-of-center (36% from left) so right panel never covers it.
        // Mobile: sit part centered horizontally and above the 35dvh bottom sheet (34% from top).
        const gx = isCompact ? tx - gw * 0.5 : tx - gw * 0.36;
        const gy = isCompact ? ty - gh * 0.34 : ty - gh * 0.48;
        return { x: gx, y: gy, w: gw, h: gh };
      };

      if (pCam.targetPartId) {
        const goalVb = getLivePartGoalVb(pCam.targetPartId);
        if (pCam.transitioning && pCam.fromVb) {
          const e = easeInOutCubic(clamp(pCam.elapsed / PART_ZOOM_DURATION_SEC, 0, 1));
          finalVb = {
            x: lerp(pCam.fromVb.x, goalVb.x, e),
            y: lerp(pCam.fromVb.y, goalVb.y, e),
            w: lerp(pCam.fromVb.w, goalVb.w, e),
            h: lerp(pCam.fromVb.h, goalVb.h, e),
          };
          if (e >= 1) {
            pCam.transitioning = false;
            pCam.fromVb = null;
          }
        } else {
          finalVb = goalVb;
        }
      } else if (pCam.transitioning && pCam.fromVb) {
        const e = easeInOutCubic(clamp(pCam.elapsed / PART_ZOOM_DURATION_SEC, 0, 1));
        finalVb = {
          x: lerp(pCam.fromVb.x, defaultVb.x, e),
          y: lerp(pCam.fromVb.y, defaultVb.y, e),
          w: lerp(pCam.fromVb.w, defaultVb.w, e),
          h: lerp(pCam.fromVb.h, defaultVb.h, e),
        };
        if (e >= 1) {
          pCam.transitioning = false;
          pCam.fromVb = null;
        }
      }

      vbRef.current = finalVb;
      if (svgRef.current) {
        svgRef.current.setAttribute(
          "viewBox",
          `${finalVb.x.toFixed(1)} ${finalVb.y.toFixed(1)} ${finalVb.w.toFixed(1)} ${finalVb.h.toFixed(1)}`
        );
      }
    },
    [staticData]
  );

  const clearHintSweep = useCallback(() => {
    sweepTimersRef.current.forEach((id) => window.clearTimeout(id));
    sweepTimersRef.current = [];
    setHintSweepPartId(null);
  }, []);

  const startHintSweep = useCallback(() => {
    clearHintSweep();
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const stepMs = 190;
    HINT_SWEEP_ORDER.forEach((partId, idx) => {
      const id = window.setTimeout(() => {
        if (phaseRef.current !== "alive") return;
        setHintSweepPartId(partId);
      }, 220 + idx * stepMs);
      sweepTimersRef.current.push(id);
    });
    const endId = window.setTimeout(() => {
      setHintSweepPartId(null);
    }, 220 + HINT_SWEEP_ORDER.length * stepMs + 220);
    sweepTimersRef.current.push(endId);
  }, [clearHintSweep]);

  const transitionPhase = useCallback(
    (next: FlowerPhase) => {
      phaseRef.current = next;
      setPhase(next);
      if (next !== "alive") {
        clearHintSweep();
        setHoveredPartId(null);
        setSelectedPartId(null);
        hoveredGardenIdxRef.current = -1;
        setHoveredGardenIdx(-1);
      }
      if (next !== "asking") {
        questionShownRef.current = false;
        setQuestionVisible(false);
      }
    },
    [clearHintSweep]
  );

  // Single StrictMode-safe requestAnimationFrame master timeline loop + canvas sync
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMob = window.innerWidth < 768;
    isMobileRef.current = isMob;
    atmosStateRef.current = createAtmosphereState(isMob);

    tRef.current = reduced ? TOTAL_GROWTH_SEC : 0;
    idleRef.current = 0;
    celebrateRef.current = 0;
    awakenRef.current = 0;
    deathRef.current = 0;
    partCamRef.current = {
      targetPartId: null,
      fromVb: null,
      elapsed: PART_ZOOM_DURATION_SEC,
      transitioning: false,
    };
    skippingRef.current.active = false;
    questionShownRef.current = reduced;
    phaseRef.current = reduced ? "asking" : "growing";

    // Size the single overlay canvas & re-frame full-bleed camera on every ResizeObserver tick
    let cssW = rootRef.current?.clientWidth || window.innerWidth || 1;
    let cssH = rootRef.current?.clientHeight || window.innerHeight || 1;
    let compFrame = 0;
    const syncCanvasSize = () => {
      const root = rootRef.current;
      const canvas = fxCanvasRef.current;
      if (!root || !canvas) return;
      cssW = Math.max(1, root.clientWidth);
      cssH = Math.max(1, root.clientHeight);
      isMobileRef.current = window.innerWidth < 768;
      const nextAspect = cssW / cssH;
      aspectRef.current = nextAspect;
      const nextComp: GardenComposition = nextAspect <= 1.2 ? "portrait" : "landscape";
      if (nextComp !== compositionRef.current) {
        compositionRef.current = nextComp;
        gardenFullGrownRef.current = [];
        cancelAnimationFrame(compFrame);
        compFrame = requestAnimationFrame(() => setComposition(nextComp));
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncCanvasSize();
    const ro = new ResizeObserver(syncCanvasSize);
    if (rootRef.current) ro.observe(rootRef.current);

    if (reduced) {
      applyFrame(TOTAL_GROWTH_SEC, 0, 0, 0, 0, 0);
      const frame = requestAnimationFrame(() => {
        setPhase("asking");
        setQuestionVisible(true);
      });
      return () => {
        cancelAnimationFrame(compFrame);
        cancelAnimationFrame(frame);
        ro.disconnect();
        clearHintSweep();
      };
    }

    let rafId = 0;
    let lastNow = 0;
    let lastDebugSync = 0;
    let isHidden = document.hidden;

    const getAtmosAndPull = () => {
      const p = phaseRef.current;
      if (p === "alive") return { atmosG: 1, pullG: 1 };
      if (p === "awakening") {
        return {
          atmosG: windowEase(awakenRef.current, 0.15, 3.6),
          pullG: windowEase(awakenRef.current, 0.2, 4.4),
        };
      }
      return { atmosG: 0, pullG: 0 };
    };

    const tick = (now: number) => {
      if (isHidden) return;
      if (!lastNow) lastNow = now;
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      if (skippingRef.current.active) {
        skippingRef.current.elapsed += dt;
        const p = Math.min(1, skippingRef.current.elapsed / 0.8);
        tRef.current = lerp(skippingRef.current.startT, TOTAL_GROWTH_SEC, easeInOutCubic(p));
        if (p >= 1) {
          skippingRef.current.active = false;
          tRef.current = TOTAL_GROWTH_SEC;
        }
      } else if (!manualPauseRef.current) {
        const p = phaseRef.current;
        if (p === "growing") {
          tRef.current = Math.min(TOTAL_GROWTH_SEC, tRef.current + dt);
        } else if (p === "asking" || p === "alive") {
          idleRef.current += dt;
        } else if (p === "celebrating") {
          idleRef.current += dt;
          celebrateRef.current += dt;
          if (celebrateRef.current >= HEART_DURATION_SEC) {
            celebrateRef.current = HEART_DURATION_SEC;
            awakenRef.current = 0;
            phaseRef.current = "awakening";
            setPhase("awakening");
          }
        } else if (p === "awakening") {
          idleRef.current += dt;
          awakenRef.current += dt;
          if (awakenRef.current >= GARDEN_DURATION_SEC) {
            awakenRef.current = GARDEN_DURATION_SEC;
            phaseRef.current = "alive";
            setPhase("alive");
            startHintSweep();
          }
        } else if (p === "dying") {
          deathRef.current = Math.min(1, deathRef.current + dt / DEATH_DURATION_SEC);
          if (deathRef.current >= 1) {
            deathRef.current = 1;
            phaseRef.current = "dead";
            setPhase("dead");
          }
        }
      }

      // Transition growing -> asking when bloom completes, then reveal question after 1s
      if (tRef.current >= TOTAL_GROWTH_SEC && phaseRef.current === "growing") {
        phaseRef.current = "asking";
        setPhase("asking");
      } else if (tRef.current < TOTAL_GROWTH_SEC && phaseRef.current !== "growing") {
        deathRef.current = 0;
        celebrateRef.current = 0;
        awakenRef.current = 0;
        transitionPhase("growing");
      }

      if (
        phaseRef.current === "asking" &&
        !questionShownRef.current &&
        idleRef.current >= QUESTION_DELAY_SEC
      ) {
        questionShownRef.current = true;
        setQuestionVisible(true);
      }

      const { atmosG, pullG } = getAtmosAndPull();
      if (partCamRef.current.transitioning) {
        partCamRef.current.elapsed = Math.min(
          PART_ZOOM_DURATION_SEC,
          partCamRef.current.elapsed + dt
        );
      }

      const activeAwaken =
        phaseRef.current === "alive"
          ? GARDEN_DURATION_SEC
          : phaseRef.current === "awakening"
            ? awakenRef.current
            : 0;
      applyFrame(tRef.current, idleRef.current, deathRef.current, atmosG, pullG, activeAwaken);

      // Render unified Canvas 2D atmosphere (fireflies, petals, shooting star, celebrating heart)
      const canvas = fxCanvasRef.current;
      const atmosState = atmosStateRef.current;
      if (canvas && atmosState) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const animTime = tRef.current >= TOTAL_GROWTH_SEC ? TOTAL_GROWTH_SEC + idleRef.current : tRef.current;
          const p = phaseRef.current;
          const heartClock =
            p === "celebrating"
              ? celebrateRef.current
              : p === "awakening" && awakenRef.current < 1.1
                ? HEART_DURATION_SEC + awakenRef.current
                : -1;
          renderAtmosphereFrame(
            ctx,
            cssW,
            cssH,
            vbRef.current,
            atmosState,
            manualPauseRef.current ? 0 : dt,
            animTime,
            atmosG,
            deathRef.current,
            heartClock
          );
        }
      }

      if (debugModeRef.current && now - lastDebugSync > 100) {
        lastDebugSync = now;
        setDebugT(tRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      isHidden = document.hidden;
      if (isHidden) {
        cancelAnimationFrame(rafId);
      } else {
        lastNow = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    applyFrame(tRef.current, 0, 0, 0, 0, 0);
    rafId = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(compFrame);
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      clearHintSweep();
    };
  }, [applyFrame, clearHintSweep, startHintSweep, transitionPhase]);

  const handleSkip = () => {
    skippingRef.current = {
      active: true,
      startT: tRef.current,
      elapsed: 0,
    };
    manualPauseRef.current = false;
    setDebugPaused(false);
  };

  const handleAnswerYes = () => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    deathRef.current = 0;
    if (reduced) {
      celebrateRef.current = HEART_DURATION_SEC;
      awakenRef.current = GARDEN_DURATION_SEC;
      transitionPhase("alive");
      applyFrame(TOTAL_GROWTH_SEC, idleRef.current, 0, 1, 1, GARDEN_DURATION_SEC);
      return;
    }
    celebrateRef.current = 0;
    awakenRef.current = 0;
    transitionPhase("celebrating");
  };

  const handleAnswerNo = () => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    celebrateRef.current = 0;
    awakenRef.current = 0;
    if (reduced) {
      deathRef.current = 1;
      transitionPhase("dead");
      applyFrame(TOTAL_GROWTH_SEC, 0, 1, 0, 0);
      return;
    }
    deathRef.current = 0;
    transitionPhase("dying");
  };

  const handleReplay = () => {
    skippingRef.current.active = false;
    manualPauseRef.current = false;
    setDebugPaused(false);
    tRef.current = 0;
    idleRef.current = 0;
    celebrateRef.current = 0;
    awakenRef.current = 0;
    deathRef.current = 0;
    partCamRef.current = {
      targetPartId: null,
      fromVb: null,
      elapsed: PART_ZOOM_DURATION_SEC,
      transitioning: false,
    };
    setTitleVisible(true);
    atmosStateRef.current = createAtmosphereState(isMobileRef.current);
    setDebugT(0);
    transitionPhase("growing");
    applyFrame(0, 0, 0, 0, 0);
  };

  const getPartData = useCallback(
    (id: FlowerPartId | null) =>
      id ? copy.parts.find((p) => p.id === id) ?? null : null,
    [copy.parts]
  );

  const isAlive = phase === "alive";
  const focusedId = selectedPartId ?? hoveredPartId;
  const activePart = isAlive ? getPartData(selectedPartId) : null;
  const hoveredPart = isAlive ? getPartData(hoveredPartId) : null;
  const activeGarden =
    composition === "portrait" ? staticData.gardenPortrait : staticData.gardenLandscape;

  // Trigger smooth 1.3s camera zoom whenever selected part changes (direct part-to-part or smooth return)
  useEffect(() => {
    const nextPartId = isAlive ? selectedPartId : null;
    if (partCamRef.current.targetPartId === nextPartId) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      partCamRef.current = {
        targetPartId: nextPartId,
        fromVb: null,
        elapsed: PART_ZOOM_DURATION_SEC,
        transitioning: false,
      };
      applyFrame(
        tRef.current,
        idleRef.current,
        deathRef.current,
        isAlive ? 1 : 0,
        isAlive ? 1 : 0,
        isAlive ? GARDEN_DURATION_SEC : 0
      );
      return;
    }
    partCamRef.current = {
      targetPartId: nextPartId,
      fromVb: { ...vbRef.current },
      elapsed: 0,
      transitioning: true,
    };
  }, [applyFrame, isAlive, selectedPartId]);

  // Fade out the quiet top-center title ("My Sun") after 3 seconds
  useEffect(() => {
    if (!titleVisible) return;
    const timer = window.setTimeout(() => setTitleVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [titleVisible]);

  const partProps = (partId: FlowerPartId) => {
    const info = copy.parts.find((p) => p.id === partId);
    const isSelected = isAlive && selectedPartId === partId;
    const isHovered = isAlive && hoveredPartId === partId;
    const isSweepLit = isAlive && !focusedId && hintSweepPartId === partId;
    const isDimmed = Boolean(isAlive && focusedId && focusedId !== partId);

    const className = [
      "sbs-part",
      isAlive ? "sbs-part-ready" : "sbs-part-locked",
      isSelected || isHovered ? "sbs-part-active" : "",
      isSweepLit ? "sbs-part-hint-glow" : "",
      isDimmed ? "sbs-part-dimmed" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      className,
      role: isAlive ? ("button" as const) : undefined,
      tabIndex: isAlive ? 0 : -1,
      "aria-label": info ? `${info.name}: ${info.meaning}` : partId,
      "aria-pressed": isAlive ? isSelected : undefined,
      onPointerEnter: (e: PointerEvent<SVGGElement>) => {
        if (!isAlive || e.pointerType === "touch") return;
        clearHintSweep();
        setHoveredPartId(partId);
      },
      onPointerLeave: (e: PointerEvent<SVGGElement>) => {
        if (!isAlive || e.pointerType === "touch") return;
        setHoveredPartId((prev) => (prev === partId ? null : prev));
      },
      onClick: (e: MouseEvent<SVGGElement>) => {
        if (!isAlive) return;
        e.stopPropagation();
        clearHintSweep();
        setSelectedPartId((prev) => (prev === partId ? null : partId));
      },
      onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
        if (!isAlive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          clearHintSweep();
          setSelectedPartId((prev) => (prev === partId ? null : partId));
        }
      },
    };
  };

  const handleCardTouchStart = (e: TouchEvent<HTMLElement>) => {
    cardTouchStartYRef.current = e.touches[0].clientY;
    setCardDragY(0);
  };

  const handleCardTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (cardTouchStartYRef.current === null) return;
    const delta = e.touches[0].clientY - cardTouchStartYRef.current;
    if (delta > 0) setCardDragY(delta);
  };

  const handleCardTouchEnd = () => {
    if (cardDragY > 50) setSelectedPartId(null);
    setCardDragY(0);
    cardTouchStartYRef.current = null;
  };

  const handleRootPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isAlive || e.pointerType === "touch") return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const vb = vbRef.current;
    const scale = Math.min(rect.width / vb.w, rect.height / vb.h);
    const offsetX = (rect.width - vb.w * scale) * 0.5;
    pointerWorldXRef.current = vb.x + (e.clientX - rect.left - offsetX) / (scale || 1);
  };

  const renderGardenFlower = (f: GardenFlowerDef, fIdx: number) => {
    const isGardenHovered = isAlive && hoveredGardenIdx === fIdx;
    const gClass = [
      "sbs-garden-flower",
      isAlive ? "sbs-garden-ready" : "sbs-part-locked",
      isGardenHovered ? "sbs-garden-hover" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <g
        key={f.id}
        opacity={f.rowOpacity}
        className={gClass}
        onPointerEnter={(e) => {
          if (!isAlive || e.pointerType === "touch") return;
          hoveredGardenIdxRef.current = fIdx;
          setHoveredGardenIdx(fIdx);
        }}
        onPointerLeave={(e) => {
          if (!isAlive || e.pointerType === "touch") return;
          if (hoveredGardenIdxRef.current === fIdx) {
            hoveredGardenIdxRef.current = -1;
            setHoveredGardenIdx(-1);
          }
        }}
        onClick={(e) => {
          if (!isAlive) return;
          e.stopPropagation();
          const atmos = atmosStateRef.current;
          const tip = gardenTipPositionsRef.current[fIdx] ?? f.stem.p3;
          if (atmos) {
            spawnGardenBurst(atmos, tip.x, tip.y, f.coreColor);
          }
        }}
      >
        {/* Ground seed spark */}
        <circle
          ref={(el) => {
            gardenSeedRefs.current[fIdx] = el;
          }}
          cx={f.baseX}
          cy={f.baseY}
          r="0"
          fill="#fef08a"
        />
        {/* Tapered curved stem */}
        <path
          ref={(el) => {
            gardenStemRefs.current[fIdx] = el;
          }}
          d=""
          fill="url(#sbsStemGrad)"
        />
        {/* Leaves glued to stem nodes */}
        {f.leaves.map((_, lIdx) => (
          <g
            key={`${f.id}-lf-${lIdx}`}
            ref={(el) => {
              if (!gardenLeafGroupRefs.current[fIdx]) gardenLeafGroupRefs.current[fIdx] = [];
              gardenLeafGroupRefs.current[fIdx][lIdx] = el;
            }}
            transform={`translate(${f.baseX}, ${f.baseY})`}
          >
            <path
              ref={(el) => {
                if (!gardenLeafBladeRefs.current[fIdx]) gardenLeafBladeRefs.current[fIdx] = [];
                gardenLeafBladeRefs.current[fIdx][lIdx] = el;
              }}
              d=""
              fill="url(#sbsLeafGrad)"
            />
          </g>
        ))}
        {/* Flower head anchored at stem.tip (0,0 local) */}
        <g
          ref={(el) => {
            gardenHeadRefs.current[fIdx] = el;
          }}
          transform={`translate(${f.baseX}, ${f.baseY})`}
        >
          <path
            ref={(el) => {
              gardenBudRefs.current[fIdx] = el;
            }}
            d=""
            fill="url(#sbsSepalGrad)"
          />
          {f.petals.map((pt, pIdx) => (
            <g
              key={`${f.id}-pt-${pIdx}`}
              ref={(el) => {
                if (!gardenPetalGroupRefs.current[fIdx]) gardenPetalGroupRefs.current[fIdx] = [];
                gardenPetalGroupRefs.current[fIdx][pIdx] = el;
              }}
              opacity={pt.opacity}
            >
              <path
                ref={(el) => {
                  if (!gardenPetalBladeRefs.current[fIdx]) gardenPetalBladeRefs.current[fIdx] = [];
                  gardenPetalBladeRefs.current[fIdx][pIdx] = el;
                }}
                d=""
                fill={`url(#${f.gradId})`}
                stroke="rgba(254, 240, 138, 0.35)"
                strokeWidth="0.6"
              />
            </g>
          ))}
          <circle
            ref={(el) => {
              gardenCoreRefs.current[fIdx] = el;
            }}
            cx="0"
            cy="0"
            r="0"
            fill={f.coreColor}
          />
        </g>
      </g>
    );
  };

  return (
    <div
      ref={rootRef}
      className="sbs-root"
      onPointerMove={handleRootPointerMove}
      onClick={() => {
        if (selectedPartId) setSelectedPartId(null);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="A cosmic bioluminescent sun-flower growing continuously from a falling seed through roots, stem, leaves, bud, and layered petals into full bloom"
        className="sbs-svg"
      >
        <defs>
          <radialGradient id="sbsBgNebula" cx="50%" cy="32%" r="55%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.16" />
            <stop offset="48%" stopColor="#ec4899" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#04040e" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="sbsAuroraGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0" />
            <stop offset="28%" stopColor="#2dd4bf" stopOpacity="0.14" />
            <stop offset="58%" stopColor="#8b5cf6" stopOpacity="0.18" />
            <stop offset="82%" stopColor="#ec4899" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="sbsAuroraGrad2" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
            <stop offset="35%" stopColor="#ec4899" stopOpacity="0.12" />
            <stop offset="68%" stopColor="#38bdf8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="sbsMoonHaloGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#c4b5fd" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sbsMoonDiscGrad" cx="38%" cy="36%" r="62%">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#ddd6fe" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.32" />
          </radialGradient>

          <linearGradient id="sbsBackHillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#09091e" stopOpacity="0.88" />
          </linearGradient>

          <linearGradient id="sbsMidHillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#172554" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#070718" stopOpacity="0.92" />
          </linearGradient>

          <linearGradient id="sbsMistGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
            <stop offset="45%" stopColor="#818cf8" stopOpacity="0.16" />
            <stop offset="75%" stopColor="#2dd4bf" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#04040e" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="sbsGroundHillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.62" />
            <stop offset="28%" stopColor="#0f172a" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#04040e" stopOpacity="0.98" />
          </linearGradient>

          <radialGradient id="sbsSoilGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.46" />
            <stop offset="38%" stopColor="#a855f7" stopOpacity="0.22" />
            <stop offset="72%" stopColor="#38bdf8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#04040e" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sbsSeedGrad" cx="42%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>

          <linearGradient id="sbsStemGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="45%" stopColor="#0f766e" />
            <stop offset="82%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>

          <linearGradient id="sbsRootGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.95" />
            <stop offset="48%" stopColor="#a855f7" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.12" />
          </linearGradient>

          <linearGradient id="sbsLeafGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="55%" stopColor="#0d9488" />
            <stop offset="86%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>

          <linearGradient id="sbsSepalGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="52%" stopColor="#0f766e" />
            <stop offset="88%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>

          <linearGradient id="sbsBudPeekGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="48%" stopColor="#ec4899" />
            <stop offset="85%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>

          <radialGradient id="sbsBudGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#ec4899" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="sbsThornGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="60%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>

          {/* 4-layer cosmic petal gradients: warm gold base -> rose pink -> luminous violet tip */}
          <linearGradient id="sbsPetalOuterGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="34%" stopColor="#db2777" />
            <stop offset="76%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>

          <linearGradient id="sbsPetalMidGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="38%" stopColor="#ec4899" />
            <stop offset="78%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>

          <linearGradient id="sbsPetalInnerGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="44%" stopColor="#f472b6" />
            <stop offset="82%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ddd6fe" />
          </linearGradient>

          <linearGradient id="sbsPetalInnermostGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="80%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>

          <radialGradient id="sbsCoreAuraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.92" />
            <stop offset="38%" stopColor="#fde047" stopOpacity="0.52" />
            <stop offset="72%" stopColor="#ec4899" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sbsCoreDiscGrad" cx="42%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="45%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>

          {/* 5 Cosmic Garden Species Gradients (zero blur filters for 60fps) */}
          <linearGradient id="sbsGardenLilyGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="45%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>

          <linearGradient id="sbsGardenRoseGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="48%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#fbcfe8" />
          </linearGradient>

          <linearGradient id="sbsGardenTulipGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="52%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#d8b4fe" />
          </linearGradient>

          <linearGradient id="sbsGardenBellGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>

          <linearGradient id="sbsGardenDaisyGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#ddd6fe" />
          </linearGradient>

          <filter id="sbsRootGlow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="sbsCoreGlow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="3.0" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Single GPU-accelerated desaturation + darkening filter applied only when d > 0 */}
          <filter id="sbsDesaturateFilter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              ref={desatMatrixRef}
              type="saturate"
              values="1"
              result="desat"
            />
            <feColorMatrix
              ref={brightMatrixRef}
              in="desat"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
            />
          </filter>
        </defs>

        <rect
          ref={bgNebulaRef}
          x="-520"
          y="-340"
          width="2160"
          height="1380"
          fill="url(#sbsBgNebula)"
          aria-hidden="true"
        />

        {/* Starry backdrop */}
        <g aria-hidden="true">
          {staticData.bgStars.map((st) => (
            <g key={st.id} opacity={st.opacity}>
              <circle cx={st.x} cy={st.y} r={st.r} fill={st.color} />
              {st.sparkle && (
                <path
                  d={`M ${(st.x - 4.5).toFixed(1)} ${st.y.toFixed(1)} L ${(st.x + 4.5).toFixed(1)} ${st.y.toFixed(1)} M ${st.x.toFixed(1)} ${(st.y - 4.5).toFixed(1)} L ${st.x.toFixed(1)} ${(st.y + 4.5).toFixed(1)}`}
                  stroke={st.color}
                  strokeWidth="0.65"
                  opacity="0.7"
                />
              )}
            </g>
          ))}
        </g>

        {/* Garden Atmosphere Layer (overscanned sky, aurora, pale moon, 3 layered hills & mist) */}
        <g ref={atmosphereGroupRef} opacity="0" aria-hidden="true">
          {/* Overscanned aurora ribbons sweeping edge-to-edge */}
          <path
            d={
              composition === "portrait"
                ? "M -460 -130 Q 120 -210, 560 -120 T 1580 -150 L 1580 55 Q 980 -10, 560 40 T -460 65 Z"
                : "M -460 85 Q 160 -20, 560 70 T 1580 40 L 1580 215 Q 960 135, 560 190 T -460 225 Z"
            }
            fill="url(#sbsAuroraGrad1)"
          />
          <path
            d={
              composition === "portrait"
                ? "M -460 -30 Q 180 -105, 620 -45 T 1580 -75 L 1580 120 Q 940 70, 480 110 T -460 135 Z"
                : "M -460 175 Q 240 90, 660 155 T 1580 115 L 1580 285 Q 920 230, 480 265 T -460 295 Z"
            }
            fill="url(#sbsAuroraGrad2)"
          />

          {/* Large pale cosmic moon / planet (higher & larger in Portrait top 35% sky) */}
          <circle
            cx={composition === "portrait" ? 648 : 895}
            cy={composition === "portrait" ? -35 : 178}
            r={composition === "portrait" ? 215 : 195}
            fill="url(#sbsMoonHaloGrad)"
          />
          <circle
            cx={composition === "portrait" ? 648 : 895}
            cy={composition === "portrait" ? -35 : 178}
            r={composition === "portrait" ? 98 : 90}
            fill="url(#sbsMoonDiscGrad)"
          />
          <ellipse
            cx={composition === "portrait" ? 626 : 875}
            cy={composition === "portrait" ? -50 : 164}
            rx="26"
            ry="16"
            fill="rgba(148, 163, 184, 0.14)"
            transform={
              composition === "portrait" ? "rotate(-18 626 -50)" : "rotate(-18 875 164)"
            }
          />
          <ellipse
            cx={composition === "portrait" ? 678 : 924}
            cy={composition === "portrait" ? -10 : 200}
            rx="18"
            ry="11"
            fill="rgba(148, 163, 184, 0.12)"
            transform={
              composition === "portrait" ? "rotate(14 678 -10)" : "rotate(14 924 200)"
            }
          />

          {/* 3 Overscanned Layered Hills + Soft Mist (extends ±480px past world edges) */}
          <path
            d="M -480 462 Q 120 402, 560 442 T 1600 456 L 1600 1050 L -480 1050 Z"
            fill="url(#sbsBackHillGrad)"
          />
          <path
            d="M -480 502 Q 200 448, 560 478 T 1600 500 L 1600 1050 L -480 1050 Z"
            fill="url(#sbsMidHillGrad)"
          />
          {/* Soft mist band hovering over the mid hills */}
          <rect x="-480" y="438" width="2080" height="145" fill="url(#sbsMistGrad)" />

          {/* Main foreground curved meadow ground */}
          <path
            d="M -480 554 Q 560 492, 1600 554 L 1600 1050 L -480 1050 Z"
            fill="url(#sbsGroundHillGrad)"
          />
          <path
            d="M -480 554 Q 560 492, 1600 554"
            fill="none"
            stroke="rgba(167, 139, 250, 0.22)"
            strokeWidth="1.6"
          />
          {/* Subtle lower foreground mist */}
          <rect x="-480" y="540" width="2080" height="170" fill="url(#sbsMistGrad)" opacity="0.65" />
        </g>

        {/* Awakening Ground Ripples spreading outward from Hero */}
        <g aria-hidden="true">
          <ellipse
            ref={gardenRipple1Ref}
            cx={BASE_X}
            cy={BASE_Y + 8}
            rx="24"
            ry="6"
            fill="none"
            stroke="#fde047"
            strokeWidth="1.8"
            opacity="0"
          />
          <ellipse
            ref={gardenRipple2Ref}
            cx={BASE_X}
            cy={BASE_Y + 8}
            rx="18"
            ry="5"
            fill="none"
            stroke="#c084fc"
            strokeWidth="1.4"
            opacity="0"
          />
        </g>

        {/* Garden Back Rows (row 0 & row 1) — behind Hero */}
        <g>
          {activeGarden.flowers.map((f, fIdx) =>
            f.row < 2 ? renderGardenFlower(f, fIdx) : null
          )}
        </g>

        {/* Ground Flora: Soft Glowing Moss Tufts, Grass Blades, Sprouts & Mushrooms */}
        <g aria-hidden="true">
          {activeGarden.moss.map((ms, idx) => (
            <ellipse
              key={ms.id}
              ref={(el) => {
                mossEllipseRefs.current[idx] = el;
              }}
              cx={ms.x}
              cy={ms.y}
              rx="0"
              ry="0"
              fill={ms.color}
              opacity="0"
            />
          ))}
          {activeGarden.grass.map((gb, idx) => (
            <g key={gb.id} opacity="0.72">
              <path
                ref={(el) => {
                  grassPathRefs.current[idx] = el;
                }}
                d=""
                fill="none"
                stroke={gb.color}
                strokeWidth={gb.isSprout ? "1.35" : "1.15"}
                strokeLinecap="round"
              />
              {gb.isSprout && (
                <circle
                  ref={(el) => {
                    sproutDotRefs.current[idx] = el;
                  }}
                  cx={gb.baseX}
                  cy={gb.baseY}
                  r="0"
                  fill="#fef08a"
                />
              )}
            </g>
          ))}
          {activeGarden.mushrooms.map((m, idx) => (
            <g
              key={m.id}
              ref={(el) => {
                mushroomGroupRefs.current[idx] = el;
              }}
              transform={`translate(${m.x}, ${m.y}) scale(0)`}
              opacity="0"
            >
              <path
                d={`M -2 0 Q -1 ${(-m.stemH * 0.5).toFixed(1)}, 0 ${(-m.stemH).toFixed(1)} Q 1 ${(-m.stemH * 0.5).toFixed(1)}, 2 0 Z`}
                fill="rgba(226, 232, 240, 0.72)"
              />
              <ellipse cx="0" cy={-m.stemH} rx={m.capRx} ry={m.capRy} fill={m.color} />
              <ellipse
                cx="0"
                cy={-m.stemH - m.capRy * 0.2}
                rx={m.capRx * 0.55}
                ry={m.capRy * 0.45}
                fill="#fffbeb"
                opacity="0.45"
              />
            </g>
          ))}
        </g>

        {/* Plant & Ground Glow Group — smoothly desaturated to monochrome on "No" */}
        <g
          ref={plantColorGroupRef}
          style={{ transition: "opacity 450ms ease" }}
        >
        {/* Ground glow & landing pulse ripple */}
        <ellipse
          ref={soilGlowRef}
          cx={BASE_X}
          cy={BASE_Y + 4}
          rx="45"
          ry="10"
          fill="url(#sbsSoilGlow)"
          opacity="0"
        />
        <ellipse
          ref={soilRippleRef}
          cx={BASE_X}
          cy={BASE_Y + 2}
          rx="18"
          ry="4"
          fill="none"
          stroke="#fef08a"
          strokeWidth="1.4"
          opacity="0"
        />

        {/* Branching Roots (growing literally from the seed tip) */}
        <g data-part="roots" filter="url(#sbsRootGlow)" {...partProps("roots")}>
          <ellipse cx={BASE_X} cy={BASE_Y + 46} rx="108" ry="50" className="sbs-hit-area" />
          {staticData.roots.map((rt, idx) => (
            <path
              key={rt.id}
              ref={(el) => {
                rootPathRefs.current[idx] = el;
              }}
              d=""
              fill="none"
              stroke="url(#sbsRootGrad)"
              strokeWidth={rt.maxWidth}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Seed of Light (falls, lands, swells, cracks) */}
        <g ref={seedGroupRef} transform={`translate(${BASE_X}, 315)`} filter="url(#sbsRootGlow)">
          <ellipse cx="0" cy="0" rx="5.5" ry="7.5" fill="url(#sbsSeedGrad)" />
          <path
            ref={seedCrackRef}
            d="M 0 1 L -1.5 4.5 L 1 7.2"
            fill="none"
            stroke="#fffbeb"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0"
          />
        </g>

        {/* Tapered Growing Stem (40-point dynamic curve + hooked seedling emergence) */}
        <g data-part="stem" {...partProps("stem")}>
          <path
            d={`M ${STEM_P0.x} ${STEM_P0.y} C ${STEM_P1.x} ${STEM_P1.y}, ${STEM_P2.x} ${STEM_P2.y}, ${STEM_P3.x} ${STEM_P3.y}`}
            fill="none"
            strokeWidth="26"
            className="sbs-hit-area"
          />
          <path ref={stemOutlineRef} d="" fill="url(#sbsStemGrad)" />
          <path
            ref={stemSpineRef}
            d=""
            fill="none"
            stroke="#fef9c3"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.48"
          />
        </g>

        {/* Two Seed Leaves (Cotyledons) unfolding from first node */}
        <g aria-hidden="true">
          <g ref={cotLeftGroupRef} transform={`translate(${BASE_X}, ${BASE_Y})`}>
            <path ref={cotLeftPathRef} d="" fill="url(#sbsLeafGrad)" />
          </g>
          <g ref={cotRightGroupRef} transform={`translate(${BASE_X}, ${BASE_Y})`}>
            <path ref={cotRightPathRef} d="" fill="url(#sbsLeafGrad)" />
          </g>
        </g>

        {/* 5 True Leaves growing continuously from fixed stem nodes */}
        <g data-part="leaves" {...partProps("leaves")}>
          {staticData.leaves.map((leaf, idx) => (
            <g
              key={leaf.id}
              ref={(el) => {
                leafGroupRefs.current[idx] = el;
              }}
              transform={`translate(${BASE_X}, ${BASE_Y})`}
            >
              <path
                ref={(el) => {
                  leafStalkRefs.current[idx] = el;
                }}
                d=""
                fill="none"
                stroke="#14b8a6"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <path
                ref={(el) => {
                  leafBladeRefs.current[idx] = el;
                }}
                d=""
                fill="url(#sbsLeafGrad)"
                stroke="rgba(254, 240, 138, 0.35)"
                strokeWidth="0.7"
              />
              <path
                ref={(el) => {
                  leafVeinRefs.current[idx] = el;
                }}
                d=""
                fill="none"
                stroke="rgba(254, 249, 195, 0.55)"
                strokeWidth="0.85"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        {/* 3 Cosmic Thorns emerging from fixed stem nodes */}
        <g data-part="thorns" {...partProps("thorns")}>
          {staticData.thorns.map((thorn, idx) => (
            <g
              key={thorn.id}
              ref={(el) => {
                thornGroupRefs.current[idx] = el;
              }}
              transform={`translate(${BASE_X}, ${BASE_Y})`}
            >
              <path
                ref={(el) => {
                  thornPathRefs.current[idx] = el;
                }}
                d=""
                fill="url(#sbsThornGrad)"
              />
            </g>
          ))}
        </g>

        {/* Flower Head / Riding & Swelling Bud — strictly anchored at stem.tip (0,0 local) */}
        <g ref={headGroupRef} transform={`translate(${BASE_X}, ${BASE_Y})`}>
          {/* Soft cosmic glow peeking from the swelling bud */}
          <circle
            ref={budGlowRef}
            cx="0"
            cy="-24"
            r="10"
            fill="url(#sbsBudGlow)"
            opacity="0"
            pointerEvents="none"
          />

          {/* Back sepals (behind inner bud) */}
          <g data-part="sepals" {...partProps("sepals")}>
            {staticData.sepals.map((sep, idx) =>
              !sep.isFront ? (
                <g
                  key={sep.id}
                  ref={(el) => {
                    sepalGroupRefs.current[idx] = el;
                  }}
                >
                  <path
                    ref={(el) => {
                      sepalPathRefs.current[idx] = el;
                    }}
                    d=""
                    fill="url(#sbsSepalGrad)"
                    stroke="rgba(254, 240, 138, 0.3)"
                    strokeWidth="0.7"
                  />
                </g>
              ) : null
            )}
          </g>

          {/* Swelling inner bud showing a hint of gold/pink/violet petal color */}
          <path
            ref={budInnerRef}
            d=""
            fill="url(#sbsBudPeekGrad)"
            stroke="rgba(254, 240, 138, 0.55)"
            strokeWidth="0.75"
          />

          {/* Front sepals wrapping the swelling bud */}
          <g data-part="sepals" {...partProps("sepals")}>
            {staticData.sepals.map((sep, idx) =>
              sep.isFront ? (
                <g
                  key={sep.id}
                  ref={(el) => {
                    sepalGroupRefs.current[idx] = el;
                  }}
                >
                  <path
                    ref={(el) => {
                      sepalPathRefs.current[idx] = el;
                    }}
                    d=""
                    fill="url(#sbsSepalGrad)"
                    stroke="rgba(254, 240, 138, 0.35)"
                    strokeWidth="0.75"
                  />
                </g>
              ) : null
            )}
          </g>

          {/* Calyx receptacle cup joining stem tip to bud base at (0,0) */}
          <ellipse ref={receptacleRef} cx="0" cy="0" rx="0" ry="0" fill="url(#sbsSepalGrad)" />

          {/* Outer & Middle Petal Layers (Layers 0 & 1 — 8 + 8 petals) */}
          <g data-part="outer-petals" {...partProps("outer-petals")}>
            {staticData.petals.map((petal, idx) =>
              petal.partId === "outer-petals" ? (
                <g
                  key={petal.id}
                  ref={(el) => {
                    petalGroupRefs.current[idx] = el;
                  }}
                  opacity={petal.opacity}
                >
                  <path
                    ref={(el) => {
                      petalBladeRefs.current[idx] = el;
                    }}
                    d=""
                    fill={`url(#${petal.gradId})`}
                    stroke="rgba(254, 240, 138, 0.52)"
                    strokeWidth="0.85"
                  />
                  <path
                    ref={(el) => {
                      petalVeinRefs.current[idx] = el;
                    }}
                    d=""
                    fill="none"
                    stroke="rgba(254, 249, 195, 0.42)"
                    strokeWidth="0.85"
                    strokeLinecap="round"
                  />
                </g>
              ) : null
            )}
          </g>

          {/* Inner & Innermost Petal Layers (Layers 2 & 3 — 6 + 5 petals) */}
          <g data-part="inner-petals" {...partProps("inner-petals")}>
            {staticData.petals.map((petal, idx) =>
              petal.partId === "inner-petals" ? (
                <g
                  key={petal.id}
                  ref={(el) => {
                    petalGroupRefs.current[idx] = el;
                  }}
                  opacity={petal.opacity}
                >
                  <path
                    ref={(el) => {
                      petalBladeRefs.current[idx] = el;
                    }}
                    d=""
                    fill={`url(#${petal.gradId})`}
                    stroke="rgba(254, 240, 138, 0.62)"
                    strokeWidth="0.85"
                  />
                  <path
                    ref={(el) => {
                      petalVeinRefs.current[idx] = el;
                    }}
                    d=""
                    fill="none"
                    stroke="rgba(255, 251, 235, 0.48)"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                </g>
              ) : null
            )}
          </g>

          {/* 12 Curved Stamens growing radially from center (0,0) */}
          <g data-part="stamens" {...partProps("stamens")}>
            <circle cx="0" cy="0" r="46" className="sbs-hit-area" />
            {staticData.stamens.map((stamen, idx) => (
              <g key={stamen.id}>
                <path
                  ref={(el) => {
                    stamenPathRefs.current[idx] = el;
                  }}
                  d=""
                  fill="none"
                  stroke="#fde68a"
                  strokeWidth="1.05"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <circle
                  ref={(el) => {
                    stamenTipRefs.current[idx] = el;
                  }}
                  cx="0"
                  cy="0"
                  r="0"
                  fill="#fffbeb"
                  stroke="#f59e0b"
                  strokeWidth="0.6"
                />
              </g>
            ))}
          </g>

          {/* Golden Phyllotaxis Core at exact center (0,0) */}
          <g data-part="core" filter="url(#sbsCoreGlow)" {...partProps("core")}>
            <circle
              ref={coreAuraRef}
              cx="0"
              cy="0"
              r="0"
              fill="url(#sbsCoreAuraGrad)"
              opacity="0"
              pointerEvents="none"
            />
            <circle ref={coreDiscRef} cx="0" cy="0" r="0" fill="url(#sbsCoreDiscGrad)" opacity="0" />
            {staticData.coreDots.map((dot, idx) => (
              <circle
                key={dot.id}
                ref={(el) => {
                  coreDotRefs.current[idx] = el;
                }}
                cx="0"
                cy="0"
                r="0"
                fill={dot.color}
              />
            ))}
          </g>

          {/* Cosmic Pollen & Stardust Sparkles releasing from core */}
          <g data-part="pollen" {...partProps("pollen")}>
            <circle cx="0" cy="0" r="145" fill="none" strokeWidth="26" className="sbs-hit-area" />
            {staticData.sparkles.map((sp, idx) => (
              <circle
                key={sp.id}
                ref={(el) => {
                  sparkleRefs.current[idx] = el;
                }}
                cx="0"
                cy="0"
                r="0"
                fill={sp.color}
                opacity="0"
              />
            ))}
          </g>
        </g>

        {/* Gently Drifting Idle Cosmic Petals (visible only after full bloom) */}
        <g aria-hidden="true">
          {staticData.driftPetals.map((dp, idx) => (
            <g
              key={dp.id}
              ref={(el) => {
                driftPetalRefs.current[idx] = el;
              }}
              opacity="0"
            >
              <path
                d="M 0 0 C -4 -4, -3 -11, 0 -14 C 3 -11, 4 -4, 0 0 Z"
                fill="url(#sbsPetalMidGrad)"
                stroke="rgba(254, 240, 138, 0.45)"
                strokeWidth="0.5"
              />
            </g>
          ))}
        </g>
        </g>

        {/* Garden Foreground Rows (row 2 & portrait row 3) — in front of Hero lower edges */}
        <g>
          {activeGarden.flowers.map((f, fIdx) =>
            f.row >= 2 ? renderGardenFlower(f, fIdx) : null
          )}
        </g>

        {/* Desktop Hover Leader-Line Callout */}
        {isAlive && hoveredPart && !activePart && (
          <g aria-hidden="true" className="hidden md:inline">
            <line
              x1={PART_CALLOUTS[hoveredPart.id].targetX}
              y1={PART_CALLOUTS[hoveredPart.id].targetY}
              x2={PART_CALLOUTS[hoveredPart.id].labelX}
              y2={PART_CALLOUTS[hoveredPart.id].labelY}
              stroke="rgba(254, 240, 138, 0.68)"
              strokeWidth="1.1"
              strokeDasharray="3 3"
            />
            <circle
              cx={PART_CALLOUTS[hoveredPart.id].targetX}
              cy={PART_CALLOUTS[hoveredPart.id].targetY}
              r="3"
              fill="#fef08a"
            />
            <text
              x={
                PART_CALLOUTS[hoveredPart.id].labelX +
                (PART_CALLOUTS[hoveredPart.id].anchor === "start" ? 8 : -8)
              }
              y={PART_CALLOUTS[hoveredPart.id].labelY + 4}
              textAnchor={PART_CALLOUTS[hoveredPart.id].anchor}
              fill="#f8fafc"
              fontSize="12"
              letterSpacing="2.2"
              style={{ textTransform: "uppercase", fontFamily: "var(--font-sans)" }}
            >
              {hoveredPart.name}
            </text>
          </g>
        )}
      </svg>

      {/* Single Unified Canvas Layer for Fireflies, Drifting Petals, Shooting Stars & Heart Particles */}
      <canvas
        ref={fxCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      {/* Top-Left "Back to our sky" Pill (same style as "Back to our galaxy", respects safe-area insets) */}
      {onExit && (
        <div
          className="fixed z-30"
          style={{
            top: "max(0.85rem, env(safe-area-inset-top))",
            left: "max(0.85rem, env(safe-area-inset-left))",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            aria-label={backLabel}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-star-white/30 bg-cosmos-navy/75 px-4 py-2 font-sans text-[11px] uppercase tracking-[0.2em] text-star-white/90 backdrop-blur-md transition-all duration-300 hover:border-star-white hover:bg-nebula-purple/20 hover:shadow-glow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple"
          >
            <span aria-hidden="true">&larr;</span>
            {backLabel}
          </button>
        </div>
      )}

      {/* Quiet Top-Center Title ("My Sun" + subtitle) that fades out softly after 3 seconds */}
      <div
        aria-hidden={!titleVisible}
        className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-[#04040e]/65 via-[#04040e]/25 to-transparent px-4 pb-5 pt-[max(4.1rem,calc(env(safe-area-inset-top)+3.35rem))] text-center transition-opacity duration-1000 ease-out sm:pt-[max(0.95rem,env(safe-area-inset-top))] ${
          titleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <h1 className="font-serif text-xl font-light tracking-[0.12em] text-star-white text-shadow-glow-subtle sm:text-2xl">
          {sunCopy.name}
        </h1>
        <p className="mt-0.5 font-sans text-[10px] uppercase tracking-[0.24em] text-star-white/70 sm:text-[11px]">
          {sunCopy.subtitle}
        </p>
      </div>

      {/* Dev-Only Timeline Scrubber & State Jump (visible only when ?debug is in the URL) */}
      {debugMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 left-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-star-white/25 bg-cosmos-navy/90 px-3.5 py-2 text-xs text-star-white backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => {
              const next = !debugPaused;
              manualPauseRef.current = next;
              setDebugPaused(next);
            }}
            className="rounded-full border border-star-white/30 px-2.5 py-0.5 text-[10px] uppercase tracking-widest hover:border-star-white"
          >
            {debugPaused ? "Play" : "Pause"}
          </button>
          <input
            type="range"
            min={0}
            max={14.5}
            step={0.02}
            value={debugT}
            aria-label="Growth timeline scrubber"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              manualPauseRef.current = true;
              setDebugPaused(true);
              skippingRef.current.active = false;
              tRef.current = val;
              setDebugT(val);
              if (val < TOTAL_GROWTH_SEC) {
                transitionPhase("growing");
              } else if (phaseRef.current === "growing") {
                phaseRef.current = "asking";
                setPhase("asking");
                questionShownRef.current = true;
                setQuestionVisible(true);
              }
              applyFrame(val, Math.max(0, val - TOTAL_GROWTH_SEC));
            }}
            className="w-28 accent-nebula-purple"
          />
          <span className="font-mono text-[11px] tabular-nums text-nebula-teal">
            {debugT.toFixed(2)}s
          </span>
          <span className="text-[10px] uppercase tracking-widest text-star-white/50">|</span>
          <button
            type="button"
            onClick={() => {
              skippingRef.current.active = false;
              manualPauseRef.current = false;
              setDebugPaused(false);
              tRef.current = TOTAL_GROWTH_SEC;
              idleRef.current = QUESTION_DELAY_SEC;
              celebrateRef.current = 0;
              awakenRef.current = 0;
              deathRef.current = 0;
              setDebugT(TOTAL_GROWTH_SEC);
              transitionPhase("asking");
              questionShownRef.current = true;
              setQuestionVisible(true);
              applyFrame(TOTAL_GROWTH_SEC, QUESTION_DELAY_SEC, 0, 0, 0);
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              phase === "asking"
                ? "border-nebula-teal text-nebula-teal"
                : "border-star-white/25 text-star-white/75 hover:border-star-white"
            }`}
          >
            Ask
          </button>
          <button
            type="button"
            onClick={() => {
              skippingRef.current.active = false;
              manualPauseRef.current = false;
              setDebugPaused(false);
              tRef.current = TOTAL_GROWTH_SEC;
              celebrateRef.current = 0;
              awakenRef.current = 0;
              deathRef.current = 0;
              setDebugT(TOTAL_GROWTH_SEC);
              transitionPhase("celebrating");
              applyFrame(TOTAL_GROWTH_SEC, idleRef.current, 0, 0, 0);
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              phase === "celebrating"
                ? "border-pink-400 text-pink-300"
                : "border-star-white/25 text-star-white/75 hover:border-star-white"
            }`}
          >
            Heart
          </button>
          <button
            type="button"
            onClick={() => {
              skippingRef.current.active = false;
              manualPauseRef.current = false;
              setDebugPaused(false);
              tRef.current = TOTAL_GROWTH_SEC;
              celebrateRef.current = HEART_DURATION_SEC;
              awakenRef.current = 0;
              deathRef.current = 0;
              setDebugT(TOTAL_GROWTH_SEC);
              transitionPhase("awakening");
              applyFrame(TOTAL_GROWTH_SEC, idleRef.current, 0, 0, 0);
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              phase === "awakening"
                ? "border-nebula-purple text-nebula-purple"
                : "border-star-white/25 text-star-white/75 hover:border-star-white"
            }`}
          >
            Garden
          </button>
          <button
            type="button"
            onClick={() => {
              skippingRef.current.active = false;
              manualPauseRef.current = false;
              setDebugPaused(false);
              tRef.current = TOTAL_GROWTH_SEC;
              idleRef.current = Math.max(idleRef.current, QUESTION_DELAY_SEC);
              celebrateRef.current = HEART_DURATION_SEC;
              awakenRef.current = GARDEN_DURATION_SEC;
              deathRef.current = 0;
              setDebugT(TOTAL_GROWTH_SEC);
              transitionPhase("alive");
              applyFrame(TOTAL_GROWTH_SEC, idleRef.current, 0, 1, 1, GARDEN_DURATION_SEC);
              startHintSweep();
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              phase === "alive"
                ? "border-nebula-teal text-nebula-teal"
                : "border-star-white/25 text-star-white/75 hover:border-star-white"
            }`}
          >
            Alive
          </button>
          <button
            type="button"
            onClick={() => {
              skippingRef.current.active = false;
              manualPauseRef.current = false;
              setDebugPaused(false);
              tRef.current = TOTAL_GROWTH_SEC;
              celebrateRef.current = 0;
              awakenRef.current = 0;
              deathRef.current = 0;
              setDebugT(TOTAL_GROWTH_SEC);
              applyFrame(TOTAL_GROWTH_SEC, idleRef.current, 0, 0, 0);
              handleAnswerNo();
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              phase === "dying" || phase === "dead"
                ? "border-rose-400 text-rose-300"
                : "border-star-white/25 text-star-white/75 hover:border-star-white"
            }`}
          >
            No
          </button>
        </div>
      )}

      {/* Post-Bloom Question Step (cleanly above the bottom control bar, never overlapping hero) */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
        style={{ bottom: "calc(3.65rem + env(safe-area-inset-bottom))" }}
      >
        {phase === "asking" && questionVisible && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="sbs-fade-up pointer-events-auto flex flex-col items-center gap-2 rounded-2xl border border-star-white/18 bg-cosmos-navy/86 px-4 py-2.5 text-center backdrop-blur-xl shadow-glow-strong sm:flex-row sm:gap-4 sm:rounded-full sm:px-6 sm:py-2.5"
          >
            <p className="font-serif text-base font-light tracking-[0.06em] text-star-white text-shadow-glow-subtle sm:text-xl">
              {copy.question}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleAnswerYes}
                aria-label={copy.yesAriaLabel}
                className="inline-flex min-h-[44px] min-w-[92px] items-center justify-center rounded-full border border-star-white/35 bg-nebula-purple/25 px-5 py-2 font-sans text-[11px] uppercase tracking-[0.22em] text-star-white backdrop-blur-md transition-all hover:border-star-white hover:bg-nebula-purple/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
              >
                {copy.yesLabel}
              </button>
              <button
                type="button"
                onClick={handleAnswerNo}
                aria-label={copy.noAriaLabel}
                className="inline-flex min-h-[44px] min-w-[92px] items-center justify-center rounded-full border border-star-white/25 bg-cosmos-navy/75 px-5 py-2 font-sans text-[11px] uppercase tracking-[0.22em] text-star-white/85 backdrop-blur-md transition-all hover:border-star-white hover:bg-star-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
              >
                {copy.noLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Part Description Card — Planet-Panel Style (Right side on Desktop, 35dvh Sheet on Mobile) */}
      <div aria-live="polite" className="contents">
        {activePart && (
          <aside
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleCardTouchStart}
            onTouchMove={handleCardTouchMove}
            onTouchEnd={handleCardTouchEnd}
            aria-label={`${activePart.name} — ${activePart.meaning}`}
            className="sbs-card-slide-in fixed inset-x-3 bottom-3 z-30 max-h-[35dvh] overflow-y-auto rounded-2xl border border-nebula-purple/45 bg-cosmos-deep/92 p-5 backdrop-blur-xl shadow-glow-strong transition-transform duration-200 ease-out md:inset-x-auto md:top-1/2 md:right-7 md:bottom-auto md:max-h-[75dvh] md:w-88 md:-translate-y-1/2 md:p-6"
            style={{
              paddingBottom: "calc(1.15rem + env(safe-area-inset-bottom))",
              transform: cardDragY > 0 ? `translateY(${cardDragY}px)` : undefined,
            }}
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-star-white/30 md:hidden"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-nebula-purple">
                  {activePart.meaning}
                </p>
                <h2 className="mt-1 font-serif text-2xl font-light tracking-[0.08em] text-star-white text-shadow-glow-subtle sm:text-3xl">
                  {activePart.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartId(null)}
                aria-label={copy.closeCardAriaLabel}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-star-white/20 bg-star-white/5 text-star-white/80 transition-colors hover:border-star-white/50 hover:text-star-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <div aria-hidden="true" className="my-3 h-px w-full bg-star-white/10" />
            <p className="text-xs sm:text-sm font-light leading-relaxed text-star-white/85">
              {activePart.description}
            </p>
          </aside>
        )}
      </div>

      {/* Unified Bottom Control Bar over soft gradient (hint bottom center, Grow again bottom right) */}
      {!activePart && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2.5 bg-gradient-to-t from-[#04040e]/88 via-[#04040e]/48 to-transparent pl-14 pr-3 pt-6 sm:justify-between sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="hidden w-28 sm:block" aria-hidden="true" />
          {isAlive ? (
            <div className="sbs-fade-up min-w-0 flex-1 truncate text-left font-sans text-[10px] uppercase tracking-[0.16em] text-star-white/80 sm:text-center sm:text-[11px] sm:tracking-[0.2em]">
              {copy.inspectHint}
            </div>
          ) : (
            <div className="hidden flex-1 sm:block" />
          )}

          {phase === "growing" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSkip();
              }}
              className="pointer-events-auto inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-star-white/25 bg-cosmos-navy/80 px-4 py-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-star-white/90 backdrop-blur-md transition-all hover:border-star-white hover:bg-nebula-purple/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple sm:min-h-[44px] sm:text-[11px]"
            >
              {copy.skipLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReplay();
              }}
              className="pointer-events-auto inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-star-white/25 bg-cosmos-navy/80 px-3.5 py-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-star-white/90 backdrop-blur-md transition-all hover:border-star-white hover:bg-nebula-purple/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple sm:min-h-[44px] sm:px-4 sm:text-[11px]"
            >
              {copy.replayLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
