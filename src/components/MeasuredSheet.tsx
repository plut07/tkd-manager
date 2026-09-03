"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  standings,
  techniquesFor,
  RESULT_UNIT,
  bestAt,
  type Attempt,
} from "@/lib/measured";
import {
  recordAttempt,
  clearAttempt,
  setMeasuredSetup,
  type MeasuredCategory,
} from "@/app/(app)/events/measuredActions";

/**
 * Running a power test or a special technique.
 *
 * Neither has a draw, so this is not a bracket: it is the score sheet an
 * official actually works from. One row per competitor, one group of boxes per
 * technique, and the standings underneath updating as numbers go in.
 *
 * The sheet is laid out the way the discipline is run -- a competitor takes all
 * their attempts at one technique before the next competitor steps up -- so the
 * attempts for a technique sit together rather than being spread across the
 * row.
 */
export default function MeasuredSheet({ initial }: { initial: MeasuredCategory }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const unit = RESULT_UNIT[data.kind];
  const all = techniquesFor(data.kind);
  const named = (key: string) => all.find((t) => t.key === key);

  const table = standings(data.attempts, data.entrants.map((e) => e.registrationId), data.techniques);
  const placeOf = new Map(table.map((s) => [s.registrationId, s]));

  /**
   * Put a number in, or take one out.
   *
   * The sheet is updated on the spot and the server told afterwards. An
   * official calls attempts faster than a round trip, and a box that clears
   * itself while they are looking at the next competitor is how a number ends
   * up on the wrong line.
   */
  function put(registrationId: string, technique: string, attemptNo: number, raw: string) {
    setError("");
    const text = raw.trim();

    const without = data.attempts.filter(
      (a) => !(a.registrationId === registrationId && a.technique === technique && a.attemptNo === attemptNo),
    );

    if (text === "") {
      setData({ ...data, attempts: without });
      startTransition(async () => {
        const result = await clearAttempt({ categoryId: data.categoryId, registrationId, technique, attemptNo });
        if ("error" in result) setError(result.error);
      });
      return;
    }

    // "x" or "-" is a miss: taken, and worth nothing. Distinct from an empty
    // box, which is an attempt not yet made.
    const missed = text === "x" || text === "X" || text === "-";
    const value = missed ? 0 : Number(text);
    if (!missed && (!Number.isFinite(value) || value < 0)) {
      setError(`"${text}" isn't a number. Leave a box empty for an attempt not taken, or x for one that missed.`);
      return;
    }

    const fresh: Attempt = { registrationId, technique, attemptNo, result: value, scored: !missed };
    setData({ ...data, attempts: [...without, fresh] });

    startTransition(async () => {
      const result = await recordAttempt({
        categoryId: data.categoryId,
        registrationId,
        technique,
        attemptNo,
        result: value,
        scored: !missed,
      });
      if ("error" in result) {
        setError(result.error);
        // Put the sheet back to what the server has, rather than leaving a
        // number on screen that was never saved.
        router.refresh();
      }
    });
  }

  function valueIn(registrationId: string, technique: string, attemptNo: number): string {
    const found = data.attempts.find(
      (a) => a.registrationId === registrationId && a.technique === technique && a.attemptNo === attemptNo,
    );
    if (!found) return "";
    return found.scored ? String(found.result) : "x";
  }

  async function saveSetup(techniques: string[], attempts: number) {
    const result = await setMeasuredSetup({ categoryId: data.categoryId, techniques, attemptsPerTechnique: attempts });
    if ("error" in result) { setError(result.error); return; }
    setData({ ...data, techniques, attemptsPerTechnique: attempts });
    setShowSetup(false);
    router.refresh();
  }

  const attemptNumbers = Array.from({ length: data.attemptsPerTechnique }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{data.name}</h2>
            <p className="text-sm text-gray-500">
              {data.kind === "power_test" ? "Power test" : "Special technique"} ·{" "}
              {data.techniques.length} technique{data.techniques.length === 1 ? "" : "s"} ·{" "}
              {data.attemptsPerTechnique} attempt{data.attemptsPerTechnique === 1 ? "" : "s"} at each · measured in{" "}
              {unit.short}
            </p>
          </div>
          <button type="button" className={showSetup ? "btn-primary" : "btn-secondary"} onClick={() => setShowSetup((o) => !o)}>
            {showSetup ? "Hide setup" : "Techniques & attempts"}
          </button>
        </div>

        {showSetup && <Setup data={data} onSave={saveSetup} />}
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {data.entrants.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No confirmed entries in this category yet. Confirm competitors on the Registration page and they appear here.
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Score sheet</h3>
            <p className="text-xs text-gray-500">
              Type the {unit.short} for each attempt. Leave a box empty for one not taken, or <strong>x</strong> for one
              that missed. {pending && <span className="text-brand-700">Saving…</span>}
            </p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="table-base min-w-full">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Competitor</th>
                  {data.techniques.map((key) => (
                    <th key={key} className="text-center" colSpan={data.attemptsPerTechnique + 1}>
                      <span className="block">{named(key)?.name ?? key}</span>
                      <span className="block text-[10px] font-normal text-gray-400">{named(key)?.english}</span>
                    </th>
                  ))}
                  <th className="text-center">Total</th>
                  <th className="text-center">Place</th>
                </tr>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th />
                  {data.techniques.map((key) => (
                    <Fragment key={key}>
                      {attemptNumbers.map((n) => (
                        <th key={n} className="text-center font-normal">{n}</th>
                      ))}
                      <th className="text-center font-normal text-gray-500">best</th>
                    </Fragment>
                  ))}
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.entrants.map((entrant) => {
                  const standing = placeOf.get(entrant.registrationId);
                  return (
                    <tr key={entrant.registrationId}>
                      <td className="whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {entrant.competitionNumber ? `#${entrant.competitionNumber} ` : ""}
                          {entrant.name || "—"}
                        </span>
                        {entrant.clubName && <span className="block text-xs text-gray-400">{entrant.clubName}</span>}
                      </td>

                      {data.techniques.map((key) => (
                        <Fragment key={key}>
                          {attemptNumbers.map((n) => (
                            <td key={n} className="p-1 text-center">
                              <input
                                className="input !w-14 !px-1 !py-1 text-center text-sm"
                                inputMode="decimal"
                                step={unit.step}
                                defaultValue={valueIn(entrant.registrationId, key, n)}
                                onBlur={(e) => put(entrant.registrationId, key, n, e.target.value)}
                                aria-label={`${entrant.name}, ${named(key)?.name ?? key}, attempt ${n}`}
                              />
                            </td>
                          ))}
                          <td className="bg-gray-50 text-center text-sm font-semibold text-gray-700">
                            {bestAt(data.attempts, entrant.registrationId, key) || "—"}
                          </td>
                        </Fragment>
                      ))}

                      <td className="text-center text-base font-bold text-gray-900">{standing?.total ?? 0}</td>
                      <td className="text-center">
                        {standing && standing.total > 0 ? (
                          <span
                            className={`badge ${
                              standing.place === 1
                                ? "bg-amber-100 text-amber-800"
                                : standing.place === 2
                                  ? "bg-gray-200 text-gray-700"
                                  : standing.place === 3
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {standing.place}
                            {standing.tied ? "=" : ""}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {table.some((s) => s.tied && s.total > 0) && (
            <p className="mt-3 text-xs text-amber-700">
              An <strong>=</strong> means two competitors could not be separated — same total, and the same number of
              attempts to get there. ITF would order a re-try; record it as an extra attempt once it has been taken.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Which techniques this category runs, and how many attempts at each. */
function Setup({
  data,
  onSave,
}: {
  data: MeasuredCategory;
  onSave: (techniques: string[], attempts: number) => void | Promise<void>;
}) {
  const all = techniquesFor(data.kind);
  const [chosen, setChosen] = useState<string[]>(data.techniques);
  const [attempts, setAttempts] = useState(data.attemptsPerTechnique);

  function toggle(key: string) {
    setChosen((held) => (held.includes(key) ? held.filter((k) => k !== key) : [...held, key]));
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-xs text-gray-500">
        A junior power test is not the senior one, so each category picks its own techniques and how many attempts it
        allows at each.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {all.map((t) => (
          <label key={t.key} className="flex items-start gap-2 rounded-md border border-gray-200 p-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={chosen.includes(t.key)} onChange={() => toggle(t.key)} />
            <span>
              <span className="font-medium text-gray-900">{t.name}</span>
              <span className="block text-xs text-gray-500">{t.english}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs">Attempts at each</label>
          <input
            type="number"
            min={1}
            max={10}
            className="input !w-24 text-center"
            value={attempts}
            onChange={(e) => setAttempts(Number(e.target.value))}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => void onSave(chosen, attempts)}>
          Save setup
        </button>
      </div>
    </div>
  );
}
