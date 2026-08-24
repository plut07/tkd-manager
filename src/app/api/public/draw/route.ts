import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { buildDrawPdf, type DrawCompetitor, type DrawMatch } from "@/lib/drawPdf";
import { formatEventRange } from "@/lib/eventStatus";

export const dynamic = "force-dynamic";

/**
 * The draw chart as a PDF.
 *
 * ?categoryId=... — one category's bracket, headed with the category name.
 *
 * A published draw is public, because it is pinned on a wall at the venue and
 * handed to coaches; an unpublished one is still being adjusted, so it needs a
 * login. That is the only access rule here.
 */
export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("categoryId");
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  if (!categoryId) return NextResponse.json({ error: "Pass categoryId" }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: category } = await supabase
    .from("event_categories")
    .select("id, name, event_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const { data: bracket } = await supabase
    .from("event_category_brackets")
    .select("status")
    .eq("event_category_id", category.id)
    .maybeSingle();

  if (bracket?.status !== "published") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "This draw hasn't been published yet." }, { status: 404 });
    }
  }

  const { data: event } = await supabase
    .from("events")
    .select("name, start_date, end_date")
    .eq("id", category.event_id)
    .maybeSingle();

  const { data: matches } = await supabase
    .from("event_matches")
    .select("id, round, slot, competitor1_registration_id, competitor2_registration_id, competitor1_points, competitor2_points, winner_registration_id")
    .eq("category_id", category.id)
    .order("slot");

  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: "No draw has been generated for this category yet." }, { status: 400 });
  }

  const regIds = Array.from(
    new Set(
      matches
        .flatMap((m: any) => [m.competitor1_registration_id, m.competitor2_registration_id])
        .filter(Boolean) as string[],
    ),
  );

  const byReg = new Map<string, DrawCompetitor>();
  if (regIds.length > 0) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, competition_number, students(full_name), clubs(name)")
      .in("id", regIds);
    for (const r of (regs ?? []) as any[]) {
      byReg.set(r.id, {
        name: r.students?.full_name ?? "",
        club: r.clubs?.name ?? null,
        number: r.competition_number != null ? String(r.competition_number) : null,
      });
    }
  }

  const bytes = await buildDrawPdf({
    categoryName: category.name,
    eventName: (event as any)?.name ?? "",
    eventDates: event ? formatEventRange((event as any).start_date, (event as any).end_date) : null,
    matches: matches as DrawMatch[],
    competitorOf: (id) => (id ? byReg.get(id) ?? null : null),
  });

  const filename = `draw-${category.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
