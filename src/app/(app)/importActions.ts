"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { readSheet } from "@/lib/spreadsheet";
import { validateStudentRows, validateClubRows, type RowError } from "@/lib/importSpecs";

/**
 * Two-phase import. `preview*` parses and validates but writes nothing; the
 * validated rows travel back to the browser in a hidden field and only
 * `commit*` touches the database. Nothing is stored server-side in between, so
 * a half-finished import can't leak into someone else's session.
 */

export type PreviewState =
  | { ok: true; kind: "students" | "clubs"; create: Row[]; update: Row[]; errors: RowError[]; payload: string }
  | { ok: false; error: string }
  | undefined;

type Row = { row: number; label: string; data: unknown; existingId?: string };

const MAX_ROWS = 2000;

async function fileToBuffer(file: File | null): Promise<ArrayBuffer | null> {
  if (!file || file.size === 0) return null;
  return file.arrayBuffer();
}

export async function previewStudentImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  await requirePermission(PERMISSIONS.STUDENT_CREATE);
  const buffer = await fileToBuffer(formData.get("file") as File | null);
  if (!buffer) return { ok: false, error: "Choose a spreadsheet to upload." };

  let parsed;
  try {
    parsed = readSheet(buffer);
  } catch {
    return { ok: false, error: "That file couldn't be read. Save it as .xlsx and try again." };
  }
  if (parsed.rows.length === 0) return { ok: false, error: "The first sheet has no data rows." };
  if (parsed.rows.length > MAX_ROWS) return { ok: false, error: `That file has ${parsed.rows.length} rows; the limit is ${MAX_ROWS} at a time.` };

  const supabase = supabaseAdmin();
  const [{ data: clubs }, { data: students }] = await Promise.all([
    supabase.from("clubs").select("id, name"),
    supabase.from("students").select("id, national_id").not("national_id", "is", null),
  ]);

  const clubsByName = new Map((clubs ?? []).map((c) => [String(c.name).trim().toLowerCase(), c.id]));
  const existing = new Map((students ?? []).map((s) => [String(s.national_id).trim().toLowerCase(), s.id]));

  const outcome = validateStudentRows(parsed.rows, parsed.rowNumbers, clubsByName, existing, null);
  return {
    ok: true,
    kind: "students",
    create: outcome.create,
    update: outcome.update,
    errors: outcome.errors,
    payload: JSON.stringify({ create: outcome.create, update: outcome.update }),
  };
}

export async function previewClubImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  await requirePermission(PERMISSIONS.USER_CREATE);
  const buffer = await fileToBuffer(formData.get("file") as File | null);
  if (!buffer) return { ok: false, error: "Choose a spreadsheet to upload." };

  let parsed;
  try {
    parsed = readSheet(buffer);
  } catch {
    return { ok: false, error: "That file couldn't be read. Save it as .xlsx and try again." };
  }
  if (parsed.rows.length === 0) return { ok: false, error: "The first sheet has no data rows." };
  if (parsed.rows.length > MAX_ROWS) return { ok: false, error: `That file has ${parsed.rows.length} rows; the limit is ${MAX_ROWS} at a time.` };

  const { data: clubs } = await supabaseAdmin().from("clubs").select("id, name");
  const existing = new Map((clubs ?? []).map((c) => [String(c.name).trim().toLowerCase(), c.id]));

  const outcome = validateClubRows(parsed.rows, parsed.rowNumbers, existing);
  return {
    ok: true,
    kind: "clubs",
    create: outcome.create,
    update: outcome.update,
    errors: outcome.errors,
    payload: JSON.stringify({ create: outcome.create, update: outcome.update }),
  };
}

export type CommitState = { ok: true; created: number; updated: number; skipped: number } | { ok: false; error: string } | undefined;

function parsePayload(formData: FormData): { create: Row[]; update: Row[] } | null {
  try {
    const parsed = JSON.parse(String(formData.get("payload") || "{}"));
    return { create: parsed.create ?? [], update: parsed.update ?? [] };
  } catch {
    return null;
  }
}

export async function commitStudentImport(_prev: CommitState, formData: FormData): Promise<CommitState> {
  await requirePermission(PERMISSIONS.STUDENT_CREATE);
  const payload = parsePayload(formData);
  if (!payload) return { ok: false, error: "Something went wrong reading the preview. Please upload the file again." };
  const applyUpdates = formData.get("applyUpdates") === "on";

  const supabase = supabaseAdmin();
  let created = 0;
  let updated = 0;

  if (payload.create.length > 0) {
    const { error } = await supabase.from("students").insert(payload.create.map((r) => r.data));
    if (error) return { ok: false, error: "Could not add the new students. No changes were made." };
    created = payload.create.length;
  }

  if (applyUpdates) {
    for (const row of payload.update) {
      const { error } = await supabase.from("students").update(row.data as Record<string, unknown>).eq("id", row.existingId as string);
      if (!error) updated += 1;
    }
  }

  revalidatePath("/students");
  return { ok: true, created, updated, skipped: applyUpdates ? 0 : payload.update.length };
}

export async function commitClubImport(_prev: CommitState, formData: FormData): Promise<CommitState> {
  await requirePermission(PERMISSIONS.USER_CREATE);
  const payload = parsePayload(formData);
  if (!payload) return { ok: false, error: "Something went wrong reading the preview. Please upload the file again." };
  const applyUpdates = formData.get("applyUpdates") === "on";

  const supabase = supabaseAdmin();
  let created = 0;
  let updated = 0;

  if (payload.create.length > 0) {
    const { error } = await supabase.from("clubs").insert(payload.create.map((r) => r.data));
    if (error) return { ok: false, error: "Could not add the new clubs. No changes were made." };
    created = payload.create.length;
  }

  if (applyUpdates) {
    for (const row of payload.update) {
      const { error } = await supabase.from("clubs").update(row.data as Record<string, unknown>).eq("id", row.existingId as string);
      if (!error) updated += 1;
    }
  }

  revalidatePath("/clubs");
  return { ok: true, created, updated, skipped: applyUpdates ? 0 : payload.update.length };
}
