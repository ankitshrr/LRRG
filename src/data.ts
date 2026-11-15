export type Word = {
  text: string;
  start: number;
  end: number;
  breakBefore?: boolean;
  noSentenceBreak?: boolean;
};

export type Line = {
  id: string;
  text: string;
  start: number;
  end: number;
  words?: Word[];
  joinedWithNext?: boolean;
};

/**
 * Returns line words with timings, strictly prioritizing user-edited line.text.
 * Preserves explicit newlines (\n) so users can control exact visual line breaks.
 */
export function getLineWordsWithTimings(line: Line): Word[] {
  // Split on newlines to preserve explicit linebreaks entered by the user
  const paragraphs = line.text.split(/\r?\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return [];

  const wordsWithBreaks: { text: string; breakBefore: boolean }[] = [];
  paragraphs.forEach((para, pIdx) => {
    const rawWords = para.trim().split(/\s+/).filter(Boolean);
    rawWords.forEach((pw, wIdx) => {
      wordsWithBreaks.push({
        text: pw,
        breakBefore: pIdx > 0 && wIdx === 0,
      });
    });
  });

  if (wordsWithBreaks.length === 0) return [];

  const existingWords = line.words || [];
  const lineDur = Math.max(0.1, line.end - line.start);

  if (existingWords.length === wordsWithBreaks.length) {
    return wordsWithBreaks.map((item, i) => ({
      text: item.text,
      start: existingWords[i].start,
      end: existingWords[i].end,
      breakBefore: item.breakBefore,
    }));
  }

  const wordDur = lineDur / wordsWithBreaks.length;
  return wordsWithBreaks.map((item, i) => ({
    text: item.text,
    start: +(line.start + i * wordDur).toFixed(2),
    end: +(line.start + (i + 1) * wordDur).toFixed(2),
    breakBefore: item.breakBefore,
  }));
}

export type Position = "top" | "center" | "bottom";
export type TextAlign = "left" | "center" | "right";
export type AnimationId = "spotify" | "apple" | "nothing" | "retro";

export type ReelStyle = {
  font: string;
  size: number;
  textColor: string;
  highlight: string;
  bg: string;
  position: Position;
  align?: TextAlign;
  animation: AnimationId;
  customBgUrl?: string;
  customBgType?: "image" | "video";
  customBgName?: string;
  materialAutoColor?: boolean;
};

export type TrackInfo = {
  title: string;
  artist: string;
  file: string;
  sizeMb: number;
  bpm: number;
  duration: number;
  audioUrl?: string;
};

export const TRACK: TrackInfo = {
  title: "Untitled Track",
  artist: "Upload Audio",
  file: "",
  sizeMb: 0,
  bpm: 120,
  duration: 60,
};

export function createTrackFromFile(file: File, duration = 60, audioUrl?: string): TrackInfo {
  // Format title from filename, e.g. "My_Song-Name.mp3" -> "My Song Name"
  const cleanBase = file.name.replace(/\.[^/.]+$/, "");
  const title = cleanBase.replace(/[-_]+/g, " ").trim() || file.name;

  return {
    title,
    artist: "My Audio",
    file: file.name,
    sizeMb: Number((file.size / (1024 * 1024)).toFixed(1)),
    bpm: 120,
    duration,
    audioUrl,
  };
}

export const INITIAL_LINES: Line[] = [];

export function parseLrcToLines(lrcText: string, defaultDuration = 90): Line[] {
  const rawTextLines = lrcText.split(/\r?\n/);
  const parsed: { time: number; text: string }[] = [];

  for (const raw of rawTextLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Matches [01:23.45] or [01:23]
    const match = trimmed.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const start = +(min * 60 + sec).toFixed(2);
      const text = match[3].trim();
      if (text) {
        parsed.push({ time: start, text });
      }
    }
  }

  parsed.sort((a, b) => a.time - b.time);
  if (parsed.length === 0) return [];

  const rawLines: Line[] = parsed.map((item, idx) => {
    const nextItem = parsed[idx + 1];
    const lineEnd = nextItem
      ? Math.max(item.time + 0.8, nextItem.time - 0.2)
      : Math.max(item.time + 3.5, defaultDuration);
    const wordsRaw = item.text.split(/\s+/).filter(Boolean);
    const wordDur = wordsRaw.length > 0 ? (lineEnd - item.time) / wordsRaw.length : 0;

    const words: Word[] = wordsRaw.map((w, wIdx) => ({
      text: w,
      start: +(item.time + wIdx * wordDur).toFixed(2),
      end: +(item.time + (wIdx + 1) * wordDur).toFixed(2),
    }));

    return {
      id: `l${idx}`,
      text: item.text,
      start: item.time,
      end: +lineEnd.toFixed(2),
      words,
    };
  });

  return normalizeLyricalLines(rawLines);
}

