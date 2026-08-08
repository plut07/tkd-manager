"use client";

export default function DeleteButton({
  action,
  fieldName,
  fieldValue,
  confirmLabel = "Are you sure?",
  label = "Delete",
  extraFields,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fieldName: string;
  fieldValue: string;
  confirmLabel?: string;
  label?: string;
  extraFields?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmLabel)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name={fieldName} value={fieldValue} />
      {extraFields &&
        Object.entries(extraFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
        {label}
      </button>
    </form>
  );
}
