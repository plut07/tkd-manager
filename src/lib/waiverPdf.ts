import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { gradeLabel } from "./belts";
import { formatEventDateTime, formatEventRange } from "./eventStatus";
import { waiverAge } from "./eligibility";

/**
 * Participation waiver / release of liability, one page per participant.
 *
 * Modelled on the federation's printed form. Fields we hold are filled in;
 * the rest (address, school, instructor, lunch choice, signature) stay blank
 * because they're completed by hand on the day.
 */

export type WaiverParticipant = {
  firstName: string | null;
  lastName: string | null;
  passportId: string | null;
  nationalId: string | null;
  birthday: string | null;
  gender: string | null;
  clubName: string | null;
  gup: number | null;
  dan: number | null;
};

export type WaiverEvent = {
  name: string;
  organizer: string | null;
  venue: string | null;
  venueAddress: string | null;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.07, 0.09, 0.15);
const LINE = rgb(0.45, 0.48, 0.55);


function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out, size) > maxWidth) out = out.slice(0, -1);
  return out === text ? text : `${out.slice(0, -1)}…`;
}

/** Word-wraps a paragraph, returning the y position after the last line. */
function drawParagraph(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, leading: number): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursor, size, font, color: INK });
      cursor -= leading;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursor, size, font, color: INK });
    cursor -= leading;
  }
  return cursor;
}

