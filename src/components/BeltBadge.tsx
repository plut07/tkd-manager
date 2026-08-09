import { beltForGup, gradeLabel } from "@/lib/belts";

/** A student's grade with a colour swatch when it's a colour belt. */
export default function BeltBadge({
  gup,
  dan,
  className = "",
}: {
  gup: number | null | undefined;
  dan: number | null | undefined;
  className?: string;
}) {
  const belt = dan == null ? beltForGup(gup) : null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {belt && (
        <span
          aria-hidden
          className="inline-block h-3 w-5 shrink-0 rounded-sm border border-gray-300"
          style={{ background: belt.swatch }}
        />
      )}
      {dan != null && <span aria-hidden className="inline-block h-3 w-5 shrink-0 rounded-sm border border-gray-300 bg-gray-900" />}
      <span>{gradeLabel(gup, dan)}</span>
    </span>
  );
}
