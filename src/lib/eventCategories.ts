// Event types shown on the "New event" form.
export const EVENT_TYPES = [
  { value: "competition", label: "Competition" },
  { value: "grading", label: "Grading" },
  { value: "seminar", label: "Seminar" },
  { value: "course", label: "Course" },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_TYPES.map((t) => [t.value, t.label])
);

// Category types available when building out a Competition event's
// divisions. Each type determines which eligibility criteria apply:
// "belt" categories are filtered by Gup/Dan + age + gender, "weight"
// categories are filtered by weight + age + gender.
export const CATEGORY_TYPES = {
  pattern: { label: "Pattern", criteria: "belt" },
  sparring: { label: "Sparring", criteria: "weight" },
  special_event: { label: "Special Event", criteria: "belt" },
  power_breaking: { label: "Power Breaking", criteria: "belt" },
  pre_arrange: { label: "Pre-arrange", criteria: "belt" },
  team_pattern: { label: "Team Pattern", criteria: "belt" },
  team_sparring: { label: "Team Sparring", criteria: "weight" },
  other: { label: "Other", criteria: "belt" },
} as const;

export type CategoryTypeCode = keyof typeof CATEGORY_TYPES;

export const CATEGORY_TYPE_LIST: { value: CategoryTypeCode; label: string; criteria: "belt" | "weight" }[] =
  Object.entries(CATEGORY_TYPES).map(([value, meta]) => ({ value: value as CategoryTypeCode, ...meta }));

export const GENDER_OPTIONS = ["male", "female", "other"] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];
