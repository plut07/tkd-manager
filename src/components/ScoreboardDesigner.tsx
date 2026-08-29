"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  contrastText,
  type ScoreboardTheme,
} from "@/lib/scoreboardTheme";
import { saveTheme, resetTheme } from "@/app/(app)/events/themeActions";

/**
 * Designing the two scoreboard screens.
 *
 * Every change shows in the preview beside the controls, at the proportions of
 * the real thing. Choosing colours for a screen you can't see is guesswork,
 * and the display is the one screen in the building nobody can quietly fix
 * once the event has started.
 */
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<"display" | "pad">("display");

  const changed = JSON.stringify(theme) !== JSON.stringify(saved);
  const set = (patch: Partial<ScoreboardTheme>) => setTheme((t) => ({ ...t, ...patch }));

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
    if (!window.confirm("Put this event back to the standard look?")) return;
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900">Colours</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Colour label="Red corner" value={theme.redColor} onChange={(v) => set({ redColor: v })} />
          <Colour label="Blue corner" value={theme.blueColor} onChange={(v) => set({ blueColor: v })} />
          <Colour label="Background" value={theme.background} onChange={(v) => set({ background: v })} />
          <Colour label="Text" value={theme.textColor} onChange={(v) => set({ textColor: v })} />
          <Colour label="Winner highlight" value={theme.accentColor} onChange={(v) => set({ accentColor: v })} />
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-900">Heading</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label text-xs">Logo address (optional)</label>
            <input
              className="input"
              placeholder="https://… or /logo.png"
              value={theme.logoUrl ?? ""}
              onChange={(e) => set({ logoUrl: e.target.value || null })}
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
              onChange={(e) => set({ headline: e.target.value })}
            />
          </div>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-900">What the display shows</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle label="Each judge's mark" value={theme.showJudgeMarks} onChange={(v) => set({ showJudgeMarks: v })} />
          <Toggle label="Warnings and deductions" value={theme.showPenalties} onChange={(v) => set({ showPenalties: v })} />
          <Toggle label="Clock" value={theme.showClock} onChange={(v) => set({ showClock: v })} />
          <Toggle label="Category and round" value={theme.showCategory} onChange={(v) => set({ showCategory: v })} />
          <Toggle label="Competitor numbers" value={theme.showCompetitorNumbers} onChange={(v) => set({ showCompetitorNumbers: v })} />
          <Toggle label='"3 judges of 5" under the score' value={theme.showVoteCount} onChange={(v) => set({ showVoteCount: v })} />
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-900">Sizes</h3>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Slider label="Score" value={theme.scoreScale} onChange={(v) => set({ scoreScale: v })} />
          <Slider label="Clock" value={theme.clockScale} onChange={(v) => set({ clockScale: v })} />
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-900">The judge's pad</h3>
        <div className="mt-2">
          <Toggle
            label="Dark background, to match the display"
            value={theme.padDarkBackground}
            onChange={(v) => set({ padDarkBackground: v })}
          />
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-900">Start from</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="btn-secondary !px-3 !py-1.5 text-xs"
              title={p.note}
              onClick={() => setTheme({ ...DEFAULT_THEME, ...theme, ...p.theme })}
            >
              {p.name}
            </button>
          ))}
        </div>

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

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
          <div className="flex gap-1 rounded-md bg-gray-100 p-1">
            <button
              type="button"
              className={`rounded px-3 py-1 text-xs font-medium ${preview === "display" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600"}`}
              onClick={() => setPreview("display")}
            >
              Display screen
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-xs font-medium ${preview === "pad" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600"}`}
              onClick={() => setPreview("pad")}
            >
              Judge&apos;s pad
            </button>
          </div>
        </div>

        <div className="mt-3">
          {preview === "display" ? <DisplayPreview theme={theme} /> : <PadPreview theme={theme} />}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Made-up names and scores, at the proportions of the real screen. The display is the one thing in the building
          nobody can quietly fix once the event has started.
        </p>
      </div>
    </div>
  );
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
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
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" className="h-4 w-4" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label text-xs">{label} — {Math.round(value * 100)}%</label>
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
    </div>
  );
}

