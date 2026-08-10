"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { checkEligibility, checkCountryEligibility, type CategoryCriteria, type StudentLite } from "@/lib/eligibility";
import { sortForNumbering, formatCompetitionNumber, type NumberingStudent } from "@/lib/numbering";
import { effectiveEventStatus, isRegistrationOpen, canOverrideLocks, fromLocalInputValue } from "@/lib/eventStatus";
import { parseGradeValue } from "@/lib/belts";

export type FormState = { error?: string } | undefined;

// Recomputes competition numbers for every confirmed registration in an
// event (numbering is scoped to the event, not the category — see
// lib/numbering.ts for the sort rules). Cheap enough to just rerun in full
// on every approve/unregister at this scale.
async function renumberEventCompetitors(eventId: string) {
  const supabase = supabaseAdmin();
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, students(birthday, gender, gup, dan)")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  const list: NumberingStudent[] = (regs ?? []).map((r: any) => ({
    registrationId: r.id,
    birthday: r.students?.birthday ?? null,
    gender: r.students?.gender ?? null,
    gup: r.students?.gup ?? null,
    dan: r.students?.dan ?? null,
  }));

  const sorted = sortForNumbering(list);
  await Promise.all(
    sorted.map((s, i) =>
      supabase
        .from("event_registrations")
        .update({ competition_number: formatCompetitionNumber(i + 1) })
        .eq("id", s.registrationId)
    )
  );
}

// The status column is now derived, not chosen. Only two states are deliberate:
// a draft (hidden from the public list) and a cancellation. Anything else is
// stored as "upcoming", which effectiveEventStatus treats as "work it out from
// the dates". The column keeps its original CHECK constraint this way.
function storedStatus(d: { isDraft: boolean; isCancelled: boolean }): string {
  if (d.isCancelled) return "cancelled";
  if (d.isDraft) return "draft";
  return "upcoming";
}

/**
 * Event details lock once the event has finished. A Super Admin, or whoever
 * created the event, can still correct things afterwards.
 */
async function assertEventEditable(session: { role: string; sub: string }, eventId: string) {
  const { data: event } = await supabaseAdmin()
    .from("events")
    .select("status, start_date, end_date, registration_deadline, created_by")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return;
  if (canOverrideLocks({ sub: session.sub, role: session.role }, event)) return;
  if (effectiveEventStatus(event) === "completed") {
    throw new Error("This event has finished. Only a Super Admin or the person who created it can change it now.");
  }
}

/**
 * Entries lock at the registration deadline — earlier than the event itself, so
 * organisers can finalise numbers. Same two people can override.
 */
async function assertRegistrationOpen(session: { role: string; sub: string }, eventId: string) {
  const { data: event } = await supabaseAdmin()
    .from("events")
    .select("status, start_date, end_date, registration_deadline, created_by")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return;
  if (canOverrideLocks({ sub: session.sub, role: session.role }, event)) return;
  if (!isRegistrationOpen(event)) {
    throw new Error("Registration for this event has closed. Contact the organizer if an entry still needs changing.");
  }
}

const eventSchema = z.object({
  name: z.string().trim().min(2, "Event name is required."),
  eventType: z.enum(["competition", "grading", "seminar", "course"], {
    errorMap: () => ({ message: "Choose an event type." }),
  }),
  startDate: z.string().min(1, "Start date and time are required."),
  endDate: z.string().optional().or(z.literal("")),
  venue: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  organizerClubId: z.string().uuid("Choose the organizing club."),
  venueAddress: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  registrationDeadline: z.string().optional().or(z.literal("")),
  isDraft: z.boolean(),
  isCancelled: z.boolean(),
  allowedCountries: z.array(z.string()).optional(),
});

