import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ExamGrid from "@/components/ExamGrid";
import Link from "next/link";
import { requireSession } from "@/lib/authz";
import SyllabusEditor from "@/components/SyllabusEditor";
import { loadExamRows, loadSyllabus, syncAllGradingCategories, addAllGradingCategories } from "./examActions";

/**
 * Marking sheet for a grading event.
 *
 * The categories are the grades being examined for, created automatically as
 * candidates register, so this only ever lists grades that somebody is actually
 * sitting for.
 */
export default async function ExamTab({
  eventId,
  canMark,
  sub,
  hrefFor,
}: {
  eventId: string;
  canMark: boolean;
  /** "main" or "syllabus". */
  sub: string;
  hrefFor: (sub: string) => string;
}) {
  const session = await requireSession();
  const sheet = await loadSyllabus(eventId);
  const supabase = supabaseAdmin();
  const { data: categories } = await supabase
    .from("event_categories")
    .select("id, name, exam_events")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("name");

  const rows = await loadExamRows(eventId, []);
  const tabs = [
    { key: "main", label: "Main Page" },
    { key: "syllabus", label: "Exam Syllabus" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-md bg-gray-100 p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              sub === t.key ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {sub === "syllabus" ? (
        <SyllabusEditor eventId={eventId} initialSheet={sheet} canEdit={canMark} />
      ) : (
      <>
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Exam</h2>
        <p className="mt-1 text-sm text-gray-500">
          Score each candidate out of ten. Several examiners can mark at the same time — each candidate is saved on
          their own, and everyone&apos;s screen updates as marks come in.
        </p>
        {canMark && (
          <form action={syncAllGradingCategories} className="mt-4 flex flex-wrap items-center gap-2">
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" className="btn-secondary">Update categories from current grades</button>
          </form>
        )}
        {canMark && (
          <form action={addAllGradingCategories} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" className="btn-secondary">Add all categories</button>
            <span className="text-xs text-gray-400">
              &quot;Update categories&quot; re-checks every candidate&apos;s grade and moves them into the right
              category, leaving any you set by hand alone. &quot;Add all categories&quot; creates the full ladder up
              front so you can choose each one&apos;s events before anybody registers.
            </span>
          </form>
        )}
        {!canMark && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You can follow the marking here, but you don&apos;t have permission to enter scores for this event.
          </p>
        )}
      </div>
      <ExamGrid
        eventId={eventId}
        categories={(categories ?? []).map((c: any) => ({ id: c.id, name: c.name, examEvents: (c.exam_events as string[] | null) ?? [] }))}
        initialRows={rows}
        canMark={canMark}
        sheet={sheet}
        examinerName={session.fullName || session.username}
      />
      </>
      )}
    </div>
  );
}
