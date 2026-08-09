import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildWorkbook, xlsxHeaders } from "@/lib/spreadsheet";
import { CLUB_COLUMNS } from "@/lib/importSpecs";

export async function GET() {
  await requireSuperAdmin();
  const { data } = await supabaseAdmin().from("clubs").select("name, city, country, contact_email, contact_phone").order("name");
  const rows = (data ?? []).map((c) => [c.name ?? "", c.city ?? "", c.country ?? "", c.contact_email ?? "", c.contact_phone ?? ""]);
  const file = buildWorkbook(CLUB_COLUMNS.map((c) => c.header), rows, "Clubs");
  return new NextResponse(new Uint8Array(file), { headers: xlsxHeaders(`clubs-${new Date().toISOString().slice(0, 10)}.xlsx`) });
}
