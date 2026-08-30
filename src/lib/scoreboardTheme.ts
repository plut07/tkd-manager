/**
 * How the scoreboard looks, and where things sit on it.
 *
 * Three layers, resolved in order:
 *
 *   1. the built-in defaults below
 *   2. the event's base design
 *   3. that event's override for the mode being scored
 *
 * A mode override holds only what differs, so changing a colour is done once
 * and not three times. Anything a mode doesn't mention follows the base.
 *
 * Positions are chosen from a fixed set rather than dragged freely. A board
 * read from the back of a hall has about six places a thing can usefully go,
 * and free coordinates mostly produce overlapping text that nobody notices
 * until the event has started.
 *
 * Anything unrecognised in a stored theme is ignored rather than trusted: this
 * is drawn straight into a page, and a colour is one of the easier things to
 * smuggle something through.
 */

export type ScoreMode = "sparring" | "pattern" | "flag";

export const MODE_LABELS: Record<ScoreMode, string> = {
  sparring: "Sparring",
  pattern: "Pattern",
  flag: "Flag",
};

// ------------------------------------------------------------------ layout

/** Where each part of the big display goes. */
export type DisplayLayout = {
  /** The ring / category / mode strip. */
  header: "top" | "bottom";
  /** The competitor's name, relative to the big number. */
  name: "aboveScore" | "belowScore";
  /** The competition number. */
  number: "withName" | "ownLine" | "cornerBadge";
  /** Each judge's own mark. */
  judgeMarks: "insidePanel" | "belowPanels";
  /** Warning and deduction counts. */
  penalties: "insidePanel" | "belowPanels";
  /** The clock. Between the panels gives the classic three-column board. */
  clock: "belowPanels" | "abovePanels" | "betweenPanels";
  /** "Round 2 of 2", "Paused", "WINNER — ...". */
  status: "underClock" | "topOfScreen";
  /** Logo and headline words. */
  branding: "top" | "bottom";
};

/** Where each part of a judge's pad goes. */
export type PadLayout = {
  /** The ring and judge number bar. */
  header: "top" | "bottom";
  /** The clock. */
  clock: "inHeader" | "aboveButtons" | "hidden";
  /** The competitor's name, relative to the judge's own running mark. */
  name: "aboveScore" | "belowScore";
  /** Undo, and what it would take back. */
  undo: "bottom" | "top";
};

export const DEFAULT_DISPLAY_LAYOUT: DisplayLayout = {
  header: "top",
  name: "aboveScore",
  number: "withName",
  judgeMarks: "insidePanel",
  penalties: "insidePanel",
  clock: "belowPanels",
  status: "underClock",
  branding: "top",
};

export const DEFAULT_PAD_LAYOUT: PadLayout = {
  header: "top",
  clock: "inHeader",
  name: "aboveScore",
  undo: "bottom",
};

/**
 * The choices offered for each position, and what each one means.
 *
 * Kept here rather than in the designer so the list, the parser and the screens
 * cannot drift apart — a position the designer offers but the display doesn't
 * understand would silently do nothing.
 */
export type SlotOption = { value: string; label: string };
export type SlotSpec<K> = { key: K; label: string; note: string; options: SlotOption[] };

export const DISPLAY_SLOTS: SlotSpec<keyof DisplayLayout>[] = [
  {
    key: "branding",
    label: "Logo and headline",
    note: "Your federation or event name.",
    options: [
      { value: "top", label: "Top of screen" },
      { value: "bottom", label: "Bottom of screen" },
    ],
  },
  {
    key: "header",
    label: "Ring, category and mode",
    note: "The strip naming the ring and what is being scored.",
    options: [
      { value: "top", label: "Top of screen" },
      { value: "bottom", label: "Bottom of screen" },
    ],
  },
  {
    key: "name",
    label: "Competitor name",
    note: "Where the name sits relative to the big number.",
    options: [
      { value: "aboveScore", label: "Above the score" },
      { value: "belowScore", label: "Below the score" },
    ],
  },
  {
    key: "number",
    label: "Competition number",
    note: "A-004, and so on.",
    options: [
      { value: "withName", label: "Beside the name" },
      { value: "ownLine", label: "On its own line" },
      { value: "cornerBadge", label: "Badge in the panel corner" },
    ],
  },
  {
    key: "judgeMarks",
    label: "Each judge's mark",
    note: "The J1 J2 J3 strip.",
    options: [
      { value: "insidePanel", label: "Inside the corner's panel" },
      { value: "belowPanels", label: "In a row under both panels" },
    ],
  },
  {
    key: "penalties",
    label: "Warnings and deductions",
    options: [
      { value: "insidePanel", label: "Inside the corner's panel" },
      { value: "belowPanels", label: "In a row under both panels" },
    ],
    note: "",
  },
  {
    key: "clock",
    label: "Clock",
    note: "Between the panels gives the classic three-column board.",
    options: [
      { value: "belowPanels", label: "Below both panels" },
      { value: "abovePanels", label: "Above both panels" },
      { value: "betweenPanels", label: "Between the panels" },
    ],
  },
  {
    key: "status",
    label: "Round and result line",
    note: '"Round 2 of 2", "Paused", "WINNER — ...".',
    options: [
      { value: "underClock", label: "Under the clock" },
      { value: "topOfScreen", label: "Top of screen" },
    ],
  },
];

