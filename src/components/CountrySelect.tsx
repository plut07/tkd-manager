import { COUNTRIES_BY_CONTINENT } from "@/lib/countries";

/**
 * Country picker grouped by continent.
 *
 * Uses a native <select> with <optgroup>, which browsers render as headed
 * groups and screen readers announce properly. Flags can't appear here — no
 * browser renders images inside option elements — so they're shown wherever a
 * country is displayed instead (see CountryFlag).
 */
export default function CountrySelect({
  id,
  name,
  defaultValue,
  defaultValues,
  required,
  multiple,
  className = "input",
  placeholder = "Not specified",
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  defaultValues?: string[];
  required?: boolean;
  multiple?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      className={className}
      required={required}
      multiple={multiple}
      defaultValue={multiple ? defaultValues ?? [] : defaultValue ?? ""}
    >
      {!multiple && <option value="">{placeholder}</option>}
      {COUNTRIES_BY_CONTINENT.map((group) => (
        <optgroup key={group.continent} label={group.continent}>
          {group.countries.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
