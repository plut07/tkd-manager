import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import BeltBadge from "@/components/BeltBadge";
import CopyLinkButton from "@/components/CopyLinkButton";
import CategoryCell from "@/components/CategoryCell";
import DeleteButton from "@/components/DeleteButton";
import { gradeValue, gradeLabel, GRADE_OPTIONS } from "@/lib/belts";
import { waiverAge, formatDob, computeAge } from "@/lib/eligibility";
import { unregisterStudent } from "./actions";

/**
 * Everyone entered for an event, with a breakdown of who they are.
 *
 * Filtering is done here rather than in the browser so the counts and the
 * summary always describe the same set of people the table is showing — a
 * filtered total that disagrees with the list underneath it is worse than none.
 */

export type RegistrationFilters = {
  club?: string;
  grade?: string;
  gender?: string;
  ageGroup?: string;
  status?: string;
};

/** Age bands wide enough to be useful without needing a custom range box. */
const AGE_GROUPS: { value: string; label: string; min: number; max: number }[] = [
  { value: "u10", label: "Under 10", min: 0, max: 9 },
  { value: "10-13", label: "10 to 13", min: 10, max: 13 },
  { value: "14-17", label: "14 to 17", min: 14, max: 17 },
  { value: "18-34", label: "18 to 34", min: 18, max: 34 },
  { value: "35+", label: "35 and over", min: 35, max: 200 },
];

function ageGroupOf(age: number | null): string | null {
  if (age == null) return null;
  return AGE_GROUPS.find((g) => age >= g.min && age <= g.max)?.value ?? null;
}

