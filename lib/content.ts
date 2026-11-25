/**
 * ============================================================================
 * HOW TO EDIT THIS FILE
 * ============================================================================
 * 1. Only change the text INSIDE the quotation marks ("...").
 * 2. Keep all quotation marks, commas, brackets, and property names intact.
 * 3. Search for "[" in this file (or run `npm run check:content`) to find
 *    every personal placeholder you still need to fill in.
 * 4. Adding or removing list items automatically adapts the scenes (dots,
 *    lanterns, stars, fireflies, promises). See min/max notes above each list.
 *
 * TABLE OF CONTENTS
 *   SECTION 1 — SETTINGS (anniversary date, email, brand, sound default)
 *   SECTION 2 — SITE-WIDE (nav, footer, SEO metadata, common buttons & aria)
 *   SECTION 3 — HOME (hero title, subtitle, enter button)
 *   SECTION 4 — SOLAR SYSTEM (sun & 8 orbiting planets)
 *   SECTION 5 — SUN SCENE (question, buttons, 10 interactive flower parts)
 *   SECTION 6 — PLANET SCENES
 *       6.1 My Safe Place
 *       6.2 Our First Date
 *       6.3 The Day We Met
 *       6.4 Your Laugh
 *       6.5 Your Smile
 *       6.6 Our Forever
 *       6.7 Things I Love About You
 *       6.8 My Promises
 *   SECTION 7 — OTHER PAGES (Our Memories, Flowers For You, Our Story,
 *                            Love Letters, My Promises Page, Write To Me)
 * ============================================================================
 */

import type { COSMIC_PALETTES, FlowerType } from "./flowers";

type PaletteKey = keyof typeof COSMIC_PALETTES;

// ============================================================================
// TYPE DEFINITIONS (ensures missing or misspelled keys are compile errors)
// ============================================================================

export interface NavItem {
  label: string;
  href: string;
}

export interface PageMeta {
  title: string;
  description: string;
}

export interface PlanetContent {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  description: string;
  detailValue1: string;
  detailValue2: string;
}

export interface FlowerPartContent {
  id:
    | "roots"
    | "stem"
    | "leaves"
    | "thorns"
    | "sepals"
    | "outer-petals"
    | "inner-petals"
    | "core"
    | "stamens"
    | "pollen";
  name: string;
  meaning: string;
  description: string;
}

export interface FirstDateMemoryItem {
  id: string;
  hotspot: string;
  title: string;
  body: string;
}

export interface ConstellationStarItem {
  id: string;
  title: string;
  date: string;
  memory: string;
}

export interface TitledBodyItem {
  id: string;
  title: string;
  body: string;
}

export interface SiteContent {
  settings: {
    togetherSince: string;
    contactEmail: string;
    brandName: string;
    soundDefaultOn: boolean;
    requiredVisits: "all" | number;
    socialLinks: {
      instagram: string;
      facebook: string;
      pinterest: string;
    };
  };
  brand: {
    logo: string;
    footerLeft: string;
    skipToContent: string;
  };
  common: {
    backToSky: string;
    backToGalaxy: string;
    openThisMemory: string;
    growAgain: string;
    close: string;
    memoryFallbackTitle: string;
    memoryWindowFallbackTitle: string;
    memoryWindowFallbackBody: string;
    closeMemoryWindowAria: string;
    memorySceneAriaFallback: string;
    openNavAria: string;
    closeNavAria: string;
    primaryNavAria: string;
    mobileNavAria: string;
    mobilePrimaryNavAria: string;
    socialLinksAria: string;
    socialLabels: {
      instagram: string;
      facebook: string;
      pinterest: string;
    };
    togetherPrefix: string;
    daySingular: string;
    dayPlural: string;
  };
  metadata: {
    root: {
      defaultTitle: string;
      titleTemplate: string;
      description: string;
      siteName: string;
    };
    home: PageMeta;
    solarSystem: PageMeta;
    ourMemories: PageMeta;
    flowersForYou: PageMeta;
    ourStory: PageMeta;
    loveLetters: PageMeta;
    myPromises: PageMeta;
    writeToMe: PageMeta;
  };
  nav: NavItem[];
  home: {
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    ctaLabel: string;
    ctaAriaLabel: string;
    canvasAriaLabel: string;
  };
  solarSystem: {
    backButton: string;
    hintMobile: string;
    hintDesktop: string;
    openMemoryCta: string;
    openAgainCta: string;
    openedBadge: string;
    memoriesOpenedLabel: string;
    ofWord: string;
    skipFinaleLabel: string;
    openLetterHint: string;
    openLetterAria: string;
    readOurLetterAria: string;
    openMemoryHref: string;
    backToSystemCta: string;
    clickToZoomHint: string;
    keptLabel: string;
    inMyHeartLabel: string;
    keyboardNavAria: string;
    openSunAriaPrefix: string;
    openPlanetAriaPrefix: string;
    memoryAsideAriaSuffix: string;
    canvasAriaLabel: string;
    sun: {
      id: string;
      isSun: true;
      name: string;
      subtitle: string;
      description: string;
      detailLabel1: string;
      detailValue1: string;
      detailLabel2: string;
      detailValue2: string;
    };
    planets: PlanetContent[];
  };
  sunFlower: {
    hint: string;
    inspectHint: string;
    question: string;
    yesLabel: string;
    noLabel: string;
    yesAriaLabel: string;
    noAriaLabel: string;
    skipLabel: string;
    replayLabel: string;
    closeCardAriaLabel: string;
    parts: FlowerPartContent[];
  };
  safePlace: {
    eyebrow: string;
    title: string;
    holdHint: string;
    reducedMotionHint: string;
    holdAriaLabel: string;
    replayLabel: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
  };
  firstDate: {
    eyebrow: string;
    title: string;
    subtitle: string;
    hint: string;
    hintTouch: string;
    findNextLabel: string;
    stayLabel: string;
    progressAriaUnit: string;
    closeNoteAria: string;
    plantedAnnouncement: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
    memories: FirstDateMemoryItem[];
  };
  dayWeMet: {
    eyebrow: string;
    title: string;
    subtitle: string;
    hint: string;
    reducedMotionHint: string;
    bringTogetherLabel: string;
    replayLabel: string;
    tapStarHint: string;
    closeStarCardAria: string;
    goldStarKeyLabel: string;
    roseStarKeyLabel: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
    stars: ConstellationStarItem[];
  };
  yourLaugh: {
    eyebrow: string;
    title: string;
    subtitle: string;
    hintTouch: string;
    hintKeep: string;
    keepPlayingLabel: string;
    soundOnAriaLabel: string;
    soundOffAriaLabel: string;
    flowerAriaPrefix: string;
    joyMeterAriaPrefix: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
  };
  yourSmile: {
    eyebrow: string;
    title: string;
    subtitle: string;
    hintDesktop: string;
    hintTouch: string;
    roamLabel: string;
    replayLabel: string;
    progressAriaPrefix: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
  };
  ourForever: {
    eyebrow: string;
    title: string;
    subtitle: string;
    hintDesktop: string;
    hintTouch: string;
    hintReducedMotion: string;
    growButtonLabel: string;
    replayLabel: string;
    progressAriaPrefix: string;
    counterPrefix: string;
    counterDaysLabel: string;
    counterSuffix: string;
    counterFallback: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
  };
  thingsILove: {
    eyebrow: string;
    title: string;
    subtitle: string;
    jarTag: string;
    hintTap: string;
    hintMeadow: string;
    replayLabel: string;
    countlessPrefix: string;
    freeFireflyAriaPrefix: string;
    readReasonAriaPrefix: string;
    closeReasonAria: string;
    hideCardAria: string;
    progressAriaUnit: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
    reasons: TitledBodyItem[];
    extraReasons: string[];
  };
  myPromisesScene: {
    eyebrow: string;
    title: string;
    subtitle: string;
    hintCatch: string;
    hintWish: string;
    catchButtonLabel: string;
    sealButtonLabel: string;
    sealHoldHint: string;
    wishButtonLabel: string;
    newWishEyebrow: string;
    promiseLabelPrefix: string;
    wishCaughtPrefix: string;
    promiseCaughtPrefix: string;
    promiseSealedAnnouncement: string;
    guideStarAnnouncement: string;
    progressAriaUnit: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
    promises: TitledBodyItem[];
    extraWishes: string[];
  };
  moon: {
    eyebrow: string;
    name: string;
    title: string;
    subtitle: string;
    noteLine1: string;
    noteLine2: string;
    landButtonLabel: string;
    closeNoteAria: string;
    moonAriaLabel: string;
    hintFlower: string;
    hintLamp: string;
    flowerButtonAria: string;
    lampButtonAria: string;
    sendAnotherLabel: string;
    messageLine1: string;
    messageLine2: string;
    canvasAriaLabel: string;
  };
  finalLetter: {
    eyebrow: string;
    greeting: string;
    paragraphs: string[];
    closing: string;
    signature: string;
    ps: string;
    readAgainLabel: string;
    replayFinaleLabel: string;
    dialogAriaLabel: string;
  };
  ourMemories: {
    eyebrow: string;
    heading: string;
    intro: string;
    canvasLabelSuffix: string;
    items: Array<{
      id: string;
      title: string;
      date: string;
      caption: string;
      flowerType: FlowerType;
      paletteKey: PaletteKey;
      seed: number;
    }>;
  };
  flowersForYou: {
    eyebrow: string;
    heading: string;
    intro: string;
    ctaLabel: string;
    ctaHref: string;
    items: Array<{
      id: string;
      name: string;
      meaning: string;
      note: string;
      whisper: string;
      flowerType: FlowerType;
      paletteKey: PaletteKey;
      seed: number;
    }>;
  };
  ourStory: {
    eyebrow: string;
    heading: string;
    heroFlowerAria: string;
    quote: string;
    introParagraph1: string;
    introParagraph2: string;
    timeline: Array<{
      phase: string;
      title: string;
      description: string;
    }>;
    primaryCta: string;
    primaryHref: string;
    secondaryCta: string;
    secondaryHref: string;
  };
  loveLetters: {
    eyebrow: string;
    heading: string;
    intro: string;
    canvasLabelPrefix: string;
    letters: Array<{
      id: string;
      date: string;
      tag: string;
      noteLabel: string;
      title: string;
      preview: string;
      flowerType: FlowerType;
      paletteKey: PaletteKey;
      seed: number;
    }>;
  };
  myPromises: {
    eyebrow: string;
    heading: string;
    intro: string;
    buttonIdle: string;
    buttonKept: string;
    statusPrefix: string;
    canvasLabelSuffix: string;
    items: Array<{
      id: string;
      subtitle: string;
      title: string;
      description: string;
      flowerType: FlowerType;
      paletteKey: PaletteKey;
      seed: number;
    }>;
  };
  writeToMe: {
    eyebrow: string;
    heading: string;
    intro: string;
    nameLabel: string;
    namePlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    submitLabel: string;
    emailSubjectPrefix: string;
    emailFromLabel: string;
    submittedTitle: string;
    submittedWithEmail: string;
    submittedWithoutEmail: string;
    sendAnotherLabel: string;
    sideHeading: string;
    sideMessage: string;
    sideQuote: string;
  };
}

