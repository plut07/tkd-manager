import { Offline, Stale, sendPress, type Press, type Ring } from "./api";

/**
 * Presses that haven't reached the server yet.
 *
 * The rule the whole app is built around: a judge's press is never lost and
 * never counted twice. Pressing a button always succeeds locally and joins the
 * queue; the queue drains in order whenever the connection allows.
 *
 * In order matters. Sparring presses commute, but a pattern deduction followed
 * by an undo does not, and neither does a flag changed twice — so one press is
 * sent at a time and a failure stops the run rather than skipping ahead.
 *
 * Kept deliberately free of React and of storage so it can be run straight
 * through in a test, which is the only way to be sure about a retry path that
 * by definition only happens when things are going wrong.
 */

export type QueueState = {
  pending: Press[];
  /** Presses the server refused for good — the bout they belonged to is over. */
  dropped: Press[];
};

export const emptyQueue = (): QueueState => ({ pending: [], dropped: [] });

export type FlushResult = {
  state: QueueState;
  /** The ring as the server last described it, if anything was sent. */
  ring: Ring | null;
  /** True when the run stopped because the server couldn't be reached. */
  offline: boolean;
  sent: number;
  dropped: number;
};

/**
 * Try to send everything waiting, oldest first.
 *
 * Stops at the first press that couldn't be delivered, leaving it and
 * everything after it queued. A press the server rejects as stale is moved to
 * `dropped` and the run continues: it will never succeed, so blocking the
 * queue behind it would strand every later press too.
 */
export async function flush(
  base: string,
  state: QueueState,
  send: typeof sendPress = sendPress,
): Promise<FlushResult> {
  let pending = [...state.pending];
  const dropped = [...state.dropped];
  let ring: Ring | null = null;
  let sent = 0;
  let droppedNow = 0;

  while (pending.length > 0) {
    const next = pending[0];
    try {
      ring = await send(base, next);
      pending = pending.slice(1);
      sent++;
    } catch (error) {
      if (error instanceof Offline) {
        return { state: { pending, dropped }, ring, offline: true, sent, dropped: droppedNow };
      }
      if (error instanceof Stale) {
        pending = pending.slice(1);
        dropped.push(next);
        droppedNow++;
        continue;
      }
      // Anything else is the server saying no for a reason that won't change
      // on a retry — a judge number that isn't on the ring, a malformed press.
      // Keeping it would block every later press behind it forever.
      pending = pending.slice(1);
      dropped.push(next);
      droppedNow++;
    }
  }

  return { state: { pending, dropped }, ring, offline: false, sent, dropped: droppedNow };
}

/**
 * The judge's own view, with what hasn't been sent yet folded in.
 *
 * A pad that only showed presses the server had acknowledged would appear to
 * ignore a judge on bad wifi, which is precisely when they need to trust it.
 */
export function withPending(ring: Ring, pending: Press[], judgeSlot: number) {
  const mine = pending.filter((p) => p.judgeSlot === judgeSlot);
  return [
    ...ring.entries,
    ...mine.map((p) => ({
      judge_slot: p.judgeSlot,
      side: p.side,
      kind: p.kind,
      value: p.value,
      round: ring.currentRound,
      voided: false,
    })),
  ];
}

/**
 * Take back the last press.
 *
 * If something is still queued, that is what comes off — locally, without
 * troubling the server, because the server never saw it. Only when the queue
 * is empty does an undo have to travel.
 */
export function undoLocally(state: QueueState, judgeSlot: number): { state: QueueState; removed: Press | null } {
  for (let i = state.pending.length - 1; i >= 0; i--) {
    if (state.pending[i].judgeSlot === judgeSlot) {
      const pending = [...state.pending];
      const [removed] = pending.splice(i, 1);
      return { state: { ...state, pending }, removed };
    }
  }
  return { state, removed: null };
}
