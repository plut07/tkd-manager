"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SignState = { ok: true } | { ok: false; error: string } | undefined;

// A drawn signature is a small PNG; anything much larger is not a signature.
const MAX_SIGNATURE_CHARS = 400_000;

/**
 * Records a signature against one registration. Reached by token rather than by
 * login, so it verifies the token itself and never trusts an id from the form.
 *
 * A team registration collects one signature per member, so the form also says
 * who is signing. That id *is* trusted only after it has been checked against
 * the team sheet the token belongs to — the token is shared within a team, and
 * without the check one member could sign on behalf of somebody on another.
 */
export async function signWaiver(_prev: SignState, formData: FormData): Promise<SignState> {
  const token = String(formData.get("token") || "");
  const signedName = String(formData.get("signedName") || "").trim();
  const signature = String(formData.get("signature") || "");
  const studentId = String(formData.get("studentId") || "") || null;

  if (!token) return { ok: false, error: "This signing link is not valid." };
  if (signedName.length < 2) return { ok: false, error: "Please type the name of whoever is signing." };
  if (!signature.startsWith("data:image/png;base64,")) return { ok: false, error: "Please draw a signature before submitting." };
  if (signature.length > MAX_SIGNATURE_CHARS) return { ok: false, error: "That signature is too large. Please draw it again." };

  const supabase = supabaseAdmin();
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id, is_team")
    .eq("waiver_token", token)
    .maybeSingle();
  if (!reg) return { ok: false, error: "This signing link is not valid." };

  if ((reg as any).is_team) {
    if (!studentId) return { ok: false, error: "Choose which team member is signing." };
    const { data: member } = await supabase
      .from("event_team_members")
      .select("student_id")
      .eq("registration_id", (reg as any).id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!member) return { ok: false, error: "That person isn't on this team sheet." };
  }

  // Written as look-then-write rather than upsert: the two uniqueness rules are
  // partial indexes (one signature per member on a team, one per individual
  // entry), and ON CONFLICT against a partial index is more trouble than the
  // one extra read is worth.
  const who = (reg as any).is_team ? studentId : null;
  const existing = await supabase
    .from("waiver_signatures")
    .select("id")
    .eq("registration_id", (reg as any).id)
    .filter("student_id", who === null ? "is" : "eq", who as any)
    .maybeSingle();

  const row = {
    registration_id: (reg as any).id,
    student_id: who,
    signed_name: signedName.toUpperCase(),
    signature_png: signature,
    signed_at: new Date().toISOString(),
  };

  const { error } = existing.data
    ? await supabase.from("waiver_signatures").update(row).eq("id", existing.data.id)
    : await supabase.from("waiver_signatures").insert(row);
  if (error) return { ok: false, error: "The signature could not be saved. Please try again." };

  revalidatePath(`/public/waiver/${token}`);
  return { ok: true };
}
