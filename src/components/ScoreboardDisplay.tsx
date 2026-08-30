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
import { resolveTheme, MODE_LABELS } from "@/lib/scoreboardTheme";
import DisplayBoard, { type BoardData, type BoardSide } from "@/components/DisplayBoard";
import { loadRing, type RingDto } from "@/app/(app)/events/scoreboardActions";
import { realtimeClient } from "@/lib/liveChannel";

/**
 * The screen the hall sees.
 *
 * This component's job is only to keep the numbers current. Where everything
 * sits is DisplayBoard's, and the layout it draws comes from the event's
 * design for the mode being scored — so the designer's preview and this are
 * the same component with different data.
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

  // The design for this mode: the event's base, with whatever the mode changes.
  const look = resolveTheme(ring.theme, ring.mode);
  const result = tally(ring.entries, ring.judgeCount, ring.mode, ring.patternBase);
  const judges = Array.from({ length: ring.judgeCount }, (_, i) => i + 1);

  // Time up on the final round is the end of the bout as far as the hall is
  // concerned, whether or not the operator has pressed anything yet.
  const timeUp = left <= 0 && ring.state !== "idle";
  const over = ring.state === "finished" || (timeUp && ring.currentRound >= ring.rounds);

  const sides: BoardSide[] = (["red", "blue"] as Side[]).map((side) => {
    const penalties = penaltyTally(ring.entries, side);
    return {
      side,
      name: side === "red" ? ring.redName : ring.blueName,
      number: side === "red" ? ring.redNumber : ring.blueNumber,
      votes: result[side],
      mark: sideTotal(ring.entries, ring.judgeCount, side, ring.mode, ring.patternBase),
      judgeMarks: judges.map((judge) => {
        const favours = judgeVerdict(ring.entries, judge, ring.mode, ring.patternBase) === side;
        return {
          judge,
          favours,
          value:
            ring.mode === "flag"
              ? favours ? "✓" : "—"
              : String(judgeScore(ring.entries, judge, side, ring.mode, ring.patternBase)),
        };
      }),
      warnings: penalties.warnings,
      deductions: penalties.deductions,
      penaltyPoints: penalties.points,
      winning: over && result.winner === side,
    };
  });

  const winnerName = result.winner === "red" ? ring.redName : ring.blueName;
  const data: BoardData = {
    ringName: ring.name,
    heading: [
      ring.categoryName,
      ring.mode === "pattern" && ring.patternName ? ring.patternName : null,
      `Round ${ring.currentRound} of ${ring.rounds}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    modeLabel: MODE_LABELS[ring.mode],
    mode: ring.mode,
    clock: formatClock(left),
    timeUp,
    statusIsResult: over,
    status: over
      ? result.winner
        ? `WINNER — ${winnerName ?? result.winner.toUpperCase()} (${result.red}–${result.blue})`
        : `Judges tied ${result.red}–${result.blue} — referee to decide`
      : ring.state === "running"
        ? `Round ${ring.currentRound} of ${ring.rounds}`
        : ring.state === "paused"
          ? "Paused"
          : "Ready",
    sides,
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: look.background }}>
      <DisplayBoard data={data} look={look} />
    </div>
  );
}
