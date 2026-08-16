import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { downloadTemplate, fillTemplate } from "@/lib/pdfTemplates";
import { SAMPLE_DATA } from "@/lib/templateFields";

export const dynamic = "force-dynamic";

/**
 * A test print of one template, filled with sample details.
 *
 * The point is to check placement without registering somebody first: print
 * this, hold it against the paper form, and adjust if anything sits wrong.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const supabase = supabaseAdmin();

  const { data: template } = await supabase
    .from("event_form_templates")
    .select("storage_path, offset_x, offset_y, scale")
    .eq("id", params.id)
    .maybeSingle();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data: fields } = await supabase
    .from("event_form_fields")
    .select("field_key, page, x, y, width, height, font_size, align")
    .eq("template_id", params.id);

  const bytes = await downloadTemplate(template.storage_path);
  const filled = await fillTemplate(bytes, (fields ?? []) as any, [SAMPLE_DATA], {
    offsetX: Number(template.offset_x) || 0,
    offsetY: Number(template.offset_y) || 0,
    scale: Number(template.scale) || 1,
  });

  return new NextResponse(new Uint8Array(filled), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="template-test-print.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