// ============================================================================
// SECTION 1 — SETTINGS
// ============================================================================

/**
 * Shown in the footer pill ("Together for X days") and the "Our Forever"
 * center counter. Format: "YYYY-MM-DD" (e.g., "2023-06-14").
 * Leave "" to hide the footer pill and show a glowing "FOREVER" in the scene.
 */
export const TOGETHER_SINCE = "";

/**
 * Used by the "Write To Me" page (/write-to-me) to open her email app.
 * Leave "" to hide the mailto button gracefully.
 */
export const CONTACT_EMAIL = "";

/** Shown in the header logo and email subject line. Recommended max: 20 chars. */
export const BRAND_NAME = "OUR COSMOS";

/** Default sound state for the "Your Laugh" musical garden (true = on, false = muted). */
export const SOUND_DEFAULT_ON = true;

/**
 * How many memories must be opened before the Grand Finale triggers.
 * Use "all" (all 9: the Sun + 8 planets) or a smaller number like 3 for testing.
 */
export const REQUIRED_VISITS: "all" | number = "all";

/** Optional social links shown in the footer when non-empty. */
export const SOCIAL_LINKS = {
  instagram: "",
  facebook: "",
  pinterest: "",
};

// ============================================================================
// CONSOLIDATED SITE CONTENT OBJECT
// ============================================================================

