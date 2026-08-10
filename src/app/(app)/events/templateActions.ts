"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { inspectPdf, TEMPLATE_BUCKET } from "@/lib/pdfTemplates";

export type TemplateState = { ok: true; templateId: string } | { ok: false; error: string } | undefined;

const MAX_BYTES = 8 * 1024 * 1024;

/** Upload a PDF form for this event and record its page size. */
export async function uploadTemplate(_prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const file = formData.get("file") as File | null;
  if (!eventId) return { ok: false, error: "Missing event." };
  if (!file || file.size === 0) return { ok: false, error: "Choose a PDF to upload." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than 8 MB." };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { ok: false, error: "The template must be a PDF." };

  const bytes = await file.arrayBuffer();
  let info;
  try {
    info = await inspectPdf(bytes);
  } catch {
    return { ok: false, error: "That PDF couldn't be read. If it's password-protected, remove the protection first." };
  }

  const supabase = supabaseAdmin();
  const path = `${eventId}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-]+/gi, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { ok: false, error: "The file could not be saved. Please try again." };

  // One active template per event keeps the print button unambiguous.
  await supabase.from("event_form_templates").update({ is_default: false }).eq("event_id", eventId);

  const { data, error } = await supabase
    .from("event_form_templates")
    .insert({
      event_id: eventId,
      name: file.name.replace(/\.pdf$/i, ""),
      storage_path: path,
      page_count: info.pageCount,
      page_width: info.width,
      page_height: info.height,
      is_default: true,
      created_by: session.sub,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from(TEMPLATE_BUCKET).remove([path]);
    return { ok: false, error: "The template could not be recorded. Please try again." };
  }

  revalidatePath(`/events/${eventId}`);
  return { ok: true, templateId: data.id };
}

/** Replace a template's field boxes with the ones drawn in the designer. */
export async function saveTemplateFields(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const templateId = String(formData.get("templateId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!templateId) return;

  let fields: any[] = [];
  try {
    fields = JSON.parse(String(formData.get("fields") || "[]"));
  } catch {
    throw new Error("The field layout could not be read. Please try saving again.");
  }

  const clean = fields
    .filter((f) => f && typeof f.field_key === "string")
    .map((f) => ({
      template_id: templateId,
      field_key: String(f.field_key),
      page: Math.max(1, Number(f.page) || 1),
      x: clamp(f.x), y: clamp(f.y),
      width: clamp(f.width, 0.01), height: clamp(f.height, 0.005),
      font_size: Math.min(Math.max(Number(f.font_size) || 11, 5), 48),
      align: ["left", "center", "right"].includes(f.align) ? f.align : "left",
    }));

  const supabase = supabaseAdmin();
  await supabase.from("event_form_fields").delete().eq("template_id", templateId);
  if (clean.length > 0) {
    const { error } = await supabase.from("event_form_fields").insert(clean);
    if (error) throw new Error("The field layout could not be saved.");
  }
  revalidatePath(`/events/${eventId}`);
}

function clamp(value: unknown, min = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), 1);
}

export async function deleteTemplate(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const templateId = String(formData.get("templateId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!templateId) return;
  const supabase = supabaseAdmin();
  const { data: tpl } = await supabase.from("event_form_templates").select("storage_path").eq("id", templateId).maybeSingle();
  await supabase.from("event_form_templates").delete().eq("id", templateId);
  if (tpl?.storage_path) await supabase.storage.from(TEMPLATE_BUCKET).remove([tpl.storage_path]);
  revalidatePath(`/events/${eventId}`);
}
