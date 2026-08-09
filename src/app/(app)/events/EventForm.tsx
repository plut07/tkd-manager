"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "./actions";
import { EVENT_TYPES } from "@/lib/eventCategories";
import CountrySelect from "@/components/CountrySelect";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function EventForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaultValues?: {
    name?: string;
    eventType?: string;
    discipline?: string;
    startDate?: string;
    endDate?: string;
    venue?: string;
    city?: string;
    country?: string;
    organizer?: string;
    description?: string;
    registrationDeadline?: string;
    status?: string;
    allowedCountries?: string[];
  };
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            Event name
          </label>
          <input id="name" name="name" className="input" defaultValue={defaultValues?.name} required />
        </div>
        <div>
          <label className="label" htmlFor="eventType">
            Event type
          </label>
          <select id="eventType" name="eventType" className="input" defaultValue={defaultValues?.eventType ?? ""} required>
            <option value="" disabled>
              Choose a type
            </option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="discipline">
            Discipline
          </label>
          <input
            id="discipline"
            name="discipline"
            className="input"
            placeholder="e.g. ITF Taekwon-Do"
            defaultValue={defaultValues?.discipline}
          />
        </div>
        <div>
          <span className="label">Status</span>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Set automatically from the dates (Singapore time): <strong>Upcoming</strong> before the start date,{" "}
            <strong>Ongoing</strong> during the event, <strong>Completed</strong> afterwards.
          </p>
          <div className="mt-2 space-y-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="isDraft" defaultChecked={defaultValues?.status === "draft"} />
              Draft — hide this event from the public listing
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="isCancelled" defaultChecked={defaultValues?.status === "cancelled"} />
              Cancelled — show as cancelled regardless of date
            </label>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="startDate">
            Start date
          </label>
          <input id="startDate" name="startDate" type="date" className="input" defaultValue={defaultValues?.startDate} required />
        </div>
        <div>
          <label className="label" htmlFor="endDate">
            End date
          </label>
          <input id="endDate" name="endDate" type="date" className="input" defaultValue={defaultValues?.endDate} />
        </div>
        <div>
          <label className="label" htmlFor="registrationDeadline">
            Registration deadline
          </label>
          <input
            id="registrationDeadline"
            name="registrationDeadline"
            type="date"
            className="input"
            defaultValue={defaultValues?.registrationDeadline}
          />
        </div>
        <div>
          <label className="label" htmlFor="organizer">
            Organizer
          </label>
          <input id="organizer" name="organizer" className="input" defaultValue={defaultValues?.organizer} />
        </div>
        <div>
          <label className="label" htmlFor="venue">
            Venue
          </label>
          <input id="venue" name="venue" className="input" defaultValue={defaultValues?.venue} />
        </div>
        <div>
          <label className="label" htmlFor="city">
            City
          </label>
          <input id="city" name="city" className="input" defaultValue={defaultValues?.city} />
        </div>
        <div>
          <label className="label" htmlFor="country">
            Country
          </label>
          <CountrySelect id="country" name="country" defaultValue={defaultValues?.country ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea id="description" name="description" rows={4} className="input" defaultValue={defaultValues?.description} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="allowedCountries">
            Eligible countries (clubs/students may only take part if their country is selected here — leave empty to allow every country)
          </label>
          <CountrySelect id="allowedCountries" name="allowedCountries" className="input h-40" multiple defaultValues={defaultValues?.allowedCountries ?? []} />
          <p className="mt-1 text-xs text-gray-400">Hold Ctrl/Cmd (or Shift for a range) to select multiple countries.</p>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
