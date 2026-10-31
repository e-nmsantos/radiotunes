#!/usr/bin/env node
/**
 * Roc Waves — gerador dos ícones PWA (zero dependências)
 * Desenha o símbolo ((•)) sobre gradiente ciano→azul e grava PNGs em icons/:
 *   icon-192.png, icon-512.png   (purpose "any": cantos arredondados, fundo transparente)
 *   maskable-512.png             (purpose "maskable": fundo total, símbolo na zona segura)
 *   apple-touch-icon.png (180)   (iOS arredonda sozinho: fundo total)
 *   favicon-32.png
 *   node tools/make-icons.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
const SS = 4; // supersampling por eixo (anti-aliasing)

const C1 = [6, 182, 212];   // #06b6d4 (theme_color)
const C2 = [37, 99, 235];   // #2563eb

/** Cobertura (0..1) do símbolo num ponto normalizado, com o símbolo escalado por `g`. */
function glyph(x, y, g) {
  const dx = (x - 0.5) / g, dy = (y - 0.5) / g;
  const d = Math.hypot(dx, dy);
  if (d <= 0.085) return true;
  const t = 0.05; // espessura dos arcos
  const half = (40 * Math.PI) / 180;
  for (const r of [0.2, 0.32]) {
    for (const side of [0, Math.PI]) {
      let a = Math.atan2(dy, dx) - side;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) <= half && Math.abs(d - r) <= t / 2) return true;
      // pontas arredondadas
      for (const s of [-half, half]) {
        const ex = r * Math.cos(side + s), ey = r * Math.sin(side + s);
        if (Math.hypot(dx - ex, dy - ey) <= t / 2) return true;
      }
    }
  }
  return false;
}

function insideRoundRect(x, y, radius) {
  const rx = Math.min(Math.max(x, radius), 1 - radius);
  const ry = Math.min(Math.max(y, radius), 1 - radius);
  return Math.hypot(x - rx, y - ry) <= radius;
}

function render(size, { rounded, glyphScale }) {
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bg = 0, fg = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = (i + (si + 0.5) / SS) / size;
          const y = (j + (sj + 0.5) / SS) / size;
          if (rounded && !insideRoundRect(x, y, 0.22)) continue;
          bg++;
          if (glyph(x, y, glyphScale)) fg++;
        }
      }
      const n = SS * SS;
      const tGrad = ((i + j) / (2 * size));
      const base = C1.map((c, k) => c + (C2[k] - c) * tGrad);
      const f = bg ? fg / bg : 0;
      const o = (j * size + i) * 4;
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(base[k] * (1 - f) + 255 * f);
      px[o + 3] = Math.round((bg / n) * 255);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, { rounded: true, glyphScale: 1 }],
  ['icon-512.png', 512, { rounded: true, glyphScale: 1 }],
  ['maskable-512.png', 512, { rounded: false, glyphScale: 0.78 }],
  ['apple-touch-icon.png', 180, { rounded: false, glyphScale: 0.9 }],
  ['favicon-32.png', 32, { rounded: true, glyphScale: 1.15 }],
];
for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(OUT, name), render(size, opts));
  console.log('✔', path.join('icons', name));
}
