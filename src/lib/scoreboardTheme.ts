/**
 * How the scoreboard looks.
 *
 * Two screens are covered: the big display the hall watches, and the pad in a
 * judge's hand. They share the corner colours — a judge glancing up at the
 * display must see the same red as the button they just pressed — and differ
 * in what else they show.
 *
 * Every setting has a default that works, so an event nobody has themed looks
 * exactly as it does today. Anything unrecognised in a stored theme is ignored
 * rather than trusted: this is drawn straight into a page, and a colour is one
 * of the easier things to smuggle something through.
 */

export type ScoreboardTheme = {
  redColor: string;
  blueColor: string;
  background: string;
  textColor: string;
  accentColor: string;

  /** A logo shown across the top of the display. */
  logoUrl: string | null;
  /** Words under the logo — a federation name, a sponsor, the event. */
  headline: string;

  /** What the big display shows. */
  showJudgeMarks: boolean;
  showPenalties: boolean;
  showClock: boolean;
  showCategory: boolean;
  showCompetitorNumbers: boolean;
  showVoteCount: boolean;

  /** How large the headline number is, as a multiplier. */
  scoreScale: number;
  /** How large the clock is, as a multiplier. */
  clockScale: number;

  /** The judge's pad follows the corner colours; this softens or brightens it. */
  padDarkBackground: boolean;
};

export const DEFAULT_THEME: ScoreboardTheme = {
  redColor: "#b91c1c",
  blueColor: "#1d4ed8",
  background: "#09090b",
  textColor: "#ffffff",
  accentColor: "#facc15",

  logoUrl: null,
  headline: "",

  showJudgeMarks: true,
  showPenalties: true,
  showClock: true,
  showCategory: true,
  showCompetitorNumbers: true,
  showVoteCount: true,

  scoreScale: 1,
  clockScale: 1,

  padDarkBackground: false,
};

/**
 * A colour we are willing to write into a style attribute.
 *
 * Only a plain hex value. CSS colours can carry urls and expressions, and this
 * string comes out of a database row and goes straight into a page — so the
 * shape is checked rather than the content sanitised.
 */
export function safeColor(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

/** A logo address we are willing to put in an img tag. */
export function safeImageUrl(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  // Same-site paths, or plain https. No data: or javascript: — the first can
  // hide a payload and the second is an attack outright.
  if (text.startsWith("/")) return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const scale = (value: unknown, fallback: number) => {
  const n = Number(value);
  // Between half and double: a headline number three times the screen is not a
  // choice anybody meant to make, and it would push the clock off the bottom.
  return Number.isFinite(n) && n >= 0.5 && n <= 2 ? Math.round(n * 100) / 100 : fallback;
};

/** Read a stored theme, falling back to the default for anything missing or odd. */
export function parseTheme(raw: unknown): ScoreboardTheme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    redColor: safeColor(t.redColor, DEFAULT_THEME.redColor),
    blueColor: safeColor(t.blueColor, DEFAULT_THEME.blueColor),
    background: safeColor(t.background, DEFAULT_THEME.background),
    textColor: safeColor(t.textColor, DEFAULT_THEME.textColor),
    accentColor: safeColor(t.accentColor, DEFAULT_THEME.accentColor),

    logoUrl: safeImageUrl(t.logoUrl),
    headline: typeof t.headline === "string" ? t.headline.slice(0, 80) : DEFAULT_THEME.headline,

    showJudgeMarks: bool(t.showJudgeMarks, DEFAULT_THEME.showJudgeMarks),
    showPenalties: bool(t.showPenalties, DEFAULT_THEME.showPenalties),
    showClock: bool(t.showClock, DEFAULT_THEME.showClock),
    showCategory: bool(t.showCategory, DEFAULT_THEME.showCategory),
    showCompetitorNumbers: bool(t.showCompetitorNumbers, DEFAULT_THEME.showCompetitorNumbers),
    showVoteCount: bool(t.showVoteCount, DEFAULT_THEME.showVoteCount),

    scoreScale: scale(t.scoreScale, DEFAULT_THEME.scoreScale),
    clockScale: scale(t.clockScale, DEFAULT_THEME.clockScale),

    padDarkBackground: bool(t.padDarkBackground, DEFAULT_THEME.padDarkBackground),
  };
}

/** Ready-made looks, so somebody can get a decent screen without picking colours. */
export const THEME_PRESETS: { name: string; note: string; theme: Partial<ScoreboardTheme> }[] = [
  {
    name: "Default",
    note: "Dark hall, bright corners.",
    theme: { ...DEFAULT_THEME },
  },
  {
    name: "High contrast",
    note: "For a bright hall or a washed-out projector.",
    theme: { background: "#000000", redColor: "#e11d48", blueColor: "#2563eb", accentColor: "#fde047", scoreScale: 1.15 },
  },
  {
    name: "Light",
    note: "For a television rather than a projector.",
    theme: { background: "#f8fafc", textColor: "#0f172a", redColor: "#dc2626", blueColor: "#1d4ed8", accentColor: "#ca8a04" },
  },
  {
    name: "Big numbers",
    note: "Score and clock as large as they go, everything else trimmed.",
    theme: { scoreScale: 1.4, clockScale: 1.3, showJudgeMarks: false, showCategory: false },
  },
];

/** Readable text on a given background — white on dark, near-black on light. */
export function contrastText(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#ffffff";
  // Rec. 601 luma: green carries most of what the eye reads as brightness.
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma > 150 ? "#111111" : "#ffffff";
}
