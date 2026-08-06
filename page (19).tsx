import { requirePermission, hasPermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import BracketView from "../../../../BracketView";
export default async function BracketPage({ params }: { params: { id: string; categoryId: string } }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const canEdit = hasPermission(session, PERMISSIONS.EVENT_EDIT);
  return (<BracketView eventId={params.id} categoryId={params.categoryId} canEdit={canEdit} backHref={`/events/${params.id}?tab=categories`} backLabel="Back to categories" />);
}
