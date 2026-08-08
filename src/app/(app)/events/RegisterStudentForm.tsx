"use client";

import { useMemo, useState } from "react";
import { checkEligibility, checkCountryEligibility, type CategoryCriteria, type StudentLite } from "@/lib/eligibility";

type Student = StudentLite & {
  id: string;
  first_name: string;
  last_name: string;
  nationality?: string | null;
  clubs?: { name: string; country?: string | null } | null;
};

type Category = CategoryCriteria & { id: string; name: string };

export default function RegisterStudentForm({
  action,
  eventId,
  students,
  categories,
  showClub,
  useCategories,
  allowedCountries,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  students: Student[];
  categories: Category[];
  showClub: boolean;
  useCategories: boolean;
  allowedCountries?: string[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  const decorated = useMemo(() => {
    return students.map((s) => {
      const reasons: string[] = [];

      const countryResult = checkCountryEligibility(s.clubs?.country, s.nationality, allowedCountries);
      if (!countryResult.eligible && countryResult.reason) reasons.push(countryResult.reason);

      if (useCategories && selectedCategory) {
        const catResult = checkEligibility(s, selectedCategory);
        if (!catResult.eligible) reasons.push(...catResult.reasons);
      }

      return { student: s, eligible: reasons.length === 0, reasons };
    });
  }, [students, selectedCategory, useCategories, allowedCountries]);

  const ineligibleCount = decorated.filter((d) => !d.eligible).length;

  return (
    <form action={action} className="mt-4 flex flex-wrap items-start gap-2 border-t border-gray-100 pt-4">
      <input type="hidden" name="eventId" value={eventId} />

      {useCategories && (
        <select
          name="categoryId"
          className="input max-w-xs"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">No category yet</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <select name="studentId" className="input max-w-xs" required defaultValue="">
        <option value="" disabled>
          Select a student
        </option>
        {decorated.map(({ student: s, eligible, reasons }) => (
          <option key={s.id} value={s.id} disabled={!eligible}>
            {s.first_name} {s.last_name}
            {showClub ? ` (${s.clubs?.name ?? ""})` : ""}
            {!eligible ? ` — not eligible: ${reasons.join(", ")}` : ""}
          </option>
        ))}
      </select>

      <button type="submit" className="btn-primary">
        Register
      </button>

      {ineligibleCount > 0 && (
        <p className="w-full text-xs text-gray-500">
          {ineligibleCount} of {decorated.length} student{decorated.length === 1 ? "" : "s"} aren&apos;t eligible
          {useCategories && selectedCategory ? " for this category" : ""} and can&apos;t be selected.
        </p>
      )}
    </form>
  );
}
