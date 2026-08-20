import PendingCandidates from "./PendingCandidates";

/**
 * Kept only so older links and any stray import still resolve.
 *
 * Gradings now take entries through the built-in public registration page, so
 * there is no external form to create or sync. What mattered here — the queue
 * of people waiting on approval — lives on the Registration page.
 */
export default function GradingTab({ eventId, canEdit = false, isSuperAdmin }: { eventId: string; canEdit?: boolean; isSuperAdmin: boolean }) {
  return <PendingCandidates eventId={eventId} isSuperAdmin={isSuperAdmin} canEdit={canEdit} />;
}
