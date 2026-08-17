"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadExamRows,
  saveExamRow,
  saveExamRowsBulk,
  setExamLock,
  type ExamRowDto,
} from "@/app/(app)/events/examActions";
import {
  componentsFor,
  marksGiven,
  marksPossible,
  sheetTotal,
  marksSayPassed,
  SHEET_TOTAL_MAX,
  type SheetMarks,
} from "@/lib/gradingSheet";
import ExamSheet, { type SheetDraft } from "./ExamSheet";
import CategoryEventsEditor from "./CategoryEventsEditor";
import { realtimeClient, POLL_WITH_REALTIME_MS, POLL_WITHOUT_REALTIME_MS } from "@/lib/liveChannel";

type Category = { id: string; name: string; examEvents: string[] };
type Draft = SheetDraft;

/**
 * The examiner's marking sheet, in two steps.
 *
 * First pick who is being graded — filter by category, search by name or club,
 * tick the ones in front of you. Then mark just those, with the option to apply
 * a score across everyone at once and commit the lot in one go.
 *
 * Marks are still saved per candidate underneath, so two examiners working
 * different students never collide, and a row somebody is part-way through
 * editing is never overwritten by an incoming refresh.
 */
export default function ExamGrid({
  eventId,
  categories,
  initialRows,
  canMark,
}: {
  eventId: string;
  categories: Category[];
  initialRows: ExamRowDto[];
  canMark: boolean;
}) {
  const [rows, setRows] = useState<ExamRowDto[]>(initialRows);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(categories.map((c) => c.id));
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [step, setStep] = useState<"select" | "mark">("select");

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [live, setLive] = useState(false);

  // Which of the selected candidates is on screen.
  const [current, setCurrent] = useState(0);

  const channelRef = useRef<any>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadExamRows(eventId, []);
      setRows((prev) => {
        const dirty = draftsRef.current;
        const byId = new Map(prev.map((r) => [r.registrationId, r]));
        return fresh.map((r) => (dirty[r.registrationId] ? byId.get(r.registrationId) ?? r : r));
      });
    } catch {
      // A refresh that fails is not worth interrupting marking for.
    }
  }, [eventId]);

  useEffect(() => {
    const client = realtimeClient();
    let channel: any = null;

    if (client) {
      channel = client.channel(`exam:${eventId}`, { config: { broadcast: { self: false } } });
      channel.on("broadcast", { event: "changed" }, () => { void refresh(); });
      channel.subscribe((status: string) => setLive(status === "SUBSCRIBED"));
      channelRef.current = channel;
    }

    const every = client ? POLL_WITH_REALTIME_MS : POLL_WITHOUT_REALTIME_MS;
    const timer = setInterval(() => { void refresh(); }, every);

    return () => {
      clearInterval(timer);
      if (channel && client) client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [eventId, refresh]);

  function announce() {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: { eventId } });
  }

  const inCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!r.categoryId || !selectedCategories.includes(r.categoryId)) return false;
      if (!term) return true;
      return (
        r.studentName.toLowerCase().includes(term) ||
        (r.clubName ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, selectedCategories, search]);

  const marking = useMemo(
    () => rows.filter((r) => chosen.includes(r.registrationId)),
    [rows, chosen],
  );

  const unassigned = useMemo(() => rows.filter((r) => !r.categoryId).length, [rows]);

  function valueFor(row: ExamRowDto): Draft {
    return (
      drafts[row.registrationId] ?? {
        marks: row.marks,
        remark: row.remark,
        passed: row.passed,
        approvedRank: row.approvedRank ?? row.categoryName ?? "",
        examinerName: row.examinerName ?? "",
        examinerSignature: row.examinerSignature ?? null,
      }
    );
  }

  function edit(row: ExamRowDto, patch: Partial<Draft>) {
    const current = valueFor(row);
    setDrafts((prev) => ({ ...prev, [row.registrationId]: { ...current, ...patch } }));
    setSaved((prev) => ({ ...prev, [row.registrationId]: false }));
    setErrors((prev) => ({ ...prev, [row.registrationId]: "" }));
  }

  function applyRow(next: ExamRowDto) {
    setRows((prev) => prev.map((r) => (r.registrationId === next.registrationId ? next : r)));
    setDrafts((prev) => {
      const copy = { ...prev };
      delete copy[next.registrationId];
      return copy;
    });
  }

  async function save(row: ExamRowDto) {
    const draft = valueFor(row);
    setBusy((prev) => ({ ...prev, [row.registrationId]: true }));
    const result = await saveExamRow({
      eventId,
      registrationId: row.registrationId,
      marks: draft.marks,
      remark: draft.remark,
      passed: draft.passed,
      approvedRank: draft.approvedRank || null,
      examinerName: draft.examinerName || null,
      examinerSignature: draft.examinerSignature,
    });
    setBusy((prev) => ({ ...prev, [row.registrationId]: false }));
    if ("error" in result) {
      setErrors((prev) => ({ ...prev, [row.registrationId]: result.error }));
      return;
    }
    applyRow(result.row);
    setSaved((prev) => ({ ...prev, [row.registrationId]: true }));
    announce();
  }

  async function saveAll() {
    const pending = marking.filter((r) => !r.locked);
    if (pending.length === 0) return;
    setBulkBusy(true);
    setBulkStatus("");

    const result = await saveExamRowsBulk({
      eventId,
      rows: pending.map((r) => {
        const d = valueFor(r);
        return {
          registrationId: r.registrationId,
          marks: d.marks,
          remark: d.remark,
          passed: d.passed,
          approvedRank: d.approvedRank || null,
          examinerName: d.examinerName || null,
          examinerSignature: d.examinerSignature,
        };
      }),
    });

    setBulkBusy(false);
    result.saved.forEach(applyRow);
    setSaved((prev) => {
      const next = { ...prev };
      result.saved.forEach((r) => { next[r.registrationId] = true; });
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      result.failures.forEach((f) => { next[f.registrationId] = f.error; });
      return next;
    });
    setBulkStatus(
      result.failures.length === 0
        ? `Saved ${result.saved.length} candidate${result.saved.length === 1 ? "" : "s"}.`
        : `Saved ${result.saved.length}, ${result.failures.length} could not be saved.`,
    );
    announce();
  }

  /** Copy the examiner's name and signature onto every other sheet. */
  function applyExaminerToAll() {
    const source = marking[current];
    if (!source) return;
    const from = valueFor(source);
    for (const row of marking) {
      if (row.locked || row.registrationId === source.registrationId) continue;
      edit(row, { examinerName: from.examinerName, examinerSignature: from.examinerSignature });
    }
  }

  async function lock(row: ExamRowDto, locked: boolean) {
    setBusy((prev) => ({ ...prev, [row.registrationId]: true }));
    const result = await setExamLock({ eventId, registrationId: row.registrationId, locked });
    setBusy((prev) => ({ ...prev, [row.registrationId]: false }));
    if ("error" in result) {
      setErrors((prev) => ({ ...prev, [row.registrationId]: result.error }));
      return;
    }
    applyRow(result.row);
    announce();
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function toggleChosen(id: string) {
    setChosen((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const liveDot = (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-gray-300"}`} />
      <span className="text-gray-500">
        {live ? "Live — other examiners' marks appear automatically" : "Checking for other examiners every few seconds"}
      </span>
    </div>
  );

  // ---------------------------------------------------------------- step two
  if (step === "mark") {
    const row = marking[Math.min(current, Math.max(0, marking.length - 1))];
    const draft = row ? valueFor(row) : null;
    const dirtyCount = marking.filter((r) => drafts[r.registrationId]).length;

    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setStep("select")}>
                ← Back to selection
              </button>
              <h3 className="text-sm font-semibold text-gray-900">
                Marking {marking.length} candidate{marking.length === 1 ? "" : "s"}
                {dirtyCount > 0 && <span className="ml-2 text-xs font-normal text-amber-700">{dirtyCount} unsaved</span>}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {bulkStatus && <span className="text-xs text-gray-600">{bulkStatus}</span>}
              {canMark && (
                <button type="button" className="btn-primary" disabled={bulkBusy} onClick={() => { void saveAll(); }}>
                  {bulkBusy ? "Saving..." : `Save all ${marking.filter((r) => !r.locked).length}`}
                </button>
              )}
            </div>
          </div>

          {/* Candidate switcher: who is in front of the examiner right now. */}
          <div className="mt-3 flex flex-wrap gap-1 border-t border-gray-100 pt-3">
            {marking.map((r, i) => {
              const comps = componentsFor(r.components);
              const d = drafts[r.registrationId];
              const marksNow = (d?.marks ?? r.marks) as SheetMarks;
              const done = marksGiven(marksNow, comps);
              return (
                <button
                  key={r.registrationId}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    i === current ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-gray-200 text-gray-600 hover:border-brand-300"
                  }`}
                >
                  {r.studentName}
                  <span className="ml-1 text-gray-400">
                    {r.locked ? "🔒" : `${done}/${marksPossible(comps)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {row && draft ? (
          <div className="card p-6">
            <ExamSheet
              studentName={row.studentName}
              clubName={row.clubName}
              currentGrade={row.currentGrade}
              categoryName={row.categoryName}
              components={row.components}
              draft={draft}
              locked={row.locked}
              canMark={canMark}
              onChange={(patch) => edit(row, patch)}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                className="btn-secondary !px-3 !py-1.5 text-xs"
                disabled={current <= 0}
                onClick={() => setCurrent((i) => Math.max(0, i - 1))}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn-secondary !px-3 !py-1.5 text-xs"
                disabled={current >= marking.length - 1}
                onClick={() => setCurrent((i) => Math.min(marking.length - 1, i + 1))}
              >
                Next →
              </button>

              {canMark && !row.locked && (
                <button type="button" className="btn-primary" disabled={busy[row.registrationId]} onClick={() => { void save(row); }}>
                  {busy[row.registrationId] ? "Saving..." : "Save this sheet"}
                </button>
              )}
              {canMark && (
                <button
                  type="button"
                  className="text-xs font-medium text-gray-600 hover:underline"
                  disabled={busy[row.registrationId]}
                  onClick={() => { void lock(row, !row.locked); }}
                >
                  {row.locked ? "Unlock" : "Lock this sheet"}
                </button>
              )}
              {canMark && marking.length > 1 && (
                <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={applyExaminerToAll}>
                  Use this examiner and signature on all {marking.length}
                </button>
              )}

              <span className="ml-auto text-xs text-gray-400">
                {errors[row.registrationId] ? (
                  <span className="text-red-600">{errors[row.registrationId]}</span>
                ) : row.locked ? (
                  "Locked"
                ) : saved[row.registrationId] ? (
                  "Saved"
                ) : row.updatedBy ? (
                  `Last saved by ${row.updatedBy}`
                ) : (
                  ""
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center text-sm text-gray-400">
            Nobody selected. Go back and choose who you&apos;re grading.
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- step one
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">1. Choose who you&apos;re grading</h3>
          {liveDot}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => {
            const entered = rows.filter((r) => r.categoryId === c.id).length;
            return (
              <div key={c.id} className="relative">
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                    selectedCategories.includes(c.id) ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedCategories.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    {c.name}
                    <span className="text-xs text-gray-400">({entered})</span>
                  </label>
                  <span className="text-gray-300">|</span>
                  <CategoryEventsEditor
                    eventId={eventId}
                    categoryId={c.id}
                    categoryName={c.name}
                    examEvents={c.examEvents}
                    canEdit={canMark}
                  />
                </div>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-gray-400">No grading categories yet — use &quot;Add all categories&quot; above, or register some candidates.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="input max-w-xs"
            placeholder="Search name or club"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setSelectedCategories(categories.map((c) => c.id))}>All categories</button>
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setSelectedCategories([])}>No categories</button>
        </div>

        {unassigned > 0 && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {unassigned} registration{unassigned === 1 ? " has" : "s have"} no grading category — usually a missing current
            grade on the student record. Use &quot;Update categories from current grades&quot; above.
          </p>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary !px-2 !py-1 text-xs"
              onClick={() => setChosen(inCategories.map((r) => r.registrationId))}
            >
              Select all {inCategories.length}
            </button>
            <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setChosen([])}>Clear</button>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={chosen.length === 0}
            onClick={() => setStep("mark")}
          >
            2. Mark {chosen.length} selected →
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Name</th>
                <th>Category</th>
                <th className="hidden md:table-cell">Current grade</th>
                <th>Marked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inCategories.map((row) => {
                const comps = componentsFor(row.components);
                const done = marksGiven(row.marks, comps);
                return (
                  <tr key={row.registrationId} className={chosen.includes(row.registrationId) ? "bg-brand-50/50" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={chosen.includes(row.registrationId)}
                        onChange={() => toggleChosen(row.registrationId)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    </td>
                    <td className="whitespace-nowrap font-medium text-gray-900">
                      {row.studentName}
                      <span className="block text-xs font-normal text-gray-500">{row.clubName ?? "No club"}</span>
                    </td>
                    <td>{row.categoryName ?? "—"}</td>
                    <td className="hidden md:table-cell">{row.currentGrade}</td>
                    <td className="text-sm text-gray-600">{done} of {marksPossible(comps)}</td>
                    <td>
                      {row.locked ? (
                        <span className="badge bg-gray-100 text-gray-500">Locked</span>
                      ) : done > 0 ? (
                        <span className="badge bg-amber-100 text-amber-700">In progress</span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-500">Not started</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {inCategories.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    {categories.length === 0
                      ? "Nobody has been registered for this grading yet."
                      : "Nobody matches — tick a category above, or clear the search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