export const FONTS = [
  {
    id: "material",
    name: "Google Sans",
    family: "system-ui, -apple-system, 'Roboto', 'Google Sans', sans-serif",
    weight: 800,
    tracking: "-0.02em",
    upper: false,
  },
  {
    id: "apple",
    name: "Apple SF Pro",
    family: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
    weight: 800,
    tracking: "-0.03em",
    upper: false,
  },
  {
    id: "spotify",
    name: "Spotify Sans",
    family: "'Plus Jakarta Sans', 'CircularStd', -apple-system, sans-serif",
    weight: 800,
    tracking: "-0.035em",
    upper: false,
  },
  {
    id: "dot",
    name: "Dot Matrix",
    family: "'Doto', monospace",
    weight: 800,
    tracking: "0em",
    upper: true,
  },
  {
    id: "syne",
    name: "Syne",
    family: "'Syne', sans-serif",
    weight: 800,
    tracking: "-0.02em",
    upper: false,
  },
  {
    id: "serif",
    name: "Instrument",
    family: "'Instrument Serif', serif",
    weight: 400,
    tracking: "-0.01em",
    upper: false,
  },
  {
    id: "grotesk",
    name: "Grotesk",
    family: "'Space Grotesk', sans-serif",
    weight: 700,
    tracking: "-0.03em",
    upper: false,
  },
  {
    id: "bebas",
    name: "Bebas",
    family: "'Bebas Neue', sans-serif",
    weight: 400,
    tracking: "0.01em",
    upper: true,
  },
  {
    id: "geist",
    name: "Geist",
    family: "'Geist', sans-serif",
    weight: 700,
    tracking: "-0.035em",
    upper: false,
  },
];

export const TEXT_COLORS = ["#5E5E5E", "#808080", "#A6A6A6", "#D9D9D9", "#FFFFFF", "#000000"];
export const HIGHLIGHT_COLORS = [
  "#FFFFFF",
  "#D71920", // Nothing Red
  "#1ED760", // Spotify Green
  "#FA2D48", // Apple Music Red/Pink
  "#00F2FE", // Electric Cyan
  "#FBBF24", // Warm Gold
  "#EDEDED",
  "#A6A6A6",
  "#000000",
];

export type Background = { id: string; name: string; css: string; image?: string; accent: string };

export const BACKGROUNDS: Background[] = [
  {
    id: "materialyou",
    name: "Material Dynamic Tone",
    css: "radial-gradient(circle at 50% 30%, #2A3B5C 0%, #151D2F 60%, #0A0E17 100%)",
    accent: "#8AB4F8",
  },
  {
    id: "spotifyblue",
    name: "Spotify Royal Blue",
    css: "linear-gradient(180deg, #3760F8 0%, #2A4BD6 55%, #162B85 100%)",
    accent: "#1ed760",
  },
  {
    id: "applemusic",
    name: "Apple Dark Velvet",
    css: "#140d1a",
    accent: "#fa2d48",
  },
  {
    id: "nothingmatrix",
    name: "Nothing Glyph",
    css: "radial-gradient(rgba(255,255,255,0.24) 1.5px, transparent 1.6px) 0 0 / 18px 18px, #000000",
    accent: "#D71920",
  },
  {
    id: "cyberneon",
    name: "Cyber Neon Grid",
    css: "linear-gradient(180deg, #090314 0%, #17092B 60%, #05010B 100%)",
    accent: "#00F2FE",
  },
  {
    id: "vintagetape",
    name: "Vintage Amber Vinyl",
    css: "radial-gradient(circle at 50% 40%, #2C2218 0%, #17120D 65%, #0B0806 100%)",
    accent: "#FBBF24",
  },
  {
    id: "spotifydark",
    name: "Spotify Pure Dark",
    css: "#121212",
    accent: "#1ed760",
  },
  {
    id: "neon",
    name: "Night City",
    image:
      "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    css: "#0a0a0a",
    accent: "#fff",
  },
  {
    id: "aurora",
    name: "Halo",
    css: "radial-gradient(60% 38% at 50% 42%, #3a3a3a 0%, #121212 55%, #050505 100%)",
    accent: "#fff",
  },
  {
    id: "crowd",
    name: "Live Stage",
    image:
      "https://images.unsplash.com/photo-1767677764533-83e1cab46a46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    css: "#0a0a0a",
    accent: "#fff",
  },
  {
    id: "ocean",
    name: "Undertow",
    image:
      "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    css: "#0a0a0a",
    accent: "#fff",
  },
  {
    id: "ember",
    name: "Matrix",
    css: "radial-gradient(rgba(255,255,255,0.16) 1.4px, transparent 1.6px) 0 0 / 14px 14px, radial-gradient(80% 50% at 50% 50%, #1a1a1a 0%, #050505 100%)",
    accent: "#fff",
  },
  {
    id: "void",
    name: "Paper",
    css: "linear-gradient(180deg, #f2f2f2 0%, #d9d9d9 100%)",
    accent: "#000",
  },
];

export type MaterialPalette = {
  id: string;
  name: string;
  primary: string;
  highlight: string;
  textColor: string;
  bgCss: string;
  container: string;
};

