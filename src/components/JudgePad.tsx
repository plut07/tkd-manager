"use client";

import { useCallback, useEffect, useState } from "react";
import {
  judgeScore,
  judgeVerdict,
  judgeHistory,
  penaltyTally,
  formatClock,
  SPARRING_AWARDS,
  SPARRING_CORRECTIONS,
  PATTERN_DEDUCTIONS,
  type Entry,
  type Side,
} from "@/lib/scoreboard";
import { type RingDto } from "@/app/(app)/events/scoreboardActions";
import { contrastText, resolveTheme } from "@/lib/scoreboardTheme";
import { useRingLive } from "@/components/useRingLive";
import {
  enqueue,
  drop,
  flush,
  pendingFor,
  newClientId,
  queueAvailable,
  type QueuedPress,
} from "@/lib/pressQueue";
import { deliver, sendPress, sendUndo, type PublicRing } from "@/lib/judgeApi";

/**
 * A judge's own screen.
 *
 * Big targets, two colours, nothing else — it is used at arm's length, in a
 * noisy hall, often one-handed. Their own running score is shown so they can
 * check themselves, and the last press can always be taken back.
 *
 * A press is written to the phone before it is sent anywhere. Halls have bad
 * wifi, and a judge who loses signal for half a round must not lose half a
 * round of scoring — nor have to think about it. The button behaves the same
 * either way; what changes is a line at the top saying how many presses are
 * still waiting to reach the ring.
 */
