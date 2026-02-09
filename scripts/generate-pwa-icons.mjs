#!/usr/bin/env node
/**
 * Generates PWA placeholder icons (correct sizes). Run: node scripts/generate-pwa-icons.mjs
 * Requires: npm install sharp (or use existing transitive dependency).
 */
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "icons");

const themeColor = "#0a0a0a"; // match manifest background_color
const padding = 0.12; // safe area for maskable (≈80% content)

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Run: npm install sharp (or ensure sharp is installed)");
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const sizes = [
    [192, "icon-192.png", false],
    [512, "icon-512.png", false],
    [192, "icon-192-maskable.png", true],
    [512, "icon-512-maskable.png", true],
  ];

  for (const [size, name, maskable] of sizes) {
    const w = size;
    const h = size;
    const pad = maskable ? Math.round(size * padding) : 0;
    const inner = size - 2 * pad;
    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${w}" height="${h}" fill="${themeColor}"/>
        <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" fill="#171717" rx="${inner / 8}"/>
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${inner * 0.4}" fill="#fafafa">A</text>
      </svg>
    `;
    const buf = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    await writeFile(join(outDir, name), buf);
    console.log("Written", name);
  }

  // apple-touch-icon 180x180
  const appleSvg = `
    <svg width="180" height="180" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="180" fill="${themeColor}"/>
      <rect x="18" y="18" width="144" height="144" fill="#171717" rx="18"/>
      <text x="90" y="90" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" fill="#fafafa">A</text>
    </svg>
  `;
  const appleBuf = await sharp(Buffer.from(appleSvg)).png().toBuffer();
  await writeFile(join(root, "public", "apple-touch-icon.png"), appleBuf);
  console.log("Written apple-touch-icon.png");

  // Favicon 32x32 (browsers accept PNG as favicon)
  const faviconSvg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="${themeColor}" rx="6"/>
      <text x="16" y="16" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="#fafafa">A</text>
    </svg>
  `;
  const faviconBuf = await sharp(Buffer.from(faviconSvg)).png().toBuffer();
  await writeFile(join(root, "public", "favicon.png"), faviconBuf);
  console.log("Written favicon.png (use as favicon or replace with .ico)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
