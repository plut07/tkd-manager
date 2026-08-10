"use client";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { SignState } from "@/app/public/waiver/[token]/actions";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || disabled}>
      {pending ? "Saving..." : "Submit signature"}
    </button>
  );
}

/**
 * Draw-to-sign pad.
 *
 * Uses pointer events so a finger, stylus and mouse all behave the same. The
 * drawing is written into a hidden field as a PNG data URL when submitted, so
 * the form posts like any other form.
 */
export default function SignaturePad({
  token,
  action,
  defaultName,
  alreadySigned,
}: {
  token: string;
  action: (prev: SignState, formData: FormData) => Promise<SignState>;
  defaultName: string;
  alreadySigned: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [state, formAction] = useFormState<SignState, FormData>(action, undefined);

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
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setHasInk(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons === 0) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  if (state?.ok) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold text-green-700">Signature saved</h2>
        <p className="mt-2 text-sm text-gray-600">
          Thank you. The signed waiver is now available to the organizer, and can still be printed.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        const canvas = canvasRef.current;
        fd.set("signature", canvas && hasInk ? canvas.toDataURL("image/png") : "");
        return formAction(fd);
      }}
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="token" value={token} />

      {alreadySigned && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This waiver has already been signed. Signing again replaces the previous signature.
        </p>
      )}

      <div>
        <label className="label" htmlFor="signedName">Name of the person signing <span className="text-red-600">*</span></label>
        <input id="signedName" name="signedName" className="input uppercase" style={{ textTransform: "uppercase" }} defaultValue={defaultName} required />
        <p className="mt-1 text-xs text-gray-400">For a participant under 18, this is the parent or guardian.</p>
      </div>

      <div>
        <span className="label">Signature <span className="text-red-600">*</span></span>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          className="h-44 w-full touch-none rounded-md border border-dashed border-gray-300 bg-white"
        />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={clear} className="btn-secondary !px-3 !py-1.5 text-xs">Clear</button>
          <span className="text-xs text-gray-400">Sign with your finger, stylus or mouse.</span>
        </div>
      </div>

      {state?.ok === false && <p className="text-sm text-red-600">{state.error}</p>}
      <Submit disabled={!hasInk} />
    </form>
  );
}
