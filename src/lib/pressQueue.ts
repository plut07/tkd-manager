"use client";

import { type Side } from "@/lib/scoreboard";

/**
 * A judge's presses, held on their own phone until the server has them.
 *
 * Halls have bad wifi. A judge whose signal drops for thirty seconds in the
 * middle of a round must not lose those thirty seconds of scoring, and must not
 * have to think about it either — the button they press has to behave the same
 * whether the network is there or not.
 *
 * So every press is written here first and sent second. It leaves the queue
 * only when the server has confirmed it, which makes the queue the honest
 * answer to "what has this judge scored that the ring doesn't know about yet".
 *
 * Two things on the server make this safe, and both were already built for it:
 *
 *   - every press carries a clientId, and a repeat of one that already arrived
 *     is answered as success rather than counted twice. So a press may be sent
 *     as many times as it takes.
 *
 *   - every press carries the bout it was made under, and the server refuses it
 *     if the ring has moved on. A press stranded on a phone during one bout can
 *     never land on the next one.
 *
 * IndexedDB rather than localStorage: this has to survive the browser killing a
 * backgrounded tab, which is exactly what phones do to a screen somebody has
 * put in their pocket between rounds.
 */

const DB_NAME = "tkd-judge";
const DB_VERSION = 1;
const STORE = "presses";

export type QueuedPress = {
  /** The name this press goes by, everywhere, for as long as it exists. */
  clientId: string;
  code: string;
  judgeSlot: number;
  side: Side;
  value: number;
  kind: "point" | "deduction" | "flag";
  /** The bout it was made under. Null means the ring wasn't on a draw bout. */
  matchId: string | null;
  /** When it was pressed, so the queue is sent in the order it happened. */
  at: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "clientId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/**
 * Whether this device can queue at all.
 *
 * A browser in private mode may refuse IndexedDB outright. Rather than break
 * the pad, the caller falls back to sending straight out and telling the judge
 * plainly when one doesn't land — which is what the pad did before any of this
 * existed.
 */
export function queueAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

/** A name for a press. Unique per device and per press, and never reused. */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(press: QueuedPress): Promise<void> {
  await run("readwrite", (store) => store.put(press) as IDBRequest<any>);
}

export async function drop(clientId: string): Promise<void> {
  await run("readwrite", (store) => store.delete(clientId) as IDBRequest<any>);
}

/**
 * Everything still waiting, oldest first.
 *
 * Order matters: a judge who pressed +2 and then took it back with −2 must have
 * those arrive that way round, or the running mark on the ring passes through a
 * number that never happened.
 */
export async function pending(): Promise<QueuedPress[]> {
  const all = await run<QueuedPress[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedPress[]>);
  return all.sort((a, b) => a.at - b.at);
}

/** Just this judge's, on this ring — the only ones their own pad should draw. */
export async function pendingFor(code: string, judgeSlot: number): Promise<QueuedPress[]> {
  const all = await pending();
  return all.filter((p) => p.code === code && p.judgeSlot === judgeSlot);
}

export type SendOutcome =
  /** The server has it. */
  | { kind: "landed" }
  /**
   * The server refused it for good: the bout is over, or the ring has moved on.
   * Retrying will never help, so it leaves the queue rather than sitting there
   * being attempted for the rest of the day.
   */
  | { kind: "stale" }
  /** Couldn't reach the server. Keep it and try again later. */
  | { kind: "offline" };

/**
 * Send what is waiting, oldest first.
 *
 * Stops at the first press that couldn't be delivered rather than working
 * through the rest — they are in the order the judge made them, and sending
 * later ones past a stuck earlier one would put the ring's running mark through
 * numbers that never happened.
 *
 * Returns how many are still waiting afterwards.
 */
export async function flush(send: (press: QueuedPress) => Promise<SendOutcome>): Promise<number> {
  const waiting = await pending();
  for (const press of waiting) {
    const outcome = await send(press);
    if (outcome.kind === "offline") break;
    await drop(press.clientId);
  }
  return (await pending()).length;
}
