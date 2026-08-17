import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { buildWaiverPdf, type WaiverParticipant } from "@/lib/waiverPdf";
import { downloadTemplate, fillTemplate } from "@/lib/pdfTemplates";
import { type TemplateData } from "@/lib/templateFields";

/**
 * Waiver form as a PDF.
 *
 * ?registrationId=... for one participant, or ?eventId=... for everyone
 * registered, one page each, so an organiser can print the whole set at once.
 */
export async function GET(request: NextRequest) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const registrationId = request.nextUrl.searchParams.get("registrationId");
  const eventIdParam = request.nextUrl.searchParams.get("eventId");
  // Preview opens in the browser; Download saves to the device.
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  if (!registrationId && !eventIdParam) {
    return NextResponse.json({ error: "Pass registrationId or eventId" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const select =
    "id, event_id, waiver_token, clubs(name, instructor_name), students(full_name, birthday, gender, gup, dan, national_id, email, nationality, weight_kg, height_cm), waiver_signatures(signed_name, signature_png, signed_at)";

  let rows: any[] = [];
  let eventId = eventIdParam;

  if (registrationId) {
    const { data } = await supabase.from("event_registrations").select(select).eq("id", registrationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    rows = [data];
    eventId = data.event_id;
  } else {
    const { data } = await supabase.from("event_registrations").select(select).eq("event_id", eventIdParam).order("registered_at");
    rows = data ?? [];
  }

  const { data: event } = await supabase
    .from("events")
    .select("name, venue, venue_address, country, start_date, end_date, clubs:organizer_club_id(name)")
    .eq("id", eventId as string)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const participants: WaiverParticipant[] = rows.map((r) => ({
    fullName: r.students?.full_name ?? null,
    signaturePng: r.waiver_signatures?.signature_png ?? null,
    signedName: r.waiver_signatures?.signed_name ?? null,
    signedAt: r.waiver_signatures?.signed_at ?? null,
    nationalId: r.students?.national_id ?? null,
    birthday: r.students?.birthday ?? null,
    gender: r.students?.gender ?? null,
    clubName: r.clubs?.name ?? null,
    gup: r.students?.gup ?? null,
    dan: r.students?.dan ?? null,
  }));

  // An uploaded template wins over the built-in layout.
  const { data: template } = await supabase
    .from("event_form_templates")
    .select("id, storage_path")
    .eq("event_id", eventId as string)
    .eq("is_default", true)
    .maybeSingle();

  const eventInfo = {
    name: (event as any).name,
    organizer: (event as any).clubs?.name ?? null,
    venue: (event as any).venue ?? null,
    venueAddress: (event as any).venue_address ?? null,
    country: (event as any).country ?? null,
    startDate: (event as any).start_date ?? null,
    endDate: (event as any).end_date ?? null,
  };

  // An uploaded template always wins, even before any boxes have been placed on
  // it — the printed form should look like the form the organiser uploaded. With
  // no boxes it simply prints blank, ready to fill in by hand.
  if (template) {
    const { data: fields } = await supabase
      .from("event_form_fields")
      .select("field_key, page, x, y, width, height, font_size, align")
      .eq("template_id", template.id);

    {
      const bytes = await downloadTemplate(template.storage_path);
      const rowsForTemplate: TemplateData[] = rows.map((r) => ({
        participant: {
          fullName: r.students?.full_name ?? null,
          nationalId: r.students?.national_id ?? null,
              birthday: r.students?.birthday ?? null,
          gender: r.students?.gender ?? null,
          clubName: r.clubs?.name ?? null,
          instructor: r.clubs?.instructor_name ?? null,
          gup: r.students?.gup ?? null,
          dan: r.students?.dan ?? null,
          email: r.students?.email ?? null,
          nationality: r.students?.nationality ?? null,
          weightKg: r.students?.weight_kg ?? null,
          heightCm: r.students?.height_cm ?? null,
          signaturePng: r.waiver_signatures?.signature_png ?? null,
          signedName: r.waiver_signatures?.signed_name ?? null,
          signedAt: r.waiver_signatures?.signed_at ?? null,
        },
        event: eventInfo,
      }));
      const filled = await fillTemplate(bytes, (fields ?? []) as any, rowsForTemplate);
      return new NextResponse(new Uint8Array(filled), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="form.pdf"`, "Cache-Control": "no-store" },
      });
    }
  }

  const pdf = await buildWaiverPdf(
    {
      name: (event as any).name,
      organizer: (event as any).clubs?.name ?? null,
      venue: (event as any).venue ?? null,
      venueAddress: (event as any).venue_address ?? null,
      country: (event as any).country ?? null,
      startDate: (event as any).start_date ?? null,
      endDate: (event as any).end_date ?? null,
    },
    participants,
  );

  const who = registrationId
    ? (participants[0]?.fullName ?? "")
    : "all-participants";
  const filename = `waiver-${(who || "form").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
