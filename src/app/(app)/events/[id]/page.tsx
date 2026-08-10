import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import DeleteButton from "@/components/DeleteButton";
import BeltBadge from "@/components/BeltBadge";
import TemplateTab from "@/components/TemplateTab";

import CategoryForm from "../CategoryForm";
import BracketView from "../BracketView";
import GradingTab from "../GradingTab";
import { EVENT_TYPE_LABELS, CATEGORY_TYPES, type CategoryTypeCode } from "@/lib/eventCategories";
import { describeCriteria, waiverAge, formatDob, type CategoryCriteria } from "@/lib/eligibility";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS, formatEventRange, formatEventDateTime } from "@/lib/eventStatus";
import { deleteEvent, addCategory, deleteCategory, addDocument, deleteDocument } from "../actions";
import CountryFlag from "@/components/CountryFlag";
function formatDate(d: string | null) { if (!d) return "TBA"; return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
export default async function EventDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; category?: string } }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("*, clubs:organizer_club_id(name)").eq("id", params.id).maybeSingle();
  if (!event) notFound();
  const isCompetition = event.event_type === "competition";
  const isGrading = event.event_type === "grading";
  const tab =
    searchParams.tab === "entries"
      ? "entries"
      : searchParams.tab === "template"
        ? "template"
      : isCompetition && (searchParams.tab === "categories" || searchParams.tab === "draws")
        ? searchParams.tab
        : isGrading && searchParams.tab === "grading"
          ? "grading"
          : "info";
  const { data: categories } = await supabase.from("event_categories").select("*").eq("event_id", event.id).order("sort_order").order("name");
  const { data: documents } = await supabase.from("event_documents").select("*").eq("event_id", event.id).order("uploaded_at", { ascending: false });
  const { count: pendingCount } = await supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "pending");
  const { count: confirmedCount } = await supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed");
  const canEdit = hasPermission(session, PERMISSIONS.EVENT_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.EVENT_DELETE);
  // Once an event has finished it is read-only for everyone but a Super Admin,
  // so entries and results can't be altered after the fact.
  const isFinished = effectiveEventStatus(event) === "completed";
  const locked = isFinished && session.role !== "super_admin";
  const canEditNow = canEdit && !locked;
  const canDeleteNow = canDelete && !locked;
  // Loaded only for the entries tab so the other tabs stay cheap.
  const { data: entries } = tab === "entries"
    ? await supabase
        .from("event_registrations")
        .select("id, status, competition_number, registered_at, clubs(name), students(first_name, last_name, birthday, gender, gup, dan, national_id, passport_id), event_categories(name)")
        .eq("event_id", event.id)
        .order("registered_at")
    : { data: null };

  const { data: template } = tab === "template"
    ? await supabase.from("event_form_templates").select("id, name, page_count").eq("event_id", event.id).eq("is_default", true).maybeSingle()
    : { data: null };
  const { data: templateFields } = template
    ? await supabase.from("event_form_fields").select("field_key, page, x, y, width, height, font_size, align").eq("template_id", template.id)
    : { data: null };

  const bracketStatusMap = new Map<string, string>();
  const confirmedCountMap = new Map<string, number>();
  if (tab === "draws" && (categories ?? []).length > 0) {
    const categoryIds = (categories ?? []).map((c) => c.id);
    const [{ data: brackets }, { data: confirmedRegs }] = await Promise.all([
      supabase.from("event_category_brackets").select("event_category_id, status").in("event_category_id", categoryIds),
      supabase.from("event_registrations").select("category_id").eq("event_id", event.id).eq("status", "confirmed").in("category_id", categoryIds),
    ]);
    (brackets ?? []).forEach((b) => bracketStatusMap.set(b.event_category_id, b.status));
    (confirmedRegs ?? []).forEach((r) => { if (r.category_id) confirmedCountMap.set(r.category_id, (confirmedCountMap.get(r.category_id) ?? 0) + 1); });
  }
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <span className={`badge ${STATUS_STYLES[effectiveEventStatus(event)] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[effectiveEventStatus(event)] ?? effectiveEventStatus(event)}</span>
              <span className="badge bg-brand-100 text-brand-700">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</span>
            </div>
            
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/events" className="btn-secondary">Back to events</Link>
            {locked ? (
              <Link href={`/events/${event.id}/register`} className="btn-secondary">View entries</Link>
            ) : (
              <Link href={`/events/${event.id}/register`} className="btn-primary">Register</Link>
            )}
            {canEditNow && (<Link href={`/events/${event.id}/edit`} className="btn-secondary">Edit</Link>)}
            {canDeleteNow && (<DeleteButton action={deleteEvent} fieldName="eventId" fieldValue={event.id} confirmLabel={`Delete "${event.name}"? This cannot be undone.`} />)}
          </div>
        </div>
        {locked && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This event has finished, so it is now read-only. Ask a Super Admin if something still needs correcting.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/events/${event.id}/register`} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100">{pendingCount ?? 0} pending approval</Link>
          <Link href={`/events/${event.id}/register`} className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 font-medium text-green-700 hover:bg-green-100">{confirmedCount ?? 0} confirmed</Link>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
        <Link href={`/events/${event.id}`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "info" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Info pack</Link>
        {isCompetition && (<Link href={`/events/${event.id}?tab=categories`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "categories" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Categories & divisions</Link>)}
        {isCompetition && (<Link href={`/events/${event.id}?tab=draws`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "draws" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Draws</Link>)}
        <Link href={`/events/${event.id}?tab=entries`} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === "entries" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Registered students</Link>
        {canEdit && (<Link href={`/events/${event.id}?tab=template`} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === "template" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Form template</Link>)}
        {isGrading && (<Link href={`/events/${event.id}?tab=grading`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "grading" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Grading registration</Link>)}
      </div>
      {tab === "info" ? (
        <>
          <div className="card p-6">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-gray-500">Dates</dt><dd className="font-medium text-gray-900">{formatEventRange(event.start_date, event.end_date)}</dd></div>
              <div><dt className="text-gray-500">Venue</dt><dd className="font-medium text-gray-900">{event.country && <CountryFlag country={event.country} showName={false} className="mr-1.5 align-[-2px]" />}{[event.venue, event.venue_address, event.country].filter(Boolean).join(", ") || "TBA"}</dd></div>
              <div><dt className="text-gray-500">Organizer</dt><dd className="font-medium text-gray-900">{(event as any).clubs?.name || "—"}</dd></div>
              <div><dt className="text-gray-500">Registration deadline</dt><dd className="font-medium text-gray-900">{formatEventDateTime(event.registration_deadline)}</dd></div>
              <div className="sm:col-span-2 lg:col-span-4"><dt className="text-gray-500">Eligible countries</dt><dd className="font-medium text-gray-900">{event.allowed_countries && event.allowed_countries.length > 0 ? event.allowed_countries.join(", ") : "Open to every country"}</dd></div>
            </dl>
            {event.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-700">{event.description}</p>}
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
            <ul className="mt-4 divide-y divide-gray-100">
              {(documents ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 hover:underline">{d.title}</a>
                  {canEditNow && (<DeleteButton action={deleteDocument} fieldName="documentId" fieldValue={d.id} confirmLabel={`Remove "${d.title}"?`} label="Remove" extraFields={{ eventId: event.id }} />)}
                </li>
              ))}
              {(documents ?? []).length === 0 && <li className="py-4 text-center text-gray-400">No documents uploaded.</li>}
            </ul>
            {canEditNow && (
              <form action={addDocument} className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <input type="hidden" name="eventId" value={event.id} />
                <input name="title" placeholder="Document title" className="input max-w-xs" required />
                <input name="url" placeholder="https://..." className="input max-w-sm" required />
                <button type="submit" className="btn-primary">+ Add document</button>
              </form>
            )}
          </div>
        </>
      ) : tab === "categories" ? (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Categories & divisions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Name</th><th>Type</th><th>Eligibility</th><th></th>{canEditNow && <th></th>}</tr></thead>
              <tbody>
                {(categories ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-gray-900">{c.name}</td>
                    <td>{CATEGORY_TYPES[c.type as CategoryTypeCode]?.label ?? c.type ?? "—"}</td>
                    <td className="text-gray-600">{describeCriteria(c as CategoryCriteria)}</td>
                    <td className="text-right"><Link href={`/events/${event.id}/categories/${c.id}/bracket`} className="text-sm font-medium text-brand-700 hover:underline">Bracket</Link></td>
                    {canEditNow && (<td className="text-right"><DeleteButton action={deleteCategory} fieldName="categoryId" fieldValue={c.id} confirmLabel={`Remove category "${c.name}"?`} label="Remove" extraFields={{ eventId: event.id }} /></td>)}
                  </tr>
                ))}
                {(categories ?? []).length === 0 && (<tr><td colSpan={5} className="py-4 text-center text-gray-400">No categories added yet.</td></tr>)}
              </tbody>
            </table>
          </div>
          {canEditNow && <CategoryForm action={addCategory} eventId={event.id} />}
        </div>
      ) : tab === "entries" ? (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Registered students ({(entries ?? []).length})</h2>
              <p className="mt-1 text-sm text-gray-500">Everyone entered for this event. Download a participation waiver for any of them.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/export/grading?eventId=${event.id}`} className="btn-secondary">Export to Excel</a>
              {(entries ?? []).length > 0 && (
                <a href={`/api/export/waiver?eventId=${event.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">All waivers (PDF)</a>
              )}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>No.</th><th>Name</th><th>Club</th><th>Grade / Degree</th>
                  <th className="hidden lg:table-cell">Date of birth</th>
                  <th className="hidden md:table-cell">Gender</th>
                  <th className="hidden md:table-cell">Age</th>
                  <th className="hidden lg:table-cell">Category</th>
                  <th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(entries ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.competition_number ?? "—"}</td>
                    <td className="font-medium text-gray-900">{[r.students?.first_name, r.students?.last_name].filter(Boolean).join(" ")}</td>
                    <td>{r.clubs?.name ?? "—"}</td>
                    <td><BeltBadge gup={r.students?.gup ?? null} dan={r.students?.dan ?? null} /></td>
                    <td className="hidden lg:table-cell">{formatDob(r.students?.birthday ?? null)}</td>
                    <td className="hidden capitalize md:table-cell">{r.students?.gender ?? "—"}</td>
                    <td className="hidden md:table-cell">{waiverAge(r.students?.birthday ?? null) || "—"}</td>
                    <td className="hidden lg:table-cell">{r.event_categories?.name ?? "—"}</td>
                    <td><span className={`badge ${r.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span></td>
                    <td className="whitespace-nowrap text-right">
                      <a href={`/api/export/waiver?registrationId=${r.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Waiver PDF</a>
                    </td>
                  </tr>
                ))}
                {(entries ?? []).length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-center text-gray-400">Nobody has registered for this event yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "template" ? (
        <TemplateTab eventId={event.id} template={template as any} fields={templateFields ?? []} canEdit={canEditNow} />
      ) : tab === "draws" ? (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900">Draws</h2>
            <p className="mt-1 text-sm text-gray-500">Select a category to view or manage its draw.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(categories ?? []).map((c) => {
                const status = bracketStatusMap.get(c.id);
                const count = confirmedCountMap.get(c.id) ?? 0;
                const selected = searchParams.category === c.id;
                return (
                  <Link key={c.id} href={`/events/${event.id}?tab=draws&category=${c.id}`} className={`rounded-md border p-3 text-sm hover:border-brand-300 ${selected ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{count} confirmed</span>
                      <span className={`badge ${status === "published" ? "bg-green-100 text-green-700" : status ? "bg-gray-100 text-gray-500" : "bg-gray-50 text-gray-400"}`}>{status === "published" ? "Published" : status ? "Draft" : "Not generated"}</span>
                    </div>
                  </Link>
                );
              })}
              {(categories ?? []).length === 0 && <p className="col-span-full py-4 text-center text-gray-400">No categories added yet.</p>}
            </div>
          </div>
          {searchParams.category && (<BracketView eventId={event.id} categoryId={searchParams.category} canEdit={canEditNow} backHref={`/events/${event.id}?tab=draws`} backLabel="Back to draws list" />)}
        </div>
      ) : (
        <GradingTab eventId={event.id} canEdit={canEditNow} isSuperAdmin={session.role === "super_admin"} />
      )}
    </div>
  );
}
