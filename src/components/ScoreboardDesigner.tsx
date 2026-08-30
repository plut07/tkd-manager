"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  DISPLAY_SLOTS,
  PAD_SLOTS,
  INFO_FIELDS,
  INFO_PLACES,
  MODE_LABELS,
  contrastText,
  resolveTheme,
  type ScoreboardTheme,
  type ThemeLook,
  type LookOverride,
  type ScoreMode,
  type DisplayLayout,
  type PadLayout,
  type InfoField,
  type InfoSpot,
} from "@/lib/scoreboardTheme";
import DisplayBoard, { type BoardData, type BoardLook } from "@/components/DisplayBoard";
import { saveTheme, resetTheme } from "@/app/(app)/events/themeActions";

/**
 * Designing the two scoreboard screens.
 *
 * Two ideas hold this page up.
 *
 * One: there is a single design for the event, and each mode may disagree with
 * it in places. Nothing is copied. Change the background on "All modes" and it
 * reaches sparring, pattern and flag — except wherever a mode has deliberately
 * said otherwise. That is why an override is stored only for the fields that
 * were actually changed, and why every control here can be put back to
 * "follows all modes".
 *
 * Two: the preview is the real screen. DisplayBoard draws both, so a position
 * that looks right here cannot look different in the hall.
 */

type Scope = "base" | ScoreMode;

type Modes = ScoreboardTheme["modes"];

/**
 * One mode's changes, replaced.
 *
 * Written out rather than spread with a computed key so the shape stays a
 * plain object of known modes — a stray key here would be saved and then
 * silently ignored by the parser.
 */
function withMode(modes: Modes, mode: ScoreMode, own: Record<string, unknown>): Modes {
  const next: Record<string, unknown> = { ...modes };
  next[mode] = own;
  return next as Modes;
}

const SCOPES: { value: Scope; label: string; note: string }[] = [
  { value: "base", label: "All modes", note: "The design everything starts from." },
  { value: "sparring", label: "Sparring", note: "Only when a sparring bout is on." },
  { value: "pattern", label: "Pattern", note: "Only when a pattern is being marked." },
  { value: "flag", label: "Flag", note: "Only for flag decisions." },
];

