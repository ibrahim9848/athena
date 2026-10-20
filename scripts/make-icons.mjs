/**
 * Generates the PWA icons (public/icons/icon-512.png, icon-192.png) with no
 * dependencies: a minimal PNG encoder (zlib deflate + CRC32, 8-bit RGBA, one
 * IDAT) and a tiny software rasteriser.
 *
 * Icon: dark squircle (#0f1317), filled red circle (#d22f45), white letter "A"
 * drawn as three stroked segments with round caps.
 *
 * Run with: node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');

/* ---------- minimal PNG encoder ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** 8-bit RGBA, filter 0 on every scanline, one IDAT. */
function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- rasteriser ---------- */

const DARK = [15, 19, 23]; // #0f1317
const RED = [210, 47, 69]; // #d22f45
const WHITE = [255, 255, 255];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Signed distance -> coverage, anti-aliased over a 1px band. */
function coverage(dist) {
  return 1 - smoothstep(-0.5, 0.5, dist);
}

/** Signed distance to a rounded rectangle spanning [0,size]^2 with corner radius r. */
function roundedRectDist(x, y, size, r) {
  const half = size / 2;
  const dx = Math.abs(x - half) - (half - r);
  const dy = Math.abs(y - half) - (half - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}

/** Distance from point p to segment a-b. */
function segmentDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * fullBleed=false: dark squircle on transparency (purpose "any").
 * fullBleed=true: the dark background fills the whole square and the artwork
 * shrinks into the maskable safe zone, so any launcher mask crops cleanly.
 */
function renderIcon(size, fullBleed = false) {
  const cornerRadius = fullBleed ? 0.5 : size * 0.19;
  const artScale = fullBleed ? 0.8 : 1;
  const circleRadius = size * 0.37 * artScale;
  const strokeHalf = (size * 0.066 * artScale) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Letter "A": apex, two feet, crossbar at 62% down each leg.
  // Scaled toward the centre together with the circle in full-bleed mode.
  const pt = (fx, fy) => [cx + (fx - 0.5) * size * artScale, cy + (fy - 0.5) * size * artScale];
  const apex = pt(0.5, 0.3);
  const leftFoot = pt(0.335, 0.68);
  const rightFoot = pt(0.665, 0.68);
  const barLeft = [lerp(apex[0], leftFoot[0], 0.62), lerp(apex[1], leftFoot[1], 0.62)];
  const barRight = [lerp(apex[0], rightFoot[0], 0.62), lerp(apex[1], rightFoot[1], 0.62)];
  const segments = [
    [apex, leftFoot],
    [apex, rightFoot],
    [barLeft, barRight],
  ];

  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const py = y + 0.5;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;

      // Dark squircle = the icon's own alpha (full square when full-bleed).
      const bgCov = fullBleed ? 1 : coverage(roundedRectDist(px, py, size, cornerRadius));
      const i = (y * size + x) * 4;
      if (bgCov <= 0) continue; // fully transparent, Buffer.alloc is zeroed

      // Red circle over the dark background.
      const circleCov = coverage(Math.hypot(px - cx, py - cy) - circleRadius);
      // White "A": max coverage over the three stroked segments (round caps).
      let letterCov = 0;
      for (const [a, b] of segments) {
        const cov = coverage(segmentDist(px, py, a[0], a[1], b[0], b[1]) - strokeHalf);
        if (cov > letterCov) letterCov = cov;
      }

      let r = lerp(DARK[0], RED[0], circleCov);
      let g = lerp(DARK[1], RED[1], circleCov);
      let b = lerp(DARK[2], RED[2], circleCov);
      r = lerp(r, WHITE[0], letterCov);
      g = lerp(g, WHITE[1], letterCov);
      b = lerp(b, WHITE[2], letterCov);

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(bgCov * 255);
    }
  }
  return encodePng(size, rgba);
}

/* ---------- write files ---------- */

mkdirSync(outDir, { recursive: true });
for (const size of [512, 192]) {
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, renderIcon(size));
  const { size: bytes } = statSync(file);
  console.log(`wrote ${path.relative(root, file)} (${size}x${size}, ${bytes} bytes)`);

  const maskable = path.join(outDir, `icon-maskable-${size}.png`);
  writeFileSync(maskable, renderIcon(size, true));
  const { size: maskBytes } = statSync(maskable);
  console.log(`wrote ${path.relative(root, maskable)} (${size}x${size} full-bleed, ${maskBytes} bytes)`);
}