function readEventForm(formData: FormData) {
  return {
    name: formData.get("name"),
    eventType: formData.get("eventType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    venue: formData.get("venue"),
    country: formData.get("country"),
    organizerClubId: formData.get("organizerClubId"),
    venueAddress: formData.get("venueAddress"),
    description: formData.get("description"),
    registrationDeadline: formData.get("registrationDeadline"),
    isDraft: formData.get("isDraft") === "on",
    isCancelled: formData.get("isCancelled") === "on",
    allowedCountries: formData.getAll("allowedCountries"),
  };
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requirePermission(PERMISSIONS.EVENT_CREATE);
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const supabase = supabaseAdmin();
  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      name: d.name,
      event_type: d.eventType,
      start_date: fromLocalInputValue(d.startDate),
      end_date: fromLocalInputValue(d.endDate),
      venue: d.venue || null,
      venue_address: d.venueAddress || null,
      organizer_club_id: d.organizerClubId,
      country: d.country || null,
      description: d.description || null,
      registration_deadline: fromLocalInputValue(d.registrationDeadline),
      status: storedStatus(d),
      allowed_countries: d.allowedCountries ?? [],
      created_by: session.sub,
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: "Could not create event." };

  revalidatePath("/events");
  redirect(`/events/${inserted.id}`);
}

export async function updateEvent(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  await assertEventEditable(session, eventId);
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("events")
    .update({
      name: d.name,
      event_type: d.eventType,
      start_date: fromLocalInputValue(d.startDate),
      end_date: fromLocalInputValue(d.endDate),
      venue: d.venue || null,
      venue_address: d.venueAddress || null,
      organizer_club_id: d.organizerClubId,
      country: d.country || null,
      description: d.description || null,
      registration_deadline: fromLocalInputValue(d.registrationDeadline),
      status: storedStatus(d),
      allowed_countries: d.allowedCountries ?? [],
    })
    .eq("id", eventId);

  if (error) return { error: "Could not update event." };

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_DELETE);
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  await assertEventEditable(session, eventId);
  const supabase = supabaseAdmin();
  await supabase.from("events").delete().eq("id", eventId);
  revalidatePath("/events");
  redirect("/events");
}

// --- Categories / divisions ---

const categorySchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1, "Category name is required."),
  type: z.enum([
    "pattern",
    "sparring",
    "special_event",
    "power_breaking",
    "pre_arrange",
    "team_pattern",
    "team_sparring",
    "other",
  ]),
  gradeList: z.array(z.string()).optional(),
  genderList: z.array(z.string()).optional(),
  // These fields are only rendered in the DOM for some category types (e.g.
  // weightMin/weightMax only show up for weight-based categories), so
  // formData.get() returns `null` — not `undefined` — when the field is
  // absent. .optional() alone rejects null, so use .nullish() here.
  ageMin: z.string().nullish(),
  ageMax: z.string().nullish(),
  weightMin: z.string().nullish(),
  weightMax: z.string().nullish(),
});

