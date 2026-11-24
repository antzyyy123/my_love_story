/**
 * Centralized content & personal configuration for Our Cosmos.
 * Edit the constants and text below to personalize every page.
 */

import type { COSMIC_PALETTES, FlowerType } from "./flowers";

// ============================================================================
// PERSONAL CONSTANTS — FILL THESE IN BEFORE PUBLISHING
// ============================================================================

/**
 * TODO: Set your anniversary date in "YYYY-MM-DD" format (e.g., "2023-06-14").
 * While empty (""), the "Together for X days" counter in the footer stays hidden.
 */
export const TOGETHER_SINCE = "";

/**
 * TODO: Set your email address (e.g., "you@example.com") for the "Write To Me" form.
 * While empty (""), the mailto: action is hidden gracefully and a warm note is shown instead.
 */
export const CONTACT_EMAIL = "";

/**
 * TODO: Optional social links for the footer. Any empty link ("") is hidden automatically.
 */
export const SOCIAL_LINKS = {
  instagram: "",
  facebook: "",
  pinterest: "",
};

// ============================================================================
// SITE-WIDE BRAND, METADATA & NAVIGATION
// ============================================================================

export const SITE_CONTENT = {
  brand: {
    logo: "OUR COSMOS",
    footerLeft: "Made with love, for you",
    skipToContent: "Skip to main content",
  },

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
  // HOME PAGE
  // ==========================================================================
  home: {
    titleLine1: "YOU ARE",
    titleLine2: "MY UNIVERSE",
    subtitle: "A GALAXY IN BLOOM, MADE ONLY FOR YOU",
    ctaLabel: "ENTER OUR GALAXY",
    ctaAriaLabel: "Enter our galaxy and explore our sky of memories",
    canvasAriaLabel:
      "A spiral galaxy of glowing flower petals, tiny blooms, and stars created for you",
  },

  // ==========================================================================
  // SOLAR SYSTEM PAGE (/solar-system)
  // ==========================================================================
  solarSystem: {
    backButton: "BACK TO OUR GALAXY",
    hintMobile: "TAP A PLANET TO OPEN A MEMORY",
    hintDesktop: "TAP A PLANET TO OPEN A MEMORY",
    openMemoryCta: "Open this memory",
    openMemoryHref: "/our-memories",
    backToSystemCta: "Back to our sky",
    canvasAriaLabel:
      "Our botanical solar system with you as the glowing golden sun at the center and eight orbiting worlds of memories and promises",
    sun: {
      id: "solar-sun",
      isSun: true,
      name: "My Sun",
      subtitle: "The Brightest Bloom in My Universe",
      description:
        "Everything in my world turns gently around you. Your warmth lights up even my quietest days, and you will always be the brightest bloom in my universe.",
      detailLabel1: "Meaning",
      detailValue1: "My Light & Warmth",
      detailLabel2: "Always",
      detailValue2: "Center of My Sky",
    },
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
  // OUR MEMORIES (was Galaxy Gallery)
  // ==========================================================================
  ourMemories: {
    eyebrow: "Kept Like Stars",
    heading: "Our Memories",
    intro:
      "Six moments I hold close to my heart—each one waiting for our favorite photos.",
    items: [
      {
        id: "memory-1",
        title: "The Day Everything Started",
        date: "[date]",
        caption: "The first time I saw you at [place] and couldn't stop smiling.",
        flowerType: "rose" as FlowerType,
        paletteKey: "magenta" as keyof typeof COSMIC_PALETTES,
        seed: 101,
      },
      {
        id: "memory-2",
        title: "Our First Date",
        date: "[date]",
        caption: "Talking for hours at [place] until we lost track of time.",
        flowerType: "delphinium" as FlowerType,
        paletteKey: "blue" as keyof typeof COSMIC_PALETTES,
        seed: 202,
      },
      {
        id: "memory-3",
        title: "A Walk Under the Evening Sky",
        date: "[date]",
        caption: "Walking hand in hand at [favorite walk or spot] with nowhere to rush.",
        flowerType: "lily" as FlowerType,
        paletteKey: "teal" as keyof typeof COSMIC_PALETTES,
        seed: 303,
      },
      {
        id: "memory-4",
        title: "Laughing Until We Cried",
        date: "[date]",
        caption: "Remembering [inside joke or funny moment]—still my favorite sound.",
        flowerType: "orchid" as FlowerType,
        paletteKey: "purple" as keyof typeof COSMIC_PALETTES,
        seed: 404,
      },
      {
        id: "memory-5",
        title: "Our Cozy Rainy Day",
        date: "[date]",
        caption: "Sharing [favorite food or movie together] while the rain tapped outside.",
        flowerType: "hydrangea" as FlowerType,
        paletteKey: "violet" as keyof typeof COSMIC_PALETTES,
        seed: 505,
      },
      {
        id: "memory-6",
        title: "My Favorite Photo of You",
        date: "[date]",
        caption: "The moment at [place] where you looked so effortlessly happy.",
        flowerType: "lotus" as FlowerType,
        paletteKey: "gold" as keyof typeof COSMIC_PALETTES,
        seed: 606,
      },
    ],
  },

  // ==========================================================================
  // FLOWERS FOR YOU (was Botanical Collections)
  // ==========================================================================
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
        flowerType: "rose" as FlowerType,
        paletteKey: "magenta" as keyof typeof COSMIC_PALETTES,
        seed: 12,
      },
      {
        id: "sunflower",
        name: "Sunflower",
        meaning: "You Light Up My Days",
        note: "Just like a sunflower turns toward the light, my heart always finds its way to you. One smile from you turns any heavy day golden.",
        whisper: "Sunlight · Joy · Brightest Bloom",
        flowerType: "lotus" as FlowerType,
        paletteKey: "gold" as keyof typeof COSMIC_PALETTES,
        seed: 48,
      },
      {
        id: "lily",
        name: "Lily",
        meaning: "You Are Pure & Graceful",
        note: "Gentle, sincere, and effortlessly kind. You carry a quiet grace that makes everyone around you feel cared for and seen.",
        whisper: "Grace · Kindness · Calm Heart",
        flowerType: "lily" as FlowerType,
        paletteKey: "blue" as keyof typeof COSMIC_PALETTES,
        seed: 24,
      },
      {
        id: "orchid",
        name: "Orchid",
        meaning: "My Rare, Precious Love",
        note: "Out of all the billions of stars in the sky, I am so grateful our paths crossed. You are rare, irreplaceable, and endlessly cherished.",
        whisper: "Rare · Precious · One in a Universe",
        flowerType: "orchid" as FlowerType,
        paletteKey: "purple" as keyof typeof COSMIC_PALETTES,
        seed: 36,
      },
    ],
  },

  // ==========================================================================
  // OUR STORY (was About)
  // ==========================================================================
  ourStory: {
    eyebrow: "Written in the Stars",
    heading: "Our Story",
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

  // ==========================================================================
  // LOVE LETTERS (was Blog)
  // ==========================================================================
  loveLetters: {
    eyebrow: "From My Heart To Yours",
    heading: "Love Letters",
    intro:
      "Whenever you miss me or just want a quiet reminder of how loved you are, open one of these.",
    letters: [
      {
        id: "letter-ordinary-days",
        date: "[date]",
        tag: "For Any Day",
        noteLabel: "My Love",
        title: "Why You Make Ordinary Days Glow",
        preview:
          "My love, I don't think you realize how much light you bring into small moments. Even a quiet afternoon or a quick text from you makes everything feel softer. Thank you for being my favorite part of every single day.",
        flowerType: "rose" as FlowerType,
        paletteKey: "purple" as keyof typeof COSMIC_PALETTES,
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
        flowerType: "hydrangea" as FlowerType,
        paletteKey: "blue" as keyof typeof COSMIC_PALETTES,
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
        flowerType: "lotus" as FlowerType,
        paletteKey: "orange" as keyof typeof COSMIC_PALETTES,
        seed: 533,
      },
    ],
  },

  // ==========================================================================
  // MY PROMISES (was Shop — NO prices, NO cart, NO checkout)
  // ==========================================================================
  myPromises: {
    eyebrow: "Kept Forever",
    heading: "My Promises",
    intro:
      "Six quiet vows I make to you—not just for today, but for every morning and midnight ahead.",
    buttonIdle: "I promise",
    buttonKept: "Kept in my heart",
    statusPrefix: "Promises held close",
    items: [
      {
        id: "promise-listen",
        subtitle: "Promise 01",
        title: "I will always listen",
        description:
          "Whether you want to talk for hours or sit in quiet comfort, you will always have my full attention and an open heart.",
        flowerType: "rose" as FlowerType,
        paletteKey: "magenta" as keyof typeof COSMIC_PALETTES,
        seed: 1001,
      },
      {
        id: "promise-choose",
        subtitle: "Promise 02",
        title: "I will choose you every day",
        description:
          "In the easy days and the tiring ones alike, I will keep choosing you with patience, gentleness, and devotion.",
        flowerType: "lily" as FlowerType,
        paletteKey: "blue" as keyof typeof COSMIC_PALETTES,
        seed: 1002,
      },
      {
        id: "promise-protect-peace",
        subtitle: "Promise 03",
        title: "I will protect your peace",
        description:
          "I promise to be your safe place—a steady hand when the world feels loud, and a warm home you can always rest in.",
        flowerType: "orchid" as FlowerType,
        paletteKey: "purple" as keyof typeof COSMIC_PALETTES,
        seed: 1003,
      },
      {
        id: "promise-laugh",
        subtitle: "Promise 04",
        title: "I will keep making you laugh",
        description:
          "Even when we are old and gray, I will still find silly ways to bring out your brightest smile.",
        flowerType: "delphinium" as FlowerType,
        paletteKey: "teal" as keyof typeof COSMIC_PALETTES,
        seed: 1004,
      },
      {
        id: "promise-cheer",
        subtitle: "Promise 05",
        title: "I will always cheer for you",
        description:
          "Through every dream you chase and every step you take, I will be right beside you, proud of who you are becoming.",
        flowerType: "lotus" as FlowerType,
        paletteKey: "gold" as keyof typeof COSMIC_PALETTES,
        seed: 1005,
      },
      {
        id: "promise-flowers",
        subtitle: "Promise 06",
        title: "I will never stop courting you",
        description:
          "Little notes, surprise flowers, and date nights—I promise to never let us forget how special it is to have each other.",
        flowerType: "peony" as FlowerType,
        paletteKey: "pink" as keyof typeof COSMIC_PALETTES,
        seed: 1006,
      },
    ],
  },

  // ==========================================================================
  // WRITE TO ME (was Contact)
  // ==========================================================================
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

  // ==========================================================================
  // SUN WINDOW — INTERACTIVE GROWING FLOWER PARTS
  // ==========================================================================
  sunFlower: {
    hint: "Tap a part of the flower",
    inspectHint: "Click the flower parts to inspect",
    question: "Do you like it, my love?",
    yesLabel: "Yes",
    noLabel: "No",
    yesAriaLabel: "Yes, I like the flower",
    noAriaLabel: "No, I do not like the flower",
    skipLabel: "Skip",
    replayLabel: "Grow again",
    closeCardAriaLabel: "Close flower part description",
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
  // MY SAFE PLACE (YELLOW PLANET) — INTERACTIVE STORM-TO-CALM SCENE
  // ==========================================================================
  safePlace: {
    eyebrow: "HOME IN YOUR ARMS",
    title: "My Safe Place",
    holdHint: "Hold to warm the night",
    reducedMotionHint: "Tap to warm the night",
    holdAriaLabel: "Hold to warm the night and calm the storm",
    replayLabel: "Replay the storm",
    messageLine1:
      "With you, I never have to pretend or hurry. Your kindness and patience have made your side my truest home.",
    messageLine2:
      "I still remember [a real memory of a time she made me feel safe], and how everything heavy faded the moment you were near.",
    canvasAriaLabel:
      "A stormy cosmic night over a quiet hill with a tiny glowing home that warms into a calm starry garden as you hold",
  },

  // ==========================================================================
  // OUR FIRST DATE — LANTERN FESTIVAL LAKE SCENE
  // ==========================================================================
  firstDate: {
    eyebrow: "OUR FIRST DATE",
    title: "Our First Date",
    subtitle: "A Memory I Keep Close",
    hint: "Tap the sky or the water to release a lantern",
    releaseButtonLabel: "Release a lantern",
    releaseMoreLabel: "Release more",
    messageLine1:
      "Hours passed like minutes beside you that night, and every small laugh felt like a lantern lighting up the dark.",
    messageLine2:
      "I will never forget [the moment I knew I wanted more dates with you].",
    canvasAriaLabel:
      "A warm night at a lantern festival beside a calm lake with a glowing moon, a wooden dock, and floating lanterns carrying memories of our first date",
    memories: [
      "[Where we met that night]",
      "[The first thing you said to me]",
      "[What we ate]",
      "[The song that was playing]",
      "[The moment we laughed the hardest]",
      "[The walk home]",
      "[When I realized I did not want the night to end]",
      "[What I felt when I got home]",
    ],
  },

  // ==========================================================================
  // THE DAY WE MET — TWO STARS & CONSTELLATION OF US
  // ==========================================================================
  dayWeMet: {
    eyebrow: "THE DAY WE MET",
    title: "The Day We Met",
    subtitle: "Where Our Universe Began",
    hint: "Bring the two stars together",
    reducedMotionHint: "Tap to bring the two stars together",
    bringTogetherLabel: "Bring them together",
    replayLabel: "Bring them together again",
    messageLine1:
      "Out of billions of quiet lights drifting across the dark, somehow our paths curved toward each other.",
    messageLine2:
      "I still hold onto [what I remember most about that first moment], like the first star that turned my whole sky bright.",
    canvasAriaLabel:
      "A deep cosmic sky with two drifting stars—gold and rose—that merge when brought together to ignite the constellation of our story",
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

  // ==========================================================================
  // YOUR LAUGH — MUSICAL NIGHT POND GARDEN
  // ==========================================================================
  yourLaugh: {
    eyebrow: "YOUR LAUGH",
    title: "Your Laugh",
    subtitle: "My Favorite Sound",
    hintTouch: "Touch the flowers",
    hintKeep: "Keep playing",
    keepPlayingLabel: "Keep playing",
    soundOnAriaLabel: "Sound on — click to mute",
    soundOffAriaLabel: "Sound muted — click to unmute",
    messageLine1:
      "Your laugh is my favorite music in the whole universe—bright, effortless, and able to turn any quiet night into pure joy.",
    messageLine2:
      "I still smile whenever I think of [the moment you laughed that I'll never forget].",
    canvasAriaLabel:
      "A glowing night garden by a calm pond with twelve musical bell-shaped flowers that chime and shimmer when touched",
  },
} as const;