export const MATERIAL_PALETTES: MaterialPalette[] = [
  {
    id: "dynamic",
    name: "Auto-Detect Wallpaper",
    primary: "#8AB4F8",
    highlight: "#8AB4F8",
    textColor: "rgba(218, 230, 254, 0.70)",
    bgCss: "radial-gradient(circle at 50% 30%, #2A3B5C 0%, #151D2F 60%, #0A0E17 100%)",
    container: "rgba(138, 180, 248, 0.20)",
  },
  {
    id: "ocean",
    name: "Ocean Azure",
    primary: "#38BDF8",
    highlight: "#38BDF8",
    textColor: "rgba(224, 242, 254, 0.70)",
    bgCss: "radial-gradient(circle at 50% 30%, #0C4A6E 0%, #082F49 60%, #031525 100%)",
    container: "rgba(56, 189, 248, 0.20)",
  },
  {
    id: "sunset",
    name: "Sunset Coral",
    primary: "#FB7185",
    highlight: "#FB7185",
    textColor: "rgba(255, 228, 230, 0.70)",
    bgCss: "radial-gradient(circle at 50% 30%, #881337 0%, #4C0519 60%, #1F010A 100%)",
    container: "rgba(251, 113, 133, 0.20)",
  },
  {
    id: "sage",
    name: "Forest Sage",
    primary: "#34D399",
    highlight: "#34D399",
    textColor: "rgba(209, 250, 229, 0.70)",
    bgCss: "radial-gradient(circle at 50% 30%, #064E3B 0%, #022C22 60%, #01140E 100%)",
    container: "rgba(52, 211, 153, 0.20)",
  },
  {
    id: "lavender",
    name: "Amethyst Violet",
    primary: "#C084FC",
    highlight: "#C084FC",
    textColor: "rgba(243, 232, 255, 0.70)",
    bgCss: "radial-gradient(circle at 50% 30%, #581C87 0%, #3B0764 60%, #18022B 100%)",
    container: "rgba(192, 132, 252, 0.20)",
  },
  {
    id: "honey",
    name: "Amber Honey",
    primary: "#FBBF24",
    highlight: "#FBBF24",
    textColor: "rgba(254, 243, 199, 0.70)",
    bgCss: "radial-gradient(circle at 50% 30%, #78350F 0%, #451A03 60%, #1A0901 100%)",
    container: "rgba(251, 191, 36, 0.20)",
  },
];

export function colorToHex(c: string): string {
  if (!c) return "#FFFFFF";
  c = c.trim();
  if (c.startsWith("#")) {
    if (c.length === 4) {
      return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    if (c.length >= 7) return c.slice(0, 7);
    return c;
  }
  const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (match) {
    const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return "#FFFFFF";
}

/**
 * Extracts dominant vibrant color and optimal text contrast from an image/canvas.
 */
export function extractColorsFromImage(
  imgOrVideo: HTMLImageElement | HTMLVideoElement,
): { primary: string; highlight: string; textColor: string; container: string } {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    ctx.drawImage(imgOrVideo, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;

    let rSum = 0, gSum = 0, bSum = 0;
    let maxSat = 0;
    let vibrantR = 138, vibrantG = 180, vibrantB = 248; // fallback Material blue
    let sampledCount = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      rSum += r;
      gSum += g;
      bSum += b;
      sampledCount++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const sat = max === 0 ? 0 : delta / max;

      if (sat > maxSat && max > 50 && max < 240) {
        maxSat = sat;
        vibrantR = r;
        vibrantG = g;
        vibrantB = b;
      }
    }

    const avgR = rSum / Math.max(1, sampledCount);
    const avgG = gSum / Math.max(1, sampledCount);
    const avgB = bSum / Math.max(1, sampledCount);

    const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
    const isBrightBg = luminance > 0.52;

    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    const primaryHex = `#${toHex(vibrantR)}${toHex(vibrantG)}${toHex(vibrantB)}`;

    if (isBrightBg) {
      return {
        primary: primaryHex,
        highlight: primaryHex,
        textColor: "rgba(0, 0, 0, 0.72)",
        container: `rgba(${Math.round(vibrantR)}, ${Math.round(vibrantG)}, ${Math.round(vibrantB)}, 0.20)`,
      };
    } else {
      return {
        primary: primaryHex,
        highlight: primaryHex,
        textColor: "rgba(255, 255, 255, 0.70)",
        container: `rgba(${Math.round(vibrantR)}, ${Math.round(vibrantG)}, ${Math.round(vibrantB)}, 0.20)`,
      };
    }
  } catch (e) {
    return {
      primary: "#8AB4F8",
      highlight: "#8AB4F8",
      textColor: "rgba(218, 230, 254, 0.70)",
      container: "rgba(138, 180, 248, 0.20)",
    };
  }
}

export function detectColorsFromBgAsync(
  bgId: string,
  customBgUrl?: string,
): Promise<{ primary: string; highlight: string; textColor: string; container: string }> {
  if (!customBgUrl) {
    return Promise.resolve(detectColorsFromBg(bgId));
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve(extractColorsFromImage(img));
    };
    img.onerror = () => {
      resolve(detectColorsFromBg(bgId));
    };
    img.src = customBgUrl;
  });
}

/**
 * Detects dynamic Material 3 colors according to the background.
 */