export const PAD_SLOTS: SlotSpec<keyof PadLayout>[] = [
  {
    key: "header",
    label: "Ring and judge number",
    note: "",
    options: [
      { value: "top", label: "Top of screen" },
      { value: "bottom", label: "Bottom of screen" },
    ],
  },
  {
    key: "clock",
    label: "Clock",
    note: "A judge rarely needs it, but some officials want it in view.",
    options: [
      { value: "inHeader", label: "In the top bar" },
      { value: "aboveButtons", label: "Large, above the buttons" },
      { value: "hidden", label: "Not shown" },
    ],
  },
  {
    key: "name",
    label: "Competitor name",
    note: "Relative to the judge's own running mark.",
    options: [
      { value: "aboveScore", label: "Above the mark" },
      { value: "belowScore", label: "Below the mark" },
    ],
  },
  {
    key: "undo",
    label: "Undo button",
    note: "",
    options: [
      { value: "bottom", label: "Below the buttons" },
      { value: "top", label: "Above the buttons" },
    ],
  },
];

// ------------------------------------------------------------------- theme

/** Everything a mode is allowed to change. */
export type ThemeLook = {
  redColor: string;
  blueColor: string;
  background: string;
  textColor: string;
  accentColor: string;

  showJudgeMarks: boolean;
  showPenalties: boolean;
  showClock: boolean;
  showCategory: boolean;
  showCompetitorNumbers: boolean;
  showVoteCount: boolean;

  scoreScale: number;
  clockScale: number;

  padDarkBackground: boolean;

  display: DisplayLayout;
  pad: PadLayout;
};

/**
 * What one mode changes.
 *
 * Note that display and pad are *partial* here, not whole layouts. A mode that
 * only wants the clock in the middle stores exactly that one slot, so moving
 * the name on the base design still reaches it. Storing a whole layout would
 * freeze a copy of the base as it stood the day the override was made, and the
 * event would slowly drift into three unrelated designs without anyone
 * touching them.
 */
export type LookOverride = Omit<Partial<ThemeLook>, "display" | "pad"> & {
  display?: Partial<DisplayLayout>;
  pad?: Partial<PadLayout>;
};

export type ScoreboardTheme = ThemeLook & {
  logoUrl: string | null;
  headline: string;
  /** What each mode changes. Anything absent follows the base. */
  modes: Partial<Record<ScoreMode, LookOverride>>;
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

  display: DEFAULT_DISPLAY_LAYOUT,
  pad: DEFAULT_PAD_LAYOUT,

  modes: {},
};

// ------------------------------------------------------------------ safety

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

/** One of the offered positions, or the default. */
function slot<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function parseDisplayLayout(raw: unknown, base: DisplayLayout): DisplayLayout {
  const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    header: slot(l.header, ["top", "bottom"] as const, base.header),
    name: slot(l.name, ["aboveScore", "belowScore"] as const, base.name),
    number: slot(l.number, ["withName", "ownLine", "cornerBadge"] as const, base.number),
    judgeMarks: slot(l.judgeMarks, ["insidePanel", "belowPanels"] as const, base.judgeMarks),
    penalties: slot(l.penalties, ["insidePanel", "belowPanels"] as const, base.penalties),
    clock: slot(l.clock, ["belowPanels", "abovePanels", "betweenPanels"] as const, base.clock),
    status: slot(l.status, ["underClock", "topOfScreen"] as const, base.status),
    branding: slot(l.branding, ["top", "bottom"] as const, base.branding),
  };
}

function parsePadLayout(raw: unknown, base: PadLayout): PadLayout {
  const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    header: slot(l.header, ["top", "bottom"] as const, base.header),
    clock: slot(l.clock, ["inHeader", "aboveButtons", "hidden"] as const, base.clock),
    name: slot(l.name, ["aboveScore", "belowScore"] as const, base.name),
    undo: slot(l.undo, ["bottom", "top"] as const, base.undo),
  };
}

/** The full look, with every field present. */
function parseLook(raw: unknown, base: ThemeLook): ThemeLook {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    redColor: safeColor(t.redColor, base.redColor),
    blueColor: safeColor(t.blueColor, base.blueColor),
    background: safeColor(t.background, base.background),
    textColor: safeColor(t.textColor, base.textColor),
    accentColor: safeColor(t.accentColor, base.accentColor),

    showJudgeMarks: bool(t.showJudgeMarks, base.showJudgeMarks),
    showPenalties: bool(t.showPenalties, base.showPenalties),
    showClock: bool(t.showClock, base.showClock),
    showCategory: bool(t.showCategory, base.showCategory),
    showCompetitorNumbers: bool(t.showCompetitorNumbers, base.showCompetitorNumbers),
    showVoteCount: bool(t.showVoteCount, base.showVoteCount),

    scoreScale: scale(t.scoreScale, base.scoreScale),
    clockScale: scale(t.clockScale, base.clockScale),

    padDarkBackground: bool(t.padDarkBackground, base.padDarkBackground),

    display: parseDisplayLayout(t.display, base.display),
    pad: parsePadLayout(t.pad, base.pad),
  };
}

