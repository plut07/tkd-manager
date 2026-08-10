import { GRADE_OPTIONS } from "@/lib/belts";

/**
 * One picker for the whole grade ladder — colour belts and black belts in a
 * single list. Submits an encoded value (G10..G1, D1..D7) which the server
 * splits back into the gup and dan columns.
 */
export default function GradeSelect({
  id,
  name,
  defaultValue,
  className = "input",
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  className?: string;
}) {
  return (
    <select id={id} name={name} className={className} defaultValue={defaultValue ?? ""}>
      <option value="">Not graded yet</option>
      {GRADE_OPTIONS.map((g) => (
        <option key={g.value} value={g.value}>
          {g.label}
        </option>
      ))}
    </select>
  );
}