export async function addCategory(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  await assertEventEditable(session, String(formData.get("eventId") || ""));
  const parsed = categorySchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    type: formData.get("type"),
    gupList: formData.getAll("gupList"),
    danList: formData.getAll("danList"),
    genderList: formData.getAll("genderList"),
    ageMin: formData.get("ageMin"),
    ageMax: formData.get("ageMax"),
    weightMin: formData.get("weightMin"),
    weightMax: formData.get("weightMax"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid category.");
  const d = parsed.data;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("event_categories").insert({
    event_id: d.eventId,
    name: d.name,
    type: d.type,
    gup_list: (d.gupList ?? []).map(Number),
    dan_list: (d.danList ?? []).map(Number),
    gender_list: d.genderList ?? [],
    age_min: d.ageMin ? Number(d.ageMin) : null,
    age_max: d.ageMax ? Number(d.ageMax) : null,
    weight_min: d.weightMin ? Number(d.weightMin) : null,
    weight_max: d.weightMax ? Number(d.weightMax) : null,
  });
  if (error) throw new Error("Could not add category. Please check the values and try again.");
  revalidatePath(`/events/${d.eventId}`);
}

export async function deleteCategory(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  await assertEventEditable(session, String(formData.get("eventId") || ""));
  const categoryId = String(formData.get("categoryId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!categoryId) return;
  const supabase = supabaseAdmin();
  await supabase.from("event_categories").delete().eq("id", categoryId);
  revalidatePath(`/events/${eventId}`);
}

// --- Documents ---

export async function addDocument(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  await assertEventEditable(session, String(formData.get("eventId") || ""));
  const eventId = String(formData.get("eventId") || "");
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  if (!eventId || !title || !url) throw new Error("Title and URL are required.");
  const supabase = supabaseAdmin();
  await supabase.from("event_documents").insert({ event_id: eventId, title, url });
  revalidatePath(`/events/${eventId}`);
}

export async function deleteDocument(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  await assertEventEditable(session, String(formData.get("eventId") || ""));
  const documentId = String(formData.get("documentId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!documentId) return;
  const supabase = supabaseAdmin();
  await supabase.from("event_documents").delete().eq("id", documentId);
  revalidatePath(`/events/${eventId}`);
}

// --- Registrations ---

export async function registerStudent(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const eventId = String(formData.get("eventId") || "");
  await assertRegistrationOpen(session, eventId);
  const studentId = String(formData.get("studentId") || "");
  const categoryId = String(formData.get("categoryId") || "") || null;
  if (!eventId || !studentId) return;

  const supabase = supabaseAdmin();
  const { data: student } = await supabase
    .from("students")
    .select("club_id, gup, dan, gender, birthday, weight_kg, nationality, clubs(country)")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) throw new Error("Student not found.");

  if (session.role === "club_admin" && student.club_id !== session.clubId) {
    throw new Error("You can only register students from your own club.");
  }

  // Hard-block registration if the event restricts participation to specific
  // countries and neither the student's club nor their own nationality is
  // one of them.
  const { data: eventRow } = await supabase.from("events").select("allowed_countries").eq("id", eventId).maybeSingle();
  const clubCountry = (student as any).clubs?.country ?? null;
  const countryResult = checkCountryEligibility(clubCountry, student.nationality, eventRow?.allowed_countries);
  if (!countryResult.eligible) {
    throw new Error("This student's club/country isn't eligible to take part in this event.");
  }

  // Hard-block registration if the student doesn't meet the category's
  // Gup/Dan/Age/Gender (or Age/Weight/Gender for Sparring) requirements.
  // The registration form already filters/disables ineligible students,
  // but we re-check here since this action can be called directly.
  if (categoryId) {
    const { data: category } = await supabase
      .from("event_categories")
      .select("type, gup_list, dan_list, gender_list, age_min, age_max, weight_min, weight_max")
      .eq("id", categoryId)
      .maybeSingle();
    if (category) {
      const studentLite: StudentLite = {
        gup: student.gup,
        dan: student.dan,
        gender: student.gender,
        birthday: student.birthday,
        weight_kg: student.weight_kg,
      };
      const result = checkEligibility(studentLite, category as CategoryCriteria);
      if (!result.eligible) {
        throw new Error(`This student doesn't meet the category requirements (${result.reasons.join(", ")}).`);
      }
    }
  }

  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    student_id: studentId,
    category_id: categoryId,
    club_id: student.club_id,
    status: "pending",
  });
  if (error && error.code !== "23505") throw new Error("Could not register student.");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}

export async function unregisterStudent(formData: FormData) {
  const session = await requireSession();
  const registrationId = String(formData.get("registrationId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!registrationId) return;
  await assertRegistrationOpen(session, eventId);

  const supabase = supabaseAdmin();
  const { data: reg } = await supabase.from("event_registrations").select("club_id").eq("id", registrationId).maybeSingle();
  if (!reg) return;

  const canManageAll = session.role === "super_admin" || session.role === "event_manager";
  if (!canManageAll && reg.club_id !== session.clubId) {
    throw new Error("You can only remove your own club's registrations.");
  }

  const wasConfirmed = await supabase
    .from("event_registrations")
    .select("status")
    .eq("id", registrationId)
    .maybeSingle();

  await supabase.from("event_registrations").delete().eq("id", registrationId);
  if (wasConfirmed.data?.status === "confirmed") await renumberEventCompetitors(eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}

// Admin/event-manager approval: moves a registration from "pending" to
// "confirmed". Club Users cannot approve their own club's registrations —
// approval is deliberately restricted to people with EVENT_EDIT rights.
// Approving also (re)assigns competition numbers for the whole event, per
// the age -> gender -> grade ordering in lib/numbering.ts.
export async function approveRegistration(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  await assertRegistrationOpen(session, String(formData.get("eventId") || ""));
  const registrationId = String(formData.get("registrationId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!registrationId) return;

  await supabaseAdmin().from("event_registrations").update({ status: "confirmed" }).eq("id", registrationId);
  await renumberEventCompetitors(eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}
