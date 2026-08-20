import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import DeleteButton from "@/components/DeleteButton";
import TemplateTab from "@/components/TemplateTab";
import RegisteredStudentsPanel, { type RegistrationFilters } from "../RegisteredStudentsPanel";
import RegistrationPanel from "../RegistrationPanel";
import EventPhotos from "@/components/EventPhotos";
import { PHOTO_BUCKET } from "@/lib/eventPhotos";

import CategoryForm from "../CategoryForm";
import BracketView from "../BracketView";
import ExamTab from "../ExamTab";
import ResultTab from "../ResultTab";
import { EVENT_TYPE_LABELS, CATEGORY_TYPES, type CategoryTypeCode } from "@/lib/eventCategories";
import { describeCriteria, type CategoryCriteria } from "@/lib/eligibility";
import { effectiveEventStatus, canOverrideLocks, STATUS_STYLES, STATUS_LABELS, formatEventRange, formatEventDateTime } from "@/lib/eventStatus";
import { deleteEvent, addCategory, deleteCategory, addDocument, deleteDocument } from "../actions";
import CountryFlag from "@/components/CountryFlag";
function formatDate(d: string | null) { if (!d) return "TBA"; return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
export default async function EventDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; sub?: string; template?: string; category?: string; club?: string; grade?: string; gender?: string; ageGroup?: string; status?: string } }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("*, clubs:organizer_club_id(name)").eq("id", params.id).maybeSingle();
  if (!event) notFound();
  const isCompetition = event.event_type === "competition";
  const isGrading = event.event_type === "grading";
  // Registration gathers what used to be three separate tabs. Old links
  // (?tab=entries, ?tab=template, ?tab=grading) still land in the right place.
  const legacy: Record<string, string> = { entries: "students", template: "template", grading: "students" };
  const rawTab = searchParams.tab ?? "";
  const tab =
    rawTab in legacy || rawTab === "registration"
      ? "registration"
      : isCompetition && (rawTab === "categories" || rawTab === "draws")
        ? rawTab
        : isGrading && (rawTab === "exam" || rawTab === "results")
          ? rawTab
          : "info";

  const subOptions = ["students", "approval", "template"];
  const requestedSub = legacy[rawTab] ?? searchParams.sub ?? "students";
  const sub = subOptions.includes(requestedSub) ? requestedSub : "students";

  const filters: RegistrationFilters = {
    club: searchParams.club ?? "",
    grade: searchParams.grade ?? "",
    gender: searchParams.gender ?? "",
    ageGroup: searchParams.ageGroup ?? "",
    status: searchParams.status ?? "",
  };

  // Filters are links, so changing one keeps the rest of the query string.
  function registrationHref(patch: Partial<RegistrationFilters & { sub: string }>) {
    const next = new URLSearchParams();
    next.set("tab", "registration");
    next.set("sub", (patch.sub ?? sub) as string);
    const merged = { ...filters, ...patch };
    for (const key of ["club", "grade", "gender", "ageGroup", "status"] as const) {
      const value = (merged as any)[key];
      if (value) next.set(key, String(value));
    }
    return `/events/${params.id}?${next.toString()}`;
  }

  const { data: categories } = await supabase.from("event_categories").select("*").eq("event_id", event.id).order("sort_order").order("name");
  const { data: documents } = await supabase.from("event_documents").select("*").eq("event_id", event.id).order("uploaded_at", { ascending: false });
  const { data: photoRows } = await supabase.from("event_photos").select("id, storage_path, caption, kind").eq("event_id", event.id).order("sort_order");
  const photos = (photoRows ?? []).map((p: any) => ({
    id: p.id,
    caption: p.caption ?? null,
    kind: (p.kind ?? "gallery") as "background" | "header" | "gallery",
    url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p.storage_path).data.publicUrl,
  }));
  const { count: pendingCount } = await supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "pending");
  const { count: confirmedCount } = await supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed");
  const canEdit = hasPermission(session, PERMISSIONS.EVENT_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.EVENT_DELETE);
  // Signing links are shared outside the app, so they need the full address.
  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  // Once an event has finished it is read-only for everyone but a Super Admin,
  // so entries and results can't be altered after the fact.
  const isFinished = effectiveEventStatus(event) === "completed";
  const locked = isFinished && session.role !== "super_admin";
  const canEditNow = canEdit && !locked;
  const canDeleteNow = canDelete && !locked;
  // Marking and publishing outlive the event itself: a Super Admin or whoever
  // created the event can still correct a result once the day is over.
  const canOverride = canOverrideLocks({ sub: session.sub, role: session.role }, event as any);
  const canMarkNow = canEdit && (!isFinished || canOverride);
  // Every form for this event, plus how many boxes each one carries, so the
  // list can say which are ready to print without a query per row.
  const showTemplates = tab === "registration" && sub === "template";
  const { data: templateRows } = showTemplates
    ? await supabase.from("event_form_templates").select("id, name, page_count, page_width, page_height, is_default, created_at, offset_x, offset_y, scale").eq("event_id", event.id).eq("purpose", "registration").order("created_at")
    : { data: null };
  const templateIds = (templateRows ?? []).map((t: any) => t.id);
  const { data: allFields } = templateIds.length > 0
    ? await supabase.from("event_form_fields").select("template_id, field_key, page, x, y, width, height, font_size, align").in("template_id", templateIds)
    : { data: null };
  const fieldsByTemplate = new Map<string, any[]>();
  for (const f of allFields ?? []) {
    if (!fieldsByTemplate.has(f.template_id)) fieldsByTemplate.set(f.template_id, []);
    fieldsByTemplate.get(f.template_id)!.push(f);
  }
  const templates = (templateRows ?? []).map((t: any) => ({
    id: t.id, name: t.name, page_count: t.page_count, page_width: t.page_width, page_height: t.page_height,
    is_default: t.is_default, field_count: (fieldsByTemplate.get(t.id) ?? []).length,
    alignment: { offsetX: Number(t.offset_x) || 0, offsetY: Number(t.offset_y) || 0, scale: Number(t.scale) || 1 },
  }));
  // Which form's boxes are open: the one asked for, else the default.
  const editingTemplate =
    templates.find((t) => t.id === searchParams.template) ??
    templates.find((t) => t.is_default) ??
    templates[0] ??
    null;

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
        <Link href={registrationHref({ sub: "students" })} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === "registration" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Registration Page</Link>
        {isGrading && (<Link href={`/events/${event.id}?tab=exam`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "exam" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Exam</Link>)}
        {isGrading && (<Link href={`/events/${event.id}?tab=results`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "results" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Results</Link>)}
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
          <EventPhotos eventId={event.id} photos={photos} canEdit={canEditNow} />
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
      ) : tab === "registration" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-md bg-gray-100 p-1">
            <Link href={registrationHref({ sub: "students" })} className={`rounded px-3 py-1.5 text-sm font-medium ${sub === "students" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>Registered students</Link>
            <Link href={registrationHref({ sub: "approval" })} className={`rounded px-3 py-1.5 text-sm font-medium ${sub === "approval" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>Approval &amp; confirmed</Link>
            {canEdit && (<Link href={registrationHref({ sub: "template" })} className={`rounded px-3 py-1.5 text-sm font-medium ${sub === "template" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>Form template</Link>)}
          </div>
          {sub === "approval" ? (
            <RegistrationPanel eventId={event.id} />
          ) : sub === "template" ? (
            <TemplateTab
              eventId={event.id}
              templates={templates}
              editing={editingTemplate}
              fields={editingTemplate ? fieldsByTemplate.get(editingTemplate.id) ?? [] : []}
              canEdit={canEditNow}
              registeredCount={(pendingCount ?? 0) + (confirmedCount ?? 0)}
            />
          ) : (
            <RegisteredStudentsPanel
              eventId={event.id}
              isGrading={isGrading}
              canEdit={canEditNow}
              baseUrl={baseUrl}
              filters={filters}
              hrefFor={(patch) => registrationHref(patch)}
            />
          )}
        </div>

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
      ) : tab === "exam" ? (
        <ExamTab
          eventId={event.id}
          canMark={canMarkNow}
          sub={searchParams.sub === "syllabus" || searchParams.sub === "form" ? searchParams.sub : "main"}
          hrefFor={(next) => `/events/${params.id}?tab=exam&sub=${next}`}
          templateId={searchParams.template}
        />
      ) : tab === "results" ? (
        <ResultTab
          eventId={event.id}
          publishedAt={(event as any).results_published_at ?? null}
          canPublish={canOverride}
          canPreview={canEdit}
        />
      ) : null}
    </div>
  );
}
