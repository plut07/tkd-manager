"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase connection, used only for Realtime.
 *
 * Nothing is read or written through it: examiners' pages join a channel and
 * send each other a bare "something changed" ping, then each page asks the
 * server for the new rows through the normal authenticated path. That keeps
 * marks off the public anon key entirely while still updating instantly.
 *
 * Returns null when the public keys aren't configured, and the caller falls
 * back to polling — the page still works, it just refreshes a little slower.
 */

let client: SupabaseClient | null = null;

/**
 * The same browser client, under a name that says what else it is used for.
 *
 * An APK is tens of megabytes and Vercel refuses any request body over 4.5 MB,
 * so a build cannot be uploaded through the server at all. The browser is
 * given a one-time signed link and sends the file straight to storage instead,
 * which needs a client on this side. It carries only the public key and can
 * still read nothing — the link is what grants the single upload.
 */
export function browserClient(): SupabaseClient | null {
  return realtimeClient();
}

export function realtimeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

/** How often to re-check when Realtime isn't available, and as a safety net. */
export const POLL_WITH_REALTIME_MS = 30_000;
export const POLL_WITHOUT_REALTIME_MS = 5_000;
