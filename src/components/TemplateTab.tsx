"use client";
import { useFormState, useFormStatus } from "react-dom";
import TemplateDesigner from "./TemplateDesigner";
import { uploadTemplate, type TemplateState } from "@/app/(app)/events/templateActions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Uploading..." : label}</button>;
}

export default function TemplateTab({
  eventId,
  template,
  fields,
  canEdit,
}: {
  eventId: string;
  template: { id: string; name: string; page_count: number } | null;
  fields: any[];
  canEdit: boolean;
}) {
  const [state, action] = useFormState<TemplateState, FormData>(uploadTemplate, undefined);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Form template</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload the printed form for this event, then mark where each detail should appear. Waivers printed from the
          Registered students tab will use it instead of the built-in layout.
        </p>

        {canEdit && (
          <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="file" name="file" accept="application/pdf,.pdf" required
              className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700" />
            <Submit label={template ? "Replace template" : "Upload template"} />
          </form>
        )}
        {state?.ok === false && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
        {template && (
          <p className="mt-3 text-sm text-gray-600">
            Current template: <strong>{template.name}</strong> ({template.page_count} page{template.page_count === 1 ? "" : "s"}) ·{" "}
            <a href={`/api/templates/${template.id}/file`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">view original</a>
          </p>
        )}
      </div>

      {template ? (
        canEdit ? (
          <div className="card p-6">
            <TemplateDesigner
              templateId={template.id}
              eventId={eventId}
              pageCount={template.page_count}
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
      ) : (
        <div className="card p-6 text-center text-sm text-gray-500">
          No template uploaded yet — printed waivers will use the built-in layout.
        </div>
      )}
    </div>
  );
}
