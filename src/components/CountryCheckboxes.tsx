"use client";
import { useMemo, useState } from "react";
import { COUNTRIES_BY_CONTINENT, CONTINENTS, type Continent } from "@/lib/countries";

/**
 * Eligible-country picker.
 *
 * A 199-option multi-select is unusable, so this is checkboxes grouped by
 * continent with a search box and a whole-continent toggle. Each ticked country
 * submits its own value under the same field name, which is what
 * formData.getAll() on the server expects — the same shape the old multi-select
 * produced.
 */
export default function CountryCheckboxes({
  name,
  defaultValues = [],
}: {
  name: string;
  defaultValues?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValues));
  const [filter, setFilter] = useState("");
  const [openContinent, setOpenContinent] = useState<Continent | "all">("all");

  const needle = filter.trim().toLowerCase();

  const groups = useMemo(
    () =>
      COUNTRIES_BY_CONTINENT.map((g) => ({
        ...g,
        countries: g.countries.filter((c) => !needle || c.name.toLowerCase().includes(needle)),
      })).filter((g) => g.countries.length > 0 && (openContinent === "all" || g.continent === openContinent)),
    [needle, openContinent],
  );

  function toggle(countryName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(countryName)) next.delete(countryName);
      else next.add(countryName);
      return next;
    });
  }

  function toggleContinent(continent: Continent, on: boolean) {
    const names = COUNTRIES_BY_CONTINENT.find((g) => g.continent === continent)?.countries.map((c) => c.name) ?? [];
    setSelected((prev) => {
      const next = new Set(prev);
      names.forEach((n) => (on ? next.add(n) : next.delete(n)));
      return next;
    });
  }

  return (
    <div className="rounded-md border border-gray-200">
      {/* One hidden input per ticked country keeps the server contract unchanged. */}
      {Array.from(selected).map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search countries..."
          className="input max-w-xs"
        />
        <select className="input max-w-[12rem]" value={openContinent} onChange={(e) => setOpenContinent(e.target.value as Continent | "all")}>
          <option value="all">All continents</option>
          {CONTINENTS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-gray-500">
          {selected.size === 0 ? "Open to every country" : `${selected.size} selected`}
        </span>
        {selected.size > 0 && (
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto p-3">
        {groups.map((g) => {
          const all = g.countries.every((c) => selected.has(c.name));
          return (
            <div key={g.continent} className="mb-4 last:mb-0">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{g.continent}</h4>
                <button
                  type="button"
                  className="text-xs font-medium text-brand-700 hover:underline"
                  onClick={() => toggleContinent(g.continent, !all)}
                >
                  {all ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {g.countries.map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={selected.has(c.name)} onChange={() => toggle(c.name)} className="h-4 w-4 rounded border-gray-300" />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No countries match &quot;{filter}&quot;.</p>}
      </div>
    </div>
  );
}
