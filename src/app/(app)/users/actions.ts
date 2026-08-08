"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireSuperAdmin, requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";

export type FormState = { error?: string } | undefined;

const baseUserSchema = {
  username: z
    .string()
    .trim()
    .min(3, "User ID must be at least 3 characters.")
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dot, dash and underscore are allowed."),
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  roleId: z.string().uuid("Choose a role."),
  clubId: z.string().uuid().optional().or(z.literal("")),
  active: z.boolean(),
};

const createSchema = z.object({
  ...baseUserSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const updateSchema = z.object({
  ...baseUserSchema,
  password: z.string().min(8, "Password must be at least 8 characters.").optional().or(z.literal("")),
});

function readForm(formData: FormData) {
  return {
    username: formData.get("username"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    clubId: formData.get("clubId"),
    active: formData.get("active") === "on",
  };
}

async function assertClubRequiredForRole(supabase: ReturnType<typeof supabaseAdmin>, roleId: string, clubId: string) {
  const { data: role } = await supabase.from("roles").select("code").eq("id", roleId).maybeSingle();
  if (role?.code === "club_admin" && !clubId) {
    return "Club Users must be assigned a club.";
  }
  return null;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.USER_CREATE);

  const parsed = createSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { username, password, fullName, email, roleId, clubId, active } = parsed.data;

  const supabase = supabaseAdmin();
  const clubErr = await assertClubRequiredForRole(supabase, roleId, clubId || "");
  if (clubErr) return { error: clubErr };

  const passwordHash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from("app_users").insert({
    username,
    password_hash: passwordHash,
    full_name: fullName,
    email: email || null,
    role_id: roleId,
    club_id: clubId || null,
    active,
  });

  if (error) {
    return { error: error.code === "23505" ? "That User ID is already taken." : "Could not create user." };
  }

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUser(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.USER_EDIT);

  const parsed = updateSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { username, password, fullName, email, roleId, clubId, active } = parsed.data;

  const supabase = supabaseAdmin();
  const clubErr = await assertClubRequiredForRole(supabase, roleId, clubId || "");
  if (clubErr) return { error: clubErr };

  const update: Record<string, unknown> = {
    username,
    full_name: fullName,
    email: email || null,
    role_id: roleId,
    club_id: clubId || null,
    active,
  };
  if (password) update.password_hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("app_users").update(update).eq("id", userId);
  if (error) {
    return { error: error.code === "23505" ? "That User ID is already taken." : "Could not update user." };
  }

  revalidatePath("/users");
  redirect("/users");
}

export async function deleteUser(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.USER_DELETE);
  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  if (userId === session.sub) {
    throw new Error("You can't delete your own account.");
  }

  const supabase = supabaseAdmin();
  const { data: targetRaw } = await supabase
    .from("app_users")
    .select("id, roles!inner(code)")
    .eq("id", userId)
    .maybeSingle();
  const target = targetRaw as unknown as { id: string; roles: { code: string } } | null;

  if (target?.roles?.code === "super_admin") {
    const { count } = await supabase
      .from("app_users")
      .select("id, roles!inner(code)", { count: "exact", head: true })
      .eq("roles.code", "super_admin")
      .eq("active", true);
    if ((count ?? 0) <= 1) {
      throw new Error("Can't delete the last active Super Admin.");
    }
  }

  await supabase.from("app_users").delete().eq("id", userId);
  revalidatePath("/users");
}

export async function togglePermission(formData: FormData) {
  await requireSuperAdmin();
  const roleId = String(formData.get("roleId") || "");
  const permissionId = String(formData.get("permissionId") || "");
  const enabled = formData.get("enabled") === "true";
  if (!roleId || !permissionId) return;

  const supabase = supabaseAdmin();
  if (enabled) {
    await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permissionId);
  } else {
    await supabase.from("role_permissions").insert({ role_id: roleId, permission_id: permissionId });
  }
  revalidatePath("/users/roles");
}
