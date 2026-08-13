"use client";
import { useFormState, useFormStatus } from "react-dom";
import TemplateDesigner from "./TemplateDesigner";
import { uploadTemplate, deleteTemplate, type TemplateState } from "@/app/(app)/events/templateActions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Uploading..." : label}</button>;
}

export default function TemplateTab({
  eventId,
  template,
  fields,
  canEdit,
  registeredCount = 0,
}: {
  eventId: string;
  template: { id: string; name: string; page_count: number; page_width: number; page_height: number } | null;
  fields: any[];
  canEdit: boolean;
  registeredCount?: number;
}) {
  const [state, action] = useFormState<TemplateState, FormData>(uploadTemplate, undefined);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Form template</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload the printed form for this event, then mark where each detail should appear. One template covers the
          whole event: every student&apos;s form is printed from it, with their own details filled into the boxes you
          place. It stays here until you replace or remove it.
        </p>

        {template ? (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{template.name}</p>
                <p className="mt-0.5 text-gray-600">
                  {template.page_count} page{template.page_count === 1 ? "" : "s"} · {fields.length} field
                  {fields.length === 1 ? "" : "s"} placed · applies to {registeredCount} registered student
                  {registeredCount === 1 ? "" : "s"}
                </p>
                <a
                  href={`/api/templates/${template.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-medium text-brand-700 hover:underline"
                >
                  View the uploaded file
                </a>
              </div>
              {canEdit && (
                <form action={deleteTemplate}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="eventId" value={eventId} />
                  <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
                    Remove template
                  </button>
                </form>
              )}
            </div>
            {fields.length === 0 && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No fields placed yet, so printed forms still use the built-in layout. Draw boxes below and save to start
                using this template.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No template uploaded yet — printed forms use the built-in layout.</p>
        )}

        {canEdit && (
          <form action={action} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="file" name="file" accept="application/pdf,.pdf" required
              className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700" />
            <Submit label={template ? "Replace template" : "Upload template"} />
            {template && (
              <span className="w-full text-xs text-gray-400">
                Replacing removes the current template and the boxes drawn on it.
              </span>
            )}
          </form>
        )}
        {state?.ok === false && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      </div>

      {template ? (
        canEdit ? (
          <div className="card p-6">
            <TemplateDesigner
              templateId={template.id}
              eventId={eventId}
              pageCount={template.page_count}
              pageWidth={Number(template.page_width)}
              pageHeight={Number(template.page_height)}
              initialFields={fields.map((f, i) => ({
                id: `saved${i}`,
                field_key: f.field_key,
                page: f.page,
                x: Number(f.x), y: Number(f.y), width: Number(f.width), height: Number(f.height),
                font_size: Number(f.font_size), align: f.align,
              }))}
            />
          </div>
        ) : (
          <div className="card p-6 text-sm text-gray-500">
            A form template is set up for this event. Ask an organizer if it needs changing.
          </div>
        )
      ) : null}
    </div>
  );
}