export default function ScoreboardDesigner({
  eventId,
  initial,
}: {
  eventId: string;
  initial: ScoreboardTheme;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<ScoreboardTheme>(initial);
  const [saved, setSaved] = useState<ScoreboardTheme>(initial);
  const [scope, setScope] = useState<Scope>("base");
  const [screen, setScreen] = useState<"display" | "pad">("display");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const changed = JSON.stringify(theme) !== JSON.stringify(saved);
  const mode: ScoreMode = scope === "base" ? "sparring" : scope;

  /** What this scope actually draws with: the base, plus its own changes. */
  const look = scope === "base"
    ? { ...theme }
    : resolveTheme(theme, scope);

  /** The changes this mode makes, or an empty object at base. */
  const override: LookOverride = scope === "base" ? {} : (theme.modes[scope] ?? {});

  // ------------------------------------------------------------ changing it

  function setLook(key: keyof ThemeLook, value: unknown) {
    setError("");
    setNote("");
    setTheme((t) => {
      if (scope === "base") {
        const next = { ...t } as Record<string, unknown>;
        next[key] = value;
        return next as ScoreboardTheme;
      }
      const own = { ...(t.modes[scope] ?? {}) } as Record<string, unknown>;
      own[key] = value;
      return { ...t, modes: withMode(t.modes, scope, own) };
    });
  }

  function setSlot(screenKey: "display" | "pad", slot: string, value: string) {
    setError("");
    setNote("");
    setTheme((t) => {
      if (scope === "base") {
        const layout = { ...(screenKey === "display" ? t.display : t.pad) } as Record<string, unknown>;
        layout[slot] = value;
        return screenKey === "display"
          ? { ...t, display: layout as unknown as DisplayLayout }
          : { ...t, pad: layout as unknown as PadLayout };
      }
      const own = { ...(t.modes[scope] ?? {}) } as Record<string, unknown>;
      // A mode's layout override holds only the slots it disagrees about, so a
      // later change to the base still reaches the slots it left alone.
      const layout = { ...((own[screenKey] as Record<string, unknown>) ?? {}) };
      layout[slot] = value;
      own[screenKey] = layout;
      return { ...t, modes: withMode(t.modes, scope, own) };
    });
  }

  /** Put one field back to following the base. */
  function clearField(key: string) {
    if (scope === "base") return;
    setError("");
    setNote("");
    setTheme((t) => {
      const own = { ...(t.modes[scope] ?? {}) } as Record<string, unknown>;
      delete own[key];
      return { ...t, modes: withMode(t.modes, scope, own) };
    });
  }

  function clearSlot(screenKey: "display" | "pad", slot: string) {
    if (scope === "base") return;
    setError("");
    setNote("");
    setTheme((t) => {
      const own = { ...(t.modes[scope] ?? {}) } as Record<string, unknown>;
      const layout = { ...((own[screenKey] as Record<string, unknown>) ?? {}) };
      delete layout[slot];
      if (Object.keys(layout).length === 0) delete own[screenKey];
      else own[screenKey] = layout;
      return { ...t, modes: withMode(t.modes, scope, own) };
    });
  }

  /** Move or resize one of the naming fields. */
  function setInfo(field: InfoField, part: keyof InfoSpot, value: string | number) {
    setError("");
    setNote("");
    setTheme((t) => {
      if (scope === "base") {
        const info = { ...t.info } as Record<string, InfoSpot>;
        info[field] = { ...info[field], [part]: value } as InfoSpot;
        return { ...t, info: info as ScoreboardTheme["info"] };
      }
      const own = { ...(t.modes[scope] ?? {}) } as Record<string, unknown>;
      // Only the part that was changed: a mode that moves the category still
      // follows the base for how big it is.
      const info = { ...((own.info as Record<string, unknown>) ?? {}) };
      info[field] = { ...((info[field] as Record<string, unknown>) ?? {}), [part]: value };
      own.info = info;
      return { ...t, modes: withMode(t.modes, scope, own) };
    });
  }

  function clearInfo(field: InfoField, part: keyof InfoSpot) {
    if (scope === "base") return;
    setError("");
    setNote("");
    setTheme((t) => {
      const own = { ...(t.modes[scope] ?? {}) } as Record<string, unknown>;
      const info = { ...((own.info as Record<string, unknown>) ?? {}) };
      const spot = { ...((info[field] as Record<string, unknown>) ?? {}) };
      delete spot[part];
      if (Object.keys(spot).length === 0) delete info[field];
      else info[field] = spot;
      if (Object.keys(info).length === 0) delete own.info;
      else own.info = info;
      return { ...t, modes: withMode(t.modes, scope, own) };
    });
  }

  const ownsInfo = (field: InfoField, part: keyof InfoSpot) => {
    if (scope === "base") return false;
    const info = (override as unknown as Record<string, unknown>).info as Record<string, unknown> | undefined;
    const spot = info?.[field] as Record<string, unknown> | undefined;
    return !!spot && Object.prototype.hasOwnProperty.call(spot, part);
  };

  function clearMode() {
    if (scope === "base") return;
    if (!window.confirm(`Make ${MODE_LABELS[scope]} follow the design for all modes again?`)) return;
    setTheme((t) => ({ ...t, modes: withMode(t.modes, scope, {}) }));
  }

  // Whether this scope has said something of its own about a field.
  const owns = (key: string) => scope !== "base" && Object.prototype.hasOwnProperty.call(override, key);
  const ownsSlot = (screenKey: "display" | "pad", slot: string) => {
    if (scope === "base") return false;
    const layout = (override as unknown as Record<string, unknown>)[screenKey] as Record<string, unknown> | undefined;
    return !!layout && Object.prototype.hasOwnProperty.call(layout, slot);
  };

  /** How many things this mode changes — for the count on its tab. */
  function changeCount(m: ScoreMode): number {
    const own = theme.modes[m] ?? {};
    let n = 0;
    for (const key of Object.keys(own)) {
      if (key === "display" || key === "pad") {
        n += Object.keys((own as unknown as Record<string, Record<string, unknown>>)[key] ?? {}).length;
      } else if (key === "info") {
        const info = (own as unknown as Record<string, Record<string, unknown>>).info ?? {};
        for (const field of Object.keys(info)) n += Object.keys((info[field] as object) ?? {}).length;
      } else {
        n += 1;
      }
    }
    return n;
  }

  // ------------------------------------------------------------------ saving

  async function save() {
    setBusy(true);
    setError("");
    setNote("");
    const result = await saveTheme({ eventId, theme });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setTheme(result.theme);
    setSaved(result.theme);
    setNote("Saved. Every screen picks it up within a few seconds.");
    router.refresh();
  }

  async function reset() {
    if (!window.confirm("Put this event back to the standard look? Every mode's changes go too.")) return;
    setBusy(true);
    setError("");
    const result = await resetTheme({ eventId });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setTheme(DEFAULT_THEME);
    setSaved(DEFAULT_THEME);
    setNote("Back to the standard look.");
    router.refresh();
  }

  // ----------------------------------------------------------------- drawing

  const slots = screen === "display" ? DISPLAY_SLOTS : PAD_SLOTS;
  const currentLayout = (screen === "display" ? look.display : look.pad) as unknown as Record<string, string>;

  return (
    <div className="space-y-4">
      {/* Which design am I editing */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-gray-900">What am I designing?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCOPES.map((s) => {
            const active = scope === s.value;
            const count = s.value === "base" ? 0 : changeCount(s.value);
            return (
              <button
                key={s.value}
                type="button"
                title={s.note}
                onClick={() => setScope(s.value)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s.label}
                {count > 0 && (
                  <span className="ml-2 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {scope === "base"
            ? "Changes here reach all three modes, except where a mode has been set differently."
            : `Only ${MODE_LABELS[scope]} bouts. Anything left alone follows the design for all modes, so changing that later still reaches this one.`}
        </p>
        {scope !== "base" && changeCount(scope) > 0 && (
          <button type="button" className="mt-2 text-xs font-medium text-red-600 hover:underline" onClick={clearMode}>
            Make {MODE_LABELS[scope]} follow all modes again
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* -------------------------------------------------- the controls */}
        <div className="card p-5">
          <div className="flex gap-1 rounded-md bg-gray-100 p-1">
            <ScreenTab label="Display screen" on={screen === "display"} onClick={() => setScreen("display")} />
            <ScreenTab label="Judge's pad" on={screen === "pad"} onClick={() => setScreen("pad")} />
          </div>

          <h3 className="mt-5 text-sm font-semibold text-gray-900">Where things sit</h3>
          <p className="mt-1 text-xs text-gray-500">
            {screen === "display"
              ? "The screen the hall watches."
              : "What a judge holds. The buttons themselves never move — only what is around them."}
          </p>
          <div className="mt-3 space-y-3">
            {slots.map((slot) => (
              <Slot
                key={String(slot.key)}
                label={slot.label}
                note={slot.note}
                options={slot.options}
                value={currentLayout[String(slot.key)] ?? ""}
                overridden={ownsSlot(screen, String(slot.key))}
                onChange={(v) => setSlot(screen, String(slot.key), v)}
                onClear={() => clearSlot(screen, String(slot.key))}
              />
            ))}
          </div>

          {screen === "display" && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-gray-900">Ring, category and the rest</h3>
              <p className="mt-1 text-xs text-gray-500">
                Each one is placed and sized on its own. Two in the same corner sit side by side. A field with nothing
                to say — a pattern during a sparring bout — takes up no room.
              </p>
              <div className="mt-3 space-y-3">
                {INFO_FIELDS.map((field) => {
                  const spot = look.info[field.key];
                  return (
                    <div key={field.key} className="rounded-md border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-700">{field.label}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{field.note}</p>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FieldFrame
                          label="Where"
                          overridden={ownsInfo(field.key, "place")}
                          onClear={() => clearInfo(field.key, "place")}
                        >
                          <select
                            className="input"
                            value={spot.place}
                            onChange={(e) => setInfo(field.key, "place", e.target.value)}
                            aria-label={`${field.label} position`}
                          >
                            {INFO_PLACES.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </FieldFrame>
                        <FieldFrame
                          label={`Size — ${Math.round(spot.scale * 100)}%`}
                          overridden={ownsInfo(field.key, "scale")}
                          onClear={() => clearInfo(field.key, "scale")}
                        >
                          <input
                            type="range"
                            min={0.5}
                            max={3}
                            step={0.05}
                            value={spot.scale}
                            className="w-full"
                            disabled={spot.place === "hidden"}
                            onChange={(e) => setInfo(field.key, "scale", Number(e.target.value))}
                            aria-label={`${field.label} size`}
                          />
                        </FieldFrame>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <h3 className="mt-6 text-sm font-semibold text-gray-900">Colours</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Colour label="Red corner" value={look.redColor} overridden={owns("redColor")} onChange={(v) => setLook("redColor", v)} onClear={() => clearField("redColor")} />
            <Colour label="Blue corner" value={look.blueColor} overridden={owns("blueColor")} onChange={(v) => setLook("blueColor", v)} onClear={() => clearField("blueColor")} />
            <Colour label="Background" value={look.background} overridden={owns("background")} onChange={(v) => setLook("background", v)} onClear={() => clearField("background")} />
            <Colour label="Text" value={look.textColor} overridden={owns("textColor")} onChange={(v) => setLook("textColor", v)} onClear={() => clearField("textColor")} />
            <Colour label="Winner highlight" value={look.accentColor} overridden={owns("accentColor")} onChange={(v) => setLook("accentColor", v)} onClear={() => clearField("accentColor")} />
          </div>

          <h3 className="mt-6 text-sm font-semibold text-gray-900">What is shown</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Toggle label="Each judge's mark" value={look.showJudgeMarks} overridden={owns("showJudgeMarks")} onChange={(v) => setLook("showJudgeMarks", v)} onClear={() => clearField("showJudgeMarks")} />
            <Toggle label="Warnings and deductions" value={look.showPenalties} overridden={owns("showPenalties")} onChange={(v) => setLook("showPenalties", v)} onClear={() => clearField("showPenalties")} />
            <Toggle label="Clock" value={look.showClock} overridden={owns("showClock")} onChange={(v) => setLook("showClock", v)} onClear={() => clearField("showClock")} />
            <Toggle label="Competitor numbers" value={look.showCompetitorNumbers} overridden={owns("showCompetitorNumbers")} onChange={(v) => setLook("showCompetitorNumbers", v)} onClear={() => clearField("showCompetitorNumbers")} />
            <Toggle label={'"3 judges of 5" under the score'} value={look.showVoteCount} overridden={owns("showVoteCount")} onChange={(v) => setLook("showVoteCount", v)} onClear={() => clearField("showVoteCount")} />
          </div>

          <h3 className="mt-6 text-sm font-semibold text-gray-900">Sizes</h3>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Slider label="Score" value={look.scoreScale} overridden={owns("scoreScale")} onChange={(v) => setLook("scoreScale", v)} onClear={() => clearField("scoreScale")} />
            <Slider label="Clock" value={look.clockScale} overridden={owns("clockScale")} onChange={(v) => setLook("clockScale", v)} onClear={() => clearField("clockScale")} />
          </div>

          <h3 className="mt-6 text-sm font-semibold text-gray-900">The judge&apos;s pad</h3>
          <div className="mt-2">
            <Toggle
              label="Dark background, to match the display"
              value={look.padDarkBackground}
              overridden={owns("padDarkBackground")}
              onChange={(v) => setLook("padDarkBackground", v)}
              onClear={() => clearField("padDarkBackground")}
            />
          </div>

          {scope === "base" && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-gray-900">Heading</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label text-xs">Logo address (optional)</label>
                  <input
                    className="input"
                    placeholder="https://… or /logo.png"
                    value={theme.logoUrl ?? ""}
                    onChange={(e) => setTheme((t) => ({ ...t, logoUrl: e.target.value || null }))}
                  />
                  <p className="mt-1 text-xs text-gray-400">Must be an https address, or a path on this site.</p>
                </div>
                <div>
                  <label className="label text-xs">Words across the top (optional)</label>
                  <input
                    className="input"
                    maxLength={80}
                    placeholder="National Championship 2026"
                    value={theme.headline}
                    onChange={(e) => setTheme((t) => ({ ...t, headline: e.target.value }))}
                  />
                </div>
              </div>

              <h3 className="mt-6 text-sm font-semibold text-gray-900">Start from</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    title={p.note}
                    onClick={() => setTheme((t) => ({ ...t, ...p.theme }))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                A ready-made look replaces the design for all modes. Anything a mode has set of its own stays.
              </p>
            </>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {note && !changed && <p className="mt-4 text-sm text-green-700">{note}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="btn-primary" disabled={busy || !changed} onClick={() => { void save(); }}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy || !changed} onClick={() => setTheme(saved)}>
              Cancel
            </button>
            <button type="button" className="text-sm font-medium text-red-600 hover:underline" disabled={busy} onClick={() => { void reset(); }}>
              Back to standard
            </button>
          </div>
        </div>

        {/* --------------------------------------------------- the preview */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {MODE_LABELS[mode]} · {screen === "display" ? "display screen" : "judge's pad"}
            </span>
          </div>

          <div className="mt-3">
            {screen === "display" ? (
              <div className="overflow-hidden rounded-lg" style={{ backgroundColor: look.background }}>
                <DisplayBoard data={sampleBoard(mode, look.showVoteCount)} look={look as BoardLook} scale={0.42} />
              </div>
            ) : (
              <PadPreview look={look} mode={mode} />
            )}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            {screen === "display"
              ? "Made-up names and scores, drawn by the same component as the real screen — if it sits here, it sits there."
              : "The pad as a judge sees it, at phone width."}
          </p>

          {scope === "base" && (
            <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              This shows sparring. Pick a mode above to see and change pattern or flag.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ preview

/** A believable bout, so the preview is judged on something realistic. */
function sampleBoard(mode: ScoreMode, showVotes: boolean): BoardData {
  const marks = (favoursFirst: boolean) =>
    [1, 2, 3, 4, 5].map((judge) => {
      const favours = favoursFirst ? judge <= 3 : judge > 3;
      return {
        judge,
        favours,
        value: mode === "flag" ? (favours ? "✓" : "—") : mode === "pattern" ? (favoursFirst ? "8.6" : "8.4") : String(favoursFirst ? 5 : 4),
      };
    });

  return {
    ringName: "Ring 1",
    categoryName: "Boys 14-16 -50kg",
    roundLabel: "Round 2 of 2",
    patternName: "Won-Hyo",
    modeLabel: MODE_LABELS[mode],
    mode,
    clock: "1:24",
    timeUp: false,
    statusIsResult: true,
    status: showVotes ? "WINNER — DYLAN (3–2)" : "WINNER — DYLAN",
    sides: [
      {
        side: "red",
        name: "DYLAN",
        number: "A-004",
        votes: 3,
        mark: mode === "pattern" ? "8.6" : 5,
        judgeMarks: marks(true),
        warnings: 1,
        deductions: 0,
        penaltyPoints: 0,
        winning: true,
      },
      {
        side: "blue",
        name: "JACK LIM",
        number: "A-011",
        votes: 2,
        mark: mode === "pattern" ? "8.4" : 4,
        judgeMarks: marks(false),
        warnings: 0,
        deductions: 1,
        penaltyPoints: 1,
        winning: false,
      },
    ],
  };
}

/** What a judge holds, laid out by the same rules as the real pad. */
function PadPreview({ look, mode }: { look: BoardLook & { pad: PadLayout; padDarkBackground: boolean }; mode: ScoreMode }) {
  const L = look.pad;
  const dark = look.padDarkBackground;
  const ink = dark ? look.textColor : "#111111";

  const header = (
    <div
      className="flex items-center justify-between rounded px-2 py-1 text-[10px]"
      style={{ backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#111827", color: dark ? ink : "#ffffff" }}
      key="header"
    >
      <span className="font-semibold">Ring 1 · Judge 2</span>
      <span className="truncate px-1 opacity-80">{mode === "pattern" ? "Won-Hyo · R1/1" : "R2/2"}</span>
      {L.clock === "inHeader" && <span className="font-mono">1:24</span>}
    </div>
  );

  const clock =
    L.clock === "aboveButtons" ? (
      <p className="text-center font-mono text-xl font-bold tabular-nums" key="clock">1:24</p>
    ) : null;

  const undo = (
    <div
      className="rounded py-1.5 text-center text-[10px] font-semibold"
      style={{ backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#e5e7eb", color: ink }}
      key="undo"
    >
      Undo my last
    </div>
  );

  const buttons = mode === "flag" ? [0] : mode === "sparring" ? [3, 2, 1, -1, -2, -3] : [-0.1, -0.2, -0.3, -0.4, -0.5, -1];

  return (
    <div
      className="mx-auto max-w-[16rem] space-y-2 overflow-hidden rounded-lg p-2"
      style={{ backgroundColor: dark ? look.background : "#ffffff", color: ink }}
    >
      {L.header === "top" && header}
      {clock}
      {L.undo === "top" && undo}

      <div className="grid grid-cols-2 gap-2">
        {(["red", "blue"] as const).map((side) => {
          const colour = side === "red" ? look.redColor : look.blueColor;
          const nameLine = (
            <p className="truncate text-[10px]" key="name">
              {look.showCompetitorNumbers ? (side === "red" ? "#A-004 " : "#A-011 ") : ""}
              {side === "red" ? "DYLAN" : "JACK LIM"}
            </p>
          );
          const markLine = (
            <p className="text-lg font-bold leading-none" key="mark">
              {mode === "flag" ? (side === "red" ? "✓" : "—") : side === "red" ? 5 : 4}
            </p>
          );
          return (
            <div key={side} className="space-y-1">
              <div className="rounded p-1 text-center" style={{ backgroundColor: colour, color: contrastText(colour) }}>
                <p className="text-[9px] font-bold tracking-widest">{side.toUpperCase()}</p>
                {L.name === "aboveScore" ? [nameLine, markLine] : [markLine, nameLine]}
              </div>
              {mode === "flag" ? (
                <div
                  className="rounded py-6 text-center text-[11px] font-bold"
                  style={{ backgroundColor: colour, color: contrastText(colour) }}
                >
                  {side.toUpperCase()} WINS
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {buttons.map((v) => (
                    <div
                      key={v}
                      className="rounded py-2 text-center text-[10px] font-bold"
                      style={{
                        backgroundColor: v < 0 ? "#3f3f46" : colour,
                        color: contrastText(v < 0 ? "#3f3f46" : colour),
                      }}
                    >
                      {v > 0 ? `+${v}` : v}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {L.undo === "bottom" && undo}
      {L.header === "bottom" && header}
    </div>
  );
}

// ------------------------------------------------------------------ controls

function ScreenTab({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-xs font-medium ${on ? "bg-white text-brand-700 shadow-sm" : "text-gray-600"}`}
    >
      {label}
    </button>
  );
}

/**
 * A field that may be following the base or set for this mode.
 *
 * The mark and the "follow all modes" link are the whole point: without them
 * there is no way to tell a mode that agrees with the base from a mode that
 * has been set to the same value, and the difference matters the next time the
 * base changes.
 */
function FieldFrame({
  label,
  overridden,
  onClear,
  children,
}: {
  label: string;
  overridden: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label text-xs">
          {label}
          {overridden && <span className="ml-1 text-brand-600" title="Set for this mode">•</span>}
        </label>
        {overridden && (
          <button type="button" className="text-[10px] text-gray-400 hover:text-red-600 hover:underline" onClick={onClear}>
            follow all modes
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Slot({
  label,
  note,
  options,
  value,
  overridden,
  onChange,
  onClear,
}: {
  label: string;
  note: string;
  options: { value: string; label: string }[];
  value: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <FieldFrame label={label} overridden={overridden} onClear={onClear}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-400">{note}</p>
    </FieldFrame>
  );
}

function Colour({
  label,
  value,
  overridden,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <FieldFrame label={label} overridden={overridden} onClear={onClear}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-10 cursor-pointer rounded border border-gray-200"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <input
          className="input !px-2 !py-1 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
        />
      </div>
    </FieldFrame>
  );
}

function Toggle({
  label,
  value,
  overridden,
  onChange,
  onClear,
}: {
  label: string;
  value: boolean;
  overridden: boolean;
  onChange: (v: boolean) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" className="h-4 w-4" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {label}
        {overridden && <span className="text-brand-600" title="Set for this mode">•</span>}
      </label>
      {overridden && (
        <button type="button" className="shrink-0 text-[10px] text-gray-400 hover:text-red-600 hover:underline" onClick={onClear}>
          follow all
        </button>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  overridden,
  onChange,
  onClear,
}: {
  label: string;
  value: number;
  overridden: boolean;
  onChange: (v: number) => void;
  onClear: () => void;
}) {
  return (
    <FieldFrame label={`${label} — ${Math.round(value * 100)}%`} overridden={overridden} onClear={onClear}>
      <input
        type="range"
        min={0.5}
        max={2}
        step={0.05}
        value={value}
        className="w-full"
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} size`}
      />
    </FieldFrame>
  );
}