export const content: SiteContent = {
  settings: {
    togetherSince: TOGETHER_SINCE,
    contactEmail: CONTACT_EMAIL,
    brandName: BRAND_NAME,
    soundDefaultOn: SOUND_DEFAULT_ON,
    requiredVisits: REQUIRED_VISITS,
    socialLinks: SOCIAL_LINKS,
  },

  // ==========================================================================
  // SECTION 2 — SITE-WIDE (Nav, Footer, SEO Metadata, Common Buttons & Aria)
  // ==========================================================================

  /** Shown in the site header, footer, and accessibility skip link. */
  brand: {
    logo: BRAND_NAME,
    footerLeft: "Made with love, for you",
    skipToContent: "Skip to main content",
  },

  /** Shared button labels, accessibility labels, and fallback messages used across scenes. */
  common: {
    backToSky: "Back to our sky",
    backToGalaxy: "BACK TO OUR GALAXY",
    openThisMemory: "Open this memory",
    growAgain: "Grow again",
    close: "Close",
    memoryFallbackTitle: "This memory needs a moment to bloom.",
    memoryWindowFallbackTitle: "This memory is resting for a moment.",
    memoryWindowFallbackBody:
      "Close this window to return to our sky, or try opening it again.",
    closeMemoryWindowAria: "Close memory window",
    memorySceneAriaFallback: "Memory scene",
    openNavAria: "Open navigation menu",
    closeNavAria: "Close navigation menu",
    primaryNavAria: "Primary navigation",
    mobileNavAria: "Mobile navigation",
    mobilePrimaryNavAria: "Mobile primary navigation",
    socialLinksAria: "Social links",
    socialLabels: {
      instagram: "Instagram",
      facebook: "Facebook",
      pinterest: "Pinterest",
    },
    togetherPrefix: "Together for",
    daySingular: "day",
    dayPlural: "days",
  },

  /** Browser tab titles and social sharing descriptions for every page. */
  metadata: {
    root: {
      defaultTitle: "For You | Our Cosmos",
      titleTemplate: "%s | Our Cosmos",
      description:
        "A galaxy in bloom, made only for you. Our memories, flowers, story, letters, and promises under one quiet sky.",
      siteName: "Our Cosmos",
    },
    home: {
      title: "For You | Our Cosmos",
      description:
        "You are my universe. Explore a galaxy in bloom, made only for you.",
    },
    solarSystem: {
      title: "Our Sky",
      description:
        "You are the brightest bloom in my universe. Tap any orbiting world to open a memory.",
    },
    ourMemories: {
      title: "Our Memories",
      description:
        "Little moments we have gathered together, kept bright like stars.",
    },
    flowersForYou: {
      title: "Flowers For You",
      description:
        "Four blooms that will never fade, and what each one means to us.",
    },
    ourStory: {
      title: "Our Story",
      description:
        "How we met, our first moments, the moment I knew, and where we are now.",
    },
    loveLetters: {
      title: "Love Letters",
      description:
        "Quiet notes written for you to read whenever you want to feel close.",
    },
    myPromises: {
      title: "My Promises",
      description:
        "Six promises I carry for you today and every day after.",
    },
    writeToMe: {
      title: "Write To Me",
      description:
        "Tell me what's in your heart—any thought, wish, or midnight note.",
    },
  },

  /** Top navigation bar links on the secondary pages. Recommended max: 18 chars per label. */
  nav: [
    { label: "HOME", href: "/" },
    { label: "OUR MEMORIES", href: "/our-memories" },
    { label: "FLOWERS FOR YOU", href: "/flowers-for-you" },
    { label: "OUR STORY", href: "/our-story" },
    { label: "LOVE LETTERS", href: "/love-letters" },
    { label: "MY PROMISES", href: "/my-promises" },
    { label: "WRITE TO ME", href: "/write-to-me" },
  ],

  // ==========================================================================
  // SECTION 3 — HOME (Hero Title, Subtitle & Enter Button on /)
  // ==========================================================================

  /** Shown centered over the spinning flower galaxy on the home page. */
  home: {
    /** Recommended max: 16 chars per line. */
    titleLine1: "YOU ARE",
    titleLine2: "MY UNIVERSE",
    /** Recommended max: 48 chars. */
    subtitle: "A GALAXY IN BLOOM, MADE ONLY FOR YOU",
    ctaLabel: "ENTER OUR GALAXY",
    ctaAriaLabel: "Enter our galaxy and explore our sky of memories",
    canvasAriaLabel:
      "A spiral galaxy of glowing flower petals, tiny blooms, and stars created for you",
  },

  // ==========================================================================
  // SECTION 4 — SOLAR SYSTEM (/solar-system — Sun & 8 Orbiting Planets)
  // ==========================================================================

  /** Shown in the 3D solar system view, hover tooltips, and planet side panel. */
  solarSystem: {
    backButton: "BACK TO OUR GALAXY",
    hintMobile: "TAP A PLANET TO OPEN A MEMORY",
    hintDesktop: "TAP A PLANET TO OPEN A MEMORY",
    openMemoryCta: "Open this memory",
    openAgainCta: "Open again",
    openedBadge: "Opened",
    memoriesOpenedLabel: "Memories opened:",
    ofWord: "of",
    skipFinaleLabel: "Skip",
    openLetterHint: "Open your letter",
    openLetterAria: "Open your sealed letter",
    readOurLetterAria: "Read our letter",
    openMemoryHref: "/our-memories",
    backToSystemCta: "Back to our sky",
    clickToZoomHint: "Click to zoom",
    keptLabel: "Kept",
    inMyHeartLabel: "In My Heart",
    keyboardNavAria: "Our sky keyboard navigation",
    openSunAriaPrefix: "Open",
    openPlanetAriaPrefix: "Open memory:",
    memoryAsideAriaSuffix: "memory",
    canvasAriaLabel:
      "Our botanical solar system with you as the glowing golden sun at the center and eight orbiting worlds of memories and promises",

    /** Shown in the side panel when the golden Sun at the center is selected. */
    sun: {
      id: "solar-sun",
      isSun: true,
      name: "My Sun",
      subtitle: "The Brightest Bloom in My Universe",
      /** Recommended max: 190 chars. */
      description:
        "Everything in my world turns gently around you. Your warmth lights up even my quietest days, and you will always be the brightest bloom in my universe.",
      detailLabel1: "Meaning",
      detailValue1: "My Light & Warmth",
      detailLabel2: "Always",
      detailValue2: "Center of My Sky",
    },

    /**
     * Shown in tooltips and the side panel when each of the 8 orbiting planets is selected.
     * Keep planet `id` values unchanged so they stay linked to their memory scenes.
     * Recommended max: tagline <= 65 chars, description <= 180 chars, detailValue <= 24 chars.
     */
    planets: [
      {
        id: "the-day-we-met",
        name: "The Day We Met",
        subtitle: "Where Our Universe Began",
        tagline: "The quiet moment everything changed for the better.",
        description:
          "I still remember [where we first met] on [date we met]. I did not know it yet, my love, but my favorite chapter had just begun.",
        detailValue1: "[date we met]",
        detailValue2: "Our Beginning",
      },
      {
        id: "your-smile",
        name: "Your Smile",
        subtitle: "My Favorite Sight",
        tagline: "Soft enough to calm any storm in my head.",
        description:
          "Every time you smile, the whole room feels lighter. It is the simplest, brightest magic I have ever known.",
        detailValue1: "Pure Starlight",
        detailValue2: "Every Single Day",
      },
      {
        id: "our-first-date",
        name: "Our First Date",
        subtitle: "A Memory I Keep Close",
        tagline: "Hours that passed like minutes beside you.",
        description:
          "Sitting with you at [our first date spot], I remember wishing the night would slow down just a little longer.",
        detailValue1: "[first date date]",
        detailValue2: "Unforgettable",
      },
      {
        id: "your-laugh",
        name: "Your Laugh",
        subtitle: "My Favorite Sound",
        tagline: "The music I never want to stop hearing.",
        description:
          "Especially when [inside joke or silly moment] comes up—hearing you laugh freely is one of the greatest joys of my life.",
        detailValue1: "Pure Joy",
        detailValue2: "Endlessly Warm",
      },
      {
        id: "quiet-evenings",
        name: "Quiet Evenings",
        subtitle: "Just Us Two",
        tagline: "Even doing nothing feels whole with you.",
        description:
          "Late talks, shared playlists, and [our favorite cozy ritual together]—you turn ordinary evenings into places I never want to leave.",
        detailValue1: "Soft Peace",
        detailValue2: "Midnight Talks",
      },
      {
        id: "my-safe-place",
        name: "My Safe Place",
        subtitle: "Home in Your Arms",
        tagline: "Where I can always be completely myself.",
        description:
          "With you, I never have to pretend or hurry. Your kindness and patience have made your side my truest home.",
        detailValue1: "Gentle & True",
        detailValue2: "Always Safe",
      },
      {
        id: "little-moments",
        name: "Little Moments",
        subtitle: "Small Things I Adore",
        tagline: "The tiny habits that make me fall for you again.",
        description:
          "From [a little habit of hers you adore] to the way you look at the sky, I notice every small detail and love you more for it.",
        detailValue1: "Golden Details",
        detailValue2: "Every Day",
      },
      {
        id: "our-forever",
        name: "Our Forever",
        subtitle: "Every Tomorrow Ahead",
        tagline: "All the places we have yet to see together.",
        description:
          "I cannot wait for [a dream trip or future plan together] and all the quiet mornings waiting for us. My love, I choose you in every season.",
        detailValue1: "All Our Tomorrows",
        detailValue2: "Always Yours",
      },
    ],
  },

  // ==========================================================================
  // SECTION 5 — SUN SCENE (Interactive Growing Flower inside "My Sun")
  // ==========================================================================

  /** Shown inside the full-screen Sun bloom scene when she clicks "Open this memory" on the Sun. */
  sunFlower: {
    hint: "Tap a part of the flower",
    inspectHint: "Click the flower parts to inspect",
    /** Shown after the flower finishes growing. Recommended max: 40 chars. */
    question: "Do you like it, my love?",
    yesLabel: "Yes",
    noLabel: "No",
    yesAriaLabel: "Yes, I like the flower",
    noAriaLabel: "No, I do not like the flower",
    skipLabel: "Skip",
    replayLabel: "Grow again",
    closeCardAriaLabel: "Close flower part description",
    /**
     * Descriptions shown in the side card when she taps each part of the grown flower.
     * Keep all 10 part `id` values unchanged. Recommended max: description <= 220 chars.
     */
    parts: [
      {
        id: "roots",
        name: "Roots",
        meaning: "Where We Began",
        description:
          "This is where our story took hold—back at [where our story began]. Even when seasons shift, everything we built together keeps us grounded, steady, and intertwined.",
      },
      {
        id: "stem",
        name: "Stem",
        meaning: "Our Shared Strength",
        description:
          "You are the quiet strength that helps me stand tall on heavy days. Reaching upward together, we hold each other steady through every wind.",
      },
      {
        id: "leaves",
        name: "Leaves",
        meaning: "How You Make Me Grow",
        description:
          "Loving you has made me kinder, softer, and braver than I ever was before. Just by being yourself, you help me grow toward the light every single day.",
      },
      {
        id: "thorns",
        name: "Thorns",
        meaning: "What Made Us Stronger",
        description:
          "Not every moment has been effortless, and we have walked through [a hard moment you overcame together]. Yet every storm we faced side by side only made our love deeper and truer.",
      },
      {
        id: "sepals",
        name: "Sepals",
        meaning: "How You Protect My Heart",
        description:
          "Like sepals cradling a delicate bloom, your patience and gentleness keep my heart safe. In your care, I never have to guard myself or hide.",
      },
      {
        id: "outer-petals",
        name: "Outer Petals",
        meaning: "First Things I Loved",
        description:
          "These are the first things that drew me to you—[first things I loved about her]. From the very start, you stood out like starlight against a midnight sky.",
      },
      {
        id: "inner-petals",
        name: "Inner Petals",
        meaning: "What Only I Know",
        description:
          "Closer to the heart are the quiet, tender sides of you—[the things only I know about her]. Being trusted with your softest self is a gift I will always treasure.",
      },
      {
        id: "core",
        name: "Flower Center",
        meaning: "My Heart, Yours",
        description:
          "Right here at the warm golden center is my heart—completely and unmistakably yours. Every bright thing in my universe begins and ends with you, my love.",
      },
      {
        id: "stamens",
        name: "Stamens",
        meaning: "The Little Moments",
        description:
          "All the small, golden instants between us—[the little moments]. They may seem tiny from far away, yet together they are what make our love glow.",
      },
      {
        id: "pollen",
        name: "Pollen & Stardust",
        meaning: "Sparks of Joy",
        description:
          "Everywhere you go, you leave little sparks of warmth and laughter behind. You brighten every room you step into, and you have filled my whole sky with light.",
      },
    ],
  },

  // ==========================================================================
  // SECTION 6 — PLANET SCENES
  // ==========================================================================

  // --------------------------------------------------------------------------
  // 6.1 MY SAFE PLACE (Storm-to-Calm Hilltop Cottage)
  // --------------------------------------------------------------------------
  /** Shown in the "My Safe Place" memory scene (hold to warm the stormy night). */
  safePlace: {
    eyebrow: "HOME IN YOUR ARMS",
    title: "My Safe Place",
    holdHint: "Hold to warm the night",
    reducedMotionHint: "Tap to warm the night",
    holdAriaLabel: "Hold to warm the night and calm the storm",
    replayLabel: "Replay the storm",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "With you, I never have to pretend or hurry. Your kindness and patience have made your side my truest home.",
    messageLine2:
      "I still remember [a real memory of a time she made me feel safe], and how everything heavy faded the moment you were near.",
    canvasAriaLabel:
      "A stormy cosmic night over a quiet hill with a tiny glowing home that warms into a calm starry garden as you hold",
  },

  // --------------------------------------------------------------------------
  // 6.2 OUR FIRST DATE (Flowering Earth Valley — River, Sea, Cafe & Dusk Lanterns)
  // --------------------------------------------------------------------------
  /** Shown inside the "Our First Date" living valley world (zooming into Earth). */
  firstDate: {
    eyebrow: "OUR FIRST DATE",
    title: "Our First Date",
    subtitle: "A Valley Made of That Night",
    hint: "Drag to look around · Tap glowing places or plant in the meadow",
    hintTouch: "Drag to look around · Tap glowing places or the meadow",
    findNextLabel: "Find the next memory",
    stayLabel: "Stay a while",
    progressAriaUnit: "memories found",
    closeNoteAria: "Close memory note",
    plantedAnnouncement: "Planted in the meadow",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "Hours passed like minutes beside you that night, and every quiet laugh felt like a whole world blooming around us.",
    messageLine2:
      "I will never forget [the moment I knew I wanted more dates with you].",
    canvasAriaLabel:
      "A living sunlit valley with a winding river flowing to the sea, sailboats at a harbor dock, growing flowers, trees, cozy houses, and a riverside cafe with two chairs and a flickering candle",
    /**
     * Memory hotspots discovered around the valley.
     * Supported count: min 3, max 16 (hotspots & progress dots adapt automatically,
     * cycling landmarks if there are more items than places).
     * Recommended max: hotspot <= 24 chars, title <= 34 chars, body <= 150 chars.
     */
    memories: [
      {
        id: "fd-cafe",
        hotspot: "The Cafe",
        title: "Where We Met That Night",
        body: "Sitting across from you at [Where we met that night], I kept smiling before I even realized it.",
      },
      {
        id: "fd-bridge",
        hotspot: "The Little Bridge",
        title: "The First Thing You Said",
        body: "I still remember [The first thing you said to me] and how instantly easy it felt to be beside you.",
      },
      {
        id: "fd-dock",
        hotspot: "The Harbor Dock",
        title: "What We Shared",
        body: "Over [What we ate], the whole evening slowed down until it felt like just the two of us.",
      },
      {
        id: "fd-cherry",
        hotspot: "The Blossom Tree",
        title: "The Song in the Air",
        body: "Whenever I hear [The song that was playing], I am right back at that table with you.",
      },
      {
        id: "fd-cottage-1",
        hotspot: "The Riverbend House",
        title: "Laughing Together",
        body: "I will always keep [The moment we laughed the hardest] tucked safely in my favorite memories.",
      },
      {
        id: "fd-oak",
        hotspot: "The Old Oak Tree",
        title: "The Walk Home",
        body: "During [The walk home], I caught myself walking a little slower just to stay beside you longer.",
      },
      {
        id: "fd-cottage-2",
        hotspot: "The Meadow House",
        title: "Not Wanting It to End",
        body: "That quiet second [When I realized I did not want the night to end] changed everything for me.",
      },
      {
        id: "fd-grove",
        hotspot: "The Pine Overlook",
        title: "Getting Home Smiling",
        body: "I still smile remembering [What I felt when I got home]—already counting the days until I saw you again.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 6.3 THE DAY WE MET (Two Drifting Stars & Constellation of Us)
  // --------------------------------------------------------------------------
  /** Shown in the "The Day We Met" memory scene (drag Gold & Rose stars together). */
  dayWeMet: {
    eyebrow: "THE DAY WE MET",
    title: "The Day We Met",
    subtitle: "Where Our Universe Began",
    hint: "Bring the two stars together",
    reducedMotionHint: "Tap to bring the two stars together",
    bringTogetherLabel: "Bring them together",
    replayLabel: "Bring them together again",
    tapStarHint: "Tap any star in the constellation to read its memory",
    closeStarCardAria: "Close star memory",
    goldStarKeyLabel:
      "Move gold star with arrow keys or press Enter to bring together",
    roseStarKeyLabel:
      "Move rose star with arrow keys or press Enter to bring together",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "Out of billions of quiet lights drifting across the dark, somehow our paths curved toward each other.",
    messageLine2:
      "I still hold onto [what I remember most about that first moment], like the first star that turned my whole sky bright.",
    canvasAriaLabel:
      "A deep cosmic sky with two drifting stars—gold and rose—that merge when brought together to ignite the constellation of our story",
    /**
     * Constellation milestone stars ignited one by one after the merge.
     * Supported count: min 2, max 12 (arc layout & timing adapt automatically).
     * Recommended max: title <= 36 chars, memory <= 160 chars.
     */
    stars: [
      {
        id: "met",
        title: "The Day We Met",
        date: "[date we met]",
        memory:
          "Two quiet orbits finally crossed at [where we met]. I still remember [first detail I noticed about you].",
      },
      {
        id: "conversation",
        title: "Our First Conversation",
        date: "[date]",
        memory:
          "We talked about [what we talked about] and somehow every awkward silence disappeared right away.",
      },
      {
        id: "laughed",
        title: "The First Time We Laughed Together",
        date: "[date]",
        memory:
          "When [the funny moment that made us laugh], I heard your real laugh and wanted to hear it forever.",
      },
      {
        id: "first-date",
        title: "Our First Date",
        date: "[date]",
        memory:
          "Sitting beside you at [our first date place], I kept wishing the clock would slow down just a little.",
      },
      {
        id: "knew",
        title: "The Day I Knew",
        date: "[date]",
        memory:
          "During [the moment I knew I loved you], everything clicked softly into place: it was always going to be you.",
      },
      {
        id: "today",
        title: "Today",
        date: "Right Here, Right Now",
        memory:
          "Every day since has bloomed brighter with you. Thank you for [what I love most about us today], my love.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 6.4 YOUR LAUGH (Musical Night Pond Garden)
  // --------------------------------------------------------------------------
  /** Shown in the "Your Laugh" memory scene (play 12 pentatonic bell flowers). */
  yourLaugh: {
    eyebrow: "YOUR LAUGH",
    title: "Your Laugh",
    subtitle: "My Favorite Sound",
    hintTouch: "Touch the flowers",
    hintKeep: "Keep playing",
    keepPlayingLabel: "Keep playing",
    soundOnAriaLabel: "Sound on — click to mute",
    soundOffAriaLabel: "Sound muted — click to unmute",
    flowerAriaPrefix: "Play musical flower",
    joyMeterAriaPrefix: "Garden joy:",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "Your laugh is my favorite music in the whole universe—bright, effortless, and able to turn any quiet night into pure joy.",
    messageLine2:
      "I still smile whenever I think of [the moment you laughed that I'll never forget].",
    canvasAriaLabel:
      "A glowing night garden by a calm pond with twelve musical bell-shaped flowers that chime and shimmer when touched",
  },

  // --------------------------------------------------------------------------
  // 6.5 YOUR SMILE (Pre-Dawn Blooming Field & Hidden Smile Sunrise)
  // --------------------------------------------------------------------------
  /** Shown in the "Your Smile" memory scene (move your light to bloom the field). */
  yourSmile: {
    eyebrow: "YOUR SMILE",
    title: "Your Smile",
    subtitle: "My Favorite Sight",
    hintDesktop: "Move the light across the field",
    hintTouch: "Drag your finger across the field",
    roamLabel: "Let the light roam",
    replayLabel: "Let it bloom again",
    progressAriaPrefix: "Field bloom progress:",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "Every time you smile, the whole world wakes up a little brighter—like sunrise spilling gently across a quiet hill.",
    messageLine2:
      "You never even have to try; [what your smile does to me] every single time.",
    canvasAriaLabel:
      "A vast pre-dawn field of closed cosmic flowers that turn toward your light and bloom into a golden sunrise with a hidden smile glowing across the hill",
  },

  // --------------------------------------------------------------------------
  // 6.6 OUR FOREVER (Braided Cosmic Infinity & Live Counter)
  // --------------------------------------------------------------------------
  /** Shown in the "Our Forever" memory scene (trace the infinity to grow braided vines). */
  ourForever: {
    eyebrow: "OUR FOREVER",
    title: "Our Forever",
    subtitle: "Every Tomorrow Ahead",
    hintDesktop: "Trace the infinity",
    hintTouch: "Trace the infinity with your finger",
    hintReducedMotion: "Tap anywhere to grow our forever",
    growButtonLabel: "Grow our forever",
    replayLabel: "Grow it again",
    progressAriaPrefix: "Loop progress",
    counterPrefix: "Together for",
    counterDaysLabel: "days",
    counterSuffix: "and counting",
    counterFallback: "FOREVER",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "No matter how many seasons turn or how far the stars drift, my favorite place will always be right beside you.",
    messageLine2:
      "To me, [what forever means to me with you]—today, tomorrow, and every lifetime after.",
    canvasAriaLabel:
      "A glowing infinity loop floating in deep space where braided gold and rose vines grow and bloom with cosmic flowers as you trace the path",
  },

  // --------------------------------------------------------------------------
  // 6.7 THINGS I LOVE ABOUT YOU (Firefly Jar in a Night Meadow)
  // --------------------------------------------------------------------------
  /** Shown in the "Things I Love About You" scene (linked to the "Little Moments" planet). */
  thingsILove: {
    eyebrow: "THINGS I LOVE ABOUT YOU",
    title: "Things I Love About You",
    subtitle: "Small Things I Adore",
    /** Shown on the small hanging tag on the glass jar. Recommended max: 26 chars. */
    jarTag: "Things I love about you",
    hintTap: "Tap a firefly to set it free",
    hintMeadow: "Tap the meadow to free even more",
    replayLabel: "Open the jar again",
    countlessPrefix: "and countless more:",
    freeFireflyAriaPrefix: "Free firefly",
    readReasonAriaPrefix: "Read reason",
    closeReasonAria: "Close reason",
    hideCardAria: "Hide card to keep tapping meadow",
    progressAriaUnit: "fireflies released",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "There are too many to count, and no jar could hold them all.",
    messageLine2:
      "And if I could whisper just one more: [one more thing I love about you that I never say].",
    canvasAriaLabel:
      "A glowing glass jar of fireflies resting on a mossy stump in a dark night meadow; freeing each firefly reveals a reason I love you and fills the sky with stars",
    /**
     * Main reasons inside the jar.
     * Supported count: min 3, max 24 (jar fireflies, sky stars & dots adapt automatically;
     * above 18 jar slots, extra releases reuse slots smoothly).
     * Recommended max: title <= 28 chars, body <= 140 chars.
     */
    reasons: [
      {
        id: "reason-1",
        title: "Your Laugh",
        body: "The way you [laugh when something catches you off guard] lights up the whole room before you even notice.",
      },
      {
        id: "reason-2",
        title: "Your Kind Heart",
        body: "How gently you treat [people or animals you care about], even on the days when you are tired yourself.",
      },
      {
        id: "reason-3",
        title: "Your Little Habits",
        body: "That tiny thing you do when you [a cute everyday habit of hers]—it makes me fall for you all over again.",
      },
      {
        id: "reason-4",
        title: "The Way You Listen",
        body: "Whenever I talk about [something I ramble about], you look at me like every single word matters.",
      },
      {
        id: "reason-5",
        title: "Your Warmth",
        body: "Just sitting beside you during [a quiet everyday moment] makes everything noisy in my head go calm.",
      },
      {
        id: "reason-6",
        title: "Your Curiosity",
        body: "The way your eyes brighten whenever you talk about [something you love or get excited about].",
      },
      {
        id: "reason-7",
        title: "Your Strength",
        body: "How bravely you keep going through [a challenge you handled with grace], without ever losing your softness.",
      },
      {
        id: "reason-8",
        title: "Your Thoughtfulness",
        body: "The little ways you remember [a small detail you remember about me] when I didn't even expect it.",
      },
      {
        id: "reason-9",
        title: "Your Voice",
        body: "Hearing you say [a sweet phrase or greeting you say] at the end of a long day feels like coming home.",
      },
      {
        id: "reason-10",
        title: "Your Playfulness",
        body: "The silly moments when we [an inside joke or playful habit together] and completely lose track of time.",
      },
      {
        id: "reason-11",
        title: "Your Honesty",
        body: "How safe it feels to be completely myself with you, knowing we can always talk through anything.",
      },
      {
        id: "reason-12",
        title: "Simply Being You",
        body: "Beyond every big moment, I love the quiet, unmistakable magic of [what makes you so uniquely you].",
      },
    ],
    /**
     * Extra shorter reasons shown when tapping the meadow after the finale (cycles).
     * Supported count: min 1, max 30. Recommended max: 95 chars each.
     */
    extraReasons: [
      "The way you scrunch your nose when [something amuses you].",
      "How you turn [ordinary errands or rides] into my favorite part of the week.",
      "Your soft sleepy voice during [a morning or late-night moment].",
      "The way you hold my hand a little tighter whenever [a sweet moment].",
      "How a single smile from you can rescue my whole day.",
      "The little tunes you hum when [you're happy or focused].",
      "How cozy every rainy evening feels just having you beside me.",
      "The way you still look up at the night sky with wonder.",
      "Every tiny message you send just to check in on me.",
      "The simple miracle that out of everyone in the world, I get to love you.",
    ],
  },

  // --------------------------------------------------------------------------
  // 6.8 MY PROMISES (Meteor Shower Hilltop & Glowing Promise Tree)
  // --------------------------------------------------------------------------
  /** Shown in the "My Promises" memory scene (linked to the "Quiet Evenings" planet). */
  myPromisesScene: {
    eyebrow: "MY PROMISES",
    title: "My Promises",
    subtitle: "Sealed Under the Stars",
    hintCatch: "Catch a shooting star",
    hintWish: "Catch a star to make a new wish",
    catchButtonLabel: "Catch a star",
    sealButtonLabel: "Seal it",
    sealHoldHint: "Hold to seal",
    wishButtonLabel: "Make a new wish",
    newWishEyebrow: "A New Wish",
    promiseLabelPrefix: "Promise",
    wishCaughtPrefix: "Wish caught:",
    promiseCaughtPrefix: "Promise caught:",
    promiseSealedAnnouncement: "Promise sealed into the tree.",
    guideStarAnnouncement:
      "A slow golden star is drifting across the sky. Press Catch a star again to catch it.",
    progressAriaUnit: "promises sealed",
    /** Recommended max: 160 chars per line. */
    messageLine1:
      "Every star in this sky could fall and my vows to you would still stand—quiet, steady, and forever yours.",
    messageLine2:
      "Above all else, [the promise I most want to keep forever].",
    canvasAriaLabel:
      "A quiet hilltop under a meteor shower with a glowing promise tree, a bench for two with a warm lantern, and shooting stars you can catch to seal promises into bloom",
    /**
     * Main promises carried by shooting stars.
     * Supported count: min 3, max 16 (progress dots & tree anchors adapt automatically;
     * if more than 8, extra promises reuse crown tips cleanly).
     * Recommended max: title <= 32 chars, body <= 150 chars.
     */
    promises: [
      {
        id: "p-1",
        title: "I Will Always Listen",
        body: "I will always [listen to you when you need to talk or just sit in silence], with my whole heart and never rushing you.",
      },
      {
        id: "p-2",
        title: "I Will Choose You Every Day",
        body: "On bright mornings and heavy nights alike, I promise to keep choosing you in [all the ordinary moments we share].",
      },
      {
        id: "p-3",
        title: "I Will Protect Your Peace",
        body: "Whenever the world feels too loud, I will be your calm harbor and [how I will comfort you when you are overwhelmed].",
      },
      {
        id: "p-4",
        title: "I Will Keep Making You Laugh",
        body: "Even years from now, I promise to still find silly ways to bring out your smile with [a joke or habit that always makes you laugh].",
      },
      {
        id: "p-5",
        title: "I Will Cheer For Your Dreams",
        body: "Through every dream you chase, especially [a dream of yours I admire], I will be right beside you prouder than anyone.",
      },
      {
        id: "p-6",
        title: "I Will Never Stop Courting You",
        body: "Little notes, surprise dates at [a place we love], and holding your hand—I will never let our magic feel ordinary.",
      },
      {
        id: "p-7",
        title: "I Will Be Gentle & True",
        body: "I promise to meet you with honesty, patience, and kindness, always standing on your side no matter the storm.",
      },
      {
        id: "p-8",
        title: "I Will Grow Old With You",
        body: "Through every season waiting for us and [a future moment we dream of together], my hand is always yours to hold.",
      },
    ],
    /**
     * Extra wishes shown in "Make a new wish" mode after the tree blooms (cycles).
     * Supported count: min 1, max 30. Recommended max: 110 chars each.
     */
    extraWishes: [
      "May we always find time for slow mornings and [our favorite weekend ritual].",
      "May we wander through [a dream destination together] hand in hand.",
      "May our home always be filled with laughter, warmth, and [a cozy detail we love].",
      "May I always be the first person you want to tell your good news to.",
      "May we never outgrow our late-night talks under quiet skies.",
      "May every year with you feel softer, deeper, and brighter than the last.",
      "May we still dance in the kitchen when our hair turns silver.",
      "May you always feel how deeply, completely, and endlessly you are loved.",
    ],
  },

  // --------------------------------------------------------------------------
  // 6.9 THE MOON (Hidden Bonus Scene — Orbiting Our First Date Earth)
  // --------------------------------------------------------------------------
  /** Shown on the hidden moon tooltip, floating note, and full-screen lunar surface scene. */
  moon: {
    eyebrow: "THE MOON",
    name: "Our Little Moon",
    title: "To the Moon and Back",
    subtitle: "A Quiet Secret in Our Sky",
    /** Recommended max: 120 chars per line in the floating moon note. */
    noteLine1: "I love you to the moon and back.",
    noteLine2:
      "Even from all the way up here, [a quiet thought I always carry for you].",
    landButtonLabel: "Land on the moon",
    closeNoteAria: "Close moon note",
    moonAriaLabel: "Our Little Moon — tap to open secret note",
    hintFlower: "Tap the moonflower",
    hintLamp: "Send a light to Earth",
    flowerButtonAria: "Plant the moonflower",
    lampButtonAria: "Send a light signal to Earth",
    sendAnotherLabel: "Send another signal",
    /** Recommended max: 160 chars per line in the lunar ending card. */
    messageLine1: "I love you to the moon and back.",
    messageLine2:
      "No matter how far apart two lights ever seem, [what always brings me right back to you].",
    canvasAriaLabel:
      "A silent silver-blue lunar surface under a bright Milky Way sky with a huge flowering Earth hanging above, a glowing moonflower bud, and a signal lamp",
  },

  // ==========================================================================
  // SECTION 7 — FINAL LETTER (Grand Finale after opening all memories)
  // ==========================================================================

  /**
   * Shown in the full-screen Grand Finale letter after opening all memories.
   * Add or remove paragraphs freely; each paragraph fades in sequentially.
   * Leave `ps` as "" to hide the P.S. line.
   */
  finalLetter: {
    eyebrow: "MY LETTER TO YOU",
    greeting: "My love,",
    paragraphs: [
      "If you are reading this, it means you walked through every little world I built for you—from [where our story began] to all the quiet evenings, laughs, and promises we hold together.",
      "No galaxy, jar of fireflies, or field of flowers could ever hold everything I feel for you. I still think about [a favorite memory with you that always stays with me], and how effortlessly you make my whole life softer and brighter just by being in it.",
      "Whatever seasons come next, I want to meet every single one of them with your hand in mine—still choosing you, still learning you, and still falling for you through [the ordinary days and all our tomorrows ahead].",
    ],
    closing: "Always and completely yours,",
    signature: "Forever yours, my love",
    ps: "P.S. Whenever you ever forget how deeply you are loved, come back to our sky—every star here still shines for you.",
    readAgainLabel: "Read again",
    replayFinaleLabel: "Replay the finale",
    dialogAriaLabel: "My final letter to you",
  },

  // ==========================================================================
  // SECTION 8 — OTHER PAGES
  // ==========================================================================

  /** Shown on the /our-memories gallery page. Supported count: min 1, max 24. */
  ourMemories: {
    eyebrow: "Kept Like Stars",
    heading: "Our Memories",
    intro:
      "Six moments I hold close to my heart—each one waiting for our favorite photos.",
    canvasLabelSuffix: "glowing floral memory",
    items: [
      {
        id: "memory-1",
        title: "The Day Everything Started",
        date: "[date]",
        caption:
          "The first time I saw you at [place] and couldn't stop smiling.",
        flowerType: "rose",
        paletteKey: "magenta",
        seed: 101,
      },
      {
        id: "memory-2",
        title: "Our First Date",
        date: "[date]",
        caption: "Talking for hours at [place] until we lost track of time.",
        flowerType: "delphinium",
        paletteKey: "blue",
        seed: 202,
      },
      {
        id: "memory-3",
        title: "A Walk Under the Evening Sky",
        date: "[date]",
        caption:
          "Walking hand in hand at [favorite walk or spot] with nowhere to rush.",
        flowerType: "lily",
        paletteKey: "teal",
        seed: 303,
      },
      {
        id: "memory-4",
        title: "Laughing Until We Cried",
        date: "[date]",
        caption:
          "Remembering [inside joke or funny moment]—still my favorite sound.",
        flowerType: "orchid",
        paletteKey: "purple",
        seed: 404,
      },
      {
        id: "memory-5",
        title: "Our Cozy Rainy Day",
        date: "[date]",
        caption:
          "Sharing [favorite food or movie together] while the rain tapped outside.",
        flowerType: "hydrangea",
        paletteKey: "violet",
        seed: 505,
      },
      {
        id: "memory-6",
        title: "My Favorite Photo of You",
        date: "[date]",
        caption:
          "The moment at [place] where you looked so effortlessly happy.",
        flowerType: "lotus",
        paletteKey: "gold",
        seed: 606,
      },
    ],
  },

  /** Shown on the /flowers-for-you page. Supported count: min 1, max 12. */
  flowersForYou: {
    eyebrow: "Blooms That Never Fade",
    heading: "Flowers For You",
    intro:
      "If I could hand you a whole garden that never wilts, these four flowers would be the first I pick for you.",
    ctaLabel: "Read My Promises",
    ctaHref: "/my-promises",
    items: [
      {
        id: "red-rose",
        name: "Red Rose",
        meaning: "My Love For You",
        note: "Deep, steady, and completely yours. Every petal is a quiet thank-you for the way you love me and for being the heart of my world.",
        whisper: "Devotion · Warmth · Always Yours",
        flowerType: "rose",
        paletteKey: "magenta",
        seed: 12,
      },
      {
        id: "sunflower",
        name: "Sunflower",
        meaning: "You Light Up My Days",
        note: "Just like a sunflower turns toward the light, my heart always finds its way to you. One smile from you turns any heavy day golden.",
        whisper: "Sunlight · Joy · Brightest Bloom",
        flowerType: "lotus",
        paletteKey: "gold",
        seed: 48,
      },
      {
        id: "lily",
        name: "Lily",
        meaning: "You Are Pure & Graceful",
        note: "Gentle, sincere, and effortlessly kind. You carry a quiet grace that makes everyone around you feel cared for and seen.",
        whisper: "Grace · Kindness · Calm Heart",
        flowerType: "lily",
        paletteKey: "blue",
        seed: 24,
      },
      {
        id: "orchid",
        name: "Orchid",
        meaning: "My Rare, Precious Love",
        note: "Out of all the billions of stars in the sky, I am so grateful our paths crossed. You are rare, irreplaceable, and endlessly cherished.",
        whisper: "Rare · Precious · One in a Universe",
        flowerType: "orchid",
        paletteKey: "purple",
        seed: 36,
      },
    ],
  },

  /** Shown on the /our-story page. Supported timeline count: min 1, max 12. */
  ourStory: {
    eyebrow: "Written in the Stars",
    heading: "Our Story",
    heroFlowerAria: "Glowing rose-quartz peony bloom for our story",
    quote:
      "“Out of all the quiet chances in this vast universe, finding you is the one I will always be most thankful for.”",
    introParagraph1:
      "This little corner of the sky is for you, my love—a place to remember where we began, how far we have come, and how deeply you mean to me.",
    introParagraph2:
      "Every chapter with you has been gentler, warmer, and brighter than anything I could have imagined on my own.",
    timeline: [
      {
        phase: "Chapter 01",
        title: "How We Met",
        description:
          "It all started on [date we met] at [where we met]. I still remember [first impression of her] and how easy it felt to talk to you.",
      },
      {
        phase: "Chapter 02",
        title: "Our First Moments",
        description:
          "From [our first date or outing] to late-night messages about everything and nothing, you quickly became the best part of my every day.",
      },
      {
        phase: "Chapter 03",
        title: "The Moment I Knew",
        description:
          "When [the moment you knew you loved her], it hit me quietly and all at once: you were the person I wanted beside me for every season.",
      },
      {
        phase: "Chapter 04",
        title: "Where We Are Now",
        description:
          "Today, loving you feels like coming home. Thank you for [something she does that you love] and for walking through life with me.",
      },
    ],
    primaryCta: "VISIT OUR SKY",
    primaryHref: "/solar-system",
    secondaryCta: "OUR MEMORIES",
    secondaryHref: "/our-memories",
  },

  /** Shown on the /love-letters page. Supported count: min 1, max 12. */
  loveLetters: {
    eyebrow: "From My Heart To Yours",
    heading: "Love Letters",
    intro:
      "Whenever you miss me or just want a quiet reminder of how loved you are, open one of these.",
    canvasLabelPrefix: "Glowing flower illustration for",
    letters: [
      {
        id: "letter-ordinary-days",
        date: "[date]",
        tag: "For Any Day",
        noteLabel: "My Love",
        title: "Why You Make Ordinary Days Glow",
        preview:
          "My love, I don't think you realize how much light you bring into small moments. Even a quiet afternoon or a quick text from you makes everything feel softer. Thank you for being my favorite part of every single day.",
        flowerType: "rose",
        paletteKey: "purple",
        seed: 311,
      },
      {
        id: "letter-thank-you",
        date: "[date]",
        tag: "Gratitude",
        noteLabel: "Always",
        title: "Thank You For Being You",
        preview:
          "Thank you for your patience, your warm laugh, and the way you care so deeply. Remembering [a sweet memory of her kindness] still makes my heart full. You never have to be anything other than who you already are.",
        flowerType: "hydrangea",
        paletteKey: "blue",
        seed: 422,
      },
      {
        id: "letter-future",
        date: "[date]",
        tag: "Our Tomorrow",
        noteLabel: "Forever",
        title: "All the Seasons Waiting For Us",
        preview:
          "When I picture the future, you are in every corner of it—slow mornings, [a future dream or place to visit together], and growing older side by side. Wherever life takes us, my hand is yours to hold.",
        flowerType: "lotus",
        paletteKey: "orange",
        seed: 533,
      },
    ],
  },

  /** Shown on the /my-promises page. Supported count: min 1, max 18. */
  myPromises: {
    eyebrow: "Kept Forever",
    heading: "My Promises",
    intro:
      "Six quiet vows I make to you—not just for today, but for every morning and midnight ahead.",
    buttonIdle: "I promise",
    buttonKept: "Kept in my heart",
    statusPrefix: "Promises held close",
    canvasLabelSuffix: "glowing floral emblem",
    items: [
      {
        id: "promise-listen",
        subtitle: "Promise 01",
        title: "I will always listen",
        description:
          "Whether you want to talk for hours or sit in quiet comfort, you will always have my full attention and an open heart.",
        flowerType: "rose",
        paletteKey: "magenta",
        seed: 1001,
      },
      {
        id: "promise-choose",
        subtitle: "Promise 02",
        title: "I will choose you every day",
        description:
          "In the easy days and the tiring ones alike, I will keep choosing you with patience, gentleness, and devotion.",
        flowerType: "lily",
        paletteKey: "blue",
        seed: 1002,
      },
      {
        id: "promise-protect-peace",
        subtitle: "Promise 03",
        title: "I will protect your peace",
        description:
          "I promise to be your safe place—a steady hand when the world feels loud, and a warm home you can always rest in.",
        flowerType: "orchid",
        paletteKey: "purple",
        seed: 1003,
      },
      {
        id: "promise-laugh",
        subtitle: "Promise 04",
        title: "I will keep making you laugh",
        description:
          "Even when we are old and gray, I will still find silly ways to bring out your brightest smile.",
        flowerType: "delphinium",
        paletteKey: "teal",
        seed: 1004,
      },
      {
        id: "promise-cheer",
        subtitle: "Promise 05",
        title: "I will always cheer for you",
        description:
          "Through every dream you chase and every step you take, I will be right beside you, proud of who you are becoming.",
        flowerType: "lotus",
        paletteKey: "gold",
        seed: 1005,
      },
      {
        id: "promise-flowers",
        subtitle: "Promise 06",
        title: "I will never stop courting you",
        description:
          "Little notes, surprise flowers, and date nights—I promise to never let us forget how special it is to have each other.",
        flowerType: "peony",
        paletteKey: "pink",
        seed: 1006,
      },
    ],
  },

  /** Shown on the /write-to-me page. */
  writeToMe: {
    eyebrow: "A Note Across Our Sky",
    heading: "Tell me what's in your heart",
    intro:
      "Leave me a little note, a dream you had, or whatever is on your mind—I always love hearing from you.",
    nameLabel: "Your name",
    namePlaceholder: "My love",
    messageLabel: "Your message to me",
    messagePlaceholder: "Write anything that is in your heart...",
    submitLabel: "Send To My Heart",
    emailSubjectPrefix: "A note from",
    emailFromLabel: "From:",
    submittedTitle: "Your note is ready",
    submittedWithEmail:
      "Your email app should open with your message addressed to me. Thank you for writing to me, my love.",
    submittedWithoutEmail:
      "I will always cherish every word you share with me. (Add CONTACT_EMAIL in lib/content.ts to enable direct mailto sending.)",
    sendAnotherLabel: "Write Another Note",
    sideHeading: "Always Here For You",
    sideMessage:
      "You never need a special occasion to reach for me. Whether it is a happy thought in the middle of the afternoon or a quiet wish at midnight, my heart is always open to you.",
    sideQuote: "“In every sky and every season, it will always be you.”",
  },
};

/** Alias preserved for existing imports across the codebase. */
export const SITE_CONTENT: SiteContent = content;
