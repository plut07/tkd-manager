import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildWaiverPdf, type WaiverParticipant } from "@/lib/waiverPdf";
import { downloadTemplate, fillTemplate } from "@/lib/pdfTemplates";
import { type TemplateData } from "@/lib/templateFields";

export const dynamic = "force-dynamic";

/**
 * A public registrant's own completed form.
 *
 * Reached with the token handed back when they submitted, so somebody who has
 * the link gets that one submission and nothing else. It prints on the event's
 * default template when there is one, with their signature in place.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: candidate } = await supabase
    .from("grading_candidates")
    .select("*, clubs:matched_club_id(name, instructor_name)")
    .eq("public_token", token)
    .maybeSingle();
  if (!candidate) return NextResponse.json({ error: "That link isn't valid." }, { status: 404 });

  const { data: event } = await supabase
    .from("events")
    .select("name, venue, venue_address, country, start_date, end_date, clubs:organizer_club_id(name)")
    .eq("id", candidate.event_id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const eventInfo = {
    name: (event as any).name,
    organizer: (event as any).clubs?.name ?? null,
    venue: (event as any).venue ?? null,
    venueAddress: (event as any).venue_address ?? null,
    country: (event as any).country ?? null,
    startDate: (event as any).start_date ?? null,
    endDate: (event as any).end_date ?? null,
  };

  const clubName = (candidate as any).clubs?.name ?? candidate.club_name_raw ?? null;

  const { data: template } = await supabase
    .from("event_form_templates")
    .select("id, storage_path")
    .eq("event_id", candidate.event_id)
    .eq("is_default", true)
    .maybeSingle();

  const filename = `registration-${String(candidate.full_name || "form").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  if (template) {
    const { data: fields } = await supabase
      .from("event_form_fields")
      .select("field_key, page, x, y, width, height, font_size, align")
      .eq("template_id", template.id);

    const bytes = await downloadTemplate(template.storage_path);
    const rows: TemplateData[] = [
      {
        participant: {
          fullName: candidate.full_name,
          nationalId: candidate.national_id,
          birthday: candidate.birthday,
          gender: candidate.gender,
          clubName,
          instructor: (candidate as any).clubs?.instructor_name ?? null,
          gup: candidate.gup,
          dan: candidate.dan,
          email: candidate.email,
          nationality: candidate.nationality,
          weightKg: candidate.weight_kg,
          heightCm: candidate.height_cm,
          signaturePng: candidate.signature_png,
          signedName: candidate.signed_name,
          signedAt: candidate.signed_at,
        },
        event: eventInfo,
      },
    ];
    const filled = await fillTemplate(bytes, (fields ?? []) as any, rows);
    return new NextResponse(new Uint8Array(filled), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const participants: WaiverParticipant[] = [
    {
      fullName: candidate.full_name,
      signaturePng: candidate.signature_png,
      signedName: candidate.signed_name,
      signedAt: candidate.signed_at,
      nationalId: candidate.national_id,
      birthday: candidate.birthday,
      gender: candidate.gender,
      clubName,
      gup: candidate.gup,
      dan: candidate.dan,
    },
  ];
  const pdf = await buildWaiverPdf(eventInfo, participants);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
