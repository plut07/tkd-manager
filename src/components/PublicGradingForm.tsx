"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { GRADE_OPTIONS } from "@/lib/belts";
import { COUNTRIES } from "@/lib/countries";
import {
  submitPublicGradingRegistration,
  type PublicRegisterState,
} from "@/app/public/events/[id]/register/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Submitting..." : "Submit registration"}
    </button>
  );
}

/**
 * Registering for a grading from the public page, with no account.
 *
 * The signature is drawn on a canvas and travels as a PNG data URL in a hidden
 * field, the same way the waiver signing page works. Once submitted the
 * registrant gets a link to their own completed form.
 */
export default function PublicGradingForm({
  eventId,
  clubs,
}: {
  eventId: string;
  clubs: { id: string; name: string }[];
}) {
  const [state, action] = useFormState<PublicRegisterState, FormData>(submitPublicGradingRegistration, undefined);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Match the backing store to the display size so lines aren't blurry.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";

    let drawing = false;
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setHasInk(true);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      e.preventDefault();
    };
    const up = () => { drawing = false; };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, []);

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const canvas = canvasRef.current;
    const field = e.currentTarget.elements.namedItem("signature") as HTMLInputElement | null;
    if (canvas && field && hasInk) field.value = canvas.toDataURL("image/png");
  }

  if (state?.ok) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Registration received</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your entry is with the organisers for approval. Keep a copy of your completed form — you can download it now
          or come back to this link later.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            href={`/api/public/grading-form?token=${state.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Download my form (PDF)
          </a>
        </div>
        <p className="mt-3 break-all text-xs text-gray-400">
          Your personal link: /api/public/grading-form?token={state.token}
        </p>
      </div>
    );
  }

  const values = (state?.ok === false ? state.values : undefined) ?? {};
  const field = "input";

  return (
    <form action={action} onSubmit={onSubmit} className="card space-y-4 p-6">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="signature" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fullName">Full name *</label>
          <input id="fullName" name="fullName" className={field} required defaultValue={values.fullName ?? ""} placeholder="As it should appear on the certificate" />
        </div>
        <div>
          <label className="label" htmlFor="nationalId">NRIC / Passport number *</label>
          <input id="nationalId" name="nationalId" className={field} required defaultValue={values.nationalId ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="birthday">Date of birth *</label>
          <input id="birthday" name="birthday" type="date" className={field} required defaultValue={values.birthday ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="gender">Gender *</label>
          <select id="gender" name="gender" className={field} required defaultValue={values.gender ?? ""}>
            <option value="" disabled>Choose</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="grade">Current grade / degree *</label>
          <select id="grade" name="grade" className={field} required defaultValue={values.grade ?? ""}>
            <option value="" disabled>Choose your current grade</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="clubId">Club</label>
          <select id="clubId" name="clubId" className={field} defaultValue={values.clubId ?? ""}>
            <option value="">Not listed / other</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="clubNameRaw">Club name (if not listed)</label>
          <input id="clubNameRaw" name="clubNameRaw" className={field} defaultValue={values.clubNameRaw ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="nationality">Nationality</label>
          <select id="nationality" name="nationality" className={field} defaultValue={values.nationality ?? ""}>
            <option value="">Choose</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className={field} defaultValue={values.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="phone">Contact number</label>
          <input id="phone" name="phone" className={field} defaultValue={values.phone ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="weightKg">Weight (kg)</label>
          <input id="weightKg" name="weightKg" type="number" step="0.1" min="0" className={field} defaultValue={values.weightKg ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="heightCm">Height (cm)</label>
          <input id="heightCm" name="heightCm" type="number" step="1" min="0" className={field} defaultValue={values.heightCm ?? ""} />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="label">Signature *</label>
        <p className="text-xs text-gray-500">Sign with your finger, stylus or mouse. This is printed on your form.</p>
        <canvas
          ref={canvasRef}
          className="mt-2 h-40 w-full touch-none rounded-md border border-dashed border-gray-300 bg-white"
        />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={clearSignature}>Clear</button>
          <span className="text-xs text-gray-400">{hasInk ? "Signed" : "Not signed yet"}</span>
        </div>
      </div>

      {state?.ok === false && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Submit />
        <span className="text-xs text-gray-400">
          Your entry goes to the organisers for approval. You&apos;ll be able to download your completed form straight
          after submitting.
        </span>
      </div>
    </form>
  );
}
