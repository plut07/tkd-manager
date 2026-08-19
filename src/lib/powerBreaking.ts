/**
 * The power-breaking techniques an examiner can pick from.
 *
 * Chosen one level at a time — hand or kick, then how it's launched, then the
 * technique itself — because the technique list depends on the limb and picking
 * from 39 options at once is slower than three short ones.
 *
 * What gets stored and printed is the launch and the technique: "Stationary
 * Punch", "Flying Back Kick". The limb only narrows the choices.
 */

export type Limb = "hand" | "kick";

export const LIMBS: { value: Limb; label: string }[] = [
  { value: "hand", label: "Hand" },
  { value: "kick", label: "Kick" },
];

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

export function techniquesFor(limb: Limb | ""): readonly string[] {
  if (limb === "hand") return HAND_TECHNIQUES;
  if (limb === "kick") return KICK_TECHNIQUES;
  return [];
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * The three parts of a choice, stored as one value: limb__launch__technique.
 *
 * Keeping the limb in the value means a saved choice can be reopened with all
 * three dropdowns already filled in, rather than the examiner having to
 * remember which limb they picked.
 */
export function breakingValue(limb: Limb | "", launch: string, technique: string): string {
  if (!limb || !launch || !technique) return "";
  return `${limb}__${slug(launch)}__${slug(technique)}`;
}

export type BreakingChoice = { limb: Limb | ""; launch: string; technique: string };

export function parseBreakingValue(value: string | null | undefined): BreakingChoice {
  const empty: BreakingChoice = { limb: "", launch: "", technique: "" };
  if (!value) return empty;
  const [limbPart, launchPart, techniquePart] = String(value).split("__");
  const limb: Limb | "" = limbPart === "hand" || limbPart === "kick" ? limbPart : "";
  const launch = LAUNCHES.find((l) => slug(l) === launchPart) ?? "";
  const technique = techniquesFor(limb).find((t) => slug(t) === techniquePart) ?? "";
  return { limb, launch, technique };
}

/** What the examiner sees and what prints: launch then technique. */
export function breakingLabel(value: string | null | undefined): string {
  if (!value) return "";
  const { launch, technique } = parseBreakingValue(value);
  if (launch && technique) return `${launch} ${technique}`;
  return String(value);
}
