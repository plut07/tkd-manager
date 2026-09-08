import { formatEventDateTime } from "@/lib/eventStatus";

/**
 * Why the buttons aren't there.
 *
 * A finished event is read-only for everyone except a Super Admin or whoever
 * created it, which is right — entries and results should not drift after the
 * fact. What was wrong is how it was communicated: `canEditNow` simply stopped
 * rendering the controls, so Add and Remove vanished with nothing in their
 * place. The server had a perfectly good explanation ready and no screen ever
 * asked for it.
 *
 * From the outside that is indistinguishable from a broken app. Somebody hit
 * exactly this, concluded the event was corrupt, and asked for the data to be
 * deleted — for a lock that was working as designed.
 *
 * So: say it. Once, at the top, in the same words the server would have used.
 */
export default function EventLockNotice({
  endDate,
  isCreatorOrAdmin,
}: {
  endDate: string | null;
  /** Whether this viewer could override the lock. If they can, there is nothing to explain. */
  isCreatorOrAdmin: boolean;
}) {
  if (isCreatorOrAdmin) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">
        This event has finished{endDate ? ` — it ended ${formatEventDateTime(endDate)}` : ""}.
      </p>
      <p className="mt-1 text-sm text-amber-800">
        It is read-only now, so entries and results can&apos;t be changed after the fact. That is why the buttons to add,
        edit and remove aren&apos;t shown. <strong>A Super Admin, or whoever created this event, can still change it</strong> —
        sign in as one of them if something genuinely needs correcting.
      </p>
      <p className="mt-1 text-xs text-amber-700">
        An event&apos;s status follows its dates rather than being set by hand, so extending the end date reopens it.
      </p>
    </div>
  );
}
