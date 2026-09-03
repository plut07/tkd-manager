import { NextResponse } from "next/server";

/**
 * The handshake that lets the Android app be this website.
 *
 * The judge app is a Trusted Web Activity: the same pages this site already
 * serves, wrapped in an Android app. Android will only drop the browser
 * chrome -- the address bar, the "you are on a website" banner -- if the site
 * vouches for the app that is showing it, and this file is how it vouches. Get
 * it wrong and the app still works but looks like a browser with a URL bar
 * across the top of the scoring buttons, which is the whole reason for
 * building it.
 *
 * The fingerprint comes from the signing key, which is yours and must stay
 * yours: an app signed with it *is* this app as far as every phone is
 * concerned. So it is read from the environment rather than committed --
 * not because the fingerprint is a secret (it isn't, it's published right
 * here) but because whoever holds the key should be the one who puts it in.
 *
 * See "The Android app" in the README for how to generate it.
 */

export const dynamic = "force-dynamic";

/** The package the APK is built under. Must match twa-manifest.json. */
const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || "org.tkdmanager.judge";

export async function GET() {
  const fingerprint = (process.env.ANDROID_CERT_FINGERPRINT || "").trim();

  // An empty list is a valid answer meaning "I vouch for nobody", which is the
  // truthful thing to say before a key exists. Android reads it, finds no
  // match, and shows the address bar -- which is the correct outcome, not a
  // broken one.
  const statements = fingerprint
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: PACKAGE_NAME,
            sha256_cert_fingerprints: fingerprint.split(",").map((f) => f.trim()).filter(Boolean),
          },
        },
      ]
    : [];

  return NextResponse.json(statements, {
    headers: {
      "Content-Type": "application/json",
      // Android caches this. An hour is short enough that a corrected
      // fingerprint reaches phones the same afternoon, and long enough that it
      // isn't fetched on every launch.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
