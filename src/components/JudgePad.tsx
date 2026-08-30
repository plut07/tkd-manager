"use client";

import { useState } from "react";
import {
  judgeScore,
  judgeVerdict,
  judgeHistory,
  penaltyTally,
  formatClock,
  SPARRING_BUTTONS,
  PATTERN_BUTTONS,
  type Side,
} from "@/lib/scoreboard";
import { judgePress, judgeUndo, type RingDto } from "@/app/(app)/events/scoreboardActions";
import { contrastText, resolveTheme } from "@/lib/scoreboardTheme";
import { useRingLive } from "@/components/useRingLive";

/**
 * A judge's own screen.
 *
 * Big targets, two colours, nothing else — it is used at arm's length, in a
 * noisy hall, often one-handed. Their own running score is shown so they can
 * check themselves, and the last press can always be taken back.
 */
export default function JudgePad({ initial, joinCode, judgeSlot }: { initial: RingDto; joinCode: string; judgeSlot: number }) {
  const { ring, left, put, announce } = useRingLive(initial, { joinCode });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function press(side: Side, value: number, kind: "point" | "deduction" | "flag") {
    setBusy(true);
    setError("");
    const result = await judgePress({ joinCode, judgeSlot, side, value, kind });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  async function undo() {
    setBusy(true);
    setError("");
    const result = await judgeUndo({ joinCode, judgeSlot });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    put(result.ring);
    announce();
  }

  const mine = judgeHistory(ring.entries, judgeSlot);
  const scoreFor = (side: Side) => judgeScore(ring.entries, judgeSlot, side, ring.mode, ring.patternBase);
  // In flag mode a judge can change their mind, and only their latest press
  // counts — so the tick follows the verdict, not the tally of presses.
  const myVerdict = judgeVerdict(ring.entries, judgeSlot, ring.mode, ring.patternBase);
  const finished = ring.state === "finished";

  // Colours come from the event's theme so a judge glancing up at the display
  // sees the same red as the button under their thumb.
  // The design for this mode: the event's base, with whatever the mode changes.
  const theme = resolveTheme(ring.theme, ring.mode);
  const L = theme.pad;
  const sides: { side: Side; label: string; name: string | null; number: string | null; colour: string }[] = [
    { side: "red", label: "RED", name: ring.redName, number: ring.redNumber, colour: theme.redColor },
    { side: "blue", label: "BLUE", name: ring.blueName, number: ring.blueNumber, colour: theme.blueColor },
  ];
  const dark = theme.padDarkBackground;

  const header = (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-900 px-3 py-2 text-white"
      key="header"
    >
      <span className="text-sm font-semibold">{ring.name} · Judge {judgeSlot}</span>
      <span className="text-sm">
        {[ring.categoryName, ring.mode === "pattern" ? ring.patternName : null, `R${ring.currentRound}/${ring.rounds}`]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {L.clock === "inHeader" && <span className="font-mono text-lg">{formatClock(left)}</span>}
    </div>
  );

  const bigClock =
    L.clock === "aboveButtons" ? (
      <p className="text-center font-mono text-4xl font-bold tabular-nums" key="clock">{formatClock(left)}</p>
    ) : null;

  const undoRow = (
    <div className="flex flex-wrap items-center gap-3" key="undo">
      <button type="button" className="btn-secondary" disabled={busy || mine.length === 0} onClick={() => { void undo(); }}>
        Undo my last
      </button>
      <span className="text-xs opacity-70">
        {mine.length === 0
          ? "Nothing recorded yet."
          : `Last: ${mine[0].side.toUpperCase()} ${mine[0].kind === "flag" ? "flag" : mine[0].value > 0 ? `+${mine[0].value}` : mine[0].value}`}
      </span>
    </div>
  );

  return (
    <div
      className="mx-auto max-w-3xl space-y-3 p-2"
      style={dark ? { backgroundColor: theme.background, color: theme.textColor, minHeight: "100vh" } : undefined}
    >
      {L.header === "top" && header}

      {finished && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This bout is finished. Wait for the next one to be set up.
        </p>
      )}

      {bigClock}
      {L.undo === "top" && undoRow}

      <div className="grid grid-cols-2 gap-3">
        {sides.map((s) => (
          <div key={s.side} className="space-y-2">
            <div
              className="rounded-md p-3 text-center"
              style={{ backgroundColor: s.colour, color: contrastText(s.colour) }}
            >
              <p className="text-xs font-bold tracking-widest opacity-80">{s.label}</p>
              {(() => {
                const nameLine = (
                  <p className="truncate text-sm" key="name">
                    {theme.showCompetitorNumbers && s.number ? `#${s.number} ` : ""}
                    {s.name ?? "—"}
                  </p>
                );
                const markLine = (
                  <p className="text-3xl font-bold" key="mark">
                    {ring.mode === "flag" ? (myVerdict === s.side ? "✓" : "—") : scoreFor(s.side)}
                  </p>
                );
                return L.name === "aboveScore" ? [nameLine, markLine] : [markLine, nameLine];
              })()}
              {/* The referee's calls already come off this mark; showing them
                  stops a judge wondering why their number moved on its own. */}
              {penaltyTally(ring.entries, s.side).points > 0 && (
                <p className="text-xs opacity-80">
                  includes −{penaltyTally(ring.entries, s.side).points} from the referee
                </p>
              )}
            </div>

            {ring.mode === "flag" ? (
              <button
                type="button"
                disabled={busy || finished}
                onClick={() => { void press(s.side, 1, "flag"); }}
                className="h-28 w-full rounded-md text-xl font-bold disabled:opacity-40"
                style={{ backgroundColor: s.colour, color: contrastText(s.colour) }}
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
                    className="h-16 rounded-md text-lg font-bold disabled:opacity-40"
                    style={{
                      backgroundColor: v < 0 ? "#3f3f46" : s.colour,
                      color: contrastText(v < 0 ? "#3f3f46" : s.colour),
                    }}
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

      {L.undo === "bottom" && undoRow}
      {L.header === "bottom" && header}
    </div>
  );
}
