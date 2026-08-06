"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const clubSchema = z.object({
  name: z.string().trim().min(2, "Club name is required."),
  city: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  contactPhone: z.string().trim().optional().or(z.literal("")),
});

export async function createClub(formData: FormData) {
  await requireSuperAdmin();
  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    country: formData.get("country"),
    contactEmail: formData.get("contactEmail"),
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
  const { error } = await supabase.from("clubs").delete().eq("id", clubId);
  if (error) throw new Error("Can't delete a club that still has students or users assigned to it.");
  revalidatePath("/clubs");
}
