import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";

import { fetchRing, pressId, sendUndo, readTheme, contrastText, Offline, type Press, type Ring } from "./src/api";
import { emptyQueue, flush, undoLocally, withPending, type QueueState } from "./src/queue";
import {
  formatClock,
  judgeHistory,
  judgeScore,
  judgeVerdict,
  penaltyTally,
  secondsLeft,
  PATTERN_BUTTONS,
  SPARRING_BUTTONS,
  type Side,
} from "./src/scoring";

/**
 * TKD Judge.
 *
 * One judge, one ring, one screen. Everything else about the scoreboard —
 * setting the bout up, the clock, warnings, confirming the result — stays with
 * the operator on the web, where there is a keyboard and a monitor.
 *
 * The screen is built for arm's length in a noisy hall: two colours, targets
 * big enough for a thumb, and no navigation to get lost in.
 */

const SERVER_KEY = "tkd.judge.server";
const QUEUE_KEY = "tkd.judge.queue";

export default function App() {
  // A judge shouldn't have to wake the phone between exchanges.
  useKeepAwake();

  const [server, setServer] = useState("");
  const [serverDraft, setServerDraft] = useState("");
  const [code, setCode] = useState("");
  const [judgeSlot, setJudgeSlot] = useState<number | null>(null);
  const [ring, setRing] = useState<Ring | null>(null);
  const [queue, setQueue] = useState<QueueState>(emptyQueue());
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const ringRef = useRef(ring);
  ringRef.current = ring;

  // The address and anything unsent survive the app being closed — a judge
  // whose phone died mid-bout comes back with their presses intact.
  useEffect(() => {
    (async () => {
      try {
        const [savedServer, savedQueue] = await Promise.all([
          AsyncStorage.getItem(SERVER_KEY),
          AsyncStorage.getItem(QUEUE_KEY),
        ]);
        if (savedServer) {
          setServer(savedServer);
          setServerDraft(savedServer);
        }
        if (savedQueue) setQueue(JSON.parse(savedQueue) as QueueState);
      } catch {
        // A device that can't read its own storage still works; it just starts
        // from nothing rather than refusing to open.
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch(() => {});
  }, [queue, ready]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  /** Send what's waiting, then refresh the ring. */
  const sync = useCallback(async () => {
    if (!server || !code) return;
    const result = await flush(server, queueRef.current);
    setQueue(result.state);
    setOffline(result.offline);
    if (result.dropped > 0) {
      setError("The ring moved on to another bout — presses that hadn't been sent were dropped.");
    }
    if (result.ring) {
      setRing(result.ring);
      return;
    }
    if (result.offline) return;
    try {
      setRing(await fetchRing(server, code));
      setOffline(false);
    } catch (e) {
      if (e instanceof Offline) setOffline(true);
    }
  }, [server, code]);

  // Two seconds while something is waiting to go out, four when everything is
  // sent — often enough to feel live, rarely enough not to drain a phone.
  useEffect(() => {
    if (!ring || judgeSlot == null) return;
    const wait = queue.pending.length > 0 ? 2000 : 4000;
    const timer = setInterval(() => { void sync(); }, wait);
    return () => clearInterval(timer);
  }, [ring, judgeSlot, queue.pending.length, sync]);

  async function join() {
    const trimmed = code.trim().toUpperCase();
    setBusy(true);
    setError("");
    try {
      const found = await fetchRing(serverDraft, trimmed);
      await AsyncStorage.setItem(SERVER_KEY, serverDraft.trim());
      setServer(serverDraft.trim());
      setCode(trimmed);
      setRing(found);
      setOffline(false);
    } catch (e) {
      setError(
        e instanceof Offline
          ? "Couldn't reach the scoreboard. Check the address and the wifi."
          : e instanceof Error
            ? e.message
            : "That didn't work.",
      );
    }
    setBusy(false);
  }

  /**
   * A press is recorded on the device first and sent afterwards.
   *
   * This is the whole point of the app over the web page: the button always
   * responds, and the connection catches up in its own time.
   */
  function press(side: Side, value: number, kind: "point" | "deduction" | "flag") {
    if (!ring || judgeSlot == null) return;
    const item: Press = {
      clientId: pressId(),
      code,
      judgeSlot,
      side,
      value,
      kind,
      matchId: ring.matchId,
      at: Date.now(),
    };
    setError("");
    setQueue((q) => ({ ...q, pending: [...q.pending, item] }));
    void sync();
  }

  async function undo() {
    if (!ring || judgeSlot == null) return;
    const local = undoLocally(queueRef.current, judgeSlot);
    if (local.removed) {
      // Never sent, so there is nothing to take back on the server.
      setQueue(local.state);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setRing(await sendUndo(server, code, judgeSlot));
      setOffline(false);
    } catch (e) {
      if (e instanceof Offline) {
        setOffline(true);
        setError("Can't take that back until the connection is working — it has already been sent.");
      } else {
        setError(e instanceof Error ? e.message : "That couldn't be undone.");
      }
    }
    setBusy(false);
  }

  function leave() {
    setRing(null);
    setJudgeSlot(null);
    setError("");
  }

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // ---- step one: where the scoreboard is, and the code ---------------------
  if (!ring) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.joinBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>TKD Judge</Text>
          <Text style={styles.muted}>Ask the ring official for the scoreboard address and the join code.</Text>

          <Text style={styles.label}>Scoreboard address</Text>
          <TextInput
            style={styles.input}
            value={serverDraft}
            onChangeText={setServerDraft}
            placeholder="tkd-manager.vercel.app"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Join code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABCDE"
            placeholderTextColor="#666"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={5}
          />

          {queue.pending.length > 0 && (
            <Text style={styles.warn}>
              {queue.pending.length} press{queue.pending.length === 1 ? "" : "es"} from earlier still waiting to be sent.
            </Text>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primary, (busy || code.trim().length < 5 || !serverDraft.trim()) && styles.disabled]}
            disabled={busy || code.trim().length < 5 || !serverDraft.trim()}
            onPress={() => { void join(); }}
          >
            <Text style={styles.primaryText}>{busy ? "Checking…" : "Continue"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---- step two: which seat at the table -----------------------------------
  if (judgeSlot == null) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.joinBody}>
          <Text style={styles.title}>{ring.name}</Text>
          <Text style={styles.muted}>Which judge are you?</Text>
          <View style={styles.seatGrid}>
            {Array.from({ length: ring.judgeCount }, (_, i) => i + 1).map((n) => (
              <Pressable key={n} style={styles.seat} onPress={() => setJudgeSlot(n)}>
                <Text style={styles.seatText}>Judge {n}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.link} onPress={leave}>
            <Text style={styles.linkText}>Use a different code</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---- the pad -------------------------------------------------------------
  const entries = withPending(ring, queue.pending, judgeSlot);
  const left = secondsLeft(
    { state: ring.state, startedAt: ring.clockStartedAt, remaining: ring.clockRemaining },
    now,
  );
  const finished = ring.state === "finished";
  const myVerdict = judgeVerdict(entries, judgeSlot, ring.mode, ring.patternBase);
  const mine = judgeHistory(entries, judgeSlot);
  const buttons = ring.mode === "sparring" ? SPARRING_BUTTONS : PATTERN_BUTTONS;

  // The event's own colours, so a judge glancing up at the display sees the
  // same red as the button under their thumb.
  const theme = readTheme(ring.theme);
  const sides: { side: Side; label: string; name: string | null; number: string | null; colour: string }[] = [
    { side: "red", label: "RED", name: ring.redName, number: ring.redNumber, colour: theme.redColor },
    { side: "blue", label: "BLUE", name: ring.blueName, number: ring.blueNumber, colour: theme.blueColor },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      <View style={styles.bar}>
        <Text style={styles.barText}>{ring.name} · Judge {judgeSlot}</Text>
        <Text style={styles.barClock}>{formatClock(left)}</Text>
      </View>
      <View style={styles.bar2}>
        <Text style={styles.barSub} numberOfLines={1}>
          {[ring.categoryName, ring.mode === "pattern" ? ring.patternName : null, `R${ring.currentRound}/${ring.rounds}`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={[styles.status, offline ? styles.statusOffline : styles.statusOnline]}>
          {offline
            ? `Offline · ${queue.pending.length} waiting`
            : queue.pending.length > 0
              ? `Sending ${queue.pending.length}…`
              : "Connected"}
        </Text>
      </View>

      {finished && <Text style={styles.notice}>This bout is finished. Wait for the next one.</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.pad}>
        {sides.map((s) => (
          <View key={s.side} style={styles.column}>
            <View style={[styles.head, { backgroundColor: s.colour }]}>
              <Text style={[styles.headLabel, { color: contrastText(s.colour), opacity: 0.75 }]}>{s.label}</Text>
              <Text style={[styles.headName, { color: contrastText(s.colour) }]} numberOfLines={1}>
                {s.number ? `#${s.number} ` : ""}
                {s.name ?? "—"}
              </Text>
              <Text style={[styles.headScore, { color: contrastText(s.colour) }]}>
                {ring.mode === "flag"
                  ? myVerdict === s.side
                    ? "✓"
                    : "—"
                  : judgeScore(entries, judgeSlot, s.side, ring.mode, ring.patternBase)}
              </Text>
              {penaltyTally(entries, s.side).points > 0 && (
                <Text style={[styles.headNote, { color: contrastText(s.colour), opacity: 0.75 }]}>
                  includes −{penaltyTally(entries, s.side).points} from the referee
                </Text>
              )}
            </View>

            {ring.mode === "flag" ? (
              <Pressable
                style={[styles.flag, { backgroundColor: s.colour }, finished && styles.disabled]}
                disabled={finished}
                onPress={() => press(s.side, 1, "flag")}
              >
                <Text style={[styles.flagText, { color: contrastText(s.colour) }]}>{s.label} WINS</Text>
              </Pressable>
            ) : (
              <View style={styles.buttons}>
                {buttons.map((v) => (
                  <Pressable
                    key={v}
                    style={[
                      styles.button,
                      { backgroundColor: v < 0 ? "#3f3f46" : s.colour },
                      finished && styles.disabled,
                    ]}
                    disabled={finished}
                    onPress={() => press(s.side, v, ring.mode === "sparring" ? "point" : "deduction")}
                  >
                    <Text style={[styles.buttonText, { color: contrastText(v < 0 ? "#3f3f46" : s.colour) }]}>
                      {v > 0 ? `+${v}` : v}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.secondary, (busy || mine.length === 0) && styles.disabled]}
          disabled={busy || mine.length === 0}
          onPress={() => { void undo(); }}
        >
          <Text style={styles.secondaryText}>Undo my last</Text>
        </Pressable>
        <Text style={styles.footerNote} numberOfLines={1}>
          {mine.length === 0
            ? "Nothing recorded yet."
            : `Last: ${mine[0].side.toUpperCase()} ${
                mine[0].kind === "flag" ? "flag" : mine[0].value > 0 ? `+${mine[0].value}` : mine[0].value
              }`}
        </Text>
        <Pressable style={styles.link} onPress={leave}>
          <Text style={styles.linkText}>Leave</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0b12" },
  centre: { alignItems: "center", justifyContent: "center" },

  joinBody: { padding: 24, gap: 8, paddingTop: 72 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  muted: { color: "#9ca3af", fontSize: 14, marginBottom: 12 },
  label: { color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 12 },
  input: {
    backgroundColor: "#17171f",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
  },
  codeInput: { fontSize: 30, letterSpacing: 10, textAlign: "center", fontWeight: "800" },

  primary: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 16, marginTop: 24 },
  primaryText: { color: "#fff", textAlign: "center", fontSize: 17, fontWeight: "700" },
  secondary: { backgroundColor: "#27272f", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  secondaryText: { color: "#e5e7eb", fontWeight: "700" },
  disabled: { opacity: 0.35 },
  link: { paddingVertical: 12 },
  linkText: { color: "#9ca3af", textDecorationLine: "underline" },

  seatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  seat: { backgroundColor: "#17171f", borderRadius: 12, paddingVertical: 28, flexGrow: 1, minWidth: "45%" },
  seatText: { color: "#fff", textAlign: "center", fontSize: 20, fontWeight: "700" },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 48,
    paddingBottom: 6,
  },
  barText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  barClock: { color: "#fff", fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] },
  bar2: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  barSub: { color: "#9ca3af", fontSize: 12, flexShrink: 1 },
  status: { fontSize: 12, fontWeight: "700" },
  statusOnline: { color: "#4ade80" },
  statusOffline: { color: "#fbbf24" },

  notice: { color: "#fbbf24", paddingHorizontal: 14, paddingBottom: 6, fontSize: 13 },
  error: { color: "#f87171", paddingHorizontal: 14, paddingVertical: 6, fontSize: 13 },
  warn: { color: "#fbbf24", fontSize: 13, marginTop: 12 },

  pad: { flex: 1, flexDirection: "row", gap: 10, paddingHorizontal: 10 },
  column: { flex: 1, gap: 10 },
  head: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  headLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  headName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  headScore: { color: "#fff", fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"] },
  headNote: { color: "rgba(255,255,255,0.75)", fontSize: 10 },

  buttons: { flex: 1, gap: 8 },
  button: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 54 },
  buttonText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  flag: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  flagText: { color: "#fff", fontSize: 22, fontWeight: "800" },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerNote: { color: "#9ca3af", fontSize: 12, flexShrink: 1 },
});