function tally(rows: any[], keyOf: (r: any) => string | null): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = keyOf(r) ?? "Not recorded";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export default async function RegisteredStudentsPanel({
  eventId,
  isGrading,
  canEdit,
  baseUrl,
  filters,
  hrefFor,
}: {
  eventId: string;
  isGrading: boolean;
  canEdit: boolean;
  baseUrl: string;
  filters: RegistrationFilters;
  /** Builds a link to this same tab with one filter changed. */
  hrefFor: (patch: Partial<RegistrationFilters>) => string;
}) {
  const supabase = supabaseAdmin();
  const { data: entries } = await supabase
    .from("event_registrations")
    .select(
      "id, status, competition_number, registered_at, waiver_token, clubs(id, name), students(full_name, birthday, gender, gup, dan, national_id, club_number), event_categories(name), waiver_signatures(signed_name, signed_at)"
    )
    .eq("event_id", eventId)
    .order("registered_at");

  const all = (entries ?? []) as any[];

  const matching = all.filter((r) => {
    if (filters.club && (r.clubs?.id ?? "") !== filters.club) return false;
    if (filters.gender && (r.students?.gender ?? "") !== filters.gender) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.grade && gradeValue(r.students?.gup ?? null, r.students?.dan ?? null) !== filters.grade) return false;
    if (filters.ageGroup && ageGroupOf(computeAge(r.students?.birthday ?? null)) !== filters.ageGroup) return false;
    return true;
  });

  // Filter choices come from who is actually entered, so there are no dead options.
  const clubOptions = Array.from(
    new Map(all.filter((r) => r.clubs?.id).map((r) => [r.clubs.id, r.clubs.name])).entries()
  ).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const gradeOptions = GRADE_OPTIONS.filter((g) =>
    all.some((r) => gradeValue(r.students?.gup ?? null, r.students?.dan ?? null) === g.value)
  );
  const genderOptions = Array.from(new Set(all.map((r) => r.students?.gender).filter(Boolean))) as string[];

  const filtered = Boolean(filters.club || filters.grade || filters.gender || filters.ageGroup || filters.status);

  const byClub = tally(matching, (r) => r.clubs?.name ?? null);
  const byGrade = tally(matching, (r) => {
    const label = gradeLabel(r.students?.gup ?? null, r.students?.dan ?? null);
    return label === "—" ? null : label;
  });
  const byAge = tally(matching, (r) => {
    const group = ageGroupOf(computeAge(r.students?.birthday ?? null));
    return AGE_GROUPS.find((g) => g.value === group)?.label ?? null;
  });
  const byGender = tally(matching, (r) => {
    const g = r.students?.gender;
    return g ? g.charAt(0).toUpperCase() + g.slice(1) : null;
  });

  const summaries: { title: string; rows: { label: string; count: number }[] }[] = [
    { title: "By club", rows: byClub },
    { title: "By grade / degree", rows: byGrade },
    { title: "By age", rows: byAge },
    { title: "By gender", rows: byGender },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Registered students</h2>
            <p className="mt-1 text-sm text-gray-500">Everyone entered for this event. Download a participation waiver for any of them.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/export/grading?eventId=${eventId}`} className="btn-secondary">Export to Excel</a>
            {all.length > 0 && (
              <a href={`/api/export/waiver?eventId=${eventId}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">All waivers (PDF)</a>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 text-sm">
          <FilterMenu label="Club" current={clubOptions.find(([id]) => id === filters.club)?.[1] as string | undefined}
            options={[{ href: hrefFor({ club: "" }), label: "All clubs", active: !filters.club },
              ...clubOptions.map(([id, name]) => ({ href: hrefFor({ club: String(id) }), label: String(name), active: filters.club === id }))]} />
          <FilterMenu label="Grade / Degree" current={GRADE_OPTIONS.find((g) => g.value === filters.grade)?.label}
            options={[{ href: hrefFor({ grade: "" }), label: "All grades", active: !filters.grade },
              ...gradeOptions.map((g) => ({ href: hrefFor({ grade: g.value }), label: g.label, active: filters.grade === g.value }))]} />
          <FilterMenu label="Age" current={AGE_GROUPS.find((g) => g.value === filters.ageGroup)?.label}
            options={[{ href: hrefFor({ ageGroup: "" }), label: "All ages", active: !filters.ageGroup },
              ...AGE_GROUPS.map((g) => ({ href: hrefFor({ ageGroup: g.value }), label: g.label, active: filters.ageGroup === g.value }))]} />
          <FilterMenu label="Gender" current={filters.gender ? filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1) : undefined}
            options={[{ href: hrefFor({ gender: "" }), label: "All genders", active: !filters.gender },
              ...genderOptions.map((g) => ({ href: hrefFor({ gender: g }), label: g.charAt(0).toUpperCase() + g.slice(1), active: filters.gender === g }))]} />
          <FilterMenu label="Status" current={filters.status ? filters.status.charAt(0).toUpperCase() + filters.status.slice(1) : undefined}
            options={[{ href: hrefFor({ status: "" }), label: "All statuses", active: !filters.status },
              { href: hrefFor({ status: "confirmed" }), label: "Confirmed", active: filters.status === "confirmed" },
              { href: hrefFor({ status: "pending" }), label: "Pending", active: filters.status === "pending" }]} />
          {filtered && (
            <Link href={hrefFor({ club: "", grade: "", gender: "", ageGroup: "", status: "" })} className="self-center text-xs font-medium text-brand-700 hover:underline">
              Clear all filters
            </Link>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No.</th><th>Name</th><th>Club</th><th>Grade / Degree</th>
                <th className="hidden lg:table-cell">Date of birth</th>
                <th className="hidden md:table-cell">Gender</th>
                <th className="hidden md:table-cell">Age</th>
                <th>Category</th>
                <th>Waiver</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {matching.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.competition_number ?? "—"}</td>
                  <td className="font-medium text-gray-900">{r.students?.full_name}</td>
                  <td>{r.clubs?.name ?? "—"}</td>
                  <td><BeltBadge gup={r.students?.gup ?? null} dan={r.students?.dan ?? null} /></td>
                  <td className="hidden lg:table-cell">{formatDob(r.students?.birthday ?? null)}</td>
                  <td className="hidden capitalize md:table-cell">{r.students?.gender ?? "—"}</td>
                  <td className="hidden md:table-cell">{waiverAge(r.students?.birthday ?? null) || "—"}</td>
                  <td>
                    {isGrading ? (
                      <CategoryCell registrationId={r.id} eventId={eventId} categoryName={r.event_categories?.name ?? null} canEdit={canEdit} />
                    ) : (
                      r.event_categories?.name ?? "—"
                    )}
                  </td>
                  <td>
                    {r.waiver_signatures ? (
                      <span className="badge bg-green-100 text-green-700" title={`Signed by ${r.waiver_signatures.signed_name}`}>Signed</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500">Not signed</span>
                    )}
                  </td>
                  <td><span className={`badge ${r.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span></td>
                  <td className="whitespace-nowrap text-right">
                    {/* Somebody who signed on the public form has nothing left to
                        sign, so the signing link makes way for their copy. */}
                    {!r.waiver_signatures && (
                      <>
                        <a href={`/public/waiver/${r.waiver_token}`} target="_blank" rel="noopener noreferrer" className="mr-3 text-sm font-medium text-brand-700 hover:underline">Sign</a>
                        <span className="mr-3"><CopyLinkButton url={`${baseUrl}/public/waiver/${r.waiver_token}`} /></span>
                      </>
                    )}
                    <a href={`/api/export/waiver?registrationId=${r.id}`} target="_blank" rel="noopener noreferrer" className="mr-3 text-sm font-medium text-brand-700 hover:underline">Preview PDF</a>
                    {r.waiver_signatures && (
                      <a href={`/api/export/waiver?registrationId=${r.id}&download=1`} className="mr-3 text-sm font-medium text-brand-700 hover:underline">Download PDF</a>
                    )}
                    {canEdit && (
                      <DeleteButton
                        action={unregisterStudent}
                        fieldName="registrationId"
                        fieldValue={r.id}
                        confirmLabel={`Remove ${r.students?.full_name} from this event?`}
                        label="Remove"
                        extraFields={{ eventId }}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {matching.length === 0 && (
                <tr><td colSpan={11} className="py-6 text-center text-gray-400">
                  {all.length === 0 ? "Nobody has registered for this event yet." : "No students match these filters."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-sm">
          <span className="font-semibold text-gray-900">
            Total: {matching.length} student{matching.length === 1 ? "" : "s"}
          </span>
          {filtered && <span className="text-gray-500">Filtered from {all.length} registered</span>}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Summary of {matching.length} student{matching.length === 1 ? "" : "s"}
          {filtered ? " matching the filters" : " registered"}
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {summaries.map((s) => (
            <div key={s.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.title}</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {s.rows.map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-2">
                    <span className="text-gray-700">{row.label}</span>
                    <span className="font-semibold text-gray-900">{row.count}</span>
                  </li>
                ))}
                {s.rows.length === 0 && <li className="text-gray-400">Nothing to show.</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A filter shown as a row of links, so a filtered view can be bookmarked. */
function FilterMenu({
  label,
  current,
  options,
}: {
  label: string;
  current?: string;
  options: { href: string; label: string; active: boolean }[];
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-brand-300">
        <span className="text-gray-500">{label}:</span> <span className="font-medium">{current ?? "All"}</span>
      </summary>
      <div className="absolute z-10 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
        {options.map((o) => (
          <Link
            key={o.href + o.label}
            href={o.href}
            className={`block rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${o.active ? "font-semibold text-brand-700" : "text-gray-700"}`}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
