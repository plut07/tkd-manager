import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/**
 * A QR code, as an image.
 *
 * Its own endpoint rather than drawn into the page, deliberately: if the
 * generator ever fails, an image that doesn't load is a gap on the page, while
 * the same failure inside a server component would take the whole page with
 * it. The address is always printed as text beside it, so a phone that won't
 * scan is never a dead end.
 *
 * Only addresses on this site are encoded. A QR is unreadable to a person, so
 * an endpoint that would encode anything is a way to put an unexpected link on
 * a page that people trust.
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url") ?? "";
  const size = Math.min(Math.max(Number(request.nextUrl.searchParams.get("size")) || 320, 120), 1000);

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Pass a full address to encode." }, { status: 400 });
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || parsed.host !== host) {
    return NextResponse.json({ error: "Only addresses on this site can be encoded." }, { status: 400 });
  }

  try {
    const svg = await QRCode.toString(parsed.toString(), {
      type: "svg",
      // Medium correction: a printed sheet in a sports hall picks up creases
      // and thumbprints, and the extra redundancy costs a slightly denser code.
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#111111", light: "#ffffff" },
    });

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "That code could not be drawn." },
      { status: 500 },
    );
  }
}
