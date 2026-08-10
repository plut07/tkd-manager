"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SignState = { ok: true } | { ok: false; error: string } | undefined;

// A drawn signature is a small PNG; anything much larger is not a signature.
const MAX_SIGNATURE_CHARS = 400_000;

/**
 * Records a signature against one registration. Reached by token rather than by
 * login, so it verifies the token itself and never trusts an id from the form.
 */
export async function signWaiver(_prev: SignState, formData: FormData): Promise<SignState> {
  const token = String(formData.get("token") || "");
  const signedName = String(formData.get("signedName") || "").trim();
  const signature = String(formData.get("signature") || "");

  if (!token) return { ok: false, error: "This signing link is not valid." };
  if (signedName.length < 2) return { ok: false, error: "Please type the name of whoever is signing." };
  if (!signature.startsWith("data:image/png;base64,")) return { ok: false, error: "Please draw a signature before submitting." };
  if (signature.length > MAX_SIGNATURE_CHARS) return { ok: false, error: "That signature is too large. Please draw it again." };

  const supabase = supabaseAdmin();
  const { data: reg } = await supabase.from("event_registrations").select("id").eq("waiver_token", token).maybeSingle();
  if (!reg) return { ok: false, error: "This signing link is not valid." };

  const { error } = await supabase
    .from("waiver_signatures")
    .upsert({ registration_id: reg.id, signed_name: signedName.toUpperCase(), signature_png: signature }, { onConflict: "registration_id" });
  if (error) return { ok: false, error: "The signature could not be saved. Please try again." };

  revalidatePath(`/public/waiver/${token}`);
  return { ok: true };
}
