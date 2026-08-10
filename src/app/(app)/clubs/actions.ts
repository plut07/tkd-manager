"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const clubSchema = z.object({
  name: z.string().trim().min(2, "Club name is required."),
  city: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  instructorName: z.string().trim().optional().or(z.literal("")),
  // Belt and braces: zod's email check plus an explicit domain rule, so
  // "a@b" (which some validators accept) is rejected.
  contactEmail: z.string().trim().email("Enter a valid email.").regex(/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/, "Email must include a domain, e.g. name@example.com").optional().or(z.literal("")),
  contactPhone: z.string().trim().optional().or(z.literal("")),
});

export async function createClub(formData: FormData) {
  await requireSuperAdmin();
  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    country: formData.get("country"),
    instructorName: formData.get("instructorName"), contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid club.");
  const d = parsed.data;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("clubs").insert({
    name: d.name,
    city: d.city || null,
    country: d.country || null,
    contact_email: d.contactEmail || null,
    contact_phone: d.contactPhone || null,
  });
  if (error) throw new Error(error.code === "23505" ? "A club with that name already exists." : "Could not create club.");
  revalidatePath("/clubs");
}

export async function updateClub(formData: FormData) {
  await requireSuperAdmin();
  const clubId = String(formData.get("clubId") || "");
  if (!clubId) return;
  const parsed = clubSchema.safeParse({
    name: formData.get("name"), city: formData.get("city"), country: formData.get("country"),
    instructorName: formData.get("instructorName"),
    contactEmail: formData.get("contactEmail"), contactPhone: formData.get("contactPhone"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid club.");
  const d = parsed.data;
  const { error } = await supabaseAdmin().from("clubs").update({
    name: d.name, instructor_name: d.instructorName || null, city: d.city || null,
    country: d.country || null, contact_email: d.contactEmail || null, contact_phone: d.contactPhone || null,
  }).eq("id", clubId);
  if (error) throw new Error(error.code === "23505" ? "A club with that name already exists." : "Could not update club.");
  revalidatePath("/clubs");
}

export async function toggleClubActive(formData: FormData) {
  await requireSuperAdmin();
  const clubId = String(formData.get("clubId") || "");
  const active = formData.get("active") === "true";
  if (!clubId) return;
  const supabase = supabaseAdmin();
  await supabase.from("clubs").update({ active: !active }).eq("id", clubId);
  revalidatePath("/clubs");
}

export async function deleteClub(formData: FormData) {
  await requireSuperAdmin();
  const clubId = String(formData.get("clubId") || "");
  if (!clubId) return;
  const supabase = supabaseAdmin();

  // Everything that would be orphaned, checked up front so the message can say
  // exactly what is in the way rather than "could not delete".
  const [{ count: students }, { count: users }, { data: organized }, { data: entries }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    supabase.from("app_users").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    supabase.from("events").select("name").eq("organizer_club_id", clubId),
    supabase.from("event_registrations").select("events(name)").eq("club_id", clubId),
  ]);

  const blockers: string[] = [];
  if ((students ?? 0) > 0) blockers.push(`${students} student${students === 1 ? "" : "s"}`);
  if ((users ?? 0) > 0) blockers.push(`${users} user account${users === 1 ? "" : "s"}`);
  if ((organized ?? []).length > 0) {
    blockers.push(`organizer of: ${(organized ?? []).map((e: any) => e.name).join(", ")}`);
  }
  const entryEvents = Array.from(new Set((entries ?? []).map((r: any) => r.events?.name).filter(Boolean)));
  if (entryEvents.length > 0) blockers.push(`entries in: ${entryEvents.join(", ")}`);

  if (blockers.length > 0) {
    throw new Error(
      `This club can't be deleted — ${blockers.join("; ")}. ` +
        "Move or remove those first, or mark the club Inactive instead.",
    );
  }

  const { error } = await supabase.from("clubs").delete().eq("id", clubId);
  if (error) throw new Error("This club could not be deleted because other records still refer to it.");
  revalidatePath("/clubs");
}

