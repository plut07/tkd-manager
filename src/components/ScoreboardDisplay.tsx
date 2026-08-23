"use client";

import { useCallback, useEffect, useState } from "react";
import {
  sideTotal,
  tally,
  secondsLeft,
  formatClock,
  judgeVerdict,
  judgeScore,
  penaltyTally,
  WARNINGS_PER_POINT,
  type Side,
} from "@/lib/scoreboard";
import { loadRing, type RingDto } from "@/app/(app)/events/scoreboardActions";
import { realtimeClient } from "@/lib/liveChannel";

/**
 * The screen the hall sees.
 *
 * Dark, enormous type, two colours. The headline number is how many judges
 * favour that competitor, because that is what decides the bout — the marks
 * themselves sit underneath, one per judge, so a coach can see the split
 * without anyone having to explain the arithmetic.
 *
 * It never takes input: a stray tap on the projector laptop shouldn't be able
 * to change a bout.
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
  const judges = Array.from({ length: ring.judgeCount }, (_, i) => i + 1);

  // Time up on the final round is the end of the bout as far as the hall is
  // concerned, whether or not the operator has pressed anything yet.
  const timeUp = left <= 0 && ring.state !== "idle";
  const over = ring.state === "finished" || (timeUp && ring.currentRound >= ring.rounds);

  const heading = [
    ring.categoryName,
    ring.mode === "pattern" && ring.patternName ? ring.patternName : null,
    `Round ${ring.currentRound} of ${ring.rounds}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* A real blink, not a fade — it has to read from the back of a hall. */}
      <style>{"@keyframes tkdblink{0%,45%{opacity:1}55%,100%{opacity:.15}} .tkd-blink{animation:tkdblink 1s steps(1,end) infinite}"}</style>

      <div className="flex items-center justify-between px-6 py-3 text-2xl font-semibold text-gray-300">
        <span>{ring.name}</span>
        <span className="truncate px-4 text-center">{heading}</span>
        <span className="text-gray-500">{ring.mode === "flag" ? "Flags" : ring.mode === "pattern" ? "Pattern" : "Sparring"}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4">
        {(["red", "blue"] as Side[]).map((side) => {
          const name = side === "red" ? ring.redName : ring.blueName;
          const number = side === "red" ? ring.redNumber : ring.blueNumber;
          const votes = result[side];
          const mark = sideTotal(ring.entries, ring.judgeCount, side, ring.mode, ring.patternBase);
          const penalties = penaltyTally(ring.entries, side);
          const winning = over && result.winner === side;

          return (
            <div
              key={side}
              className={`rounded-2xl p-5 text-center ${side === "red" ? "bg-red-700" : "bg-blue-700"} ${
                winning ? "ring-8 ring-yellow-400" : ""
              }`}
            >
              <p className="text-2xl font-semibold uppercase tracking-widest opacity-80">{side}</p>

              <div className={winning ? "tkd-blink" : ""}>
                <p className="mt-1 truncate text-4xl font-bold">
                  {number ? <span className="mr-3 rounded bg-black/25 px-3 py-0.5 tabular-nums">{number}</span> : null}
                  {name ?? "—"}
                </p>

                {/* The number that decides it: judges in favour. */}
                <p className="mt-1 text-[7rem] font-black leading-none tabular-nums">{votes}</p>
                <p className="-mt-2 text-lg uppercase tracking-widest opacity-70">
                  {votes === 1 ? "judge" : "judges"} of {ring.judgeCount}
                </p>
              </div>

              {/* Every judge's own mark, so the split is visible. */}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {judges.map((judge) => {
                  const verdict = judgeVerdict(ring.entries, judge, ring.mode, ring.patternBase);
                  const favours = verdict === side;
                  return (
                    <span
                      key={judge}
                      className={`min-w-[4.5rem] rounded-md px-2 py-1 text-xl font-bold tabular-nums ${
                        favours ? "bg-yellow-400 text-gray-900" : "bg-black/25 text-white/80"
                      }`}
                    >
                      <span className="mr-1 text-xs font-medium opacity-60">J{judge}</span>
                      {ring.mode === "flag"
                        ? favours
                          ? "✓"
                          : "—"
                        : judgeScore(ring.entries, judge, side, ring.mode, ring.patternBase)}
                    </span>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-center gap-3 text-lg">
                {ring.mode !== "flag" && (
                  <span className="rounded-md bg-black/25 px-3 py-1 tabular-nums">
                    <span className="mr-2 text-xs uppercase tracking-wider opacity-60">Score</span>
                    {mark}
                  </span>
                )}
                <span className={`rounded-md px-3 py-1 tabular-nums ${penalties.warnings > 0 ? "bg-amber-400 text-gray-900" : "bg-black/25"}`}>
                  <span className="mr-2 text-xs uppercase tracking-wider opacity-60">Warn</span>
                  {penalties.warnings}
                </span>
                <span className={`rounded-md px-3 py-1 tabular-nums ${penalties.deductions > 0 ? "bg-white text-gray-900" : "bg-black/25"}`}>
                  <span className="mr-2 text-xs uppercase tracking-wider opacity-60">Ded</span>
                  {penalties.deductions}
                </span>
                {penalties.points > 0 && (
                  <span className="rounded-md bg-black/40 px-3 py-1 tabular-nums">−{penalties.points}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-center">
        <p className={`font-mono text-[5rem] font-bold leading-none tabular-nums ${timeUp ? "text-yellow-400" : ""}`}>
          {formatClock(left)}
        </p>
        <p className="mt-1 text-2xl text-gray-300">
          {over ? (
            result.winner ? (
              <span className="font-bold text-yellow-400">
                WINNER — {(result.winner === "red" ? ring.redName : ring.blueName) ?? result.winner.toUpperCase()} ({result.red}–{result.blue})
              </span>
            ) : (
              <span className="font-bold text-yellow-400">Judges tied {result.red}–{result.blue} — referee to decide</span>
            )
          ) : ring.state === "running" ? (
            `Round ${ring.currentRound} of ${ring.rounds}`
          ) : ring.state === "paused" ? (
            "Paused"
          ) : (
            "Ready"
          )}
        </p>
        <p className="mt-1 text-sm text-gray-600">Every {WARNINGS_PER_POINT} warnings costs 1 point.</p>
      </div>
    </div>
  );
}