export async function buildWaiverPdf(event: WaiverEvent, participants: WaiverParticipant[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const list = participants.length > 0 ? participants : [null];
  for (const participant of list) {
    drawWaiverPage(pdf.addPage(A4), event, participant, font, bold);
  }
  return pdf.save();
}

function drawWaiverPage(page: PDFPage, event: WaiverEvent, p: WaiverParticipant | null, font: PDFFont, bold: PDFFont) {
  const width = A4[0];
  const right = width - MARGIN;
  const contentWidth = right - MARGIN;
  let y = A4[1] - MARGIN;

  // ---- heading
  if (event.organizer) {
    const label = `By ${event.organizer}`;
    page.drawText(label, { x: (width - font.widthOfTextAtSize(label, 10)) / 2, y, size: 10, font, color: INK });
  }
  y -= 26;
  const title = event.name.toUpperCase();
  const titleSize = font.widthOfTextAtSize(title, 20) > contentWidth ? 15 : 20;
  page.drawText(fitText(title, bold, titleSize, contentWidth), {
    x: (width - bold.widthOfTextAtSize(fitText(title, bold, titleSize, contentWidth), titleSize)) / 2,
    y, size: titleSize, font: bold, color: INK,
  });
  y -= 20;
  const subtitle = "Participation Waiver and Release of Liability Form";
  page.drawText(subtitle, { x: (width - font.widthOfTextAtSize(subtitle, 11)) / 2, y, size: 11, font, color: INK });
  y -= 26;

  // ---- details table
  const rowH = 26;
  const labelW = 130;
  const midX = MARGIN + 330;
  const midLabelW = 92;

  const box = (x: number, yTop: number, w: number, h: number) =>
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: LINE, borderWidth: 0.8 });
  const label = (text: string, x: number, yTop: number) =>
    page.drawText(text, { x: x + 6, y: yTop - 17, size: 9.5, font, color: INK });
  const value = (text: string, x: number, yTop: number, w: number) => {
    if (!text) return;
    page.drawText(fitText(text, bold, 10, w - 12), { x: x + 6, y: yTop - 17, size: 10, font: bold, color: INK });
  };

  const fullName = [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
  const ic = (p?.passportId || p?.nationalId || "").trim();
  const gender = (p?.gender ?? "").trim();
  const genderText = gender ? gender.toUpperCase() : "MALE / FEMALE";

  // NAME (full width)
  box(MARGIN, y, labelW, rowH); label("NAME", MARGIN, y);
  box(MARGIN + labelW, y, contentWidth - labelW, rowH); value(fullName, MARGIN + labelW, y, contentWidth - labelW);
  y -= rowH;

  // I.C. | AGE
  box(MARGIN, y, labelW, rowH); label("I.C.", MARGIN, y);
  box(MARGIN + labelW, y, midX - MARGIN - labelW, rowH); value(ic, MARGIN + labelW, y, midX - MARGIN - labelW);
  box(midX, y, midLabelW, rowH); label("AGE", midX, y);
  box(midX + midLabelW, y, right - midX - midLabelW, rowH); value(waiverAge(p?.birthday), midX + midLabelW, y, right - midX - midLabelW);
  y -= rowH;

  // DATE OF BIRTH | GENDER
  box(MARGIN, y, labelW, rowH); label("DATE OF BIRTH", MARGIN, y);
  box(MARGIN + labelW, y, midX - MARGIN - labelW, rowH); value(p?.birthday ?? "", MARGIN + labelW, y, midX - MARGIN - labelW);
  box(midX, y, midLabelW, rowH); label("GENDER", midX, y);
  box(midX + midLabelW, y, right - midX - midLabelW, rowH); value(genderText, midX + midLabelW, y, right - midX - midLabelW);
  y -= rowH;

  // ADDRESS / SCHOOL NAME — filled in by hand
  for (const caption of ["ADDRESS", "SCHOOL NAME"]) {
    box(MARGIN, y, labelW, rowH); label(caption, MARGIN, y);
    box(MARGIN + labelW, y, contentWidth - labelW, rowH);
    y -= rowH;
  }

  // TRAINING CENTRE | GRADE / DEGREE
  box(MARGIN, y, labelW, rowH); label("TRAINING CENTRE", MARGIN, y);
  box(MARGIN + labelW, y, midX - MARGIN - labelW, rowH); value(p?.clubName ?? "", MARGIN + labelW, y, midX - MARGIN - labelW);
  box(midX, y, midLabelW, rowH); label("GRADE /", midX, y);
  page.drawText("DEGREE", { x: midX + 6, y: y - 26, size: 9.5, font, color: INK });
  const grade = p ? gradeLabel(p.gup, p.dan) : "";
  box(midX + midLabelW, y, right - midX - midLabelW, rowH); value(grade === "—" ? "" : grade, midX + midLabelW, y, right - midX - midLabelW);
  y -= rowH;

  // NAME OF INSTRUCTOR
  box(MARGIN, y, labelW, rowH); label("NAME OF INSTRUCTOR", MARGIN, y);
  box(MARGIN + labelW, y, contentWidth - labelW, rowH);
  y -= rowH;

  // LUNCH
  box(MARGIN, y, labelW, rowH); label("LUNCH", MARGIN, y);
  box(MARGIN + labelW, y, contentWidth - labelW, rowH);
  page.drawText("[    ] NON-HALAL      [    ] HALAL", { x: MARGIN + labelW + 8, y: y - 17, size: 9.5, font, color: INK });
  y -= rowH + 26;

  // ---- event particulars
  const venueLine = [event.venue, event.venueAddress, event.country].filter(Boolean).join(", ") || "TBA";
  const particulars: [string, string][] = [
    ["Venue:", venueLine],
    ["Date:", formatEventRange(event.startDate, event.endDate)],
    ["Time:", formatEventDateTime(event.startDate)],
  ];
  for (const [k, v] of particulars) {
    page.drawText(k, { x: MARGIN + 60, y, size: 10, font, color: INK });
    page.drawText(fitText(v, font, 10, contentWidth - 130), { x: MARGIN + 120, y, size: 10, font, color: INK });
    y -= 16;
  }
  y -= 16;

  // ---- waiver wording
  const org = event.organizer || "the organizing committee";
  const paragraphs = [
    `I wish to participate in ${event.name}, due to be held on ${formatEventRange(event.startDate, event.endDate)} at ${venueLine}.`,
    "I understand and agree that, during my participation in this event, I shall be solely responsible for any accidents, damages, or injuries caused by my own actions. I hereby waive any right to claim damages against " +
      `${org} and the organizing committee of the said event, as well as other participants. I agree to bear and pay for any losses or expenses arising from my participation.`,
    "All decisions of the Organizing Committee are final, and no complaints will be entertained. The Organizing Committee reserves the right to prohibit anyone from participating in the above event.",
    `I understand and agree to the above terms and commit to complying with all regulations of "${event.name}".`,
  ];
  for (const para of paragraphs) {
    y = drawParagraph(page, para, MARGIN, y, contentWidth, font, 9.5, 13) - 8;
  }

  // ---- signature block
  y -= 10;
  const sigW = 300;
  const sigX = (width - sigW) / 2;
  const sigH = 96;
  page.drawRectangle({ x: sigX, y: y - sigH, width: sigW, height: sigH, borderColor: LINE, borderWidth: 0.8 });
  page.drawText("Participant / Parent / Guardian's Signature", { x: sigX + 8, y: y - 16, size: 9.5, font, color: INK });
  page.drawText("..............................................................", { x: sigX + 8, y: y - 60, size: 9.5, font, color: INK });
  page.drawText(`Name: ${fullName}`, { x: sigX + 8, y: y - 75, size: 9.5, font, color: INK });
  page.drawText("Date:", { x: sigX + 8, y: y - 89, size: 9.5, font, color: INK });
}
