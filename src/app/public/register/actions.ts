"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public request for a login. Nothing is created here except the request
 * itself — a Super Admin decides whether it becomes an account.
 */

export type RequestState = { ok: true } | { ok: false; error: string } | undefined;

const schema = z.object({
  username: z
    .string().trim().min(3, "User ID must be at least 3 characters.").max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dot, dash and underscore are allowed."),
  fullName: z.string().trim().min(2, "Full name is required.").transform((v) => v.toUpperCase()),
  email: z.string().trim().email("Enter a valid email.").regex(/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/, "Email must include a domain."),
  phone: z.string().trim().optional().or(z.literal("")),
  clubId: z.string().uuid().optional().or(z.literal("")),
  clubNameRaw: z.string().trim().optional().or(z.literal("")),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function submitAccessRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    clubId: formData.get("clubId"),
    clubNameRaw: formData.get("clubNameRaw"),
    message: formData.get("message"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const supabase = supabaseAdmin();

  // Deliberately vague: confirming whether a User ID exists would let anyone
  // probe for valid logins.
  const [{ data: existingUser }, { data: existingRequest }] = await Promise.all([
    supabase.from("app_users").select("id").eq("username", d.username).maybeSingle(),
    supabase.from("access_requests").select("id").eq("username", d.username).eq("status", "pending").maybeSingle(),
  ]);
  if (existingUser || existingRequest) {
    return { ok: false, error: "That User ID isn't available. Please choose another." };
  }

  const { error } = await supabase.from("access_requests").insert({
    username: d.username,
    full_name: d.fullName,
    email: d.email,
    phone: d.phone || null,
    club_id: d.clubId || null,
    club_name_raw: d.clubNameRaw || null,
    message: d.message || null,
    password_hash: await bcrypt.hash(d.password, 10),
  });
  if (error) return { ok: false, error: "Your request could not be submitted. Please try again." };

  return { ok: true };
}
