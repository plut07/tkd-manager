/**
 * The power-breaking techniques an examiner can pick from.
 *
 * Built from three levels — how it's launched, whether it's hand or foot, and
 * the technique itself. Only the first and third are shown, because "Stationary
 * Punch" and "Flying Back Kick" are what people say out loud; the middle level
 * exists to decide which techniques are on offer.
 */

export const LAUNCHES = ["Stationary", "Flying", "Jumping"] as const;

export const HAND_TECHNIQUES = [
  "Punch",
  "Knife Hand Strike",
  "Backfist Strike",
  "Hammer Fist",
  "Elbow Strike",
] as const;

export const KICK_TECHNIQUES = [
  "Front Kick",
  "Turning Kick",
  "Downward Kick",
  "Hooking Kick",
  "Back Kick",
  "Twisting Kick",
  "Reverse Hooking Kick",
  "Reverse Turning Kick",
] as const;

export type BreakingOption = {
  /** Stored value, stable even if a label is reworded. */
  value: string;
  /** What the examiner sees and what prints: "Flying Back Kick". */
  label: string;
  launch: string;
  limb: "Hand" | "Kick";
  technique: string;
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export const BREAKING_OPTIONS: BreakingOption[] = LAUNCHES.flatMap((launch) => [
  ...HAND_TECHNIQUES.map((technique) => ({
    value: `${slug(launch)}__hand__${slug(technique)}`,
    label: `${launch} ${technique}`,
    launch,
    limb: "Hand" as const,
    technique,
  })),
  ...KICK_TECHNIQUES.map((technique) => ({
    value: `${slug(launch)}__kick__${slug(technique)}`,
    label: `${launch} ${technique}`,
    launch,
    limb: "Kick" as const,
    technique,
  })),
]);

const BY_VALUE = new Map(BREAKING_OPTIONS.map((o) => [o.value, o]));

/** The printable name for a stored choice; falls back to whatever was typed. */
export function breakingLabel(value: string | null | undefined): string {
  if (!value) return "";
  return BY_VALUE.get(value)?.label ?? value;
}

export type BreakingGroup = { launch: string; options: BreakingOption[] };

/** Grouped for the dropdown, so the list reads as three sections. */
export function breakingGroups(): BreakingGroup[] {
  return LAUNCHES.map((launch) => ({
    launch,
    options: BREAKING_OPTIONS.filter((o) => o.launch === launch),
  }));
}
