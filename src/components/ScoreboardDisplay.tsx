"use client";

import { useRef } from "react";
import {
  sideTotal,
  tally,
  formatClock,
  judgeVerdict,
  judgeScore,
  penaltyTally,
  type Side,
} from "@/lib/scoreboard";
import { resolveTheme, MODE_LABELS } from "@/lib/scoreboardTheme";
import DisplayBoard, { type BoardData, type BoardSide } from "@/components/DisplayBoard";
import FullScreenButton, { useFullScreen } from "@/components/FullScreenButton";
import { useRingLive } from "@/components/useRingLive";
import { type RingDto } from "@/app/(app)/events/scoreboardActions";

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
  const { ring, left } = useRingLive(initial, { ringId: initial.id });
  const board = useRef<HTMLDivElement>(null);
  const screen = useFullScreen(board);

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
    categoryName: ring.categoryName ?? "",
    roundLabel: `Round ${ring.currentRound} of ${ring.rounds}`,
    patternName: ring.patternName ?? "",
    modeLabel: MODE_LABELS[ring.mode],
    mode: ring.mode,
    // The last ten seconds show a tenth. That is where a round is decided and
    // where everybody is watching the number rather than the bout.
    clock: formatClock(left, true),
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
    <div
      ref={board}
      className={screen.big ? "fixed inset-0 z-50 overflow-auto" : "relative min-h-screen"}
      style={{ backgroundColor: look.background }}
    >
      <FullScreenButton big={screen.big} showControls={screen.showControls} onToggle={screen.toggle} />
      <DisplayBoard data={data} look={look} />
    </div>
  );
}
