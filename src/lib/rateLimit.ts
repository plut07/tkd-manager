import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Slowing down guesses at a ring's join code.
 *
 * A join code is five characters, and holding one lets its bearer score on a
 * live ring. That is the right trade — a referee turning up with their own
 * phone is not going to be issued an account at the door — but 32^5 is only
 * about 33 million combinations, and until now nothing stopped a script from
 * working through them.
 *
 * Counted in the database rather than in memory on purpose. This deploys to
 * Vercel, where each request may land on a different instance with its own
 * memory, so an in-process counter would be reset by the very traffic it is
 * meant to catch.
 *
 * Only *failures* are counted. A judge with a valid code polls this endpoint
 * throughout a bout and must never be throttled; somebody guessing produces
 * nothing but misses. So in normal use this costs one delete on sign-in and
 * nothing at all thereafter.
 */

/**
 * How many *different* wrong codes an address may try.
 *
 * Distinct codes, not attempts, and that distinction is the whole design. A
 * venue is one address for the whole hall: counting attempts meant a handful of
 * judges fumbling between them could lock out every phone on the wifi, with the
 * limit punishing exactly the people it exists to serve.
 *
 * Enumeration looks nothing like that. Somebody working through the code space
 * tries many different codes; a hall full of judges mistyping tries a few, over
 * and over. So an honest venue can retype as often as it likes and still never
 * approach this, while a script reaches it almost immediately.
 */
const ALLOWED_MISSES = 12;

/** Kept per address so the count is of distinct codes; bounded so a run of
 *  guesses cannot grow the row without limit. */
const MAX_REMEMBERED = 40;

/** How long a run of misses is remembered, and how long a block lasts. */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * The caller's address.
 *
 * Vercel sets x-forwarded-for; the left-most entry is the client, the rest are
 * proxies. Falls back to a single shared bucket rather than to no limit at all
 * — better that an unidentifiable caller shares a quota than escapes one.
 */
export function callerIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}

export type LimitVerdict =
  /**
   * `hadMisses` says whether this address has a run of misses on record, so the
   * caller knows whether clearing it is worth a query. A judge with a good code
   * polls this endpoint every second all day and has nothing to clear — without
   * this, wiping the slate on success would be a write per poll.
   */
  | { allowed: true; hadMisses: boolean }
  | { allowed: false; retryAfterSeconds: number };

/** Whether this address may try a code right now. */
export async function checkJoinCodeAttempts(ip: string): Promise<LimitVerdict> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("join_code_attempts")
    .select("failures, first_failure_at, blocked_until")
    .eq("ip", ip)
    .maybeSingle();
  if (!data) return { allowed: true, hadMisses: false };

  const blockedUntil = data.blocked_until ? new Date(data.blocked_until).getTime() : 0;
  const now = Date.now();
  if (blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }
  return { allowed: true, hadMisses: true };
}

/**
 * Record a wrong code.
 *
 * The run of misses is forgotten once it goes quiet for a window, so somebody
 * who fumbles the code twice a week is never blocked — it takes ten misses
 * inside fifteen minutes.
 */
export async function recordJoinCodeMiss(ip: string, code: string): Promise<void> {
  const supabase = supabaseAdmin();
  const now = Date.now();

  const { data } = await supabase
    .from("join_code_attempts")
    .select("failures, first_failure_at, codes")
    .eq("ip", ip)
    .maybeSingle();

  const startedAt = data?.first_failure_at ? new Date(data.first_failure_at).getTime() : 0;
  const stale = !data || now - startedAt > WINDOW_MS;

  const seen: string[] = stale ? [] : ((data?.codes as string[]) ?? []);
  const tried = String(code ?? "").trim().toUpperCase();
  // The same wrong code again is the same guess again, and tells us nothing new
  // about whether this is a person or a script.
  const codes = seen.includes(tried) ? seen : [...seen, tried].slice(-MAX_REMEMBERED);

  await supabase.from("join_code_attempts").upsert(
    {
      ip,
      // Attempts are still counted, for anybody looking at the row later, but
      // they are not what decides the block.
      failures: stale ? 1 : Number(data?.failures ?? 0) + 1,
      codes,
      first_failure_at: new Date(stale ? now : startedAt).toISOString(),
      blocked_until: codes.length >= ALLOWED_MISSES ? new Date(now + WINDOW_MS).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ip" },
  );
}

/** A code that worked. The address goes back to a clean slate. */
export async function clearJoinCodeMisses(ip: string): Promise<void> {
  await supabaseAdmin().from("join_code_attempts").delete().eq("ip", ip);
}
