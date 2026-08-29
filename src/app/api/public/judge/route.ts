import { NextResponse, type NextRequest } from "next/server";
import { loadRing, judgePress, judgeUndo } from "@/app/(app)/events/scoreboardActions";
import { type Side } from "@/lib/scoreboard";

export const dynamic = "force-dynamic";

/**
 * The judge's phone talks to this.
 *
 * One endpoint, three verbs, because a judge's device only ever does three
 * things: look at the ring, press a button, take the last press back.
 *
 * Authenticated by join code, exactly like the web judge page — and it calls
 * the same functions that page calls, so the app and the browser can never
 * drift apart on what a press means. The code grants nothing but scoring on
 * one ring: it cannot read the draw, the entries, or any other ring.
 */

const CORS = {
  // Expo's web preview runs on a different origin during development. The
  // Android build isn't subject to CORS at all, so this costs nothing and
  // makes `npx expo start --web` work while testing.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** GET /api/public/judge?code=ABCDE — everything the pad needs to draw itself. */
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return reply({ error: "Pass a join code." }, 400);

  const ring = await loadRing({ joinCode: code });
  if (!ring) return reply({ error: "That code doesn't match a ring." }, 404);

  // The join code is deliberately not echoed back, and neither is the ring id:
  // the device already has the code, and nothing else needs an internal id.
  const { joinCode, eventId, ...safe } = ring;
  return reply({ ring: { ...safe, id: ring.id } });
}

/**
 * POST /api/public/judge — press or undo.
 *
 * { action: "press", code, judgeSlot, side, value, kind, clientId, matchId }
 * { action: "undo",  code, judgeSlot }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "That request wasn't readable." }, 400);
  }

  const code = String(body?.code ?? "").trim().toUpperCase();
  const judgeSlot = Number(body?.judgeSlot);
  if (!code) return reply({ error: "Pass a join code." }, 400);
  if (!Number.isInteger(judgeSlot) || judgeSlot < 1) return reply({ error: "Pass a judge number." }, 400);

  if (body?.action === "undo") {
    const result = await judgeUndo({ joinCode: code, judgeSlot });
    if ("error" in result) return reply({ error: result.error }, 400);
    return reply({ ring: strip(result.ring) });
  }

  if (body?.action !== "press") return reply({ error: "Unknown action." }, 400);

  const side = body?.side === "red" || body?.side === "blue" ? (body.side as Side) : null;
  const kind = body?.kind;
  if (!side) return reply({ error: "Side must be red or blue." }, 400);
  if (kind !== "point" && kind !== "deduction" && kind !== "flag") {
    return reply({ error: "Kind must be point, deduction or flag." }, 400);
  }
  const value = Number(body?.value);
  if (!Number.isFinite(value)) return reply({ error: "Value must be a number." }, 400);

  const result = await judgePress({
    joinCode: code,
    judgeSlot,
    side,
    value,
    kind,
    clientId: body?.clientId ? String(body.clientId) : undefined,
    // Only enforced when the device says which bout it meant. A press sent
    // without one is a live press from a device that is looking at the ring
    // right now.
    expectedMatchId: body?.matchId !== undefined ? (body.matchId as string | null) : undefined,
  });

  if ("error" in result) {
    // "stale" tells the app to drop the press rather than keep retrying it:
    // the bout it belonged to is over, and no amount of retrying will help.
    return reply({ error: result.error, stale: result.stale === true }, result.stale ? 409 : 400);
  }
  return reply({ ring: strip(result.ring) });
}

function strip(ring: Awaited<ReturnType<typeof loadRing>>) {
  if (!ring) return null;
  const { joinCode, eventId, ...safe } = ring;
  return { ...safe, id: ring.id };
}
