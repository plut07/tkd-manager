"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MODES,
  PATTERNS,
  WARNINGS_PER_POINT,
  tally,
  sideTotal,
  formatClock,
  judgeVerdict,
  judgeScore,
  penaltyTally,
  type ScoreMode,
  type Side,
} from "@/lib/scoreboard";
import {
  updateRing,
  setClock,
  clearRing,
  confirmResult,
  refereePress,
  refereeUndo,
  type RingDto,
} from "@/app/(app)/events/scoreboardActions";
import { useRingLive } from "@/components/useRingLive";

type Category = { id: string; name: string };
type Match = {
  id: string;
  label: string;
  red: string | null;
  blue: string | null;
  redNumber: string | null;
  blueNumber: string | null;
  categoryId: string | null;
};

/**
 * The operator's screen: set the bout up, run the clock, call warnings, confirm
 * the result.
 *
 * The judges' devices only ever score. Warnings and deductions are the
 * referee's call, so they live here, and nothing reaches the draw until
 * somebody presses Confirm.
 */
export default function ScoreboardControl({
  initial,
  categories,
  matches,
  baseUrl,
}: {
  initial: RingDto;
  categories: Category[];
  matches: Match[];
  baseUrl: string;
}) {
  const router = useRouter();
  const { ring, left, live, put, setLocal: setRing, announce, refresh } = useRingLive(initial, { ringId: initial.id });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  /**
   * The ring's settings are edited as a draft and saved in one go.
   *
   * These four apply to every bout the ring runs, so they are set once before
   * the event and then left alone. Saving each keystroke as it was typed made
   * "5" briefly mean "no judges" on every screen in the hall.
   */
  const settingsOf = (r: RingDto) => ({
    mode: r.mode,
    judgeCount: r.judgeCount,
    patternBase: r.patternBase,
    roundSeconds: r.roundSeconds,
    rounds: r.rounds,
  });
  const [draft, setDraft] = useState(() => settingsOf(initial));
  const [savedNote, setSavedNote] = useState("");

  async function patch(p: Parameters<typeof updateRing>[0]["patch"]) {
    setBusy(true);
    setError("");
    const result = await updateRing({ ringId: ring.id, patch: p });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  const draftChanged = JSON.stringify(draft) !== JSON.stringify(settingsOf(ring));

  async function saveSettings() {
    setSavedNote("");
    // An emptied number box reads back as NaN, which would reach the database
    // as a broken value rather than an error. Each falls back to its default.
    const num = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
    await patch({
      mode: draft.mode,
      judgeCount: num(draft.judgeCount, 5),
      patternBase: num(draft.patternBase, 10),
      roundSeconds: num(draft.roundSeconds, 120),
      rounds: num(draft.rounds, 2),
    });
    setSavedNote("Saved. These apply to every bout on this ring.");
  }

  function cancelSettings() {
    setDraft(settingsOf(ring));
    setSavedNote("");
  }

  async function clock(action: "start" | "pause" | "reset" | "finish" | "nextRound") {
    setBusy(true);
    setError("");
    const result = await setClock({ ringId: ring.id, action });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  async function callPenalty(side: Side, kind: "warning" | "penalty") {
    setBusy(true);
    setError("");
    const result = await refereePress({ ringId: ring.id, side, kind });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  async function undoPenalty(side: Side) {
    setBusy(true);
    setError("");
    const result = await refereeUndo({ ringId: ring.id, side });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  async function confirm() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await confirmResult({ ringId: ring.id });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setMessage(result.message);
    await refresh();
    announce();
    router.refresh();
  }

  async function clearAll() {
    if (!window.confirm("Clear this bout? Every press, warning and deduction for it is removed.")) return;
    setBusy(true);
    setMessage("");
    const result = await clearRing({ ringId: ring.id });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  /** Picking a bout from the draw fills both corners and their numbers in. */
  async function chooseMatch(matchId: string) {
    const match = matches.find((m) => m.id === matchId);
    await patch({
      matchId: matchId || null,
      redName: match?.red ?? null,
      blueName: match?.blue ?? null,
      redNumber: match?.redNumber ?? null,
      blueNumber: match?.blueNumber ?? null,
      categoryId: match?.categoryId ?? ring.categoryId,
    });
  }

  const result = tally(ring.entries, ring.judgeCount, ring.mode, ring.patternBase);
  const judgeLink = `${baseUrl}/public/judge?code=${ring.joinCode}`;
  const displayLink = `${baseUrl}/events/${ring.eventId}/scoreboard/display?ring=${ring.id}`;

  // The setup is fixed once the clock is running: changing the judge count or
  // the pattern base mid-bout would silently rewrite a score already given.
  const running = ring.state === "running";
  const locked = busy || running;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{ring.name}</h2>
            <p className="text-sm text-gray-500">
              Judges join at <strong>{baseUrl}/public/judge</strong> with code{" "}
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-base font-bold tracking-widest">{ring.joinCode}</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Judges who want the phone app — which keeps scoring when the wifi drops — can get it at{" "}
              <a href="/public/app" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                {baseUrl}/public/app
              </a>
            </p>
          </div>
          {/* One code, two uses: a judge with the app scans it here and is
              taken straight into their ring; a judge without it points an
              ordinary phone camera at the same code and lands on the web pad.
              Either way nobody types the address or the five characters. */}
          <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-2">
            <img
              src={`/api/public/qr?url=${encodeURIComponent(judgeLink)}&size=132`}
              alt={`QR code to join ${ring.name}`}
              width={132}
              height={132}
              className="rounded bg-white p-1"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Judges scan this</p>
              <p className="text-xs text-gray-500">Opens their ring directly — no address, no code to type.</p>
              <a
                href={`/events/${ring.eventId}/scoreboard/ring-sheet?ring=${ring.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary mt-2 inline-block !px-3 !py-1.5 text-xs"
              >
                Printable sheet for this ring
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={displayLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open display screen</a>
            <a href={judgeLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open a judge screen</a>
            <button
              type="button"
              className={showSetup ? "btn-primary" : "btn-secondary"}
              onClick={() => setShowSetup((open) => !open)}
            >
              {showSetup ? "Hide match setup" : "Match setup"}
            </button>
          </div>
        </div>
      </div>

      {/* Out of the way by default. On the day this is opened once, filled in,
          and closed again — what the operator needs in front of them for the
          next eight hours is the clock and the score. */}
      {showSetup && (
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">This bout</h3>
          {running && <span className="text-xs text-amber-700">The clock is running — pause it to change the setup.</span>}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label text-xs">Category</label>
            <select className="input" value={ring.categoryId ?? ""} disabled={locked} onChange={(e) => { void patch({ categoryId: e.target.value || null }); }}>
              <option value="">None</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Bout from the draw</label>
            <select className="input" value={ring.matchId ?? ""} disabled={locked} onChange={(e) => { void chooseMatch(e.target.value); }}>
              <option value="">Not from the draw</option>
              {matches
                .filter((m) => !ring.categoryId || m.categoryId === ring.categoryId)
                .map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Red corner</label>
            <div className="flex gap-2">
              <input className="input !w-20 text-center" placeholder="No." value={ring.redNumber ?? ""} disabled={locked}
                onChange={(e) => setRing({ ...ring, redNumber: e.target.value })}
                onBlur={(e) => { void patch({ redNumber: e.target.value || null }); }} />
              <input className="input" value={ring.redName ?? ""} disabled={locked}
                onChange={(e) => setRing({ ...ring, redName: e.target.value })}
                onBlur={(e) => { void patch({ redName: e.target.value }); }} />
            </div>
          </div>
          <div>
            <label className="label text-xs">Blue corner</label>
            <div className="flex gap-2">
              <input className="input !w-20 text-center" placeholder="No." value={ring.blueNumber ?? ""} disabled={locked}
                onChange={(e) => setRing({ ...ring, blueNumber: e.target.value })}
                onBlur={(e) => { void patch({ blueNumber: e.target.value || null }); }} />
              <input className="input" value={ring.blueName ?? ""} disabled={locked}
                onChange={(e) => setRing({ ...ring, blueName: e.target.value })}
                onBlur={(e) => { void patch({ blueName: e.target.value }); }} />
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Ring settings</h3>
            <span className="text-xs text-gray-500">These apply to every bout run on this ring, so set them once before the event.</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="label text-xs">Mode</label>
              <select className="input" value={draft.mode} disabled={locked}
                onChange={(e) => setDraft({ ...draft, mode: e.target.value as ScoreMode })}>
                {MODES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Judges</label>
              <input type="number" min={1} max={9} className="input text-center" value={draft.judgeCount} disabled={locked}
                onChange={(e) => setDraft({ ...draft, judgeCount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label text-xs">Pattern starts at</label>
              <input type="number" step="0.1" min={0} className="input text-center" value={draft.patternBase}
                disabled={locked || draft.mode !== "pattern"}
                onChange={(e) => setDraft({ ...draft, patternBase: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label text-xs">Round (seconds)</label>
              <input type="number" min={10} className="input text-center" value={draft.roundSeconds} disabled={locked}
                onChange={(e) => setDraft({ ...draft, roundSeconds: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label text-xs">Rounds</label>
              <input type="number" min={1} className="input text-center" value={draft.rounds} disabled={locked}
                onChange={(e) => setDraft({ ...draft, rounds: Number(e.target.value) })} />
            </div>
            {/* The pattern changes from bout to bout, so it saves on the spot
                rather than waiting for the settings to be saved with it. */}
            <div>
              <label className="label text-xs">Pattern (this bout)</label>
              <select className="input" value={ring.patternName ?? ""} disabled={locked || ring.mode !== "pattern"}
                onChange={(e) => { void patch({ patternName: e.target.value || null }); }}>
                <option value="">Not chosen</option>
                {PATTERNS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={locked || !draftChanged} onClick={() => { void saveSettings(); }}>
              {busy ? "Saving..." : "Save settings"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy || !draftChanged} onClick={cancelSettings}>Cancel</button>
            <span className="text-xs text-gray-400">{MODES.find((m) => m.value === draft.mode)?.note}</span>
            {savedNote && !draftChanged && <span className="text-xs text-green-700">{savedNote}</span>}
          </div>
        </div>
      </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-4xl font-bold tabular-nums text-gray-900">{formatClock(left, true)}</span>
            <span className="text-sm text-gray-500">
              Round {ring.currentRound} of {ring.rounds} ·{" "}
              {ring.state === "running" ? "Running" : ring.state === "paused" ? "Paused" : ring.state === "finished" ? "Finished" : "Ready"}
            </span>
            {/* A hall on the slow path should be told, rather than left
                wondering why the display trails the judges' pads. */}
            {!live && (
              <span
                className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                title="Presses are fetched on a timer instead of arriving the instant they are made. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on the deployment to make it instant."
              >
                Not live — up to a second behind
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!running ? (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => { void clock("start"); }}>Start</button>
            ) : (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => { void clock("pause"); }}>Pause</button>
            )}
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => { void clock("reset"); }}>Reset clock</button>
            <button type="button" className="btn-secondary" disabled={busy || ring.currentRound >= ring.rounds}
              onClick={() => { void clock("nextRound"); }}>Next round</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => { void clock("finish"); }}>End bout</button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900">Score</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Warnings and deductions are the referee&apos;s call, so they are pressed here rather than by the judges. A
          deduction takes a point off every judge&apos;s mark straight away; every {WARNINGS_PER_POINT} warnings does the
          same.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-4">
          {(["red", "blue"] as Side[]).map((side) => {
            const penalties = penaltyTally(ring.entries, side);
            const toNextPoint = WARNINGS_PER_POINT - (penalties.warnings % WARNINGS_PER_POINT);
            return (
              <div key={side} className={`rounded-md p-4 text-center ${side === "red" ? "bg-red-50" : "bg-blue-50"}`}>
                <p className={`text-xs font-bold uppercase ${side === "red" ? "text-red-700" : "text-blue-700"}`}>{side}</p>
                <p className="truncate text-sm text-gray-700">
                  {(side === "red" ? ring.redNumber : ring.blueNumber) ? `#${side === "red" ? ring.redNumber : ring.blueNumber} ` : ""}
                  {(side === "red" ? ring.redName : ring.blueName) ?? "—"}
                </p>
                <p className="text-4xl font-bold text-gray-900">{sideTotal(ring.entries, ring.judgeCount, side, ring.mode, ring.patternBase)}</p>
                <p className="mt-1 text-xs text-gray-500">{side === "red" ? result.red : result.blue} of {ring.judgeCount} judges</p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
                    disabled={busy} onClick={() => { void callPenalty(side, "warning"); }}>
                    Warning ({penalties.warnings})
                  </button>
                  <button type="button" className="rounded-md bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
                    disabled={busy} onClick={() => { void callPenalty(side, "penalty"); }}>
                    Deduction ({penalties.deductions})
                  </button>
                  <button type="button" className="text-xs font-medium text-gray-500 hover:underline disabled:opacity-40"
                    disabled={busy || (penalties.warnings === 0 && penalties.deductions === 0)}
                    onClick={() => { void undoPenalty(side); }}>
                    Undo
                  </button>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  {penalties.points > 0 ? `−${penalties.points} point${penalties.points === 1 ? "" : "s"} · ` : ""}
                  {toNextPoint} more warning{toNextPoint === 1 ? "" : "s"} costs a point
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Judge</th>
                <th className="text-center">Red</th>
                <th className="text-center">Blue</th>
                <th>Favours</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ring.judgeCount }, (_, i) => i + 1).map((judge) => {
                const verdict = judgeVerdict(ring.entries, judge, ring.mode, ring.patternBase);
                const scored = ring.entries.some((e) => e.judge_slot === judge && !e.voided);
                return (
                  <tr key={judge}>
                    <td className="font-medium text-gray-900">Judge {judge}</td>
                    <td className="text-center">{judgeScore(ring.entries, judge, "red", ring.mode, ring.patternBase)}</td>
                    <td className="text-center">{judgeScore(ring.entries, judge, "blue", ring.mode, ring.patternBase)}</td>
                    <td>
                      {!scored ? (
                        <span className="text-gray-400">not connected yet</span>
                      ) : verdict ? (
                        <span className={`badge ${verdict === "red" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{verdict.toUpperCase()}</span>
                      ) : (
                        <span className="text-gray-400">tied</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <button type="button" className="btn-primary" disabled={busy || !result.winner} onClick={() => { void confirm(); }}>
            Confirm result and save to the draw
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => { void clearAll(); }}>Clear bout</button>
          {!result.winner && <span className="text-xs text-amber-700">Judges are level — the referee has to separate them first.</span>}
          {message && <span className="text-sm text-green-700">{message}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
