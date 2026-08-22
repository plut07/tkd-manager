"use client";
import { useFormState, useFormStatus } from "react-dom";
import TemplateDesigner from "./TemplateDesigner";
import { uploadTemplate, deleteTemplate, setDefaultTemplate, type TemplateState } from "@/app/(app)/events/templateActions";
import type { TemplateFieldDef } from "@/lib/templateFields";
import TemplateGrades from "./TemplateGrades";

export type TemplateSummary = {
  id: string;
  name: string;
  page_count: number;
  page_width: number;
  page_height: number;
  is_default: boolean;
  field_count: number;
  alignment: { offsetX: number; offsetY: number; scale: number };
  /** For result forms: the grades this one covers. Empty means any. */
  grades?: string[];
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Uploading..." : label}</button>;
}

/**
 * The forms an event prints from.
 *
 * Several can be kept side by side — a waiver, an indemnity, a club's own sheet
 * — and whichever is marked default is the one a registrant's PDF comes out on.
 * The boxes are drawn per template, so switching the default switches the
 * layout with it.
 */
export default function TemplateTab({
  eventId,
  templates,
  editing,
  fields,
  canEdit,
  registeredCount = 0,
  purpose = "registration",
  catalogue,
  title = "Form templates",
  intro,
  linkPrefix = "?tab=registration&sub=template",
}: {
  eventId: string;
  templates: TemplateSummary[];
  /** The template whose boxes are open in the designer. */
  editing: TemplateSummary | null;
  fields: any[];
  canEdit: boolean;
  registeredCount?: number;
  /** "registration" for the form a candidate signs, "exam" for the result form. */
  purpose?: "registration" | "exam";
  catalogue?: TemplateFieldDef[];
  title?: string;
  intro?: string;
  linkPrefix?: string;
}) {
  const [state, action] = useFormState<TemplateState, FormData>(uploadTemplate, undefined);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {intro ??
            "Upload the printed forms for this event and mark where each detail should appear. The form marked Default is the one a registrant's PDF is printed on. Templates stay here until you remove them."}
        </p>

        {templates.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">
                    {t.name}
                    {t.is_default && <span className="ml-2 badge bg-green-100 text-green-700">Default</span>}
                    {editing?.id === t.id && <span className="ml-2 badge bg-brand-100 text-brand-700">Editing</span>}
                  </p>
                  <p className="mt-0.5 text-gray-600">
                    {t.page_count} page{t.page_count === 1 ? "" : "s"} · {t.field_count} field{t.field_count === 1 ? "" : "s"} placed
                  </p>
                  <a href={`/api/templates/${t.id}/file`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">
                    View the uploaded file
                  </a>
                </div>
                <div className="relative flex flex-wrap items-center gap-3">
                  {purpose === "exam" && (
                    <TemplateGrades templateId={t.id} eventId={eventId} grades={t.grades ?? []} canEdit={canEdit} />
                  )}
                  {canEdit && editing?.id !== t.id && (
                    <a href={`${linkPrefix}&template=${t.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                      Place fields
                    </a>
                  )}
                  {canEdit && !t.is_default && (
                    <form action={setDefaultTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <button type="submit" className="text-sm font-medium text-brand-700 hover:underline">Make default</button>
                    </form>
                  )}
                  {canEdit && (
                    <form action={deleteTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Remove</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No templates uploaded yet — printed forms use the built-in layout.</p>
        )}

        {templates.length > 0 && registeredCount > 0 && (
          <p className="mt-3 text-xs text-gray-400">Applies to all {registeredCount} registered student{registeredCount === 1 ? "" : "s"}.</p>
        )}

        {canEdit && (
          <form action={action} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="purpose" value={purpose} />
            <input type="file" name="file" accept="application/pdf,.pdf" required
              className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700" />
            <Submit label="Upload another form" />
          </form>
        )}
        {state?.ok === false && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      </div>

      {editing && canEdit && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900">Fields on &ldquo;{editing.name}&rdquo;</h3>
          {editing.field_count === 0 && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No fields placed yet, so this form prints blank. Draw boxes below and press Save layout.
            </p>
          )}
          <div className="mt-4">
            <TemplateDesigner
              templateId={editing.id}
              eventId={eventId}
              pageCount={editing.page_count}
              pageWidth={Number(editing.page_width)}
              pageHeight={Number(editing.page_height)}
              initialFields={fields.map((f, i) => ({
                id: `saved${i}`,
                field_key: f.field_key,
                page: f.page,
                x: Number(f.x), y: Number(f.y), width: Number(f.width), height: Number(f.height),
                font_size: Number(f.font_size), align: f.align,
              }))}
              alignment={editing.alignment}
              catalogue={catalogue}
            />
          </div>
        </div>
      )}
    </div>
  );
}
