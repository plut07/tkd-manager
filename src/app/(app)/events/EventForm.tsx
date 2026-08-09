"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "./actions";
import { EVENT_TYPES } from "@/lib/eventCategories";
import CountrySelect from "@/components/CountrySelect";
import CountryCheckboxes from "@/components/CountryCheckboxes";
import VenueMap from "@/components/VenueMap";

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
  clubs,
  defaultValues,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  clubs: { id: string; name: string }[];
  defaultValues?: {
    name?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    venue?: string;
    venueAddress?: string;
    country?: string;
    organizerClubId?: string;
    description?: string;
    registrationDeadline?: string;
    status?: string;
    allowedCountries?: string[];
  };
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, undefined);
  const [address, setAddress] = useState(defaultValues?.venueAddress ?? "");

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Event name</label>
          <input id="name" name="name" className="input" defaultValue={defaultValues?.name} required />
        </div>

        <div>
          <label className="label" htmlFor="eventType">Event type</label>
          <select id="eventType" name="eventType" className="input" defaultValue={defaultValues?.eventType ?? ""} required>
            <option value="" disabled>Choose a type</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="organizerClubId">Organizer</label>
          <select id="organizerClubId" name="organizerClubId" className="input" defaultValue={defaultValues?.organizerClubId ?? ""} required>
            <option value="" disabled>Choose a club</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {clubs.length === 0 && (
            <p className="mt-1 text-xs text-red-600">No active clubs yet — add a club before creating an event.</p>
          )}
        </div>

        <div>
          <span className="label">Status</span>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Set automatically from the dates (Singapore time): <strong>Upcoming</strong> before the start,{" "}
            <strong>Ongoing</strong> during, <strong>Completed</strong> afterwards.
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
          <label className="label" htmlFor="startDate">Starts</label>
          <input id="startDate" name="startDate" type="datetime-local" className="input" defaultValue={defaultValues?.startDate} required />
          <p className="mt-1 text-xs text-gray-400">All times are Singapore time (UTC+8).</p>
        </div>

        <div>
          <label className="label" htmlFor="endDate">Ends</label>
          <input id="endDate" name="endDate" type="datetime-local" className="input" defaultValue={defaultValues?.endDate} />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="registrationDeadline">Registration deadline</label>
          <input id="registrationDeadline" name="registrationDeadline" type="datetime-local" className="input" defaultValue={defaultValues?.registrationDeadline} />
          <p className="mt-1 text-xs text-gray-400">
            Once this passes, only a Super Admin or whoever created the event can add or amend entries.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="venue">Venue name</label>
          <input id="venue" name="venue" className="input" placeholder="e.g. Singapore Sports Hub" defaultValue={defaultValues?.venue} />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="venueAddress">Venue address</label>
          <input
            id="venueAddress"
            name="venueAddress"
            className="input"
            placeholder="1 Stadium Dr, Singapore 397629"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-400">Type or paste the full address — the map below updates as you type.</p>
          <VenueMap address={address} className="mt-3" />
        </div>

        <div>
          <label className="label" htmlFor="country">Country</label>
          <CountrySelect id="country" name="country" defaultValue={defaultValues?.country ?? ""} />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={4} className="input" defaultValue={defaultValues?.description} />
        </div>

        <div className="sm:col-span-2">
          <span className="label">Eligible countries</span>
          <p className="mb-2 text-xs text-gray-400">
            Tick the countries whose clubs may take part. Leave everything unticked to open the event to all.
          </p>
          <CountryCheckboxes name="allowedCountries" defaultValues={defaultValues?.allowedCountries ?? []} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
