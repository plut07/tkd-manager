"use client";

import { useState } from "react";
import { CATEGORY_TYPE_LIST, GENDER_OPTIONS } from "@/lib/eventCategories";
import { GRADE_OPTIONS } from "@/lib/belts";


export default function CategoryForm({
  action,
  eventId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
}) {
  const [type, setType] = useState<string>("pattern");
  const meta = CATEGORY_TYPE_LIST.find((t) => t.value === type) ?? CATEGORY_TYPE_LIST[0];
  const usesBelt = meta.criteria === "belt";
  const usesWeight = meta.criteria === "weight";

  return (
    <form action={action} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Category name</label>
          <input name="name" placeholder="e.g. Yellow Belt Male Pattern" className="input" required />
        </div>
        <div>
          <label className="label">Category type</label>
          <select name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {CATEGORY_TYPE_LIST.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Age range</label>
          <div className="flex items-center gap-2">
            <input name="ageMin" type="number" placeholder="Min" className="input" />
            <span className="text-gray-400">to</span>
            <input name="ageMax" type="number" placeholder="Max" className="input" />
          </div>
        </div>

        {usesWeight && (
          <div>
            <label className="label">Weight range (kg)</label>
            <div className="flex items-center gap-2">
              <input name="weightMin" type="number" step="0.1" placeholder="Min" className="input" />
              <span className="text-gray-400">to</span>
              <input name="weightMax" type="number" step="0.1" placeholder="Max" className="input" />
            </div>
          </div>
        )}

        <div>
          <label className="label">Gender (select one or more)</label>
          <div className="flex gap-4 pt-1">
            {GENDER_OPTIONS.map((g) => (
              <label key={g} className="flex items-center gap-1.5 text-sm capitalize text-gray-700">
                <input type="checkbox" name="genderList" value={g} className="h-4 w-4 rounded border-gray-300" />
                {g}
              </label>
            ))}
          </div>
        </div>

        {usesBelt && (
          <div className="sm:col-span-2">
            <label className="label">Grades allowed (tick one or more)</label>
            <p className="mb-2 text-xs text-gray-400">
              Same list as a student&apos;s Current Grade / Degree — colour belts and black belts together.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {GRADE_OPTIONS.map((g) => (
                <label key={g.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" name="gradeList" value={g.value} className="h-4 w-4 rounded border-gray-300" />
                  {g.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Leave a range blank, or leave Grades and Gender unticked, for &quot;no restriction&quot; on that criterion. Students
        outside the ranges you set here won&apos;t be selectable when registering into this category.
      </p>

      <button type="submit" className="btn-primary">
        + Add category
      </button>
    </form>
  );
}
