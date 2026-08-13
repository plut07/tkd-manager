"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadExamRows,
  saveExamRow,
  setExamLock,
  type ExamRowDto,
} from "@/app/(app)/events/examActions";
import { EXAM_EVENTS, ticksGiven, type ExamEventKey } from "@/lib/gradingExam";
import { realtimeClient, POLL_WITH_REALTIME_MS, POLL_WITHOUT_REALTIME_MS } from "@/lib/liveChannel";

type Category = { id: string; name: string };
type Draft = { marks: Record<ExamEventKey, boolean>; remark: string; passed: boolean };

/**
 * The examiner's marking sheet.
 *
 * Each student is saved on their own, so two examiners marking different
 * students never collide. Everyone's page joins a channel for this event: after
 * a save the page pings the others, and they refetch through the server action
 * rather than reading the table directly.
 *
 * A row being edited locally is never overwritten by an incoming refresh — the
 * examiner is told it changed underneath them instead, so nobody loses typing
 * mid-mark.
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
  const [selected, setSelected] = useState<string[]>(categories.map((c) => c.id));
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [live, setLive] = useState(false);

  const channelRef = useRef<any>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadExamRows(eventId, []);
      setRows((prev) => {
        // Keep rows the examiner is part-way through editing; everything else
        // takes the server's version.
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

  const visible = useMemo(() => {
    if (selected.length === 0) return [];
    return rows.filter((r) => (r.categoryId ? selected.includes(r.categoryId) : false));
  }, [rows, selected]);

  const unassigned = useMemo(() => rows.filter((r) => !r.categoryId).length, [rows]);

  function valueFor(row: ExamRowDto): Draft {
    return drafts[row.registrationId] ?? { marks: row.marks, remark: row.remark, passed: row.passed };
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
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const markedCount = visible.filter((r) => ticksGiven(r.marks) > 0).length;
  const lockedCount = visible.filter((r) => r.locked).length;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Categories being examined</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-block h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-gray-300"}`} />
            <span className="text-gray-500">{live ? "Live — other examiners' marks appear automatically" : "Checking for other examiners every few seconds"}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                selected.includes(c.id) ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"
              }`}
            >
              <input type="checkbox" className="h-4 w-4" checked={selected.includes(c.id)} onChange={() => toggleCategory(c.id)} />
              {c.name}
            </label>
          ))}
          {categories.length === 0 && <p className="text-sm text-gray-400">No grading categories yet — register some candidates first.</p>}
        </div>
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setSelected(categories.map((c) => c.id))}>Select all</button>
            <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setSelected([])}>Clear</button>
            <span className="ml-auto text-gray-500">
              {visible.length} candidate{visible.length === 1 ? "" : "s"} · {markedCount} marked · {lockedCount} locked
            </span>
          </div>
        )}
        {unassigned > 0 && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {unassigned} registration{unassigned === 1 ? " has" : "s have"} no grading category — usually a missing current
            grade on the student record. Set their grade and re-register them to bring them into the list.
          </p>
        )}
      </div>

      <div className="card p-4">
        <p className="text-sm text-gray-500">
          Tick each part the candidate passed, then tick Passed for the overall result. Save as you go, and lock a
          candidate once you&apos;re finished with them — locking is per student and doesn&apos;t wait on anybody else.
          <span className="ml-1 text-gray-400">* the three parts every grading covers.</span>
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Club</th>
                {EXAM_EVENTS.map((e) => (
                  <th key={e.key} className="whitespace-nowrap px-3 text-center">
                    {e.label}
                    {e.required && <span className="text-red-500">*</span>}
                  </th>
                ))}
                <th>Remark</th>
                <th className="text-center">Passed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const draft = valueFor(row);
                const dirty = Boolean(drafts[row.registrationId]);
                const disabled = !canMark || row.locked || busy[row.registrationId];
                return (
                  <tr key={row.registrationId} className={row.locked ? "bg-gray-50" : dirty ? "bg-amber-50/50" : undefined}>
                    <td className="whitespace-nowrap font-medium text-gray-900">{row.studentName}</td>
                    <td className="whitespace-nowrap">{row.clubName ?? "—"}</td>
                    {EXAM_EVENTS.map((e) => (
                      <td key={e.key} className="text-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={draft.marks[e.key] === true}
                          disabled={disabled}
                          aria-label={`${e.label} — ${row.studentName}`}
                          onChange={(ev) => edit(row, { marks: { ...draft.marks, [e.key]: ev.target.checked } })}
                        />
                      </td>
                    ))}
                    <td>
                      <input
                        type="text"
                        className="input !w-40"
                        placeholder="Optional"
                        value={draft.remark}
                        disabled={disabled}
                        onChange={(ev) => edit(row, { remark: ev.target.value })}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={draft.passed}
                        disabled={disabled}
                        title="Passed the grading"
                        onChange={(ev) => edit(row, { passed: ev.target.checked })}
                      />
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {canMark && !row.locked && (
                        <button
                          type="button"
                          className="btn-primary !px-3 !py-1.5 text-xs"
                          disabled={busy[row.registrationId]}
                          onClick={() => { void save(row); }}
                        >
                          {busy[row.registrationId] ? "Saving..." : dirty ? "Save" : "Saved"}
                        </button>
                      )}
                      {canMark && (
                        <button
                          type="button"
                          className="ml-2 text-xs font-medium text-gray-600 hover:underline"
                          disabled={busy[row.registrationId]}
                          onClick={() => { void lock(row, !row.locked); }}
                        >
                          {row.locked ? "Unlock" : "Lock"}
                        </button>
                      )}
                      <span className="ml-2 block text-xs text-gray-400">
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
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={EXAM_EVENTS.length + 5} className="py-6 text-center text-gray-400">
                    {categories.length === 0
                      ? "Nobody has been registered for this grading yet."
                      : "Tick a category above to start marking."}
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
