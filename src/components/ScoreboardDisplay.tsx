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
  type Side,
} from "@/lib/scoreboard";
import { contrastText } from "@/lib/scoreboardTheme";
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
 * Colours and what is shown come from the event's theme, which arrives with
 * the ring. Every element the theme can hide is optional to the reading of the
 * board: the score, the corners and the winner are never hidden.
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

  const theme = ring.theme;
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
    <div className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.textColor }}>
      {/* A real blink, not a fade — it has to read from the back of a hall. */}
      <style>{"@keyframes tkdblink{0%,45%{opacity:1}55%,100%{opacity:.15}} .tkd-blink{animation:tkdblink 1s steps(1,end) infinite}"}</style>

      {(theme.logoUrl || theme.headline) && (
        <div className="flex flex-col items-center gap-1 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {theme.logoUrl && <img src={theme.logoUrl} alt="" className="h-16 object-contain" />}
          {theme.headline && <p className="text-2xl font-semibold opacity-90">{theme.headline}</p>}
        </div>
      )}

      {theme.showCategory && (
        <div className="flex items-center justify-between px-6 py-3 text-2xl font-semibold opacity-70">
          <span>{ring.name}</span>
          <span className="truncate px-4 text-center">{heading}</span>
          <span className="opacity-70">{ring.mode === "flag" ? "Flags" : ring.mode === "pattern" ? "Pattern" : "Sparring"}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 px-4">
        {(["red", "blue"] as Side[]).map((side) => {
          const name = side === "red" ? ring.redName : ring.blueName;
          const number = side === "red" ? ring.redNumber : ring.blueNumber;
          const votes = result[side];
          const mark = sideTotal(ring.entries, ring.judgeCount, side, ring.mode, ring.patternBase);
          const penalties = penaltyTally(ring.entries, side);
          const winning = over && result.winner === side;
          const colour = side === "red" ? theme.redColor : theme.blueColor;
          const ink = contrastText(colour);

          return (
            <div
              key={side}
              className="rounded-2xl p-5 text-center"
              style={{
                backgroundColor: colour,
                color: ink,
                outline: winning ? `8px solid ${theme.accentColor}` : "none",
                outlineOffset: winning ? "-2px" : undefined,
              }}
            >
              <p className="text-2xl font-semibold uppercase tracking-widest opacity-80">{side}</p>

              <div className={winning ? "tkd-blink" : ""}>
                <p className="mt-1 truncate text-4xl font-bold">
                  {theme.showCompetitorNumbers && number ? (
                    <span className="mr-3 rounded bg-black/25 px-3 py-0.5 tabular-nums">{number}</span>
                  ) : null}
                  {name ?? "—"}
                </p>

                {/* The number that decides it: judges in favour. */}
                <p className="font-black leading-none tabular-nums" style={{ fontSize: `${7 * theme.scoreScale}rem` }}>
                  {votes}
                </p>
                {theme.showVoteCount && (
                  <p className="-mt-2 text-lg uppercase tracking-widest opacity-70">
                    {votes === 1 ? "judge" : "judges"} of {ring.judgeCount}
                  </p>
                )}
              </div>

              {theme.showJudgeMarks && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {judges.map((judge) => {
                    const verdict = judgeVerdict(ring.entries, judge, ring.mode, ring.patternBase);
                    const favours = verdict === side;
                    return (
                      <span
                        key={judge}
                        className="min-w-[4.5rem] rounded-md px-2 py-1 text-xl font-bold tabular-nums"
                        style={{
                          backgroundColor: favours ? theme.accentColor : "rgba(0,0,0,0.25)",
                          color: favours ? contrastText(theme.accentColor) : ink,
                        }}
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
              )}

              {/* A pattern is marked out of ten and the mark is the result, so
                  it stays. Sparring is decided by the count of judges above,
                  where an averaged points figure only competed with it. */}
              {ring.mode === "pattern" && (
                <p className="mt-3 rounded-md bg-black/25 py-1 text-2xl font-bold tabular-nums">
                  <span className="mr-2 text-sm uppercase tracking-widest opacity-60">Score</span>
                  {mark}
                </p>
              )}

              {theme.showPenalties && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div
                    className="rounded-md py-2"
                    style={
                      penalties.warnings > 0
                        ? { backgroundColor: theme.accentColor, color: contrastText(theme.accentColor) }
                        : { backgroundColor: "rgba(0,0,0,0.25)" }
                    }
                  >
                    <p className="text-sm uppercase tracking-widest opacity-70">Warning</p>
                    <p className="text-4xl font-bold leading-none tabular-nums">{penalties.warnings}</p>
                  </div>
                  <div
                    className="rounded-md py-2"
                    style={
                      penalties.deductions > 0
                        ? { backgroundColor: "#ffffff", color: "#111111" }
                        : { backgroundColor: "rgba(0,0,0,0.25)" }
                    }
                  >
                    <p className="text-sm uppercase tracking-widest opacity-70">Deduction</p>
                    <p className="text-4xl font-bold leading-none tabular-nums">{penalties.deductions}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-center">
        {theme.showClock && (
          <p
            className="font-mono font-bold leading-none tabular-nums"
            style={{ fontSize: `${5 * theme.clockScale}rem`, color: timeUp ? theme.accentColor : theme.textColor }}
          >
            {formatClock(left)}
          </p>
        )}
        <p className="mt-1 text-2xl opacity-80">
          {over ? (
            result.winner ? (
              <span className="font-bold" style={{ color: theme.accentColor }}>
                WINNER — {(result.winner === "red" ? ring.redName : ring.blueName) ?? result.winner.toUpperCase()} ({result.red}–{result.blue})
              </span>
            ) : (
              <span className="font-bold" style={{ color: theme.accentColor }}>
                Judges tied {result.red}–{result.blue} — referee to decide
              </span>
            )
          ) : ring.state === "running" ? (
            `Round ${ring.currentRound} of ${ring.rounds}`
          ) : ring.state === "paused" ? (
            "Paused"
          ) : (
            "Ready"
          )}
        </p>
      </div>
    </div>
  );
}
