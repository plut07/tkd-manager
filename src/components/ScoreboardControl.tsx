"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MODES,
  PATTERNS,
  WARNINGS_PER_POINT,
  tally,
  sideTotal,
  secondsLeft,
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
  loadRing,
  type RingDto,
} from "@/app/(app)/events/scoreboardActions";
import { realtimeClient } from "@/lib/liveChannel";

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
  const [ring, setRing] = useState<RingDto>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(() =>
    secondsLeft({ state: initial.state, startedAt: initial.clockStartedAt, remaining: initial.clockRemaining }),
  );
  const channelRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    const fresh = await loadRing({ ringId: initial.id });
    if (fresh) setRing(fresh);
  }, [initial.id]);

  useEffect(() => {
    const client = realtimeClient();
    let channel: any = null;
    if (client) {
      channel = client.channel(`ring:${initial.id}`, { config: { broadcast: { self: false } } });
      channel.on("broadcast", { event: "changed" }, () => { void refresh(); });
      channel.subscribe();
      channelRef.current = channel;
    }
    const poll = setInterval(() => { void refresh(); }, client ? 10000 : 3000);
    return () => {
      clearInterval(poll);
      if (channel && client) client.removeChannel(channel);
    };
  }, [initial.id, refresh]);

  useEffect(() => {
    const tick = setInterval(() => {
      setLeft(secondsLeft({ state: ring.state, startedAt: ring.clockStartedAt, remaining: ring.clockRemaining }));
    }, 250);
    return () => clearInterval(tick);
  }, [ring.state, ring.clockStartedAt, ring.clockRemaining]);

  function announce() {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }

  async function patch(p: Parameters<typeof updateRing>[0]["patch"]) {
    setBusy(true);
    setError("");
    const result = await updateRing({ ringId: ring.id, patch: p });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRing(result.ring);
    announce();
  }

  async function clock(action: "start" | "pause" | "reset" | "finish" | "nextRound") {
    setBusy(true);
    setError("");
    const result = await setClock({ ringId: ring.id, action });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRing(result.ring);
    announce();
  }

  async function callPenalty(side: Side, kind: "warning" | "penalty") {
    setBusy(true);
    setError("");
    const result = await refereePress({ ringId: ring.id, side, kind });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRing(result.ring);
    announce();
  }

  async function undoPenalty(side: Side) {
    setBusy(true);
    setError("");
    const result = await refereeUndo({ ringId: ring.id, side });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRing(result.ring);
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
    setRing(result.ring);
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
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={displayLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open display screen</a>
            <a href={judgeLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open a judge screen</a>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Match setup</h3>
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

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="label text-xs">Mode</label>
            <select className="input" value={ring.mode} disabled={locked} onChange={(e) => { void patch({ mode: e.target.value as ScoreMode }); }}>
              {MODES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Judges</label>
            <input type="number" min={1} max={9} className="input text-center" value={ring.judgeCount} disabled={locked}
              onChange={(e) => { void patch({ judgeCount: Number(e.target.value) || 5 }); }} />
          </div>
          <div>
            <label className="label text-xs">Pattern starts at</label>
            <input type="number" step="0.1" min={0} className="input text-center" value={ring.patternBase}
              disabled={locked || ring.mode !== "pattern"}
              onChange={(e) => { void patch({ patternBase: Number(e.target.value) || 0 }); }} />
          </div>
          <div>
            <label className="label text-xs">Pattern</label>
            <select className="input" value={ring.patternName ?? ""} disabled={locked || ring.mode !== "pattern"}
              onChange={(e) => { void patch({ patternName: e.target.value || null }); }}>
              <option value="">Not chosen</option>
              {PATTERNS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Round (seconds)</label>
            <input type="number" min={10} className="input text-center" value={ring.roundSeconds} disabled={locked}
              onChange={(e) => { void patch({ roundSeconds: Number(e.target.value) || 120 }); }} />
          </div>
          <div>
            <label className="label text-xs">Rounds</label>
            <input type="number" min={1} className="input text-center" value={ring.rounds} disabled={locked}
              onChange={(e) => { void patch({ rounds: Number(e.target.value) || 2 }); }} />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-400">{MODES.find((m) => m.value === ring.mode)?.note}</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-4xl font-bold tabular-nums text-gray-900">{formatClock(left)}</span>
            <span className="text-sm text-gray-500">
              Round {ring.currentRound} of {ring.rounds} ·{" "}
              {ring.state === "running" ? "Running" : ring.state === "paused" ? "Paused" : ring.state === "finished" ? "Finished" : "Ready"}
            </span>
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
