"use client";

import {
  contrastText,
  INFO_FIELDS,
  type DisplayLayout,
  type InfoField,
  type InfoLayout,
  type InfoPlace,
  type ScoreMode,
} from "@/lib/scoreboardTheme";

/**
 * The board itself, drawn from data rather than from a live ring.
 *
 * Split out so the designer's preview and the real display screen are the same
 * component. A preview that is a separate lookalike drifts from the thing it
 * claims to show, and the drift is only discovered on the day.
 *
 * Every position comes from the layout; nothing here decides where things go.
 */

export type BoardSide = {
  side: "red" | "blue";
  name: string | null;
  number: string | null;
  votes: number;
  mark: number | string;
  judgeMarks: { judge: number; value: string; favours: boolean }[];
  warnings: number;
  deductions: number;
  penaltyPoints: number;
  winning: boolean;
};

export type BoardData = {
  ringName: string;
  categoryName: string;
  roundLabel: string;
  patternName: string;
  modeLabel: string;
  mode: ScoreMode;
  clock: string;
  timeUp: boolean;
  status: string;
  statusIsResult: boolean;
  sides: BoardSide[];
};

export type BoardLook = {
  redColor: string;
  blueColor: string;
  background: string;
  textColor: string;
  accentColor: string;
  logoUrl: string | null;
  headline: string;
  showJudgeMarks: boolean;
  showPenalties: boolean;
  showClock: boolean;
  showCompetitorNumbers: boolean;
  showVoteCount: boolean;
  scoreScale: number;
  clockScale: number;
  info: InfoLayout;
  display: DisplayLayout;
};

