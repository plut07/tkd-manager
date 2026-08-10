"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { RequestState } from "@/app/public/register/actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Sending..." : "Send request"}</button>;
}

export default function AccessRequestForm({
  action,
  clubs,
}: {
  action: (prev: RequestState, formData: FormData) => Promise<RequestState>;
  clubs: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState<RequestState, FormData>(action, undefined);

  if (state?.ok) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold text-green-700">Request sent</h2>
        <p className="mt-2 text-sm text-gray-600">
          A Super Admin will review it. Once approved you can sign in with the User ID and password you chose — there&apos;s
          nothing else to do, and no email will be sent, so please check back or ask your instructor.
        </p>
        <Link href="/public/events" className="btn-secondary mt-4 inline-flex">Back to events</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="username">User ID <span className="text-red-600">*</span></label>
          <input id="username" name="username" className="input" required placeholder="e.g. weitan" />
          <p className="mt-1 text-xs text-gray-400">Letters, numbers, dot, dash and underscore.</p>
        </div>
        <div>
          <label className="label" htmlFor="password">Password <span className="text-red-600">*</span></label>
          <input id="password" name="password" type="password" className="input" required minLength={8} />
          <p className="mt-1 text-xs text-gray-400">At least 8 characters. Stored securely; nobody can read it back.</p>
        </div>
        <div>
          <label className="label" htmlFor="fullName">Full name <span className="text-red-600">*</span></label>
          <input id="fullName" name="fullName" className="input uppercase" style={{ textTransform: "uppercase" }} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email <span className="text-red-600">*</span></label>
          <input id="email" name="email" type="email" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Contact number</label>
          <input id="phone" name="phone" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="clubId">Your club</label>
          <select id="clubId" name="clubId" className="input" defaultValue="">
            <option value="">Not listed / new club</option>
            {clubs.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="clubNameRaw">If your club isn&apos;t listed, type its name</label>
          <input id="clubNameRaw" name="clubNameRaw" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="message">Anything the reviewer should know</label>
          <textarea id="message" name="message" rows={3} className="input" />
        </div>
      </div>
      {state?.ok === false && <p className="text-sm text-red-600">{state.error}</p>}
      <p className="text-xs text-gray-500">
        New accounts are created as <strong>Club User</strong>. A Super Admin can change that when approving.
      </p>
      <Submit />
    </form>
  );
}
