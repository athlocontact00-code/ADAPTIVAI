#!/usr/bin/env node
/**
 * Generates premium PWA icons for AdaptivAI (wave/pulse motif).
 * Source: assets/logo.png or assets/logo-1024.png. If missing, creates assets/logo-1024.png from SVG.
 * Run: npm run pwa:icons  (requires: npm install sharp --save-dev)
 */
import { mkdir, writeFile, readFile, access } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "icons");
const assetsDir = join(root, "assets");

const THEME_COLOR = "#0a0a0a";
const BG_DARK = "#171717";
const WHITE = "#fafafa";
const PADDING_MASKABLE = 0.1; // 80% content area for maskable

function exists(path) {
  return access(path).then(() => true).catch(() => false);
}

/** Premium wave/pulse SVG (no "A" placeholder) – dark bg, white wave. */
function createLogoSvg(size) {
  const pad = size * 0.12;
  const w = size - 2 * pad;
  const h = size - 2 * pad;
  const cx = pad + w / 2;
  const cy = pad + h / 2;
  const stroke = Math.max(2, size / 64);
  // Smooth wave/pulse path (sine-like curve)
  const wave = [
    `M ${pad + w * 0.1} ${cy}`,
    `C ${pad + w * 0.25} ${cy - h * 0.22}, ${pad + w * 0.5} ${cy + h * 0.2}, ${cx} ${cy}`,
    `C ${pad + w * 0.75} ${cy - h * 0.2}, ${pad + w * 0.9} ${cy + h * 0.22}, ${pad + w * 0.9} ${cy}`,
  ].join(" ");
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${THEME_COLOR}"/>
  <rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="${BG_DARK}" rx="${w / 12}"/>
  <path d="${wave}" stroke="${WHITE}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${wave}" stroke="rgba(250,250,250,0.4)" stroke-width="${stroke * 0.5}" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,${size * 0.04})"/>
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
  await mkdir(assetsDir, { recursive: true });

  let sourcePath = join(assetsDir, "logo-1024.png");
  const altPath = join(assetsDir, "logo.png");
  if (await exists(altPath)) sourcePath = altPath;

  let sourceBuffer;
  if (await exists(sourcePath)) {
    sourceBuffer = await readFile(sourcePath);
    console.log("Using source:", sourcePath);
  } else {
    const logoSvg = createLogoSvg(1024);
    sourceBuffer = await sharp(Buffer.from(logoSvg)).png().toBuffer();
    await writeFile(sourcePath, sourceBuffer);
    console.log("Created", sourcePath);
  }

  const source = sharp(sourceBuffer);

  const sizes = [
    [192, "icon-192.png", false],
    [512, "icon-512.png", false],
    [192, "icon-192-maskable.png", true],
    [512, "icon-512-maskable.png", true],
    [512, "maskable-512.png", true],
  ];

  for (const [size, name, maskable] of sizes) {
    let buf;
    if (maskable) {
      const pad = Math.round(size * PADDING_MASKABLE);
      const inner = size - 2 * pad;
      const resized = await source.clone().resize(inner, inner).png().toBuffer();
      const bg = await sharp({
        create: { width: size, height: size, channels: 3, background: THEME_COLOR },
      })
        .png()
        .toBuffer();
      buf = await sharp(bg)
        .composite([{ input: resized, left: pad, top: pad }])
        .png()
        .toBuffer();
    } else {
      buf = await source.clone().resize(size, size).png().toBuffer();
    }
    await writeFile(join(outDir, name), buf);
    console.log("Written", name);
  }

  // apple-touch-icon 180x180
  const appleBuf = await source.clone().resize(180, 180).png().toBuffer();
  await writeFile(join(root, "public", "apple-touch-icon.png"), appleBuf);
  console.log("Written apple-touch-icon.png");

  // Favicons
  const fav32 = await source.clone().resize(32, 32).png().toBuffer();
  await writeFile(join(root, "public", "favicon.png"), fav32);
  await writeFile(join(root, "public", "favicon-32.png"), fav32);
  console.log("Written favicon.png, favicon-32.png");

  const fav16 = await source.clone().resize(16, 16).png().toBuffer();
  await writeFile(join(root, "public", "favicon-16.png"), fav16);
  console.log("Written favicon-16.png");

  console.log("Done. PWA icons + favicons generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