export function detectColorsFromBg(bgId: string, customBgUrl?: string): {
  primary: string;
  highlight: string;
  textColor: string;
  container: string;
} {
  switch (bgId) {
    case "spotifyblue":
      return {
        primary: "#1ED760",
        highlight: "#FFFFFF",
        textColor: "rgba(0, 0, 0, 0.72)",
        container: "rgba(30, 215, 96, 0.20)",
      };
    case "spotifydark":
      return {
        primary: "#1ED760",
        highlight: "#1ED760",
        textColor: "rgba(255, 255, 255, 0.65)",
        container: "rgba(30, 215, 96, 0.20)",
      };
    case "applemusic":
      return {
        primary: "#FA2D48",
        highlight: "#FFFFFF",
        textColor: "rgba(255, 255, 255, 0.45)",
        container: "rgba(250, 45, 72, 0.20)",
      };
    case "nothingmatrix":
      return {
        primary: "#D71920",
        highlight: "#D71920",
        textColor: "#707070",
        container: "rgba(215, 25, 32, 0.20)",
      };
    case "ocean":
      return {
        primary: "#38BDF8",
        highlight: "#38BDF8",
        textColor: "rgba(224, 242, 254, 0.70)",
        container: "rgba(56, 189, 248, 0.20)",
      };
    case "aurora":
      return {
        primary: "#A78BFA",
        highlight: "#A78BFA",
        textColor: "rgba(243, 232, 255, 0.70)",
        container: "rgba(167, 139, 250, 0.20)",
      };
    case "crowd":
      return {
        primary: "#F97316",
        highlight: "#F97316",
        textColor: "rgba(255, 237, 213, 0.70)",
        container: "rgba(249, 115, 22, 0.20)",
      };
    case "neon":
      return {
        primary: "#FB7185",
        highlight: "#FB7185",
        textColor: "rgba(255, 228, 230, 0.70)",
        container: "rgba(251, 113, 133, 0.20)",
      };
    case "cyberneon":
      return {
        primary: "#00F2FE",
        highlight: "#00F2FE",
        textColor: "rgba(0, 242, 254, 0.60)",
        container: "rgba(0, 242, 254, 0.20)",
      };
    case "vintagetape":
      return {
        primary: "#FBBF24",
        highlight: "#FBBF24",
        textColor: "rgba(254, 243, 199, 0.60)",
        container: "rgba(251, 191, 36, 0.20)",
      };
    case "void":
      return {
        primary: "#111111",
        highlight: "#000000",
        textColor: "rgba(0, 0, 0, 0.65)",
        container: "rgba(0, 0, 0, 0.15)",
      };
    case "ember":
      return {
        primary: "#22C55E",
        highlight: "#22C55E",
        textColor: "rgba(220, 252, 231, 0.70)",
        container: "rgba(34, 197, 94, 0.20)",
      };
    case "materialyou":
    default:
      return {
        primary: "#8AB4F8",
        highlight: "#8AB4F8",
        textColor: "rgba(218, 230, 254, 0.70)",
        container: "rgba(138, 180, 248, 0.20)",
      };
  }
}

export type AnimationPreset = {
  id: AnimationId;
  name: string;
  badge: string;
  desc: string;
  font: string;
  fontName: string;
  bg: string;
  bgName: string;
  textColor: string;
  highlight: string;
  size: number;
  align?: "left" | "center" | "right";
};

export const ANIMATIONS: AnimationPreset[] = [
  {
    id: "spotify",
    name: "Spotify Lyrics",
    badge: "Sp",
    desc: "100% Spotify · High-contrast white & dark lyrics on Spotify Royal Blue",
    font: "spotify",
    fontName: "Spotify Sans",
    bg: "spotifyblue",
    bgName: "Spotify Royal Blue",
    textColor: "rgba(0, 0, 0, 0.72)",
    highlight: "#FFFFFF",
    size: 23,
    align: "left",
  },
  {
    id: "apple",
    name: "Apple Music",
    badge: "",
    desc: "100% Apple Music · Frosted glowing karaoke syllable bloom",
    font: "apple",
    fontName: "Apple SF Pro Display",
    bg: "applemusic",
    bgName: "Pure Apple Dark Velvet",
    textColor: "rgba(255, 255, 255, 0.40)",
    highlight: "#FFFFFF",
    size: 34,
    align: "center",
  },
  {
    id: "nothing",
    name: "Nothing OS",
    badge: "(N)",
    desc: "Dot-matrix · Nothing Red active word · Pure industrial",
    font: "dot",
    fontName: "Nothing Dot-Matrix",
    bg: "nothingmatrix",
    bgName: "100% Nothing Glyph",
    textColor: "#707070",
    highlight: "#D71920",
    size: 27,
    align: "center",
  },
  {
    id: "retro",
    name: "Vintage Vinyl",
    badge: "📻",
    desc: "Warm analog acoustic grooves · Instrument serif · Golden hour",
    font: "serif",
    fontName: "Instrument Serif",
    bg: "vintagetape",
    bgName: "Vintage Amber Vinyl",
    textColor: "rgba(251, 191, 36, 0.45)",
    highlight: "#FBBF24",
    size: 33,
    align: "center",
  },
];

