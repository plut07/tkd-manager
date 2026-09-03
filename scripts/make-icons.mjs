/**
 * Draw the judge app's icons.
 *
 * Run with `node scripts/make-icons.mjs`. Writes into public/icons/.
 *
 * The icons are generated rather than checked in as artwork because they are
 * four sizes of one simple shape, and a script is easier to correct than four
 * binary files nobody can diff. It encodes the PNG by hand -- zlib is in Node
 * and the format's header is a dozen bytes -- rather than adding an image
 * library to a project that has no other use for one.
 *
 * The mark is the same one as src/app/icon.svg: the two corners this whole app
 * is about, red and blue either side of a dividing line. No lettering, because
 * a maskable icon has its edges cropped by the launcher and text is the first
 * thing to go.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BACKGROUND = [9, 9, 11];
const RED = [185, 28, 28];
const BLUE = [29, 78, 216];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** `pixels` is width*height*3 bytes of RGB. */
function png(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  // Each scanline is prefixed with its filter type; 0 means "store as is",
  // which costs a few bytes and saves writing a filter.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    pixels.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * @param size    pixels square
 * @param padding how much of the edge is background only. A maskable icon is
 *                cropped to a circle by some launchers, so its mark is drawn
 *                smaller to survive that; a plain one fills the tile.
 */
function draw(size, padding) {
  const pixels = Buffer.alloc(size * size * 3);
  const centre = (size - 1) / 2;
  const radius = size / 2 - padding * size;
  const barHalf = Math.max(1, size * 0.031);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centre;
      const dy = y - centre;
      let colour = BACKGROUND;
      if (dx * dx + dy * dy <= radius * radius) {
        colour = dx < 0 ? RED : BLUE;
        // The dividing line, which is what makes it read as two corners rather
        // than as one circle in two colours.
        if (Math.abs(dx) <= barHalf) colour = BACKGROUND;
      }
      const at = (y * size + x) * 3;
      pixels[at] = colour[0];
      pixels[at + 1] = colour[1];
      pixels[at + 2] = colour[2];
    }
  }
  return png(size, size, pixels);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ["judge-192.png", draw(192, 0.12)],
  ["judge-512.png", draw(512, 0.12)],
  // Maskable icons are cropped by the launcher: the mark sits inside the safe
  // zone so nothing important is cut off.
  ["judge-maskable-512.png", draw(512, 0.22)],
];
for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
  console.log(`wrote public/icons/${name}  ${data.length} bytes`);
}
