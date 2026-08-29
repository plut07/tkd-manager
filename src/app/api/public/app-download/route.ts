import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RELEASE_BUCKET } from "@/lib/appReleases";

export const dynamic = "force-dynamic";

/**
 * Hands over the current judge app build.
 *
 * The bucket is private and this asks for a short-lived link, so the storage
 * address never appears on the page and an old link can't be passed around
 * after a build has been withdrawn.
 *
 * Public on purpose: referees turn up with their own phones and no account,
 * and the file is useless without a join code anyway.
 */
export async function GET() {
  const supabase = supabaseAdmin();

  const { data: release } = await supabase
    .from("app_releases")
    .select("storage_path, file_name, version")
    .eq("platform", "android")
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!release) {
    return NextResponse.json({ error: "No build has been published yet." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(RELEASE_BUCKET)
    .createSignedUrl(release.storage_path, 300, { download: release.file_name });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "That build could not be fetched right now." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
