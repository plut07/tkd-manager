"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMySignature } from "@/app/(app)/users/actions";

/**
 * An examiner's own signature, drawn once and reused.
 *
 * Kept on the account rather than redrawn on every candidate's sheet: an
 * examiner marking twenty people shouldn't sign twenty times, and a signature
 * that varies each time is worth less, not more.
 */
export default function MySignaturePad({ initial }: { initial: string | null }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saved, setSaved] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    setBusy(true);
    setStatus("");
    const png = canvas.toDataURL("image/png");
    const result = await saveMySignature({ signature: png });
    setBusy(false);
    if ("error" in result) {
      setStatus(result.error);
      return;
    }
    setSaved(png);
    setStatus("Saved. Use Import my signature when marking.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await saveMySignature({ signature: null });
    setBusy(false);
    setSaved(null);
    clear();
    setStatus("Removed.");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">My signature</h2>
      <p className="mt-1 text-sm text-gray-500">
        Draw it once here, then use <strong>Import my signature</strong> on a grading sheet instead of signing each one.
      </p>

      {saved && (
        <div className="mt-4">
          <span className="label text-xs">Currently saved</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saved} alt="Your saved signature" className="h-20 rounded-md border border-gray-200 bg-white" />
        </div>
      )}

      <div className="mt-4">
        <span className="label text-xs">{saved ? "Draw a new one to replace it" : "Draw your signature"}</span>
        <canvas ref={canvasRef} className="h-32 w-full max-w-lg touch-none rounded-md border border-dashed border-gray-300 bg-white" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy || !hasInk} onClick={() => { void save(); }}>
          {busy ? "Saving..." : "Save signature"}
        </button>
        <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={clear}>Clear</button>
        {saved && (
          <button type="button" className="text-sm font-medium text-red-600 hover:underline" disabled={busy} onClick={() => { void remove(); }}>
            Remove saved signature
          </button>
        )}
        {status && <span className="text-sm text-gray-600">{status}</span>}
      </div>
    </div>
  );
}
