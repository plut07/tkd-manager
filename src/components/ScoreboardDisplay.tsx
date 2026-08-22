"use client";

import { useCallback, useEffect, useState } from "react";
import { sideTotal, tally, secondsLeft, formatClock, judgeVerdict, type Side } from "@/lib/scoreboard";
import { loadRing, type RingDto } from "@/app/(app)/events/scoreboardActions";
import { realtimeClient } from "@/lib/liveChannel";

/**
 * The screen the hall sees.
 *
 * Dark, enormous type, two colours and nothing to read at a glance beyond the
 * score and the clock. It never takes input — a stray tap on the projector
 * laptop shouldn't be able to change a bout.
 */
export default function ScoreboardDisplay({ initial }: { initial: RingDto }) {
  const [ring, setRing] = useState<RingDto>(initial);
  const [left, setLeft] = useState(() =>
    secondsLeft({ state: initial.state, startedAt: initial.clockStartedAt, remaining: initial.clockRemaining }),
  );

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

  const result = tally(ring.entries, ring.judgeCount, ring.mode, ring.patternBase);
  const total = (side: Side) => sideTotal(ring.entries, ring.judgeCount, side, ring.mode, ring.patternBase);
  const finished = ring.state === "finished";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center justify-between px-6 py-3 text-lg text-gray-400">
        <span>{ring.name}</span>
        <span className="truncate">{ring.categoryName ?? ""}</span>
        <span>{ring.mode === "flag" ? "Flags" : ring.mode === "pattern" ? "Pattern" : "Sparring"}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4">
        {(["red", "blue"] as Side[]).map((side) => {
          const winning = finished && result.winner === side;
          return (
            <div
              key={side}
              className={`rounded-2xl p-6 text-center ${side === "red" ? "bg-red-700" : "bg-blue-700"} ${
                winning ? "ring-8 ring-yellow-400" : ""
              }`}
            >
              <p className="text-2xl font-semibold uppercase tracking-widest opacity-80">{side}</p>
              <p className="mt-1 truncate text-3xl font-bold">{(side === "red" ? ring.redName : ring.blueName) ?? "—"}</p>
              <p className="mt-2 text-[7rem] font-black leading-none tabular-nums">{total(side)}</p>

              {/* Each judge as a dot, so the hall can see the split at a glance. */}
              <div className="mt-3 flex justify-center gap-2">
                {Array.from({ length: ring.judgeCount }, (_, i) => i + 1).map((judge) => {
                  const verdict = judgeVerdict(ring.entries, judge, ring.mode, ring.patternBase);
                  return (
                    <span
                      key={judge}
                      className={`h-4 w-4 rounded-full ${verdict === side ? "bg-yellow-400" : "bg-white/25"}`}
                      title={`Judge ${judge}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <p className="font-mono text-[5rem] font-bold leading-none tabular-nums">{formatClock(left)}</p>
        <p className="mt-1 text-xl text-gray-400">
          {ring.state === "running"
            ? `Round ${ring.currentRound} of ${ring.rounds}`
            : ring.state === "paused"
              ? "Paused"
              : finished
                ? result.winner
                  ? `${(result.winner === "red" ? ring.redName : ring.blueName) ?? result.winner.toUpperCase()} wins ${result.red}–${result.blue}`
                  : `Judges tied ${result.red}–${result.blue}`
                : "Ready"}
        </p>
      </div>
    </div>
  );
}
