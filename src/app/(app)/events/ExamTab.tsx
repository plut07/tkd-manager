import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ExamGrid from "@/components/ExamGrid";
import Link from "next/link";
import { requireSession } from "@/lib/authz";
import SyllabusEditor from "@/components/SyllabusEditor";
import TemplateTab from "@/components/TemplateTab";
import { catalogueFor } from "@/lib/templateFields";
import { loadExamRows, loadSyllabusSet, syncAllGradingCategories, addAllGradingCategories } from "./examActions";

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
  templateId,
}: {
  eventId: string;
  canMark: boolean;
  /** "main", "syllabus" or "form". */
  sub: string;
  hrefFor: (sub: string) => string;
  /** Which result template's boxes are open, if any. */
  templateId?: string;
}) {
  const session = await requireSession();
  const syllabus = await loadSyllabusSet(eventId);
  const supabase = supabaseAdmin();
  const { data: categories } = await supabase
    .from("event_categories")
    .select("id, name, exam_events")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("name");

  const rows = await loadExamRows(eventId, []);

  const { data: resultForm } = await supabase
    .from("event_form_templates")
    .select("id")
    .eq("event_id", eventId)
    .eq("purpose", "exam")
    .eq("is_default", true)
    .maybeSingle();
  const tabs = [
    { key: "main", label: "Main Page" },
    { key: "syllabus", label: "Exam Syllabus" },
    { key: "form", label: "Result Form" },
  ];

  // The result form can place anything on this event's syllabus, so its field
  // list is built from the same sheet the marking screen uses.
  // The result form can place anything from any of this event's syllabuses, so
  // a form drawn once still works when different grades sit different sheets.
  const catalogue = catalogueFor(
    Array.from(
      new Map(
        [syllabus.fallback, ...Object.values(syllabus.byGrade)].flat().map((c) => [c.key, c]),
      ).values(),
    ),
  );

  const { data: templateRows } = sub === "form"
    ? await supabase
        .from("event_form_templates")
        .select("id, name, page_count, page_width, page_height, is_default, created_at, offset_x, offset_y, scale")
        .eq("event_id", eventId)
        .eq("purpose", "exam")
        .order("created_at")
    : { data: null };
  const templateIds = (templateRows ?? []).map((t: any) => t.id);
  const { data: allFields } = templateIds.length > 0
    ? await supabase.from("event_form_fields").select("template_id, field_key, page, x, y, width, height, font_size, align").in("template_id", templateIds)
    : { data: null };
  const fieldsByTemplate = new Map<string, any[]>();
  for (const f of allFields ?? []) {
    if (!fieldsByTemplate.has(f.template_id)) fieldsByTemplate.set(f.template_id, []);
    fieldsByTemplate.get(f.template_id)!.push(f);
  }
  const templates = (templateRows ?? []).map((t: any) => ({
    id: t.id, name: t.name, page_count: t.page_count, page_width: t.page_width, page_height: t.page_height,
    is_default: t.is_default, field_count: (fieldsByTemplate.get(t.id) ?? []).length,
    alignment: { offsetX: Number(t.offset_x) || 0, offsetY: Number(t.offset_y) || 0, scale: Number(t.scale) || 1 },
  }));
  const editingTemplate =
    templates.find((t) => t.id === templateId) ?? templates.find((t) => t.is_default) ?? templates[0] ?? null;

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
        <SyllabusEditor eventId={eventId} syllabus={syllabus} canEdit={canMark} />
      ) : sub === "form" ? (
        <div className="space-y-4">
          <TemplateTab
            eventId={eventId}
            templates={templates}
            editing={editingTemplate}
            fields={editingTemplate ? fieldsByTemplate.get(editingTemplate.id) ?? [] : []}
            canEdit={canMark}
            registeredCount={rows.length}
            purpose="exam"
            catalogue={catalogue}
            title="Result form"
            intro="The form each candidate's result is printed on. Place the syllabus fields — a component's alloted mark, a pattern and what it scored, the total, PASSED or FAILED, the examiner's signature — and every candidate in this exam prints on it, filled with their own marks."
            linkPrefix="?tab=exam&sub=form"
          />
          {templates.length > 0 && rows.length > 0 && (
            <div className="card p-4">
              <a href={`/api/export/exam-form?eventId=${eventId}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                Print every marked candidate
              </a>
              <span className="ml-3 text-xs text-gray-400">One copy each, in competition-number order.</span>
            </div>
          )}
        </div>
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
        syllabus={syllabus}
        examinerName={session.fullName || session.username}
        hasResultForm={Boolean(resultForm)}
      />
      </>
      )}
    </div>
  );
}
