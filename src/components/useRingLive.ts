"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { secondsLeftExact, clockOffset, serverTime, type Clock } from "@/lib/scoreboard";
import { loadRing, type RingDto } from "@/app/(app)/events/scoreboardActions";
import { realtimeClient } from "@/lib/liveChannel";

/**
 * Keeping one screen's copy of a ring current.
 *
 * The operator's page, the hall display and a judge's pad all need the same
 * three things and used to each do them slightly differently, which is how the
 * display ended up a second behind the pad.
 *
 *   1. A press anywhere shows everywhere, as close to at once as it can.
 *   2. The clock counts down locally, so it is smooth without a message a
 *      second.
 *   3. The countdown is measured against the *server's* clock, not the
 *      device's.
 *
 * On (3): the moment a round started is written by the server. Measuring it
 * against a hall laptop's own clock measures the gap between the two machines
 * as well as the time that has passed — a laptop five seconds slow started a
 * 120-second round at 2:05 and counted down from there. Every reply carries
 * the server's time, so the difference is known and taken off.
 *
 * On (1): a press is broadcast to the other screens directly, which is
 * immediate. That needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * to be set on the deployment. Without them there is no broadcast and no
 * shared connection at all, and every screen falls back to asking the server
 * on a timer — which is why `liveNow` is reported: a hall that is quietly on
 * the slow path should be told rather than left wondering why the display
 * lags the pad.
 */

/** How often to ask the server, in milliseconds. */
const POLL_WITH_BROADCAST = 10_000;   // a safety net; broadcasts do the work
const POLL_RUNNING = 1_000;           // no broadcast, and a bout is on
const POLL_IDLE = 4_000;              // no broadcast, and nothing is happening

export type RingLive = {
  ring: RingDto;
  /** Seconds left, unrounded, already corrected for this device's clock. */
  left: number;
  /** True while presses are arriving the instant they are made. */
  live: boolean;
  /** Replace the local copy after an action that already returned a fresh one. */
  put: (ring: RingDto) => void;
  /**
   * Change the local copy without treating it as a fresh reply.
   *
   * For typing in a field that hasn't been saved yet. Going through `put`
   * would take the clock offset from a timestamp that is now minutes old and
   * push the countdown off by however long the operator has had the page open.
   */
  setLocal: (ring: RingDto) => void;
  /** Tell the other screens something changed. */
  announce: () => void;
  refresh: () => Promise<void>;
};

export function useRingLive(initial: RingDto, by: { ringId?: string; joinCode?: string }): RingLive {
  const [ring, setRing] = useState<RingDto>(initial);
  const [live, setLive] = useState(false);
  const channelRef = useRef<any>(null);

  // How far this device's clock is from the server's. A ref rather than state:
  // it changes on every reply and nothing should re-render because of it.
  const offset = useRef(clockOffset(initial.serverNow));

  const [left, setLeft] = useState(() =>
    secondsLeftExact(clockOf(initial), serverTime(offset.current)),
  );

  const key = by.ringId ?? by.joinCode ?? "";

  const put = useCallback((fresh: RingDto) => {
    offset.current = clockOffset(fresh.serverNow);
    setRing(fresh);
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await loadRing(by.ringId ? { ringId: by.ringId } : { joinCode: by.joinCode ?? "" });
    if (fresh) put(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, put]);

  useEffect(() => {
    const client = realtimeClient();
    let channel: any = null;
    if (client) {
      channel = client.channel(`ring:${initial.id}`, { config: { broadcast: { self: false } } });
      channel.on("broadcast", { event: "changed" }, () => { void refresh(); });
      channel.subscribe((status: string) => setLive(status === "SUBSCRIBED"));
      channelRef.current = channel;
    }
    return () => {
      channelRef.current = null;
      if (channel && client) client.removeChannel(channel);
    };
  }, [initial.id, refresh]);

  // The polling rate follows what is at stake. Without a broadcast connection
  // this is the only way a press reaches the display at all, so during a bout
  // it asks once a second; between bouts nobody is watching a number change
  // and the traffic isn't worth it.
  useEffect(() => {
    const every = live
      ? POLL_WITH_BROADCAST
      : ring.state === "running"
        ? POLL_RUNNING
        : POLL_IDLE;
    const poll = setInterval(() => { void refresh(); }, every);
    return () => clearInterval(poll);
  }, [live, ring.state, refresh]);

  // Ten times a second. The clock is drawn from arithmetic, not from anything
  // arriving over the network, so this costs nothing but makes the last
  // seconds of a round move the way a scoreboard should.
  //
  // Only the three clock fields belong in the dependencies. Listing `ring`
  // itself as well tore the interval down and built it again on every reply —
  // once a second during a bout, which is exactly when the countdown should be
  // left alone to run.
  const { state, clockStartedAt, clockRemaining } = ring;
  useEffect(() => {
    const tick = setInterval(() => {
      setLeft(secondsLeftExact({ state, startedAt: clockStartedAt, remaining: clockRemaining }, serverTime(offset.current)));
    }, 100);
    return () => clearInterval(tick);
  }, [state, clockStartedAt, clockRemaining]);

  const announce = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }, []);

  return { ring, left, live, put, setLocal: setRing, announce, refresh };
}

function clockOf(ring: RingDto): Clock {
  return { state: ring.state, startedAt: ring.clockStartedAt, remaining: ring.clockRemaining };
}
