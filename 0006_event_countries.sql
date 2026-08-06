"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import type { PermissionCode } from "@/lib/permissions";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!username || !password) {
    return { error: "Enter your ID and password." };
  }

  let redirectTo: string | null = null;

  try {
    const supabase = supabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_user_access")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("login lookup failed", error);
      return { error: "Something went wrong. Please try again." };
    }

    if (!user || !user.active) {
      return { error: "Invalid ID or password." };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return { error: "Invalid ID or password." };
    }

    const token = await createSessionToken({
      sub: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      permissions: (user.permissions || []) as PermissionCode[],
      clubId: user.club_id,
    });
    setSessionCookie(token);

    supabase
      .from("app_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.user_id)
      .then(() => {});

    redirectTo = next && next.startsWith("/") ? next : "/dashboard";
  } catch (err) {
    console.error("login failed", err);
    return { error: "Something went wrong. Please try again." };
  }

  if (redirectTo) redirect(redirectTo);
  return undefined;
}
