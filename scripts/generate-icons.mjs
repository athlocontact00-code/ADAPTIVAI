#!/usr/bin/env node
/**
 * Generates app icons from brand logo-mark (Apple-like).
 * Uses public/brand/logo-mark-dark.svg (white A on transparent).
 * Output: public/icons/ (icon-1024, 512, 192, 180, maskable-512) and favicons.
 * Run: node scripts/generate-icons.mjs  (requires: sharp)
 */
import { mkdir, writeFile, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const brandDir = join(root, "public", "brand");
const outDir = join(root, "public", "icons");
const THEME = "#0B0B0F";
const STROKE_A = 6;
const STROKE_EKG = 5;
const PATH_A = "M12 56 L32 12 L52 56";
const PATH_EKG = "M19.27 40 L29 40 L32 33 L35 40 L44.73 40";

function svgIcon(size, contentScale = 0.88) {
  const pad = (size * (1 - contentScale)) / 2;
  const scale = (size * contentScale) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${THEME}"/>
  <g transform="translate(${pad},${pad}) scale(${scale})" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round">
    <path d="${PATH_A}" stroke-width="${STROKE_A}"/>
    <path d="${PATH_EKG}" stroke-width="${STROKE_EKG}"/>
  </g>
</svg>`;
}

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Run: npm install sharp --save-dev");
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  await mkdir(brandDir, { recursive: true });

  const size1024 = 1024;
  const regularSvg = svgIcon(size1024, 0.88);
  const maskableSvg = svgIcon(size1024, 0.8);

  const buf1024 = await sharp(Buffer.from(regularSvg)).png().toBuffer();
  const bufMaskable1024 = await sharp(Buffer.from(maskableSvg)).png().toBuffer();

  await writeFile(join(outDir, "icon-1024.png"), buf1024);
  console.log("Written icon-1024.png");

  const icon1024 = sharp(buf1024);
  await writeFile(join(outDir, "icon-512.png"), await icon1024.clone().resize(512, 512).png().toBuffer());
  await writeFile(join(outDir, "icon-192.png"), await icon1024.clone().resize(192, 192).png().toBuffer());
  await writeFile(join(outDir, "icon-180.png"), await icon1024.clone().resize(180, 180).png().toBuffer());
  console.log("Written icon-512.png, icon-192.png, icon-180.png");

  const mask512 = await sharp(bufMaskable1024).resize(512, 512).png().toBuffer();
  await writeFile(join(outDir, "maskable-512.png"), mask512);
  await writeFile(join(outDir, "icon-512-maskable.png"), mask512);
  await writeFile(join(outDir, "icon-192-maskable.png"), await sharp(bufMaskable1024).resize(192, 192).png().toBuffer());
  console.log("Written maskable-512.png, icon-512-maskable.png, icon-192-maskable.png");

  await writeFile(join(root, "public", "apple-touch-icon.png"), await icon1024.clone().resize(180, 180).png().toBuffer());
  const fav48 = await icon1024.clone().resize(48, 48).png().toBuffer();
  await writeFile(join(root, "public", "favicon.png"), fav48);
  await writeFile(join(root, "public", "favicon-48.png"), fav48);
  await writeFile(join(root, "public", "favicon-32.png"), await icon1024.clone().resize(32, 32).png().toBuffer());
  await writeFile(join(root, "public", "favicon-16.png"), await icon1024.clone().resize(16, 16).png().toBuffer());
  await writeFile(join(root, "public", "logo.png"), await icon1024.clone().resize(512, 512).png().toBuffer());
  console.log("Written apple-touch-icon.png, favicon*.png, logo.png");

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
