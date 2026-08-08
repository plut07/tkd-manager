"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "./actions";

type Role = { id: string; code: string; name: string };
type Club = { id: string; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function UserForm({
  action,
  roles,
  clubs,
  submitLabel,
  defaultValues,
  passwordHint,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  roles: Role[];
  clubs: Club[];
  submitLabel: string;
  passwordHint: string;
  defaultValues?: {
    username?: string;
    fullName?: string;
    email?: string;
    roleId?: string;
    clubId?: string;
    active?: boolean;
  };
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="username">
            User ID
          </label>
          <input id="username" name="username" className="input" defaultValue={defaultValues?.username} required />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" className="input" placeholder={passwordHint} />
        </div>
        <div>
          <label className="label" htmlFor="fullName">
            Full name
          </label>
          <input id="fullName" name="fullName" className="input" defaultValue={defaultValues?.fullName} required />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="input" defaultValue={defaultValues?.email} />
        </div>
        <div>
          <label className="label" htmlFor="roleId">
            Role
          </label>
          <select id="roleId" name="roleId" className="input" defaultValue={defaultValues?.roleId} required>
            <option value="" disabled>
              Choose a role
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="clubId">
            Club{" "}
            <span className="text-gray-400 font-normal">(required for Club User)</span>
          </label>
          <select id="clubId" name="clubId" className="input" defaultValue={defaultValues?.clubId ?? ""}>
            <option value="">No club</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} />
        Active (can sign in)
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