export default function JudgePad({ initial, joinCode, judgeSlot }: { initial: RingDto; joinCode: string; judgeSlot: number }) {
  const { ring, left, put, announce } = useRingLive(initial, { joinCode });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /**
   * Presses this phone has taken that the ring hasn't confirmed yet.
   *
   * Held in state as well as in IndexedDB so the judge's own running mark moves
   * the instant they press, with or without a network. They are drawn from here
   * until the ring sends them back, at which point they are the same press
   * under the same name and this copy goes.
   */
  const [waiting, setWaiting] = useState<QueuedPress[]>([]);
  const [online, setOnline] = useState(true);

  /**
   * Put back the two fields the endpoint won't echo.
   *
   * /api/public/judge deliberately withholds the join code and the event id —
   * the device already has the code, and has no business knowing an internal
   * id. But the rest of the pad holds one shape of ring however it arrived, so
   * they are restored from what this screen was already given.
   */
  const restore = useCallback(
    (fresh: PublicRing): RingDto => ({ ...fresh, joinCode, eventId: initial.eventId }),
    [joinCode, initial.eventId],
  );

  const reload = useCallback(async () => {
    if (!queueAvailable()) return;
    try {
      setWaiting(await pendingFor(joinCode, judgeSlot));
    } catch {
      // A browser that won't give us storage is not a reason to stop scoring.
    }
  }, [joinCode, judgeSlot]);

  /** Send everything waiting, then redraw from what is left. */
  const drain = useCallback(async () => {
    if (!queueAvailable()) return;
    try {
      await flush(deliver);
    } catch {
      /* try again on the next tick */
    }
    await reload();
  }, [reload]);

  // The browser's own idea of whether it is connected is the fastest signal
  // there is, and coming back is the moment to try the queue again.
  useEffect(() => {
    const mark = () => setOnline(navigator.onLine);
    mark();
    const back = () => { mark(); void drain(); };
    window.addEventListener("online", back);
    window.addEventListener("offline", mark);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", mark);
    };
  }, [drain]);

  // navigator.onLine only knows about the network adaptor, not about a hall
  // wifi that is connected and going nowhere. So the queue is also retried on a
  // timer whenever anything is in it.
  useEffect(() => {
    void reload();
    const retry = setInterval(() => { if (waiting.length > 0) void drain(); }, 5_000);
    return () => clearInterval(retry);
  }, [reload, drain, waiting.length]);

  async function press(side: Side, value: number, kind: "point" | "deduction" | "flag") {
    setError("");
    const queued: QueuedPress = {
      clientId: newClientId(),
      code: joinCode,
      judgeSlot,
      side,
      value,
      kind,
      matchId: ring.matchId,
      at: Date.now(),
    };

    // Written down first, sent second — so a press is never lost between the
    // thumb and the network.
    const stored = queueAvailable();
    if (stored) {
      try {
        await enqueue(queued);
        setWaiting((held) => [...held, queued]);
      } catch {
        // No storage. Fall through and send it the old way: it either goes or
        // the judge is told plainly that it didn't.
      }
    }

    setBusy(true);
    const reply = await sendPress(queued);
    setBusy(false);

    if (reply === null) {
      // Couldn't reach the ring. It stays in the queue and goes when the signal
      // does; nothing to tell the judge beyond the count already on screen.
      if (!stored) setError("No signal, and this phone won't hold the press. Tell the ring official.");
      return;
    }

    if (stored) { try { await drop(queued.clientId); } catch { /* it will be dropped on the next drain */ } }
    setWaiting((held) => held.filter((p) => p.clientId !== queued.clientId));

    if (!reply.ok) { setError(reply.error); return; }
    put(restore(reply.ring));
    announce();
  }

  async function undo() {
    setError("");

    // A press still on the phone is taken back here rather than at the ring —
    // the ring has never heard of it, and asking it to undo would take back the
    // judge's previous press instead, which is the wrong one.
    const mineWaiting = waiting.filter((p) => p.code === joinCode && p.judgeSlot === judgeSlot);
    if (mineWaiting.length > 0) {
      const last = mineWaiting[mineWaiting.length - 1];
      try { await drop(last.clientId); } catch { /* nothing to do */ }
      setWaiting((held) => held.filter((p) => p.clientId !== last.clientId));
      return;
    }

    setBusy(true);
    const reply = await sendUndo(joinCode, judgeSlot);
    setBusy(false);
    if (reply === null) { setError("No signal — that couldn't be taken back yet."); return; }
    if (!reply.ok) { setError(reply.error); return; }
    put(restore(reply.ring));
    announce();
  }

  /**
   * What this judge's own screen should show.
   *
   * The ring's presses, plus this phone's unsent ones. A press that has landed
   * comes back carrying the name this device gave it, which is how the two are
   * matched up — without that, a press would be drawn twice for the moment
   * between the server confirming it and the queue letting go of it.
   */
  const landed = new Set(ring.entries.map((e) => e.clientId).filter(Boolean) as string[]);
  const unsent: Entry[] = waiting
    .filter((p) => !landed.has(p.clientId))
    .map((p) => ({
      judge_slot: p.judgeSlot,
      side: p.side,
      kind: p.kind,
      value: p.value,
      round: ring.currentRound,
      clientId: p.clientId,
    }));
  const entries: Entry[] = unsent.length > 0 ? [...ring.entries, ...unsent] : ring.entries;
  const queuedCount = unsent.length;

  const mine = judgeHistory(entries, judgeSlot);
  const scoreFor = (side: Side) => judgeScore(entries, judgeSlot, side, ring.mode, ring.patternBase);
  // In flag mode a judge can change their mind, and only their latest press
  // counts — so the tick follows the verdict, not the tally of presses.
  const myVerdict = judgeVerdict(entries, judgeSlot, ring.mode, ring.patternBase);
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

      {/* One line, and only when there is something to say. A judge should not
          have to think about the network — but if presses are sitting on the
          phone they are entitled to know, because it is their score that the
          ring is missing. */}
      {(queuedCount > 0 || !online) && (
        <p
          className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
            queuedCount > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          <span>
            {queuedCount > 0
              ? `${queuedCount} press${queuedCount === 1 ? "" : "es"} waiting to reach the ring. Keep scoring — they go as soon as the signal is back.`
              : "No signal. Keep scoring; presses are held on this phone."}
          </span>
          {queuedCount > 0 && (
            <button type="button" className="shrink-0 font-semibold underline" onClick={() => { void drain(); }}>
              Try now
            </button>
          )}
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
            ) : ring.mode === "sparring" ? (
              /* Awards first and full width, because that is what a judge
                 presses hundreds of times a day; corrections underneath in
                 grey, smaller, and labelled as corrections so nobody mistakes
                 one for a referee's deduction. */
              <div className="space-y-2">
                {SPARRING_AWARDS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    disabled={busy || finished}
                    onClick={() => { void press(s.side, b.value, "point"); }}
                    className="flex h-20 w-full flex-col items-center justify-center rounded-md px-2 disabled:opacity-40"
                    style={{ backgroundColor: s.colour, color: contrastText(s.colour) }}
                  >
                    <span className="text-2xl font-bold leading-none">{b.label}</span>
                    <span className="mt-1 text-[10px] leading-tight opacity-80">{b.note}</span>
                  </button>
                ))}
                <div className="grid grid-cols-3 gap-2 border-t border-current/20 pt-2">
                  {SPARRING_CORRECTIONS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      disabled={busy || finished}
                      title={b.note}
                      onClick={() => { void press(s.side, b.value, "point"); }}
                      className="h-11 rounded-md bg-zinc-700 text-base font-semibold text-white disabled:opacity-40"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="text-center text-[10px] opacity-60">Corrections — a referee&apos;s deduction is called on the ring screen</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {PATTERN_DEDUCTIONS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    disabled={busy || finished}
                    onClick={() => { void press(s.side, b.value, "deduction"); }}
                    className="flex h-16 flex-col items-center justify-center rounded-md bg-zinc-700 text-white disabled:opacity-40"
                  >
                    <span className="text-lg font-bold leading-none">{b.label}</span>
                    <span className="mt-0.5 text-[10px] leading-tight opacity-80">{b.note}</span>
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
