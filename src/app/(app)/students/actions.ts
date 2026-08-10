"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { parseGradeValue } from "@/lib/belts";

export type FormState = { error?: string } | undefined;

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), {
      message: `Must be between ${min} and ${max}.`,
    });

const studentSchema = z.object({
  clubId: z.string().uuid("Choose a club."),
  // Names are stored in capitals so lists and exports read consistently.
  firstName: z.string().trim().min(1, "First name is required.").transform((v) => v.toUpperCase()),
  lastName: z.string().trim().min(1, "Last name is required.").transform((v) => v.toUpperCase()),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  birthday: z.string().optional().or(z.literal("")),
  weightKg: optionalNumber(1, 300),
  heightCm: optionalNumber(50, 260),
  grade: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  nationality: z.string().trim().optional().or(z.literal("")),
  nationalId: z.string().trim().optional().or(z.literal("")),
  passportId: z.string().trim().optional().or(z.literal("")),
  active: z.boolean(),
});

function readForm(formData: FormData) {
  return {
    clubId: formData.get("clubId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    birthday: formData.get("birthday"),
    weightKg: formData.get("weightKg"),
    heightCm: formData.get("heightCm"),
    grade: formData.get("grade"),
    gender: formData.get("gender"),
    nationality: formData.get("nationality"),
    nationalId: formData.get("nationalId"),
    passportId: formData.get("passportId"),
    active: formData.get("active") === "on",
  };
}

function toRow(data: z.infer<typeof studentSchema>, clubIdOverride: string | null) {
  return {
    club_id: clubIdOverride ?? data.clubId,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email || null,
    birthday: data.birthday || null,
    weight_kg: data.weightKg,
    height_cm: data.heightCm,
    ...parseGradeValue(data.grade),
    gender: data.gender || null,
    nationality: data.nationality || null,
    national_id: data.nationalId || null,
    passport_id: data.passportId || null,
    active: data.active,
  };
}

export async function createStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requirePermission(PERMISSIONS.STUDENT_CREATE);
  const parsed = studentSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // Club Users can only ever create students in their own club, regardless
  // of what the form says.
  const clubOverride = session.role === "club_admin" ? session.clubId : null;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("students").insert(toRow(parsed.data, clubOverride));
  if (error) return { error: "Could not create student." };

  revalidatePath("/students");
  redirect("/students");
}

export async function updateStudent(studentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requirePermission(PERMISSIONS.STUDENT_EDIT);
  const parsed = studentSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = supabaseAdmin();

  if (session.role === "club_admin") {
    const { data: existing } = await supabase.from("students").select("club_id").eq("id", studentId).maybeSingle();
    if (!existing || existing.club_id !== session.clubId) {
      throw new Error("You can only edit students from your own club.");
    }
  }

  const clubOverride = session.role === "club_admin" ? session.clubId : null;
  const { error } = await supabase.from("students").update(toRow(parsed.data, clubOverride)).eq("id", studentId);
  if (error) return { error: "Could not update student." };

  revalidatePath("/students");
  redirect("/students");
}

export async function deleteStudent(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.STUDENT_DELETE);
  const studentId = String(formData.get("studentId") || "");
  if (!studentId) return;

  const supabase = supabaseAdmin();

  if (session.role === "club_admin") {
    const { data: existing } = await supabase.from("students").select("club_id").eq("id", studentId).maybeSingle();
    if (!existing || existing.club_id !== session.clubId) {
      throw new Error("You can only delete students from your own club.");
    }
  }

  await supabase.from("students").delete().eq("id", studentId);
  revalidatePath("/students");
}
