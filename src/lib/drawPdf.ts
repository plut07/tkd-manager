import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { ROUND_ORDER, ROUND_LABELS, placings, type PlacedMatch } from "./bracket";

/**
 * The draw chart as a printable PDF.
 *
 * Drawn rather than stamped onto a template: a bracket's shape depends on how
 * many competitors turned up, so there is no fixed form it could be laid over.
 *
 * The page is headed with the category name because that is what the sheet is
 * pinned up as — "Boys 14-16 -50kg", not the file it came from.
 */

export type DrawCompetitor = { name: string; club: string | null; number: string | null };

export type DrawMatch = PlacedMatch & {
  id: string;
  slot: number;
  competitor1_points: number | null;
  competitor2_points: number | null;
};

export type DrawChart = {
  categoryName: string;
  eventName: string;
  eventDates: string | null;
  matches: DrawMatch[];
  competitorOf: (registrationId: string | null) => DrawCompetitor | null;
};

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.72, 0.72, 0.76);
const WIN_BG = rgb(0.88, 0.96, 0.89);

/** Cut a string to what will fit, ending in an ellipsis rather than overflowing. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

export async function buildDrawPdf(chart: DrawChart): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const rounds = ROUND_ORDER.filter((r) => chart.matches.some((m) => m.round === r));
  // A 32-draw across four columns on A4 leaves a name 60pt wide. The sheet
  // grows with the draw instead, so the page is sized from the rounds.
  const width = rounds.length >= 5 ? 1684 : rounds.length >= 4 ? 1191 : 842;
  const height = rounds.length >= 5 ? 1191 : rounds.length >= 4 ? 842 : 595;
  const page = pdf.addPage([width, height]);

  const margin = 36;
  const headerBottom = height - 96;

  page.drawText(fit(chart.categoryName, bold, 24, width - margin * 2), {
    x: margin,
    y: height - 52,
    size: 24,
    font: bold,
    color: INK,
  });
  page.drawText(
    fit([chart.eventName, chart.eventDates].filter(Boolean).join("  ·  "), font, 11, width - margin * 2),
    { x: margin, y: height - 70, size: 11, font, color: MUTED },
  );
  page.drawLine({
    start: { x: margin, y: headerBottom + 12 },
    end: { x: width - margin, y: headerBottom + 12 },
    thickness: 0.75,
    color: LINE,
  });

  // The podium takes the bottom-right corner, so the bracket stops short of it.
  const podiumWidth = 240;
  const podiumHeight = 92;
  const chartBottom = margin + podiumHeight + 16;
  const chartHeight = headerBottom - chartBottom;

  const columnWidth = (width - margin * 2) / Math.max(1, rounds.length + 1);
  const boxWidth = Math.min(columnWidth - 24, 260);
  const boxHeight = 40;

  rounds.forEach((round, r) => {
    const roundMatches = chart.matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
    const x = margin + r * columnWidth;

    page.drawText(ROUND_LABELS[round] ?? round, {
      x,
      y: headerBottom - 6,
      size: 9,
      font: bold,
      color: MUTED,
    });

    const slotHeight = chartHeight / Math.max(1, roundMatches.length);
    roundMatches.forEach((m, i) => {
      const centre = headerBottom - 24 - slotHeight * (i + 0.5);
      drawMatchBox(page, font, bold, chart, m, x, centre + boxHeight / 2, boxWidth, boxHeight);
    });
  });

  // The champion's box, one column past the final.
  const final = chart.matches.find((m) => m.round === "final") ?? null;
  const winner = final?.winner_registration_id ? chart.competitorOf(final.winner_registration_id) : null;
  const winnerX = margin + rounds.length * columnWidth;
  const winnerY = headerBottom - 24 - chartHeight / 2 + boxHeight / 2;
  page.drawRectangle({
    x: winnerX,
    y: winnerY - boxHeight / 2,
    width: boxWidth,
    height: boxHeight / 2 + 6,
    borderWidth: 1.5,
    borderColor: rgb(0.85, 0.68, 0.13),
    color: rgb(1, 0.98, 0.9),
  });
  page.drawText("WINNER", { x: winnerX + 6, y: winnerY + 6, size: 7, font: bold, color: MUTED });
  // Blank, not "TBD": an undecided final is an empty box on a paper chart.
  if (winner) {
    page.drawText(fit(winner.name, bold, 10, boxWidth - 12), {
      x: winnerX + 6,
      y: winnerY - 8,
      size: 10,
      font: bold,
      color: INK,
    });
  }

  drawPodium(page, font, bold, chart, width - margin - podiumWidth, margin, podiumWidth, podiumHeight);

  return pdf.save();
}

function drawMatchBox(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  chart: DrawChart,
  match: DrawMatch,
  x: number,
  top: number,
  boxWidth: number,
  boxHeight: number,
) {
  const rowHeight = boxHeight / 2;
  page.drawRectangle({
    x,
    y: top - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderWidth: 0.75,
    borderColor: LINE,
  });
  page.drawLine({
    start: { x, y: top - rowHeight },
    end: { x: x + boxWidth, y: top - rowHeight },
    thickness: 0.5,
    color: LINE,
  });

  const sides: { id: string | null; other: string | null; points: number | null }[] = [
    { id: match.competitor1_registration_id, other: match.competitor2_registration_id, points: match.competitor1_points },
    { id: match.competitor2_registration_id, other: match.competitor1_registration_id, points: match.competitor2_points },
  ];

  sides.forEach((side, i) => {
    const rowTop = top - rowHeight * i;
    const who = chart.competitorOf(side.id);
    const won = match.winner_registration_id != null && match.winner_registration_id === side.id;

    if (won) {
      page.drawRectangle({
        x: x + 0.75,
        y: rowTop - rowHeight + 0.75,
        width: boxWidth - 1.5,
        height: rowHeight - 1.5,
        color: WIN_BG,
      });
    }

    // A bye prints as an empty line. Nobody stood there, and a word in the box
    // makes it look like a bout that was fought.
    if (!who) return;

    const label = `${who.number ? `${who.number}  ` : ""}${who.name}${who.club ? `  (${who.club})` : ""}`;
    page.drawText(fit(label, won ? bold : font, 8.5, boxWidth - 34), {
      x: x + 5,
      y: rowTop - rowHeight + 6,
      size: 8.5,
      font: won ? bold : font,
      color: INK,
    });
    if (side.points != null) {
      page.drawText(String(side.points), {
        x: x + boxWidth - 16,
        y: rowTop - rowHeight + 6,
        size: 8.5,
        font: bold,
        color: won ? INK : MUTED,
      });
    }
  });
}

function drawPodium(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  chart: DrawChart,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
) {
  const podium = placings(chart.matches);
  page.drawRectangle({ x, y, width: boxWidth, height: boxHeight, borderWidth: 0.75, borderColor: LINE });
  page.drawText("PLACINGS", { x: x + 8, y: y + boxHeight - 14, size: 8, font: bold, color: MUTED });

  const rows: { place: string; id: string | null }[] = [
    { place: "1st", id: podium.first },
    { place: "2nd", id: podium.second },
    { place: "3rd", id: podium.thirds[0] ?? null },
    { place: "3rd", id: podium.thirds[1] ?? null },
  ];

  rows.forEach((row, i) => {
    const rowY = y + boxHeight - 28 - i * 15;
    page.drawText(row.place, { x: x + 8, y: rowY, size: 9, font: bold, color: MUTED });
    const who = chart.competitorOf(row.id);
    if (who) {
      page.drawText(fit(who.name, font, 9, boxWidth - 44), { x: x + 34, y: rowY, size: 9, font, color: INK });
    }
  });
}