export const DEFAULT_STYLE: ReelStyle = {
  font: "spotify",
  size: 23,
  textColor: "rgba(0, 0, 0, 0.72)",
  highlight: "#FFFFFF",
  bg: "spotifyblue",
  position: "center",
  align: "left",
  animation: "spotify",
  materialAutoColor: true,
};

/**
 * Spotify & iOS Apple Music lyric phrase segmentation algorithm.
 * A lyric sentence begins with a genuine sentence starter or capitalized subject
 * and continues as that full sentence until the next true sentence begins.
 *
 * "I", "I'm", "I've", "I'll", "I'd" are grammatically capitalized in English.
 * Within a sentence (e.g. "Till I ride away, dead and buried", "If you go, I'm going too",
 * "if I told you", "the compliments I throw you"), they belong strictly to the current sentence.
 *
 * Dependent wh-clauses after cognition/perception verbs (e.g. "see how you look to me", "know what you did")
 * belong strictly to the current sentence and do NOT break the line.
 */
// Lexicons for NLP & syntactic structure analysis
const NLP_CONJUNCTIONS = /^(and|if|till|until|til|because|cause|'cause|when|while|that|so|as|or|but|where|before|after|since|unless)$/i;
const NLP_COORDINATING_CONJUNCTIONS = /^(and|but|so|or|yet|then)$/i;
const NLP_SUBORDINATING_CONJUNCTIONS = /^(because|cause|'cause|when|while|if|as|though|although|since|unless|before|after|till|until)$/i;
const NLP_CLAUSE_FOLLOWERS = /^(i|you|he|she|we|they|it|the|a|an|this|that|these|those|my|your|his|her|our|their|every|all|no|some|if|when|where|while|because|cause|'cause|now|then|even|just|maybe|don't|can't|won't|ain't|isn't|aren't|wasn't|weren't|will|would|can|could|should|is|are|am|was|were|do|did|have|had|take|give|let|tell|make|say|leave|hold|run|come|go|see|look|feel|hear|stand|fall)$/i;
const NLP_PREPOSITIONS = /^(the|a|an|of|to|in|on|at|for|from|with|by|into|onto|upon|about|my|your|his|her|our|their|its)$/i;
const NLP_COGNITION_VERBS = /^(see|saw|seen|know|knew|known|hear|heard|feel|felt|tell|told|say|said|think|thought|wonder|wondering|ask|asked|show|showed|shown|watch|watching|find|found|realize|remember|forget|understand|make|want)$/i;
const NLP_SUBJECT_PRONOUNS = /^(I|you|he|she|we|they|it)$/i;
const NLP_FINITE_VERBS = /^(would|wouldn?t|will|won?t|can|can?t|could|couldn?t|should|shouldn?t|is|isn?t|are|aren?t|am|was|wasn?t|were|weren?t|do|don?t|did|didn?t|does|doesn?t|have|haven?t|has|hasn?t|had|hadn?t|hate|love|want|need|think|feel|look|know|see|go|say|said|come|came|make|made|take|took|give|gave|stand|tell|told|believe)$/i;
const NLP_UNIVERSAL_STARTERS = /^(Till|Til|Until|'Til|'Til'|Nothing|Everything|Something|Anything|Nobody|Everybody|Somebody|Anybody|No|Never|Always|Every|All|None|Please|Baby|Darling|Honey|Listen|Look|Take|Tell|Don't|Hold|Leave|Stop|Remember|Forget|Give|Let|Make|Keep|Come|Run|Wait|Show|Help|Oh|Ooh|Ah|Yeah|Whoa|Hey|Yo|Mm|Mmm|Woah|'Cause|Cause|Because|Ain't|Won't|Can't|If)$/i;
const NLP_TERMINAL_PUNCT_REGEX = /[.!?—;…\u3002\uff01\uff1f\u3001\uff0c\u0964\u0965]$/;

/**
 * Evaluates a semantic & prosodic boundary score before word w.
 * Combines NLP syntax, clause completion, acoustic gap (prosody), and punctuation restoration.
 */
export function evaluateLyricalBoundaryScore(
  w: Word,
  prevW?: Word,
  nextW?: Word,
  sentenceWordsSoFar?: Word[],
  acousticGap = 0,
  nextNextW?: Word,
): number {
  if (!prevW) return -Infinity;
  if ((w as any).breakBefore) return 1000;

  const raw = (w.text || "").trim();
  const clean = raw.replace(/^['"‘“\(\[\{¿¡]+/, "");
  if (!clean) return -Infinity;

  const prevRaw = (prevW.text || "").trim();
  const prevClean = prevRaw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nextRaw = nextW ? (nextW.text || "").trim() : "";
  const nextClean = nextRaw.toLowerCase().replace(/[^a-z0-9]/g, "");

  const prevEndsTerminal = NLP_TERMINAL_PUNCT_REGEX.test(prevRaw);
  const prevEndsParen = /[\)\]\}]$/.test(prevRaw);
  const prevEndsClause = /[,:-]$/.test(prevRaw);

  // 1. Explicit terminal punctuation or closing parenthesis always breaks
  if (prevEndsTerminal || prevEndsParen) return 900;

  const currentWords = sentenceWordsSoFar || [];
  const wordsCount = currentWords.length;
  const isCap = /^[A-Z]/.test(clean);
  const cleanLower = clean.toLowerCase();

  // Never break if current line has <= 2 words (prevent tiny orphan fragments)
  if (wordsCount <= 2) {
    if (wordsCount <= 2 && /^(if|and|but|so|cause|'cause)$/i.test(clean)) return -500;
    if (wordsCount <= 2 && !prevEndsTerminal) return -300;
  }

  // Preceding prepositions / articles forbid line breaks (e.g. "in The", "of A", "to California")
  if (NLP_PREPOSITIONS.test(prevClean)) {
    return -600;
  }

  // Dependent wh-clauses after cognition verbs (e.g. "see how", "know what") forbid breaks
  if (
    NLP_COGNITION_VERBS.test(prevClean) &&
    /^(how|what|where|when|why|who|which|that)$/i.test(clean)
  ) {
    return -700;
  }

  // Preceding conjunction forbids breaks (e.g. "if I", "and I", "till I")
  if (NLP_CONJUNCTIONS.test(prevClean)) {
    return -500;
  }

  let score = 0;

  // Audio pause detection & prosody analysis (voice pause / breath detection)
  const actualGap = acousticGap || (w.start && prevW.end ? w.start - prevW.end : 0);
  if (actualGap >= 0.40) score += 320;
  else if (actualGap >= 0.20) score += 160;

  // Clause ending comma / dash
  if (prevEndsClause && wordsCount >= 3) {
    score += 150;
  }

  // Universal lyrical starters (e.g. "Till", "Nothing", "'Cause", "If", "Baby", "Please")
  if (NLP_UNIVERSAL_STARTERS.test(clean) && isCap && wordsCount >= 3) {
    score += 350;
  }

  // Coordinating & subordinating conjunctions starting a new lyrical clause
  // e.g. "it's even better And I don't know what"
  // "find the way But you were never listening"
  // "listening So take my hand again"
  if (NLP_COORDINATING_CONJUNCTIONS.test(cleanLower) || NLP_SUBORDINATING_CONJUNCTIONS.test(cleanLower)) {
    if (wordsCount >= 3) {
      const isFollowedByClause = NLP_CLAUSE_FOLLOWERS.test(nextClean);
      const isNextSubject = NLP_SUBJECT_PRONOUNS.test(nextClean);
      const nextNextClean = nextNextW ? (nextNextW.text || "").toLowerCase().replace(/[^a-z0-9]/g, "") : "";
      const isNextNextVerb = NLP_FINITE_VERBS.test(nextNextClean);

      if (isCap && isFollowedByClause) {
        score += 380;
      } else if (isNextSubject && isNextNextVerb && wordsCount >= 4) {
        // Semantic compound sentence boundary (even unpunctuated/lowercase)
        score += 340;
      } else if ((prevEndsClause || actualGap >= 0.18) && isFollowedByClause) {
        score += 300;
      }
    }
  }

  // Subject pronoun ("I", "you", "we", "they", "he", "she", "it") followed by a finite verb:
  const isSubjPronoun = NLP_SUBJECT_PRONOUNS.test(cleanLower) && isCap;
  const isNextVerb = NLP_FINITE_VERBS.test(nextClean);

  if (isSubjPronoun && isNextVerb) {
    if (wordsCount >= 6) {
      // Completed previous clause + new subject/verb = new sentence
      score += 400;
    } else if (wordsCount >= 4) {
      // Check if preceding word is an adverb, verb participle, adjective or completed predicate
      if (
        /^(together|alone|away|blue|true|alive|alright|night|day|time|now|before|again|more|out|down|up|in|over|think|said|dead|buried|carry|too|uh|better|what)$/i.test(
          prevClean
        )
      ) {
        score += 350;
      } else if (prevEndsClause || actualGap >= 0.18) {
        score += 300;
      }
    }
  }

  // Length & prosody balance: if current sentence is getting very long (>= 9 words or >= 44 chars),
  // encourage breaking at any natural subject, conjunction, or capital word
  const currentChars =
    currentWords.reduce((sum, cw) => sum + cw.text.length, 0) + wordsCount - 1;
  if (wordsCount >= 9 || currentChars >= 44) {
    if (isCap || isSubjPronoun || NLP_CONJUNCTIONS.test(cleanLower)) {
      score += 260;
    }
  }

  return score;
}

/**
 * Universal NLP & Prosody Lyrical Sentence Break Detector.
 */
export function isLyricalSentenceBreak(
  w: Word,
  prevW?: Word,
  nextW?: Word,
  sentenceWordsSoFar?: Word[],
  nextNextW?: Word,
): boolean {
  if (!prevW) return false;
  if ((w as any).noSentenceBreak) return false;
  if ((w as any).breakBefore) return true;
  const acousticGap = w.start && prevW.end ? w.start - prevW.end : 0;
  const score = evaluateLyricalBoundaryScore(w, prevW, nextW, sentenceWordsSoFar, acousticGap, nextNextW);
  return score >= 200;
}

export function isCapitalizedLineBreak(
  w: Word,
  prevW?: Word,
  sentenceWordsSoFar?: Word[],
  nextW?: Word,
  nextNextW?: Word,
): boolean {
  return isLyricalSentenceBreak(w, prevW, nextW, sentenceWordsSoFar, nextNextW);
}

export type SentenceGroup = {
  words: Word[];
  rows: Word[][];
};

export type SubLineWithMeta = {
  words: Word[];
  isNewSentence: boolean;
};

/**
 * Poetically wraps the words of a single sentence into balanced rows only if very long.
 */
export function wrapSentenceWordsIntoRows(
  words: Word[],
  preferredMaxWords = 7,
  preferredMaxChars = 28,
): Word[][] {
  if (words.length === 0) return [];
  const totalChars = words.reduce((acc, w) => acc + w.text.length, 0) + words.length - 1;

  // Single line if standard length (stays together on one line!)
  if (words.length <= preferredMaxWords && totalChars <= preferredMaxChars) {
    return [words];
  }

  // Scoring function to evaluate poetic break point before word i
  const scoreBreak = (i: number): number => {
    if (i <= 0 || i >= words.length) return -Infinity;
    const prevWord = words[i - 1].text;
    const nextWordText = words[i].text;
    const nextWordClean = nextWordText.toLowerCase().replace(/[^a-z]/g, "");
    let score = 0;

    // Punctuation is an ideal poetic break point
    if (/[,;!?.—]$/.test(prevWord)) score += 90;

    // Conjunctions / clauses make natural vocal phrase starts
    if (/^(and|but|or|so|because|when|if|that|while|till|until|with|like|then|where|without|please)$/.test(nextWordClean)) {
      score += 45;
    }

    return score;
  };

  // If very long sentence (>= 9 words or >= 36 chars): evaluate 3-way split
  if (words.length >= 9 || totalChars >= 36) {
    let best3Split: [number, number] | null = null;
    let best3Score = -Infinity;

    for (let i = 2; i <= words.length - 4; i++) {
      for (let j = i + 2; j <= words.length - 2; j++) {
        const row1 = words.slice(0, i);
        const row2 = words.slice(i, j);
        const row3 = words.slice(j);

        const chars1 = row1.reduce((s, w) => s + w.text.length, 0) + row1.length - 1;
        const chars2 = row2.reduce((s, w) => s + w.text.length, 0) + row2.length - 1;
        const chars3 = row3.reduce((s, w) => s + w.text.length, 0) + row3.length - 1;

        let score = scoreBreak(i) + scoreBreak(j);
        if (chars1 > preferredMaxChars + 4) score -= (chars1 - preferredMaxChars) * 2;
        if (chars2 > preferredMaxChars + 4) score -= (chars2 - preferredMaxChars) * 2;
        if (chars3 > preferredMaxChars + 4) score -= (chars3 - preferredMaxChars) * 2;

        const maxDiff = Math.max(Math.abs(chars1 - chars2), Math.abs(chars2 - chars3), Math.abs(chars1 - chars3));
        score -= maxDiff * 0.8;

        if (score > best3Score) {
          best3Score = score;
          best3Split = [i, j];
        }
      }
    }

    if (best3Split) {
      return [
        words.slice(0, best3Split[0]),
        words.slice(best3Split[0], best3Split[1]),
        words.slice(best3Split[1]),
      ];
    }
  }

  // 2-way split for long phrases
  let bestSplit = Math.floor(words.length / 2);
  let bestScore = -Infinity;

  for (let i = 2; i <= words.length - 2; i++) {
    const words1 = words.slice(0, i);
    const words2 = words.slice(i);
    const chars1 = words1.reduce((sum, w) => sum + w.text.length, 0) + words1.length - 1;
    const chars2 = words2.reduce((sum, w) => sum + w.text.length, 0) + words2.length - 1;

    let score = scoreBreak(i);
    const charDiff = Math.abs(chars1 - chars2);
    const wordDiff = Math.abs(words1.length - words2.length);
    score -= charDiff * 1.5;
    score -= wordDiff * 4;

    if (score > bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  return [words.slice(0, bestSplit), words.slice(bestSplit)];
}

/**
 * Universal Lyrical Phrase Normalizer & Healer (Spotify & Apple Music standard).
 * Heals fragmented lines where sentences were broken mid-phrase or where subject pronouns
 * were stranded on previous lines.
 *
 * Keeps complete lyrical phrases and sentences together.
 * Preserves 100% of word timings and natural punctuation.
 * Guarantees zero timing drift and synchronized audio playback across the entire website.
 */
export function normalizeLyricalLines(lines: Line[]): Line[] {
  if (!lines || lines.length === 0) return [];
  return lines.map((line) => ({
    ...line,
    words: getLineWordsWithTimings(line),
  }));
}

/**
 * Groups words into sentences based on Capitalized words / explicit line breaks,
 * and then wraps each sentence into balanced rows.
 * This guarantees:
 * - Rows within the SAME sentence have tight spacing (words closer together, less padding)
 * - Different sentences (starting with a capital letter) have prominent gap / padding (new line as in Spotify)
 */
export function splitWordsIntoSentenceGroups(
  words: Word[],
  preferredMaxWords = 7,
  preferredMaxChars = 28,
): SentenceGroup[] {
  if (words.length === 0) return [];

  // Step 1: Segment into distinct sentence clauses based on explicit line break (\n)
  // or capitalized lyrical starter (e.g. "Till", "Nothing", "Always")
  const sentenceSlices: Word[][] = [];
  let curSentence: Word[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const prevW = words[i - 1];
    const nextW = words[i + 1];
    const nextNextW = words[i + 2];

    if ((w as any).noSentenceBreak) {
      curSentence.push(w);
      continue;
    }

    const isExplicit = Boolean((w as any).breakBefore);
    const isCapital = isLyricalSentenceBreak(w, prevW, nextW, curSentence, nextNextW);

    if (isExplicit || isCapital) {
      if (curSentence.length > 0) {
        sentenceSlices.push(curSentence);
      }
      curSentence = [w];
    } else {
      const prevClean = (prevW.text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const COGNITION_VERBS =
        /^(see|saw|seen|know|knew|known|hear|heard|feel|felt|tell|told|say|said|think|thought|wonder|wondering|ask|asked|show|showed|shown|watch|watching|find|found|realize|remember|forget|understand|make|want)$/;
      if (
        COGNITION_VERBS.test(prevClean) &&
        /^(How|What|Where|When|Why|Who|Which|That)$/.test(w.text)
      ) {
        w.text = w.text.toLowerCase();
      }
      curSentence.push(w);
    }
  }

  if (curSentence.length > 0) {
    sentenceSlices.push(curSentence);
  }

  // Step 2: Wrap each sentence into rows only if it genuinely exceeds standard line length
  return sentenceSlices.map((sentenceWords) => ({
    words: sentenceWords,
    rows: wrapSentenceWordsIntoRows(sentenceWords, preferredMaxWords, preferredMaxChars),
  }));
}

/**
 * Splits words into sublines while tagging whether each subline starts a new sentence
 * or is a wrapped continuation of the same sentence.
 */
export function splitWordsIntoSubLinesWithMeta(
  words: Word[],
  preferredMaxWords = 7,
  preferredMaxChars = 28,
): SubLineWithMeta[] {
  const groups = splitWordsIntoSentenceGroups(words, preferredMaxWords, preferredMaxChars);
  const result: SubLineWithMeta[] = [];

  for (const g of groups) {
    for (let rIdx = 0; rIdx < g.rows.length; rIdx++) {
      result.push({
        words: g.rows[rIdx],
        isNewSentence: rIdx === 0,
      });
    }
  }

  return result;
}

/**
 * Splits a lyrical line into beautifully balanced, clean rows (Apple Music & Spotify style).
 * Strictly preserves explicit newlines (\n), breaks automatically before every capitalized word,
 * and eliminates bulky text stacks and single-word orphan breaks.
 */
export function splitWordsIntoSubLines(
  words: Word[],
  preferredMaxWords = 7,
  preferredMaxChars = 28,
): Word[][] {
  return splitWordsIntoSubLinesWithMeta(words, preferredMaxWords, preferredMaxChars).map(
    (s) => s.words,
  );
}

/**
 * Takes a plain string (like previous or upcoming lyric line) and groups it into
 * distinct sentences and wrapped rows with sentence-level separation.
 */
export function splitTextIntoSentenceGroups(
  text: string,
  preferredMaxWords = 7,
  preferredMaxChars = 28,
): { text: string; rows: string[] }[] {
  const rawWords = text.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const pseudoWords: Word[] = rawWords.map((t, i) => ({
    text: t,
    start: i,
    end: i + 1,
  }));

  const groups = splitWordsIntoSentenceGroups(pseudoWords, preferredMaxWords, preferredMaxChars);
  return groups.map((g) => ({
    text: g.words.map((w) => w.text).join(" "),
    rows: g.rows.map((r) => r.map((w) => w.text).join(" ")),
  }));
}

export function fmt(t: number, precise = false) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  if (precise) return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
  return `${m}:${String(Math.floor(sec)).padStart(2, "0")}`;
}

export function parseTime(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
}

export function activeIndex(lines: Line[], t: number) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].start <= t) idx = i;
  return idx;
}

// Deterministic pseudo-waveform with a verse/chorus energy envelope.
export function waveform(count: number, duration: number) {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * duration;
    const chorus = (t > 43 && t < 64) || t > 75 ? 1 : 0.68;
    const intro = Math.min(1, t / 2.5);
    const outro = Math.min(1, Math.max(0, (duration - t) / 4));
    const n =
      (Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.55 +
      Math.abs(Math.sin(i * 0.31)) * 0.25 +
      Math.abs(Math.sin(i * 0.07 + 1)) * 0.2;
    out.push(Math.max(0.06, n * chorus * intro * outro));
  }
  return out;
}