/** The hall's screen, shrunk. */
function DisplayPreview({ theme }: { theme: ScoreboardTheme }) {
  const sides: { side: "red" | "blue"; name: string; number: string; votes: number; colour: string; winning: boolean }[] = [
    { side: "red", name: "DYLAN", number: "A-004", votes: 3, colour: theme.redColor, winning: true },
    { side: "blue", name: "JACK LIM", number: "A-011", votes: 2, colour: theme.blueColor, winning: false },
  ];

  return (
    <div className="overflow-hidden rounded-lg" style={{ backgroundColor: theme.background, color: theme.textColor }}>
      {(theme.logoUrl || theme.headline) && (
        <div className="flex flex-col items-center gap-1 pt-3">
          {theme.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" className="h-8 object-contain" />
          )}
          {theme.headline && <p className="text-xs font-semibold opacity-80">{theme.headline}</p>}
        </div>
      )}

      {theme.showCategory && (
        <div className="flex items-center justify-between px-3 py-2 text-[10px] opacity-70">
          <span>Ring 1</span>
          <span>Boys 14-16 -50kg · Round 2 of 2</span>
          <span>Sparring</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 px-2">
        {sides.map((s) => (
          <div
            key={s.side}
            className="rounded-lg p-2 text-center"
            style={{
              backgroundColor: s.colour,
              color: contrastText(s.colour),
              outline: s.winning ? `3px solid ${theme.accentColor}` : "none",
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">{s.side}</p>
            <p className="truncate text-sm font-bold">
              {theme.showCompetitorNumbers && <span className="mr-1 rounded bg-black/25 px-1 text-[10px]">{s.number}</span>}
              {s.name}
            </p>
            <p className="font-black leading-none" style={{ fontSize: `${2.75 * theme.scoreScale}rem` }}>{s.votes}</p>
            {theme.showVoteCount && <p className="text-[9px] uppercase tracking-widest opacity-70">judges of 5</p>}

            {theme.showJudgeMarks && (
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {[1, 2, 3, 4, 5].map((j) => {
                  const favours = s.side === "red" ? j <= 3 : j > 3;
                  return (
                    <span
                      key={j}
                      className="rounded px-1 text-[9px] font-bold"
                      style={{
                        backgroundColor: favours ? theme.accentColor : "rgba(0,0,0,0.25)",
                        color: favours ? contrastText(theme.accentColor) : contrastText(s.colour),
                      }}
                    >
                      J{j} {s.side === "red" ? 5 : 4}
                    </span>
                  );
                })}
              </div>
            )}

            {theme.showPenalties && (
              <div className="mt-1 grid grid-cols-2 gap-1">
                <div className="rounded bg-black/25 py-0.5">
                  <p className="text-[8px] uppercase tracking-widest opacity-70">Warning</p>
                  <p className="text-sm font-bold leading-none">{s.side === "red" ? 1 : 0}</p>
                </div>
                <div className="rounded bg-black/25 py-0.5">
                  <p className="text-[8px] uppercase tracking-widest opacity-70">Deduction</p>
                  <p className="text-sm font-bold leading-none">0</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {theme.showClock && (
        <div className="py-3 text-center">
          <p className="font-mono font-bold leading-none tabular-nums" style={{ fontSize: `${2 * theme.clockScale}rem` }}>
            1:24
          </p>
          <p className="mt-1 text-[10px] opacity-70">Round 2 of 2</p>
        </div>
      )}
    </div>
  );
}

/** What a judge holds. */
function PadPreview({ theme }: { theme: ScoreboardTheme }) {
  const dark = theme.padDarkBackground;
  return (
    <div
      className="mx-auto max-w-[16rem] overflow-hidden rounded-lg p-2"
      style={{ backgroundColor: dark ? theme.background : "#ffffff", color: dark ? theme.textColor : "#111111" }}
    >
      <div className="flex items-center justify-between rounded px-2 py-1 text-[10px]" style={{ backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#f3f4f6" }}>
        <span className="font-semibold">Ring 1 · Judge 2</span>
        <span className="font-mono">1:24</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["red", "blue"] as const).map((side) => {
          const colour = side === "red" ? theme.redColor : theme.blueColor;
          return (
            <div key={side} className="space-y-1">
              <div className="rounded p-1 text-center" style={{ backgroundColor: colour, color: contrastText(colour) }}>
                <p className="text-[9px] font-bold tracking-widest">{side.toUpperCase()}</p>
                <p className="truncate text-[10px]">{side === "red" ? "DYLAN" : "JACK LIM"}</p>
                <p className="text-lg font-bold leading-none">{side === "red" ? 5 : 4}</p>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[3, 2, 1, -1, -2, -3].map((v) => (
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
            </div>
          );
        })}
      </div>

      <div className="mt-2 rounded py-1.5 text-center text-[10px] font-semibold" style={{ backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#e5e7eb" }}>
        Undo my last
      </div>
    </div>
  );
}
