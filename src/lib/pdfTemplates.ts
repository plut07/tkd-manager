import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "./supabaseAdmin";
import { resolveTemplateField, isImageField, imageForField, type TemplateData } from "./templateFields";

export const TEMPLATE_BUCKET = "event-templates";

export type TemplateField = {
  field_key: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  align: "left" | "center" | "right";
};

/** Reads page count and size so the designer can lay its preview out to scale. */
export async function inspectPdf(bytes: ArrayBuffer): Promise<{ pageCount: number; width: number; height: number }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const first = doc.getPage(0);
  const { width, height } = first.getSize();
  return { pageCount: doc.getPageCount(), width, height };
}

export async function downloadTemplate(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabaseAdmin().storage.from(TEMPLATE_BUCKET).download(storagePath);
  if (error || !data) throw new Error("The template file could not be read. It may have been removed.");
  return data.arrayBuffer();
}

/**
 * Stamp values onto a copy of the uploaded PDF.
 *
 * Field boxes are stored as fractions of the page with the origin at the top
 * left (how the designer sees it); PDF coordinates start at the bottom left, so
 * y is flipped here. Text is shrunk to fit rather than overflowing its box.
 */
export type TemplateAlignment = { offsetX?: number; offsetY?: number; scale?: number };

export async function fillTemplate(
  templateBytes: ArrayBuffer,
  fields: TemplateField[],
  rows: TemplateData[],
  alignment: TemplateAlignment = {},
): Promise<Uint8Array> {
  // A whole-form correction, applied once to every box. Zero and one when the
  // designer drew on the real page, which is the normal case.
  const dx = Number(alignment.offsetX) || 0;
  const dy = Number(alignment.offsetY) || 0;
  const k = Number(alignment.scale) || 1;
  const place = (f: TemplateField) => ({
    x: f.x * k + dx,
    y: f.y * k + dy,
    width: f.width * k,
    height: f.height * k,
  });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const source = await PDFDocument.load(templateBytes, { ignoreEncryption: true });

  const list = rows.length > 0 ? rows : [{ participant: null, event: {} } as TemplateData];

  for (const data of list) {
    const pageIndexes = source.getPageIndices();
    const copied = await out.copyPages(source, pageIndexes);
    copied.forEach((page) => out.addPage(page));
    const offset = out.getPageCount() - copied.length;

    for (const f of fields) {
      const pageNumber = Math.min(Math.max(1, f.page), copied.length);
      const page = out.getPage(offset + pageNumber - 1);
      const { width: pw, height: ph } = page.getSize();

      const at = place(f);
      const boxW = at.width * pw;
      const boxH = at.height * ph;
      const boxX = at.x * pw;
      const boxTop = at.y * ph;

      // The signature is a picture, so it's fitted to the box rather than
      // written into it. A missing or unreadable image just leaves the space
      // blank — the rest of the form still prints.
      if (isImageField(f.field_key)) {
        const png = imageForField(f.field_key, data);
        if (!png) continue;
        try {
          const image = await out.embedPng(png);
          const scale = Math.min(boxW / image.width, boxH / image.height);
          const drawW = image.width * scale;
          const drawH = image.height * scale;
          let x = boxX;
          if (f.align === "center") x = boxX + (boxW - drawW) / 2;
          else if (f.align === "right") x = boxX + boxW - drawW;
          // Sit it on the bottom of the box, the way a signature rests on a line.
          const y = ph - boxTop - boxH;
          page.drawImage(image, { x, y, width: drawW, height: drawH });
        } catch {
          // Corrupt signature data shouldn't stop the form printing.
        }
        continue;
      }

      const text = resolveTemplateField(f.field_key, data);
      if (!text) continue;

      let size = Number(f.font_size) || 11;
      size = Math.min(size, boxH * 0.85);
      while (size > 5 && font.widthOfTextAtSize(text, size) > boxW - 4) size -= 0.5;

      const textWidth = font.widthOfTextAtSize(text, size);
      let x = boxX + 2;
      if (f.align === "center") x = boxX + (boxW - textWidth) / 2;
      else if (f.align === "right") x = boxX + boxW - textWidth - 2;

      // Flip to PDF's bottom-left origin, then sit the text on the box's baseline.
      const y = ph - boxTop - boxH + (boxH - size) / 2 + size * 0.22;

      page.drawText(text, { x, y, size, font, color: rgb(0.07, 0.09, 0.15) });
    }
  }

  return out.save();
}
