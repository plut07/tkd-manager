"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { PHOTO_BUCKET, type PhotoKind } from "@/lib/eventPhotos";

/**
 * Photos on an event's info pack.
 *
 * The bucket is public because these appear on the public event page, so the
 * URL is the picture — there is nothing private to protect behind a route.
 */

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type PhotoState = { ok: true } | { ok: false; error: string } | undefined;

export async function uploadEventPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const caption = String(formData.get("caption") || "").trim();
  const requested = String(formData.get("kind") || "gallery");
  const kind: PhotoKind = requested === "background" || requested === "header" ? requested : "gallery";
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (!eventId) return { ok: false, error: "Missing event." };
  if (files.length === 0) return { ok: false, error: "Choose at least one picture to upload." };

  const supabase = supabaseAdmin();
  const { data: last } = await supabase
    .from("event_photos")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let order = (last?.sort_order ?? 0) + 1;

  for (const file of files) {
    if (file.size > MAX_BYTES) return { ok: false, error: `"${file.name}" is larger than 6 MB.` };
    if (!ALLOWED.includes(file.type)) return { ok: false, error: `"${file.name}" isn't a picture we can use. Try JPG, PNG or WebP.` };

    const path = `${eventId}/${Date.now()}-${order}-${file.name.replace(/[^a-z0-9.\-]+/gi, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploadError) return { ok: false, error: "The picture could not be saved. Please try again." };

    // Only one background and one header per event, so a new one replaces the
    // old rather than leaving the page to choose between them.
    if (kind !== "gallery") {
      const { data: previous } = await supabase
        .from("event_photos")
        .select("id, storage_path")
        .eq("event_id", eventId)
        .eq("kind", kind);
      if ((previous ?? []).length > 0) {
        await supabase.from("event_photos").delete().eq("event_id", eventId).eq("kind", kind);
        const paths = (previous ?? []).map((p: any) => p.storage_path).filter(Boolean);
        if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
      }
    }

    const { error } = await supabase.from("event_photos").insert({
      event_id: eventId,
      storage_path: path,
      caption: caption || null,
      sort_order: order,
      kind,
      uploaded_by: session.sub,
    });
    if (error) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      return { ok: false, error: "The picture could not be recorded. Please try again." };
    }
    order++;
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/public/events/${eventId}`);
  return { ok: true };
}

export async function deleteEventPhoto(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const photoId = String(formData.get("photoId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!photoId) return;

  const supabase = supabaseAdmin();
  const { data: photo } = await supabase.from("event_photos").select("storage_path").eq("id", photoId).maybeSingle();
  await supabase.from("event_photos").delete().eq("id", photoId);
  if (photo?.storage_path) await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/public/events/${eventId}`);
}
