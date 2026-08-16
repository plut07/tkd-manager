"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseGradeValue } from "@/lib/belts";
import { gradingCategoryIdFor } from "@/lib/gradingCategory";
import { isRegistrationOpen } from "@/lib/eventStatus";

/**
 * Registering for a grading without an account.
 *
 * The submission is staged as a candidate for approval rather than becoming a
 * student outright — the same queue the Tally form feeds — so nobody can add
 * themselves to the federation's records unreviewed.
 *
 * The token returned is what lets them fetch their own completed form
 * afterwards, and nothing else.
 */

export type PublicRegisterState =
  | { ok: true; token: string }
  | { ok: false; error: string; values?: Record<string, string> }
  | undefined;

const MAX_SIGNATURE_CHARS = 400_000;

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120).transform((v) => v.toUpperCase()),
  nationalId: z.string().trim().min(3, "Enter your NRIC or passport number.").max(40),
  birthday: z.string().trim().min(1, "Enter your date of birth."),
  gender: z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Choose a gender." }) }),
  grade: z.string().trim().min(1, "Choose your current grade."),
  clubId: z.string().trim().optional().default(""),
  clubNameRaw: z.string().trim().max(120).optional().default(""),
  nationality: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email("That email address doesn't look right.").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().default(""),
  weightKg: z.string().trim().optional().default(""),
  heightCm: z.string().trim().optional().default(""),
});

function numberOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function submitPublicGradingRegistration(
  _prev: PublicRegisterState,
  formData: FormData,
): Promise<PublicRegisterState> {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return { ok: false, error: "Missing event." };

  const signature = String(formData.get("signature") || "");
  const raw = Object.fromEntries(
    ["fullName", "nationalId", "birthday", "gender", "grade", "clubId", "clubNameRaw", "nationality", "email", "phone", "weightKg", "heightCm"]
      .map((k) => [k, String(formData.get(k) ?? "")]),
  ) as Record<string, string>;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form.", values: raw };
  }
  const input = parsed.data;

  if (!signature.startsWith("data:image/png;base64,")) {
    return { ok: false, error: "Please sign in the box before submitting.", values: raw };
  }
  if (signature.length > MAX_SIGNATURE_CHARS) {
    return { ok: false, error: "That signature is too large. Please clear it and sign again.", values: raw };
  }

  const supabase = supabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id, event_type, status, start_date, end_date, registration_deadline")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.event_type !== "grading") return { ok: false, error: "This event isn't open for public registration.", values: raw };
  if (!isRegistrationOpen(event as any)) return { ok: false, error: "Registration for this grading has closed.", values: raw };

  const { gup, dan } = parseGradeValue(input.grade);
  if (gup == null && dan == null) return { ok: false, error: "Choose your current grade.", values: raw };

  // Resolve the club by id when picked from the list, and keep whatever was
  // typed either way so an organiser can see what they meant.
  let clubId: string | null = null;
  let clubName = input.clubNameRaw;
  if (input.clubId) {
    const { data: club } = await supabase.from("clubs").select("id, name").eq("id", input.clubId).maybeSingle();
    if (club) {
      clubId = club.id;
      clubName = club.name;
    }
  }

  // Each public submission is its own batch, so the import history reads the
  // same whether an entry came from Tally, a spreadsheet, or this form.
  const { data: batch, error: batchError } = await supabase
    .from("grading_import_batches")
    .insert({ event_id: eventId, imported_by: null, row_count: 1, matched_count: 0, new_count: 1 })
    .select("id")
    .single();
  if (batchError || !batch) return { ok: false, error: "Your registration could not be saved. Please try again.", values: raw };

  const { data: candidate, error } = await supabase
    .from("grading_candidates")
    .insert({
      batch_id: batch.id,
      event_id: eventId,
      full_name: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      birthday: input.birthday || null,
      gender: input.gender,
      weight_kg: numberOrNull(input.weightKg),
      height_cm: numberOrNull(input.heightCm),
      gup,
      dan,
      nationality: input.nationality || null,
      national_id: input.nationalId,
      club_name_raw: clubName || null,
      matched_club_id: clubId,
      signature_png: signature,
      signed_name: input.fullName,
      signed_at: new Date().toISOString(),
      status: "pending",
      review_note: "Registered through the public form.",
    })
    .select("public_token")
    .single();

  if (error || !candidate) return { ok: false, error: "Your registration could not be saved. Please try again.", values: raw };

  // Create the category now so organisers see what they're grading for, but
  // never at the cost of losing the registration.
  try {
    await gradingCategoryIdFor(supabase, eventId, gup, dan);
  } catch {
    // An organiser can set it by hand; the entry matters more.
  }

  return { ok: true, token: candidate.public_token as string };
}
