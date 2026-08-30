"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  RELEASE_BUCKET,
  MAX_RELEASE_BYTES,
  safeDownloadUrl,
  fileNameFromUrl,
  type Platform,
} from "@/lib/appReleases";

/**
 * Publishing a build of the judge app.
 *
 * Super Admin only, because this is the one place in the system that hands a
 * file to somebody's phone and asks them to install it. An APK from an
 * untrusted source is a serious thing, so the ability to put one here is not
 * given out with ordinary event permissions.
 *
 * The file never passes through this server. Vercel refuses any request body
 * over 4.5 MB and an APK is far larger than that, so the browser is given a
 * one-time signed link and sends the file straight to storage. These two
 * actions are the beginning and the end of that: permission to upload, then
 * the record of what was uploaded.
 */

/** Step one: check who is asking, and hand back a link good for one upload. */
export async function createUploadTarget(input: {
  fileName: string;
  size: number;
  platform?: Platform;
}): Promise<{ ok: true; path: string; token: string } | { error: string }> {
  try {
    await requireSuperAdmin();
    const platform: Platform = input.platform ?? "android";

    if (!input.fileName) return { error: "Choose the .apk file to upload." };
    if (input.size <= 0) return { error: "That file is empty." };
    if (input.size > MAX_RELEASE_BYTES) {
      return { error: `That file is ${(input.size / 1024 / 1024).toFixed(0)} MB — larger than the 150 MB limit.` };
    }
    // Checked by name rather than by the browser's guess at the type: Windows
    // and Android disagree about what an .apk is, and an empty type would slip
    // through a type check while a renamed file would not.
    if (platform === "android" && !input.fileName.toLowerCase().endsWith(".apk")) {
      return { error: "That doesn't look like an .apk file. Expo's build page gives you one to download." };
    }

    const safeName = input.fileName.replace(/[^a-z0-9.\-_]+/gi, "_");
    const path = `${platform}/${Date.now()}-${safeName}`;

    const { data, error } = await supabaseAdmin().storage.from(RELEASE_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return { error: `Storage wouldn't accept an upload: ${error?.message ?? "no link given"}` };

    return { ok: true, path, token: data.token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That upload couldn't be started." };
  }
}

/** Step two: the file is in storage — write down what it is. */
export async function recordRelease(input: {
  path: string;
  fileName: string;
  size: number;
  version: string;
  notes?: string;
  platform?: Platform;
}): Promise<{ ok: true; message: string } | { error: string }> {
  try {
    const session = await requireSuperAdmin();
    const platform: Platform = input.platform ?? "android";
    const version = input.version.trim();
    if (!version) return { error: "Give this build a version, so judges can tell one from another." };

    const supabase = supabaseAdmin();

    // The row is only written for a file that actually arrived. A browser that
    // died mid-upload would otherwise leave a release pointing at nothing, and
    // the download page would offer judges a broken link.
    const { data: found, error: listError } = await supabase.storage
      .from(RELEASE_BUCKET)
      .list(platform, { search: input.path.split("/").pop() });
    if (listError) return { error: `The upload couldn't be confirmed: ${listError.message}` };
    if (!found || found.length === 0) {
      return { error: "The file didn't finish uploading. Try again — nothing was published." };
    }

    // Only one build is offered at a time. The older rows stay, so a build
    // that turns out to be broken can be put back with one click.
    await supabase.from("app_releases").update({ is_current: false }).eq("platform", platform);

    const { error } = await supabase.from("app_releases").insert({
      platform,
      version,
      notes: input.notes?.trim() || null,
      storage_path: input.path,
      file_name: input.fileName.replace(/[^a-z0-9.\-_]+/gi, "_"),
      file_size: input.size,
      is_current: true,
      uploaded_by: session.sub,
    });
    if (error) {
      await supabase.storage.from(RELEASE_BUCKET).remove([input.path]);
      return { error: `The release could not be saved: ${error.message}` };
    }

    revalidatePath("/app-releases");
    revalidatePath("/public/app");
    return { ok: true, message: `Version ${version} is now the download judges are offered.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That release couldn't be saved." };
  }
}

/**
 * Publish a build that lives somewhere else.
 *
 * The other route needs two things this deployment may not have: the public
 * Supabase keys, without which the browser cannot upload at all, and room in
 * storage, which on the free plan stops at 50 MB per file — smaller than the
 * APK. A GitHub Release has neither problem and a permanent address, so this
 * records the link and nothing is copied anywhere.
 *
 * Nothing is fetched here to check the link. A build page behind a redirect or
 * a slow host would make publishing fail for a reason that has nothing to do
 * with whether the link is right, and the address is shown on the page for the
 * admin to try themselves.
 */
export async function recordLinkedRelease(input: {
  url: string;
  version: string;
  notes?: string;
  platform?: Platform;
}): Promise<{ ok: true; message: string } | { error: string }> {
  try {
    const session = await requireSuperAdmin();
    const platform: Platform = input.platform ?? "android";

    const version = input.version.trim();
    if (!version) return { error: "Give this build a version, so judges can tell one from another." };

    const url = safeDownloadUrl(input.url);
    if (!url) {
      return {
        error:
          "That doesn't look like a download address. It has to start with https:// — an http link could be swapped " +
          "for a different file on the way to somebody's phone.",
      };
    }
    if (platform === "android" && !url.toLowerCase().includes(".apk")) {
      return {
        error:
          "That address doesn't end in .apk. Use the link to the file itself, not the page it sits on — on GitHub, " +
          "right-click the .apk under a release's Assets and copy the link address.",
      };
    }

    const supabase = supabaseAdmin();
    await supabase.from("app_releases").update({ is_current: false }).eq("platform", platform);

    const { error } = await supabase.from("app_releases").insert({
      platform,
      version,
      notes: input.notes?.trim() || null,
      download_url: url,
      storage_path: null,
      file_name: fileNameFromUrl(url),
      file_size: 0,
      is_current: true,
      uploaded_by: session.sub,
    });
    if (error) return { error: `The release could not be saved: ${error.message}` };

    revalidatePath("/app-releases");
    revalidatePath("/public/app");
    return { ok: true, message: `Version ${version} is now the download judges are offered.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That release couldn't be saved." };
  }
}

/** Put an earlier build back in front of people. */
export async function makeCurrent(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("releaseId") || "");
  const platform = String(formData.get("platform") || "android");
  if (!id) return;

  const supabase = supabaseAdmin();
  await supabase.from("app_releases").update({ is_current: false }).eq("platform", platform);
  await supabase.from("app_releases").update({ is_current: true }).eq("id", id);

  revalidatePath("/app-releases");
  revalidatePath("/public/app");
}

/** Remove a build and its file. */
export async function deleteRelease(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("releaseId") || "");
  if (!id) return;

  const supabase = supabaseAdmin();
  const { data: release } = await supabase.from("app_releases").select("storage_path").eq("id", id).maybeSingle();
  await supabase.from("app_releases").delete().eq("id", id);
  // A linked release has no file of ours to remove, and the file it points at
  // is somebody else's to delete.
  if (release?.storage_path) await supabase.storage.from(RELEASE_BUCKET).remove([release.storage_path]);

  revalidatePath("/app-releases");
  revalidatePath("/public/app");
}
