import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { downloadTemplate } from "@/lib/pdfTemplates";

/**
 * Streams the uploaded template so the designer can render it.
 *
 * The bucket is private; this route is the only way in, and it checks the
 * session first rather than handing out a public URL.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const { data: tpl } = await supabaseAdmin()
    .from("event_form_templates")
    .select("storage_path")
    .eq("id", params.id)
    .maybeSingle();
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const bytes = await downloadTemplate(tpl.storage_path);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=60" },
  });
}
