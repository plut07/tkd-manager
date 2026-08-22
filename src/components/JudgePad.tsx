"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  judgeScore,
  judgeVerdict,
  judgeHistory,
  secondsLeft,
  formatClock,
  SPARRING_BUTTONS,
  PATTERN_BUTTONS,
  type Side,
} from "@/lib/scoreboard";
import { judgePress, judgeUndo, loadRing, type RingDto } from "@/app/(app)/events/scoreboardActions";
import { realtimeClient } from "@/lib/liveChannel";

/**
 * A judge's own screen.
 *
 * Big targets, two colours, nothing else — it is used at arm's length, in a
 * noisy hall, often one-handed. Their own running score is shown so they can
 * check themselves, and the last press can always be taken back.
 */
export default function JudgePad({ initial, joinCode, judgeSlot }: { initial: RingDto; joinCode: string; judgeSlot: number }) {
  const [ring, setRing] = useState<RingDto>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(() => secondsLeft({ state: initial.state, startedAt: initial.clockStartedAt, remaining: initial.clockRemaining }));
  const channelRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    const fresh = await loadRing({ joinCode });
    if (fresh) setRing(fresh);
  }, [joinCode]);

  useEffect(() => {
    const client = realtimeClient();
    let channel: any = null;
    if (client) {
      channel = client.channel(`ring:${initial.id}`, { config: { broadcast: { self: false } } });
      channel.on("broadcast", { event: "changed" }, () => { void refresh(); });
      channel.subscribe();
      channelRef.current = channel;
    }
    const poll = setInterval(() => { void refresh(); }, client ? 15000 : 4000);
    return () => {
      clearInterval(poll);
      if (channel && client) client.removeChannel(channel);
    };
  }, [initial.id, refresh]);

  // The clock is worked out locally from when it started, so it stays smooth
  // without a message every second.
  useEffect(() => {
    const tick = setInterval(() => {
      setLeft(secondsLeft({ state: ring.state, startedAt: ring.clockStartedAt, remaining: ring.clockRemaining }));
    }, 250);
    return () => clearInterval(tick);
  }, [ring.state, ring.clockStartedAt, ring.clockRemaining]);

  function announce() {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }

  async function press(side: Side, value: number, kind: "point" | "deduction" | "flag") {
    setBusy(true);
    setError("");
    const result = await judgePress({ joinCode, judgeSlot, side, value, kind });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRing(result.ring);
    announce();
  }

  async function undo() {
    setBusy(true);
    setError("");
    const result = await judgeUndo({ joinCode, judgeSlot });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRing(result.ring);
    announce();
  }

  const mine = judgeHistory(ring.entries, judgeSlot);
  const scoreFor = (side: Side) => judgeScore(ring.entries, judgeSlot, side, ring.mode, ring.patternBase);
  // In flag mode a judge can change their mind, and only their latest press
  // counts — so the tick follows the verdict, not the tally of presses.
  const myVerdict = judgeVerdict(ring.entries, judgeSlot, ring.mode, ring.patternBase);
  const finished = ring.state === "finished";

  const sides: { side: Side; label: string; name: string | null; classes: string }[] = [
    { side: "red", label: "RED", name: ring.redName, classes: "bg-red-600 hover:bg-red-700" },
    { side: "blue", label: "BLUE", name: ring.blueName, classes: "bg-blue-600 hover:bg-blue-700" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-900 px-3 py-2 text-white">
        <span className="text-sm font-semibold">{ring.name} · Judge {judgeSlot}</span>
        <span className="text-sm">{ring.categoryName ?? "No category"}</span>
        <span className="font-mono text-lg">{formatClock(left)}</span>
      </div>

      {finished && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This bout is finished. Wait for the next one to be set up.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {sides.map((s) => (
          <div key={s.side} className="space-y-2">
            <div className={`rounded-md ${s.side === "red" ? "bg-red-50" : "bg-blue-50"} p-3 text-center`}>
              <p className={`text-xs font-bold ${s.side === "red" ? "text-red-700" : "text-blue-700"}`}>{s.label}</p>
              <p className="truncate text-sm text-gray-700">{s.name ?? "—"}</p>
              <p className="text-3xl font-bold text-gray-900">
                {ring.mode === "flag" ? (myVerdict === s.side ? "✓" : "—") : scoreFor(s.side)}
              </p>
            </div>

            {ring.mode === "flag" ? (
              <button
                type="button"
                disabled={busy || finished}
                onClick={() => { void press(s.side, 1, "flag"); }}
                className={`h-28 w-full rounded-md text-xl font-bold text-white disabled:opacity-40 ${s.classes}`}
              >
                {s.label} WINS
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(ring.mode === "sparring" ? SPARRING_BUTTONS : PATTERN_BUTTONS).map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={busy || finished}
                    onClick={() => { void press(s.side, v, ring.mode === "sparring" ? "point" : "deduction"); }}
                    className={`h-16 rounded-md text-lg font-bold text-white disabled:opacity-40 ${
                      v < 0 ? "bg-gray-700 hover:bg-gray-800" : s.classes
                    }`}
                  >
                    {v > 0 ? `+${v}` : v}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={busy || mine.length === 0} onClick={() => { void undo(); }}>
          Undo my last
        </button>
        <span className="text-xs text-gray-500">
          {mine.length === 0
            ? "Nothing recorded yet."
            : `Last: ${mine[0].side.toUpperCase()} ${mine[0].kind === "flag" ? "flag" : mine[0].value > 0 ? `+${mine[0].value}` : mine[0].value}`}
        </span>
      </div>
    </div>
  );
}
