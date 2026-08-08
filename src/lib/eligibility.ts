import { CATEGORY_TYPES, type CategoryTypeCode } from "./eventCategories";

// Deliberately plain/pure — no server-only or DB imports — so this can be
// shared between server actions (hard block on register) and client
// components (live filtering of the student picker).

export type StudentLite = {
  gup: number | null;
  dan: number | null;
  gender: string | null;
  birthday: string | null;
  weight_kg: number | null;
};

export type CategoryCriteria = {
  type: string;
  gup_list: number[] | null;
  dan_list: number[] | null;
  gender_list: string[] | null;
  age_min: number | null;
  age_max: number | null;
  weight_min: number | null;
  weight_max: number | null;
};

export function computeAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--;
  return years;
}

function criteriaKind(type: string): "belt" | "weight" {
  return CATEGORY_TYPES[type as CategoryTypeCode]?.criteria ?? "belt";
}

export function checkEligibility(
  student: StudentLite,
  category: CategoryCriteria
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const kind = criteriaKind(category.type);

  if (category.gender_list && category.gender_list.length > 0) {
    if (!student.gender || !category.gender_list.includes(student.gender)) {
      reasons.push("gender");
    }
  }

  if (category.age_min != null || category.age_max != null) {
    const age = computeAge(student.birthday);
    if (age == null) {
      reasons.push("age unknown");
    } else {
      if (category.age_min != null && age < category.age_min) reasons.push("age");
      if (category.age_max != null && age > category.age_max) reasons.push("age");
    }
  }

  if (kind === "belt") {
    const gupList = category.gup_list ?? [];
    const danList = category.dan_list ?? [];
    if (gupList.length > 0 || danList.length > 0) {
      const gupOk = student.gup != null && gupList.includes(student.gup);
      const danOk = student.dan != null && danList.includes(student.dan);
      if (!gupOk && !danOk) reasons.push("belt");
    }
  }

  if (kind === "weight") {
    if (category.weight_min != null || category.weight_max != null) {
      if (student.weight_kg == null) {
        reasons.push("weight unknown");
      } else {
        if (category.weight_min != null && student.weight_kg < category.weight_min) reasons.push("weight");
        if (category.weight_max != null && student.weight_kg > category.weight_max) reasons.push("weight");
      }
    }
  }

  return { eligible: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
}

/**
 * Event-level (not category-level) country gate. A student can take part
 * only if the event has no country restriction, or if either their club's
 * country or their own nationality is one of the countries ticked when the
 * event was created.
 */
export function checkCountryEligibility(
  clubCountry: string | null | undefined,
  nationality: string | null | undefined,
  allowedCountries: string[] | null | undefined
): { eligible: boolean; reason?: string } {
  if (!allowedCountries || allowedCountries.length === 0) return { eligible: true };
  const ok = (!!clubCountry && allowedCountries.includes(clubCountry)) || (!!nationality && allowedCountries.includes(nationality));
  return ok ? { eligible: true } : { eligible: false, reason: "country not eligible for this event" };
}

export function describeCriteria(c: CategoryCriteria): string {
  const kind = criteriaKind(c.type);
  const parts: string[] = [];

  if (kind === "belt") {
    if (c.gup_list && c.gup_list.length > 0) {
      parts.push(`Gup ${[...c.gup_list].sort((a, b) => a - b).join(", ")}`);
    }
    if (c.dan_list && c.dan_list.length > 0) {
      parts.push(`Dan ${[...c.dan_list].sort((a, b) => a - b).join(", ")}`);
    }
  }

  if (c.age_min != null || c.age_max != null) {
    parts.push(`Age ${c.age_min ?? "?"}–${c.age_max ?? "?"}`);
  }

  if (kind === "weight" && (c.weight_min != null || c.weight_max != null)) {
    parts.push(`${c.weight_min ?? "?"}–${c.weight_max ?? "?"} kg`);
  }

  if (c.gender_list && c.gender_list.length > 0) {
    parts.push(c.gender_list.join("/"));
  }

  return parts.length > 0 ? parts.join(" · ") : "No restrictions";
}