/**
 * Only the fields a mode actually set.
 *
 * Kept sparse on purpose. If an override stored every field, editing the base
 * would stop reaching the modes — they would each be carrying a full frozen
 * copy of whatever the base looked like when the override was created.
 */
/** Only the slots a mode actually named, checked against the offered choices. */
function sparseLayout(raw: unknown, specs: readonly { key: string; options: SlotOption[] }[]): Record<string, string> {
  const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const spec of specs) {
    const value = l[spec.key];
    if (typeof value === "string" && spec.options.some((o) => o.value === value)) out[spec.key] = value;
  }
  return out;
}

function parseOverride(raw: unknown): LookOverride {
  if (!raw || typeof raw !== "object") return {};
  const t = raw as Record<string, unknown>;
  const out: LookOverride = {};

  const colours = ["redColor", "blueColor", "background", "textColor", "accentColor"] as const;
  for (const key of colours) {
    if (typeof t[key] === "string") {
      const value = safeColor(t[key], "");
      if (value) out[key] = value;
    }
  }

  const flags = [
    "showJudgeMarks", "showPenalties", "showClock",
    "showCategory", "showCompetitorNumbers", "showVoteCount", "padDarkBackground",
  ] as const;
  for (const key of flags) if (typeof t[key] === "boolean") out[key] = t[key] as boolean;

  for (const key of ["scoreScale", "clockScale"] as const) {
    if (t[key] !== undefined) {
      const value = scale(t[key], NaN);
      if (Number.isFinite(value)) out[key] = value;
    }
  }

  const display = sparseLayout(t.display, DISPLAY_SLOTS);
  if (Object.keys(display).length > 0) out.display = display as Partial<DisplayLayout>;

  const pad = sparseLayout(t.pad, PAD_SLOTS);
  if (Object.keys(pad).length > 0) out.pad = pad as Partial<PadLayout>;

  return out;
}

/**
 * Read a stored theme.
 *
 * A theme saved before layouts and modes existed simply has neither, and comes
 * back with the defaults — nobody's event changes appearance because the shape
 * grew.
 */
export function parseTheme(raw: unknown): ScoreboardTheme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const look = parseLook(t, DEFAULT_THEME);

  const modes: Partial<Record<ScoreMode, LookOverride>> = {};
  const stored = (t.modes && typeof t.modes === "object" ? t.modes : {}) as Record<string, unknown>;
  for (const mode of ["sparring", "pattern", "flag"] as const) {
    const override = parseOverride(stored[mode]);
    if (Object.keys(override).length > 0) modes[mode] = override;
  }

  return {
    ...look,
    logoUrl: safeImageUrl(t.logoUrl),
    headline: typeof t.headline === "string" ? t.headline.slice(0, 80) : DEFAULT_THEME.headline,
    modes,
  };
}

/**
 * The look to draw with, for one mode.
 *
 * This is what every screen calls. The base is the whole answer unless the
 * mode has said otherwise, field by field.
 */
export function resolveTheme(theme: ScoreboardTheme, mode: ScoreMode): ThemeLook & { logoUrl: string | null; headline: string } {
  const override = theme.modes?.[mode] ?? {};
  return {
    ...theme,
    ...override,
    display: { ...theme.display, ...(override.display ?? {}) },
    pad: { ...theme.pad, ...(override.pad ?? {}) },
    logoUrl: theme.logoUrl,
    headline: theme.headline,
  };
}

/** Whether a mode changes anything at all, for showing "3 changes" in the UI. */
export function overrideCount(theme: ScoreboardTheme, mode: ScoreMode): number {
  return Object.keys(theme.modes?.[mode] ?? {}).length;
}

/** Ready-made looks, so somebody can get a decent screen without picking colours. */
export const THEME_PRESETS: { name: string; note: string; theme: Partial<ScoreboardTheme> }[] = [
  {
    name: "Default",
    note: "Dark hall, bright corners.",
    theme: {
      redColor: DEFAULT_THEME.redColor,
      blueColor: DEFAULT_THEME.blueColor,
      background: DEFAULT_THEME.background,
      textColor: DEFAULT_THEME.textColor,
      accentColor: DEFAULT_THEME.accentColor,
      display: DEFAULT_DISPLAY_LAYOUT,
      pad: DEFAULT_PAD_LAYOUT,
    },
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
  {
    name: "Clock in the middle",
    note: "The classic three-column board, with the time between the corners.",
    theme: { display: { ...DEFAULT_DISPLAY_LAYOUT, clock: "betweenPanels", penalties: "belowPanels" } },
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
