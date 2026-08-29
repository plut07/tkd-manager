import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import ScoreboardDesigner from "@/components/ScoreboardDesigner";
import { loadTheme } from "./themeActions";

/**
 * How this event's scoreboard looks.
 *
 * Set per event rather than once for the system, because a federation running
 * somebody else's championship wants that championship's colours on the wall.
 * An event nobody has touched follows the house style.
 */
export default async function AppearanceTab({ eventId }: { eventId: string }) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const theme = await loadTheme({ eventId });

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900">Screen design</h2>
        <p className="mt-1 text-sm text-gray-500">
          The colours and layout of the big display and the judges&apos; pads for this event. Saving reaches every
          screen in the hall within a few seconds — nobody has to reload anything.
        </p>
      </div>

      <ScoreboardDesigner eventId={eventId} initial={theme} />
    </div>
  );
}
