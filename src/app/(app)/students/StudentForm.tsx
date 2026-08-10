"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "./actions";
import CountrySelect from "@/components/CountrySelect";
import GradeSelect from "@/components/GradeSelect";

type Club = { id: string; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function StudentForm({
  action,
  clubs,
  lockClub,
  submitLabel,
  defaultValues,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  clubs: Club[];
  lockClub?: { id: string; name: string } | null;
  submitLabel: string;
  defaultValues?: {
    clubId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    birthday?: string;
    weightKg?: number | null;
    heightCm?: number | null;
    grade?: string;
    gender?: string;
    nationality?: string;
    nationalId?: string;
    active?: boolean;
  };
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clubId">
            Club
          </label>
          {lockClub ? (
            <>
              <input className="input bg-gray-50" value={lockClub.name} disabled readOnly />
              <input type="hidden" name="clubId" value={lockClub.id} />
            </>
          ) : (
            <select id="clubId" name="clubId" className="input" defaultValue={defaultValues?.clubId} required>
              <option value="" disabled>
                Choose a club
              </option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label" htmlFor="gender">
            Gender
          </label>
          <select id="gender" name="gender" className="input" defaultValue={defaultValues?.gender ?? ""}>
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="firstName">
            First name
          </label>
          <input id="firstName" name="firstName" className="input uppercase" style={{ textTransform: "uppercase" }} defaultValue={defaultValues?.firstName} required />
        </div>
        <div>
          <label className="label" htmlFor="lastName">
            Last name
          </label>
          <input id="lastName" name="lastName" className="input uppercase" style={{ textTransform: "uppercase" }} defaultValue={defaultValues?.lastName} required />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="input" defaultValue={defaultValues?.email} />
        </div>
        <div>
          <label className="label" htmlFor="birthday">
            Birthday
          </label>
          <input id="birthday" name="birthday" type="date" className="input" defaultValue={defaultValues?.birthday} />
        </div>
        <div>
          <label className="label" htmlFor="weightKg">
            Weight (KG)
          </label>
          <input id="weightKg" name="weightKg" type="number" step="0.1" min="1" max="300" className="input" defaultValue={defaultValues?.weightKg ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="heightCm">
            Height (cm)
          </label>
          <input id="heightCm" name="heightCm" type="number" step="0.1" min="50" max="260" className="input" defaultValue={defaultValues?.heightCm ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="grade">
            Current Grade / Degree
          </label>
          <GradeSelect id="grade" name="grade" defaultValue={defaultValues?.grade ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="nationality">
            Nationality
          </label>
          <CountrySelect id="nationality" name="nationality" defaultValue={defaultValues?.nationality ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="nationalId">
            NRIC / Passport ID
          </label>
          <input id="nationalId" name="nationalId" className="input" defaultValue={defaultValues?.nationalId} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} />
        Active
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