/** `scale` is 1 on the real screen and smaller in the designer's preview. */
export default function DisplayBoard({
  data,
  look,
  scale = 1,
}: {
  data: BoardData;
  look: BoardLook;
  scale?: number;
}) {
  const L = look.display;
  const rem = (value: number) => `${value * scale}rem`;

  const branding =
    look.logoUrl || look.headline ? (
      <div className="flex flex-col items-center gap-1 py-2" key="branding">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {look.logoUrl && <img src={look.logoUrl} alt="" style={{ height: rem(4) }} className="object-contain" />}
        {look.headline && (
          <p className="font-semibold opacity-90" style={{ fontSize: rem(1.5) }}>{look.headline}</p>
        )}
      </div>
    ) : null;

  // The naming fields, each in whichever of the six corners it was put in.
  // A field with nothing to say — a pattern in a sparring bout — takes up no
  // room, so a cell holding only that one disappears rather than leaving a gap.
  const text: Record<InfoField, string> = {
    ring: data.ringName,
    category: data.categoryName,
    round: data.roundLabel,
    pattern: data.mode === "pattern" ? data.patternName : "",
    mode: data.modeLabel,
  };

  const cell = (place: InfoPlace, align: "start" | "center" | "end") => {
    const here = INFO_FIELDS.filter((f) => look.info[f.key].place === place && text[f.key]);
    if (here.length === 0) return <span key={place} />;
    return (
      <div
        key={place}
        className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${
          align === "start" ? "justify-start" : align === "end" ? "justify-end" : "justify-center"
        }`}
      >
        {here.map((f, i) => (
          <span key={f.key} className="flex items-baseline gap-3">
            {i > 0 && <span className="opacity-40" style={{ fontSize: rem(1) }}>·</span>}
            <span className="font-semibold" style={{ fontSize: rem(1.25 * look.info[f.key].scale) }}>
              {text[f.key]}
            </span>
          </span>
        ))}
      </div>
    );
  };

  const bar = (which: "top" | "bottom") => {
    const places: InfoPlace[] =
      which === "top"
        ? ["topLeft", "topCenter", "topRight"]
        : ["bottomLeft", "bottomCenter", "bottomRight"];
    const anything = INFO_FIELDS.some((f) => places.includes(look.info[f.key].place) && text[f.key]);
    if (!anything) return null;
    return (
      <div
        className="grid items-center gap-2 px-4 py-2 opacity-80"
        style={{ gridTemplateColumns: "1fr auto 1fr" }}
        key={`${which}Bar`}
      >
        {cell(places[0], "start")}
        {cell(places[1], "center")}
        {cell(places[2], "end")}
      </div>
    );
  };

  const clock = look.showClock ? (
    <p
      className="text-center font-mono font-bold leading-none tabular-nums"
      style={{ fontSize: rem(5 * look.clockScale), color: data.timeUp ? look.accentColor : look.textColor }}
      key="clock"
    >
      {data.clock}
    </p>
  ) : null;

  const status = (
    <p
      className="text-center opacity-80"
      style={{ fontSize: rem(1.35), color: data.statusIsResult ? look.accentColor : undefined }}
      key="status"
    >
      <span className={data.statusIsResult ? "font-bold" : ""}>{data.status}</span>
    </p>
  );

  /** A row under both panels, used when a part is pushed out of the panels. */
  const strip = (key: string, render: (s: BoardSide) => React.ReactNode) => (
    <div className="grid grid-cols-2 gap-3 px-3" key={key}>
      {data.sides.map((s) => (
        <div key={s.side} className="text-center">{render(s)}</div>
      ))}
    </div>
  );

  const judgeStrip =
    look.showJudgeMarks && L.judgeMarks === "belowPanels"
      ? strip("judges", (s) => <JudgeMarks side={s} look={look} rem={rem} />)
      : null;

  const penaltyStrip =
    look.showPenalties && L.penalties === "belowPanels"
      ? strip("penalties", (s) => <Penalties side={s} look={look} rem={rem} />)
      : null;

  const panels = (
    <div
      className="gap-3 px-3"
      style={{
        display: "grid",
        gridTemplateColumns: L.clock === "betweenPanels" ? "1fr auto 1fr" : "1fr 1fr",
        alignItems: "center",
      }}
      key="panels"
    >
      <Panel side={data.sides[0]} data={data} look={look} rem={rem} />
      {L.clock === "betweenPanels" && (
        <div className="px-2 text-center">
          {clock}
          {L.status === "underClock" && status}
        </div>
      )}
      <Panel side={data.sides[1]} data={data} look={look} rem={rem} />
    </div>
  );

  // The page, assembled in the order the layout asks for.
  const blocks: React.ReactNode[] = [];
  if (L.branding === "top") blocks.push(branding);
  blocks.push(bar("top"));
  if (L.status === "topOfScreen") blocks.push(status);
  if (L.clock === "abovePanels") blocks.push(clock);
  blocks.push(panels);
  if (judgeStrip) blocks.push(judgeStrip);
  if (penaltyStrip) blocks.push(penaltyStrip);
  if (L.clock === "belowPanels") {
    blocks.push(clock);
    if (L.status === "underClock") blocks.push(status);
  } else if (L.clock === "abovePanels" && L.status === "underClock") {
    blocks.push(status);
  }
  blocks.push(bar("bottom"));
  if (L.branding === "bottom") blocks.push(branding);

  return (
    <div
      className="flex min-h-full flex-col justify-center gap-2 py-2"
      style={{ backgroundColor: look.background, color: look.textColor }}
    >
      {/* A real blink, not a fade — it has to read from the back of a hall. */}
      <style>{"@keyframes tkdblink{0%,45%{opacity:1}55%,100%{opacity:.15}} .tkd-blink{animation:tkdblink 1s steps(1,end) infinite}"}</style>
      {blocks.filter(Boolean)}
    </div>
  );
}

function Panel({
  side,
  data,
  look,
  rem,
}: {
  side: BoardSide;
  data: BoardData;
  look: BoardLook;
  rem: (v: number) => string;
}) {
  const L = look.display;
  const colour = side.side === "red" ? look.redColor : look.blueColor;
  const ink = contrastText(colour);

  const number =
    look.showCompetitorNumbers && side.number ? (
      <span className="rounded bg-black/25 px-2 tabular-nums">{side.number}</span>
    ) : null;

  const name = (
    <p className="truncate font-bold" style={{ fontSize: rem(2.25) }} key="name">
      {L.number === "withName" && number ? <span className="mr-2">{number}</span> : null}
      {side.name ?? "—"}
    </p>
  );

  const score = (
    <div key="score">
      <p className="font-black leading-none tabular-nums" style={{ fontSize: rem(7 * look.scoreScale) }}>
        {side.votes}
      </p>
      {look.showVoteCount && (
        <p className="uppercase tracking-widest opacity-70" style={{ fontSize: rem(0.95), marginTop: rem(-0.4) }}>
          {side.votes === 1 ? "judge" : "judges"} of {side.judgeMarks.length}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="relative rounded-2xl px-3 py-3 text-center"
      style={{
        backgroundColor: colour,
        color: ink,
        outline: side.winning ? `${rem(0.5)} solid ${look.accentColor}` : "none",
        outlineOffset: side.winning ? `-${rem(0.12)}` : undefined,
      }}
    >
      {L.number === "cornerBadge" && number && (
        <span
          className="absolute left-2 top-2 rounded bg-black/30 px-2 font-bold tabular-nums"
          style={{ fontSize: rem(1) }}
        >
          {side.number}
        </span>
      )}

      <p className="font-semibold uppercase tracking-widest opacity-80" style={{ fontSize: rem(1.25) }}>
        {side.side}
      </p>

      {L.number === "ownLine" && number && (
        <p className="font-bold tabular-nums" style={{ fontSize: rem(1.4) }}>{side.number}</p>
      )}

      <div className={side.winning ? "tkd-blink" : ""}>
        {L.name === "aboveScore" ? [name, score] : [score, name]}
      </div>

      {/* A pattern is marked out of ten and the mark is the result, so it stays.
          Sparring is decided by the count of judges above. */}
      {data.mode === "pattern" && (
        <p className="mt-2 rounded-md bg-black/25 py-1 font-bold tabular-nums" style={{ fontSize: rem(1.5) }}>
          <span className="mr-2 uppercase tracking-widest opacity-60" style={{ fontSize: rem(0.8) }}>Score</span>
          {side.mark}
        </p>
      )}

      {look.showJudgeMarks && L.judgeMarks === "insidePanel" && (
        <div className="mt-2"><JudgeMarks side={side} look={look} rem={rem} /></div>
      )}
      {look.showPenalties && L.penalties === "insidePanel" && (
        <div className="mt-2"><Penalties side={side} look={look} rem={rem} /></div>
      )}
    </div>
  );
}

function JudgeMarks({ side, look, rem }: { side: BoardSide; look: BoardLook; rem: (v: number) => string }) {
  const colour = side.side === "red" ? look.redColor : look.blueColor;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {side.judgeMarks.map((j) => (
        <span
          key={j.judge}
          className="rounded-md px-2 py-0.5 font-bold tabular-nums"
          style={{
            fontSize: rem(1.15),
            minWidth: rem(3.6),
            backgroundColor: j.favours ? look.accentColor : "rgba(0,0,0,0.25)",
            color: j.favours ? contrastText(look.accentColor) : contrastText(colour),
          }}
        >
          <span className="mr-1 font-medium opacity-60" style={{ fontSize: rem(0.7) }}>J{j.judge}</span>
          {j.value}
        </span>
      ))}
    </div>
  );
}

function Penalties({ side, look, rem }: { side: BoardSide; look: BoardLook; rem: (v: number) => string }) {
  const box = (label: string, count: number, active: boolean, activeBg: string, activeInk: string) => (
    <div
      className="rounded-md py-1"
      style={active ? { backgroundColor: activeBg, color: activeInk } : { backgroundColor: "rgba(0,0,0,0.25)" }}
    >
      <p className="uppercase tracking-widest opacity-70" style={{ fontSize: rem(0.8) }}>{label}</p>
      <p className="font-bold leading-none tabular-nums" style={{ fontSize: rem(2.25) }}>{count}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {box("Warning", side.warnings, side.warnings > 0, look.accentColor, contrastText(look.accentColor))}
      {box("Deduction", side.deductions, side.deductions > 0, "#ffffff", "#111111")}
    </div>
  );
}
