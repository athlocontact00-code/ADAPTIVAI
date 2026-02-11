import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "public", "stock", "raw");
const OUTPUT_DIR = path.join(ROOT, "public", "stock", "processed");

const VARIANTS = [
  { suffix: "hero", width: 2400 },
  { suffix: "section", width: 1600 },
];

const DARK_OVERLAY_OPACITY = 0.64; // 55–70%
const GLOW_STRENGTH = 0.9; // subtle
const GRAIN_OPACITY = 0.08; // 5–10%

function clampByte(n) {
  return Math.max(0, Math.min(255, n));
}

function svgSolidOverlay({ width, height, opacity }) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgba(0,0,0,${opacity})"/>
    </svg>`,
  );
}

function svgSunsetGlow({ width, height, strength }) {
  const orange = 0.38 * strength;
  const purple = 0.24 * strength;
  const navy = 0.20 * strength;

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sunset" cx="18%" cy="12%" r="75%">
          <stop offset="0%" stop-color="rgb(255,122,24)" stop-opacity="${orange}"/>
          <stop offset="45%" stop-color="rgb(168,85,247)" stop-opacity="${purple}"/>
          <stop offset="72%" stop-color="rgb(30,58,138)" stop-opacity="${navy}"/>
          <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#sunset)"/>
    </svg>`,
  );
}

async function grainTilePng({ size = 512, opacity = 0.08, amplitude = 26 }) {
  const channels = 4;
  const buf = Buffer.alloc(size * size * channels);
  const alpha = clampByte(Math.round(255 * opacity));

  for (let i = 0; i < size * size; i++) {
    const v = clampByte(Math.round(128 + (Math.random() - 0.5) * 2 * amplitude));
    const idx = i * channels;
    buf[idx + 0] = v;
    buf[idx + 1] = v;
    buf[idx + 2] = v;
    buf[idx + 3] = alpha;
  }

  return sharp(buf, { raw: { width: size, height: size, channels } }).png().toBuffer();
}

async function listInputImages() {
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(jpe?g|png)$/i.test(name))
    .sort();
}

async function processOneVariant({ inputPath, baseName, width, suffix }) {
  const meta = await sharp(inputPath).rotate().metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Could not read dimensions for: ${inputPath}`);
  }

  const scale = Math.min(1, width / meta.width);
  const outW = Math.round(meta.width * scale);
  const outH = Math.round(meta.height * scale);

  const darkOverlay = svgSolidOverlay({
    width: outW,
    height: outH,
    opacity: DARK_OVERLAY_OPACITY,
  });
  const glowOverlay = svgSunsetGlow({ width: outW, height: outH, strength: GLOW_STRENGTH });
  const grain = await grainTilePng({ size: 512, opacity: GRAIN_OPACITY });

  const outFile = path.join(OUTPUT_DIR, `${baseName}-${suffix}.webp`);

  await sharp(inputPath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .toColourspace("srgb")
    .composite([
      { input: darkOverlay, blend: "over" },
      { input: glowOverlay, blend: "screen" },
      { input: grain, tile: true, blend: "overlay" },
    ])
    .sharpen(0.7)
    .webp({ quality: 82, effort: 4 })
    .toFile(outFile);

  return outFile;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const inputs = await listInputImages();
  if (inputs.length === 0) {
    console.error(`No images found in: ${INPUT_DIR}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Processing ${inputs.length} image(s) from ${path.relative(ROOT, INPUT_DIR)} → ${path.relative(ROOT, OUTPUT_DIR)}`);

  for (const file of inputs) {
    const inputPath = path.join(INPUT_DIR, file);
    const baseName = path.parse(file).name;

    console.log(`- ${file}`);
    for (const variant of VARIANTS) {
      const out = await processOneVariant({
        inputPath,
        baseName,
        width: variant.width,
        suffix: variant.suffix,
      });
      console.log(`  - ${path.relative(ROOT, out)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

