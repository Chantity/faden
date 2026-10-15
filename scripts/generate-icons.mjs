// Erzeugt die App-Icons ohne Fremdpakete.
//
// Quelle der Geometrie ist `ICON` unten; dieselben Formen stehen als
// `public/icons/icon.svg` im Repo. Dieses Skript rastert sie mit
// Supersampling und schreibt PNG (192, 512, maskable 512, apple-touch 180)
// sowie `favicon.ico` (16/32/48 als eingebettete PNGs).
//
// Aufruf (nur nötig, wenn sich das Icon ändert): `npm run icons`

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

// Gedämpftes Grün (--color-primary, hell) und Papierton (--color-bg, hell).
const BG = [0x4a, 0x6b, 0x57];
const FG = [0xf4, 0xf1, 0xea];

// Geometrie im Einheitsquadrat 0..1: ein „Faden" aus drei ToDos.
const ICON = {
  cornerRadius: 0.22,
  nodes: [
    [0.5, 0.25],
    [0.5, 0.5],
    [0.5, 0.75],
  ],
  nodeRadius: 0.085,
  lineWidth: 0.05,
};

function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inForeground(x, y) {
  const { nodes, nodeRadius, lineWidth } = ICON;
  for (const [nx, ny] of nodes) {
    if (Math.hypot(x - nx, y - ny) <= nodeRadius) return true;
  }
  for (let i = 0; i + 1 < nodes.length; i++) {
    if (distToSegment(x, y, nodes[i], nodes[i + 1]) <= lineWidth / 2) return true;
  }
  return false;
}

/**
 * Rastert das Icon. `shape`:
 * - 'rounded': abgerundetes Quadrat mit transparenten Ecken (purpose „any")
 * - 'square':  vollflächig (maskable, apple-touch); Motiv auf `scale` verkleinert,
 *              damit es in der sicheren Zone (Radius 40 %) liegt.
 */
function render(size, shape, scale = 1) {
  const S = 4; // 4×4 Unterabtastung
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (x + (sx + 0.5) / S) / size;
          const v = (y + (sy + 0.5) / S) / size;
          const inside = shape === 'square' || inRoundedSquare(u, v, ICON.cornerRadius);
          if (!inside) continue;
          bg++;
          const mu = (u - 0.5) / scale + 0.5;
          const mv = (v - 0.5) / scale + 0.5;
          if (inForeground(mu, mv)) fg++;
        }
      }
      const i = (y * size + x) * 4;
      const t = bg === 0 ? 0 : fg / bg;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - t) + FG[c] * t);
      px[i + 3] = Math.round((bg / (S * S)) * 255);
    }
  }
  return encodePng(size, size, px);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // Filter: keiner
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // Typ: Icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size;
    e[1] = size;
    e.writeUInt16LE(1, 4); // Farbebenen
    e.writeUInt16LE(32, 6); // Bit pro Pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

function write(rel, data) {
  const file = join(out, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`  ${rel} (${data.length} B)`);
}

console.log('Icons:');
write('icons/icon-192.png', render(192, 'rounded'));
write('icons/icon-512.png', render(512, 'rounded'));
write('icons/icon-maskable-512.png', render(512, 'square', 0.8));
write('icons/apple-touch-icon.png', render(180, 'square', 0.9));
write(
  'favicon.ico',
  encodeIco([16, 32, 48].map((size) => ({ size, png: render(size, 'rounded') }))),
);
