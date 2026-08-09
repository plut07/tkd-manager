import { BELTS } from "@/lib/belts";

/**
 * Belt picker that submits the gup number the database stores.
 *
 * A native select can't show colour swatches in its options, so the label
 * carries the colour name and the swatch appears next to the field.
 */
export default function BeltSelect({
  id,
  name,
  defaultValue,
  className = "input",
}: {
  id?: string;
  name: string;
  defaultValue?: number | string | null;
  className?: string;
}) {
  return (
    <select id={id} name={name} className={className} defaultValue={defaultValue == null ? "" : String(defaultValue)}>
      <option value="">Not a colour belt / black belt</option>
      {BELTS.map((b) => (
        <option key={b.gup} value={b.gup}>
          {b.gup} Gup — {b.label}
        </option>
      ))}
    </select>
  );
}
