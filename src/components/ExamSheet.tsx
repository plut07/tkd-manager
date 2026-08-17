"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHEET,
  BREAKING_ATTEMPTS,
  componentsFor,
  componentTotal,
  markValue,
  sheetTotal,
  marksSayPassed,
  SHEET_TOTAL_MAX,
  PASS_MARK,
  REMARK_MAX,
  type SheetMarks,
} from "@/lib/gradingSheet";

export type SheetDraft = {
  marks: SheetMarks;
  remark: string;
  passed: boolean;
  approvedRank: string;
  examinerName: string;
  examinerSignature: string | null;
};

/**
 * One candidate's marking sheet, laid out like the paper form.
 *
 * Components down the left, their columns across the middle, Max and Alloted on
 * the right. Alloted adds the columns up and stops at the component's Max, so
 * over-generous individual marks can't inflate a component past its share.
 */
export default function ExamSheet({
  studentName,
  clubName,
  currentGrade,
  categoryName,
  components,
  draft,
  locked,
  canMark,
  onChange,
}: {
  studentName: string;
  clubName: string | null;
  currentGrade: string;
  categoryName: string | null;
  components: string[];
  draft: SheetDraft;
  locked: boolean;
  canMark: boolean;
  onChange: (patch: Partial<SheetDraft>) => void;
}) {
  const inPlay = componentsFor(components);
  const inPlayKeys = new Set(inPlay.map((c) => c.key));
  const total = sheetTotal(draft.marks, inPlay);
  const wouldPass = marksSayPassed(draft.marks, inPlay);
  const disabled = !canMark || locked;

  function setMark(key: string, value: string, max: number) {
    const next = { ...draft.marks };
    if (value === "") delete next[key];
    else next[key] = Math.min(Math.max(Number(value) || 0, 0), max);
    onChange({ marks: next });
  }

  function setMethod(key: string, value: string) {
    const next = { ...draft.marks };
    if (value.trim() === "") delete next[key];
    else next[key] = value.slice(0, 80);
    onChange({ marks: next });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{studentName}</h3>
          <p className="text-xs text-gray-500">
            {clubName ?? "No club"} · currently {currentGrade}
            {categoryName ? ` · grading for ${categoryName}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            {total}
            <span className="text-sm font-normal text-gray-400"> / {SHEET_TOTAL_MAX}</span>
          </p>
          <span className={`badge ${draft.passed ? "bg-green-100 text-green-700" : wouldPass ? "bg-green-50 text-green-700" : "bg-red-100 text-red-700"}`}>
            {draft.passed ? "PASSED" : wouldPass ? `PASSED (${PASS_MARK}+)` : "FAILED"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-2 py-1 text-left">Components</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Content</th>
              <th className="w-16 border border-gray-300 px-2 py-1 text-center">Max</th>
              <th className="w-20 border border-gray-300 px-2 py-1 text-center">Alloted</th>
            </tr>
          </thead>
          <tbody>
            {SHEET.map((component) => {
              const active = inPlayKeys.has(component.key);
              const alloted = componentTotal(component, draft.marks);
              return (
                <tr key={component.key} className={active ? undefined : "opacity-40"}>
                  <td className="border border-gray-300 px-2 py-2 align-top font-semibold text-gray-800">
                    {component.label}
                    {!active && <span className="block text-xs font-normal text-gray-400">not sat</span>}
                  </td>
                  <td className="border border-gray-300 px-2 py-2">
                    {!active ? (
                      <span className="text-xs text-gray-400">Not part of this category&apos;s exam.</span>
                    ) : component.methodRows ? (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="w-8 px-1 py-0.5 text-left text-gray-500"></th>
                            <th className="px-1 py-0.5 text-left text-gray-500">Method</th>
                            {BREAKING_ATTEMPTS.map((a) => (
                              <th key={a} className="w-24 px-1 py-0.5 text-center text-gray-500">{a}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {component.methodRows.map((row, i) => (
                            <tr key={row.key}>
                              <td className="px-1 py-0.5 text-gray-500">{row.label}</td>
                              <td className="px-1 py-0.5">
                                <input
                                  type="text"
                                  className="input !py-1 text-xs"
                                  placeholder="What was broken"
                                  value={String(draft.marks[row.key] ?? "")}
                                  disabled={disabled}
                                  onChange={(e) => setMethod(row.key, e.target.value)}
                                />
                              </td>
                              {[1, 2, 3].map((attempt) => {
                                const key = `pb_m${i + 1}_a${attempt}`;
                                return (
                                  <td key={key} className="px-1 py-0.5 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={component.itemMax}
                                      step="0.5"
                                      className="input !w-16 !px-1 !py-1 text-center text-xs"
                                      value={markValue(draft.marks, key) ?? ""}
                                      disabled={disabled}
                                      aria-label={`Method ${i + 1}, attempt ${attempt}`}
                                      onChange={(e) => setMark(key, e.target.value, component.itemMax)}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {component.items.map((item) => (
                          <label key={item.key} className="text-xs text-gray-600">
                            <span className="block whitespace-nowrap">{item.label}</span>
                            <input
                              type="number"
                              min={0}
                              max={component.itemMax}
                              step="0.5"
                              className="input !w-20 !px-1 !py-1 text-center"
                              value={markValue(draft.marks, item.key) ?? ""}
                              disabled={disabled}
                              placeholder={`0-${component.itemMax}`}
                              onChange={(e) => setMark(item.key, e.target.value, component.itemMax)}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700">
                    {component.max}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-900">
                    {active ? alloted : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-2 py-1 text-right font-semibold" colSpan={2}>Total</td>
              <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{SHEET_TOTAL_MAX}</td>
              <td className="border border-gray-300 px-2 py-1 text-center text-lg font-bold text-gray-900">{total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor={`remark-${studentName}`}>Remarks</label>
          <textarea
            id={`remark-${studentName}`}
            className="input min-h-[5rem]"
            maxLength={REMARK_MAX}
            value={draft.remark}
            disabled={disabled}
            onChange={(e) => onChange({ remark: e.target.value.slice(0, REMARK_MAX) })}
          />
          <p className="mt-1 text-xs text-gray-400">{draft.remark.length} / {REMARK_MAX} characters</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label text-xs">Approved rank</label>
            <input
              type="text"
              className="input"
              value={draft.approvedRank}
              disabled={disabled}
              onChange={(e) => onChange({ approvedRank: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">The grade being taken. Change it only if the candidate is passed to a different rank.</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="label text-xs">Examiner</label>
              <input
                type="text"
                className="input"
                placeholder="Examiner's name"
                value={draft.examinerName}
                disabled={disabled}
                onChange={(e) => onChange({ examinerName: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={draft.passed}
                disabled={disabled}
                onChange={(e) => onChange({ passed: e.target.checked })}
              />
              Passed
            </label>
          </div>

          <ExaminerSignature
            value={draft.examinerSignature}
            disabled={disabled}
            onChange={(png) => onChange({ examinerSignature: png })}
          />
        </div>
      </div>
    </div>
  );
}

/** The examiner's own signature at the foot of the sheet. */
function ExaminerSignature({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (png: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
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
    const up = () => {
      if (!drawing) return;
      drawing = false;
      onChange(canvas.toDataURL("image/png"));
    };

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
    // onChange is a stable callback from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  if (disabled) {
    return (
      <div>
        <span className="label text-xs">Examiner signature</span>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Examiner signature" className="h-16 rounded-md border border-gray-200 bg-white" />
        ) : (
          <p className="text-xs text-gray-400">Not signed.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <span className="label text-xs">Examiner signature</span>
      <canvas ref={canvasRef} className="h-20 w-full touch-none rounded-md border border-dashed border-gray-300 bg-white" />
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary !px-2 !py-1 text-xs"
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasInk(false);
            onChange(null);
          }}
        >
          Clear
        </button>
        <span className="text-xs text-gray-400">{hasInk ? "Signed" : "Not signed"}</span>
      </div>
    </div>
  );
}
