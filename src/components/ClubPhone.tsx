import { dialCode } from "@/lib/countries";

/**
 * A contact number with its country's dialling prefix.
 *
 * The prefix is derived from the club's country rather than stored, so it stays
 * right if the country is corrected. A number already in international format
 * is left alone instead of being double-prefixed.
 */
export default function ClubPhone({ phone, country }: { phone: string | null | undefined; country: string | null | undefined }) {
  const number = (phone ?? "").trim();
  if (!number) return <span className="text-gray-400">—</span>;

  const prefix = dialCode(country);
  const alreadyInternational = number.startsWith("+");

  return (
    <span className="whitespace-nowrap">
      {prefix && !alreadyInternational && <span className="text-gray-500">{prefix} </span>}
      {number}
    </span>
  );
}
