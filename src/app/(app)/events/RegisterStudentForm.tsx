"use client";

import { useMemo, useState } from "react";
import { checkEligibility, checkCountryEligibility, type CategoryCriteria, type StudentLite } from "@/lib/eligibility";
import { isTopGrade, nextGrade } from "@/lib/belts";

type Student = StudentLite & {
  id: string;
  full_name: string;
  nationality?: string | null;
  clubs?: { name: string; country?: string | null } | null;
};

type Category = CategoryCriteria & { id: string; name: string };

/**
 * Entering one person into one event.
 *
 * The student is chosen first and the categories follow, because that is the
 * order a coach thinks in — "where can Dylan go?", not "who fits this box?".
 * Only categories that student actually qualifies for are listed; the rest are
 * left out rather than shown greyed, so nobody spends the morning working out
 * why an entry keeps being refused.
 */
export default function RegisterStudentForm({
  action,
  eventId,
  students,
  categories,
  showClub,
  useCategories,
  allowedCountries,
  isGrading = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  students: Student[];
  categories: Category[];
  showClub: boolean;
  useCategories: boolean;
  allowedCountries?: string[];
  isGrading?: boolean;
}) {
  const [studentId, setStudentId] = useState("");
  const selected = students.find((s) => s.id === studentId) ?? null;

  /** Why this student can't enter the event at all, if they can't. */
  const blocked = useMemo(() => {
    if (!selected) return [] as string[];
    const reasons: string[] = [];
    const country = checkCountryEligibility(selected.clubs?.country, selected.nationality, allowedCountries);
    if (!country.eligible && country.reason) reasons.push(country.reason);
    if (isGrading && isTopGrade(selected.gup, selected.dan)) reasons.push("already at 9th Dan, the highest grade");
    return reasons;
  }, [selected, allowedCountries, isGrading]);

  const target = selected && isGrading ? nextGrade(selected.gup, selected.dan) : null;

  /** The categories this student qualifies for, and the ones they don't. */
  const { eligible, ineligible } = useMemo(() => {
    if (!selected || !useCategories) return { eligible: [] as Category[], ineligible: [] as Category[] };
    const yes: Category[] = [];
    const no: Category[] = [];
    for (const c of categories) {
      if (checkEligibility(selected, c).eligible) yes.push(c);
      else no.push(c);
    }
    return { eligible: yes, ineligible: no };
  }, [selected, categories, useCategories]);

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="flex flex-wrap items-start gap-2">
        <select
          name="studentId"
          className="input max-w-xs"
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="" disabled>Select a student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {showClub ? ` (${s.clubs?.name ?? ""})` : ""}
            </option>
          ))}
        </select>

        {useCategories && (
          <select name="categoryId" className="input max-w-xs" disabled={!selected || blocked.length > 0} defaultValue="">
            <option value="">
              {!selected
                ? "Choose a student first"
                : eligible.length === 0
                  ? "No category fits this student"
                  : "No category yet"}
            </option>
            {eligible.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        )}

        <button type="submit" className="btn-primary" disabled={!selected || blocked.length > 0}>Register</button>
      </div>

      {blocked.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {selected?.full_name} can&apos;t be entered: {blocked.join("; ")}.
        </p>
      )}

      {isGrading && selected && blocked.length === 0 && target && (
        <p className="text-xs text-gray-500">
          {selected.full_name} will be examined for <strong>{target.label}</strong> — a grading always tests for the
          grade directly above the one held, so there is nothing to choose.
        </p>
      )}

      {useCategories && selected && blocked.length === 0 && (
        <p className="text-xs text-gray-500">
          {eligible.length === 0
            ? `None of the ${categories.length} categories match ${selected.full_name}'s age, grade, gender or weight.`
            : `${eligible.length} of ${categories.length} categories fit ${selected.full_name}${
                ineligible.length > 0 ? `; the other ${ineligible.length} don't and aren't shown` : ""
              }.`}
        </p>
      )}
    </form>
  );
}
