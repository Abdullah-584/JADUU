// JADUU brand asset generator — 100% original artwork, generated procedurally.
// Produces: icon.png, icon.ico, icon.icns, icons/*.png, tray.png, trayTemplate.png(+@2x)
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(root, "..", "assets");
mkdirSync(path.join(assetsDir, "icons"), { recursive: true });

/* ---------------------------------- PNG ---------------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* --------------------------------- drawing -------------------------------- */
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }

// Deep indigo -> violet background with rounded-rect mask
function background(cx, cy, S) {
  const t = clamp01(cy / S);
  let r = lerp(0x17, 0x2a, t), g = lerp(0x13, 0x1f, t), b = lerp(0x38, 0x5e, t);
  // subtle radial glow behind the star
  const d = Math.hypot(cx - 0.5, cy - 0.5);
  const glow = 1 - smoothstep(0.12, 0.52, d);
  r = lerp(r, 0x3d, glow * 0.55); g = lerp(g, 0x30, glow * 0.55); b = lerp(b, 0x7a, glow * 0.55);
  return [r, g, b];
}

// Four-point magical spark: r(theta) = R*(a + (1-a)*|cos(2*theta)|^p)
const SPARK_CX = 0.5, SPARK_CY = 0.52, SPARK_R = 0.335, SPARK_A = 0.30, SPARK_P = 1.15;
function sparkInside(x, y) {
  const dx = x - SPARK_CX, dy = y - SPARK_CY;
  const theta = Math.atan2(dy, dx);
  const r = Math.hypot(dx, dy);
  const maxR = SPARK_R * (SPARK_A + (1 - SPARK_A) * Math.pow(Math.abs(Math.cos(2 * theta)), SPARK_P));
  return r <= maxR;
}
// small orbiting node (AI dot)
const NODE_CX = 0.72, NODE_CY = 0.245, NODE_R = 0.045;
const nodeInside = (x, y) => Math.hypot(x - NODE_CX, y - NODE_CY) <= NODE_R;

function sparkColor(x, y) {
  // golden gradient: bright center -> deep amber edge
  const d = clamp01(Math.hypot(x - SPARK_CX, y - SPARK_CY) / SPARK_R);
  let r = lerp(0xff, 0xf6, d), g = lerp(0xe9, 0xa6, d), b = lerp(0xa8, 0x2e, d);
  // inner white-hot core
  const core = 1 - smoothstep(0.0, 0.28, d);
  r = lerp(r, 0xff, core); g = lerp(g, 0xfb, core); b = lerp(b, 0xe6, core);
  return [r, g, b];
}

function renderIcon(size) {
  const SS = 2; // 2x2 supersampling
  const buf = Buffer.alloc(size * size * 4);
  const radius = 0.225; // rounded rect corner (normalized units — matches x/y space)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          // rounded-rect coverage
          const ex = Math.max(Math.abs(x - 0.5) - (0.5 - radius), 0);
          const ey = Math.max(Math.abs(y - 0.5) - (0.5 - radius), 0);
          const mask = 1 - smoothstep(radius - 1.5 / size, radius + 1.5 / size, Math.hypot(ex, ey));
          let cr, cg, cb, ca;
          if (sparkInside(x, y)) { [cr, cg, cb] = sparkColor(x, y); ca = 1; }
          else if (nodeInside(x, y)) { [cr, cg, cb] = [0xb9, 0xa8, 0xff]; ca = 1; }
          else { [cr, cg, cb] = background(x, y, 1); ca = 1; }
          r += cr * mask * ca; g += cg * mask * ca; b += cb * mask * ca; a += mask * ca;
        }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = Math.round((a / n) * 255);
    }
  }
  return buf;
}

// Monochrome spark on transparent background (for tray/template icons)
function renderMono(size, rgb) {
  const SS = 2;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const inStar = sparkInside(x, y) || nodeInside(x, y);
          a += inStar ? 1 : 0;
        }
      }
      const i = (py * size + px) * 4;
      buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2];
      buf[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return buf;
}

function boxResize(src, srcSize, dstSize) {
  const dst = Buffer.alloc(dstSize * dstSize * 4);
  const f = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const x0 = Math.floor(x * f), x1 = Math.max(x0 + 1, Math.floor((x + 1) * f));
      const y0 = Math.floor(y * f), y1 = Math.max(y0 + 1, Math.floor((y + 1) * f));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < srcSize; yy++) {
        for (let xx = x0; xx < x1 && xx < srcSize; xx++) {
          const i = (yy * srcSize + xx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++;
        }
      }
      const di = (y * dstSize + x) * 4;
      dst[di] = Math.round(r / n); dst[di + 1] = Math.round(g / n); dst[di + 2] = Math.round(b / n); dst[di + 3] = Math.round(a / n);
    }
  }
  return dst;
}

/* ---------------------------------- ICO ----------------------------------- */
function encodeICO(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + 16 * count;
  for (const { size, png } of pngBuffers) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.png)]);
}

/* ---------------------------------- ICNS ---------------------------------- */
function encodeICNS(png1024, png512) {
  const icon1024 = Buffer.concat([Buffer.from("ic10", "ascii"), Buffer.alloc(4), png1024]);
  icon1024.writeUInt32BE(png1024.length, 4);
  const icon512 = Buffer.concat([Buffer.from("ic09", "ascii"), Buffer.alloc(4), png512]);
  icon512.writeUInt32BE(png512.length, 4);
  const total = 8 + icon1024.length + icon512.length;
  const head = Buffer.from("icns", "ascii");
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(total);
  return Buffer.concat([head, sizeBuf, icon512, icon1024]);
}

/* --------------------------------- output --------------------------------- */
console.log("[jaduu:assets] rendering 1024px icon (supersampled)…");
const master = renderIcon(1024);
writeFileSync(path.join(assetsDir, "icon.png"), encodePNG(1024, 1024, master));
for (const s of [512, 256, 128, 64, 32]) {
  writeFileSync(path.join(assetsDir, "icons", `${s}x${s}.png`), encodePNG(s, s, boxResize(master, 1024, s)));
}
const png256 = encodePNG(256, 256, boxResize(master, 1024, 256));
const png32 = encodePNG(32, 32, boxResize(master, 1024, 32));
writeFileSync(path.join(assetsDir, "icon.ico"), encodeICO([{ size: 256, png: png256 }, { size: 32, png: png32 }]));
writeFileSync(path.join(assetsDir, "icon.icns"), encodeICNS(encodePNG(1024, 1024, master), encodePNG(512, 512, boxResize(master, 1024, 512))));

const white = renderMono(32, [0xff, 0xff, 0xff]);
writeFileSync(path.join(assetsDir, "tray.png"), encodePNG(32, 32, white));
writeFileSync(path.join(assetsDir, "tray@2x.png"), encodePNG(64, 64, renderMono(64, [0xff, 0xff, 0xff])));
const black32 = renderMono(32, [0x00, 0x00, 0x00]);
writeFileSync(path.join(assetsDir, "trayTemplate.png"), encodePNG(32, 32, black32));
writeFileSync(path.join(assetsDir, "trayTemplate@2x.png"), encodePNG(64, 64, renderMono(64, [0x00, 0x00, 0x00])));

console.log("[jaduu:assets] done → assets/");
