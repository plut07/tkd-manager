/**
 * The people running the ring.
 *
 * Plain, like the rest of lib/: the roles and the seat numbering, with no
 * database or React attached, so the pad, the ring screen and the server all
 * agree on what "slot 0" means without importing each other.
 */

export type OfficialRole = "referee" | "judge" | "jury" | "timekeeper" | "recorder" | "coordinator";

export const OFFICIAL_ROLES: { value: OfficialRole; label: string; note: string }[] = [
  { value: "referee", label: "Referee", note: "Runs the bout and calls warnings and deductions." },
  { value: "judge", label: "Corner judge", note: "Scores from a corner. This is most of the panel." },
  { value: "jury", label: "Jury", note: "Rules on protests and disputed bouts." },
  { value: "timekeeper", label: "Timekeeper", note: "Runs the clock." },
  { value: "recorder", label: "Recorder", note: "Keeps the ring's paperwork." },
  { value: "coordinator", label: "Umpire coordinator", note: "Assigns the panels." },
];

export const ROLE_LABELS: Record<OfficialRole, string> = Object.fromEntries(
  OFFICIAL_ROLES.map((r) => [r.value, r.label]),
) as Record<OfficialRole, string>;

/**
 * The referee's seat.
 *
 * The scoreboard already records the referee's warnings and deductions against
 * slot 0, because no judge is slot 0. Seating uses the same number, so a press
 * and the person who made it line up without a translation step.
 */
export const REFEREE_SLOT = 0;

/** What to call a seat on a ring. */
export function seatLabel(slot: number): string {
  return slot === REFEREE_SLOT ? "Referee" : `Judge ${slot}`;
}

/**
 * The seats a ring has, in the order they are filled.
 *
 * The referee first, then one corner judge per slot the ring is set up for.
 */
export function seatsFor(judgeCount: number): number[] {
  const judges = Array.from({ length: Math.max(0, judgeCount) }, (_, i) => i + 1);
  return [REFEREE_SLOT, ...judges];
}

/** One official in one seat, as a screen needs them. */
export type SeatedOfficial = {
  slot: number;
  officialId: string;
  name: string;
  country: string | null;
  qualification: string | null;
};

/**
 * The panel as it is written into a confirmed result.
 *
 * Deliberately a copy rather than a set of ids: an official removed from the
 * event afterwards must not take the record of who judged a bout with them.
 */
export function panelSnapshot(seated: SeatedOfficial[]): { slot: number; name: string; country: string | null }[] {
  return seated
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({ slot: s.slot, name: s.name, country: s.country }));
}

/** Read a stored panel back, ignoring anything that isn't one. */
export function parsePanel(raw: unknown): { slot: number; name: string; country: string | null }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      slot: Number(entry.slot) || 0,
      name: typeof entry.name === "string" ? entry.name : "",
      country: typeof entry.country === "string" ? entry.country : null,
    }))
    .filter((entry) => entry.name !== "");
}
