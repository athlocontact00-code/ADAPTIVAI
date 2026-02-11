import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "public", "stock", "raw");
const OUTPUT_DIR = path.join(ROOT, "public", "stock", "processed");
const MOCKUPS_INPUT_DIR = path.join(ROOT, "public", "mockups", "raw");
const MOCKUPS_OUTPUT_DIR = path.join(ROOT, "public", "mockups", "processed");

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

function fnv1a32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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

async function grainTilePng({ size = 512, opacity = 0.08, amplitude = 26, seed = 0 }) {
  const rng = mulberry32(fnv1a32(`grain:${size}:${opacity}:${amplitude}`) ^ (seed >>> 0));
  const channels = 4;
  const buf = Buffer.alloc(size * size * channels);
  const alpha = clampByte(Math.round(255 * opacity));

  for (let i = 0; i < size * size; i++) {
    const v = clampByte(Math.round(128 + (rng() - 0.5) * 2 * amplitude));
    const idx = i * channels;
    buf[idx + 0] = v;
    buf[idx + 1] = v;
    buf[idx + 2] = v;
    buf[idx + 3] = alpha;
  }

  return sharp(buf, { raw: { width: size, height: size, channels } }).png().toBuffer();
}

function computeAlphaBounds({ data, width, height, channels }) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const a = data[idx + 3];
      if (a && a > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return { minX, minY, maxX, maxY };
}

async function keyOutLightBackgroundToWebp({
  inputPath,
  outputPath,
  threshold,
  softness = 16,
  cropPadding = 3,
}) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  const channels = info.channels ?? 4;

  for (let i = 0; i < out.length; i += channels) {
    const r = out[i + 0];
    const g = out[i + 1];
    const b = out[i + 2];
    const v = Math.min(r, g, b);

    if (v >= threshold) {
      out[i + 3] = 0;
      continue;
    }
    if (v >= threshold - softness) {
      const a = clampByte(Math.round((255 * (threshold - v)) / softness));
      out[i + 3] = a;
    }
  }

  const bounds = computeAlphaBounds({
    data: out,
    width: info.width,
    height: info.height,
    channels,
  });

  const base = sharp(out, {
    raw: { width: info.width, height: info.height, channels },
  });

  const pipeline = bounds
    ? base.extract({
        left: Math.max(0, bounds.minX - cropPadding),
        top: Math.max(0, bounds.minY - cropPadding),
        width: Math.min(
          info.width - Math.max(0, bounds.minX - cropPadding),
          bounds.maxX - bounds.minX + 1 + cropPadding * 2,
        ),
        height: Math.min(
          info.height - Math.max(0, bounds.minY - cropPadding),
          bounds.maxY - bounds.minY + 1 + cropPadding * 2,
        ),
      })
    : base;

  await pipeline.webp({ quality: 100, lossless: true, effort: 4 }).toFile(outputPath);
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
  const grain = await grainTilePng({
    size: 512,
    opacity: GRAIN_OPACITY,
    seed: fnv1a32(`${baseName}:${suffix}:${outW}x${outH}`),
  });

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

  if (await exists(MOCKUPS_INPUT_DIR)) {
    await fs.mkdir(MOCKUPS_OUTPUT_DIR, { recursive: true });
    console.log(
      `\nProcessing mockups from ${path.relative(ROOT, MOCKUPS_INPUT_DIR)} → ${path.relative(ROOT, MOCKUPS_OUTPUT_DIR)}`,
    );

    const macbookIn = path.join(MOCKUPS_INPUT_DIR, "macbook.png");
    if (await exists(macbookIn)) {
      const macbookOut = path.join(MOCKUPS_OUTPUT_DIR, "macbook.webp");
      await keyOutLightBackgroundToWebp({
        inputPath: macbookIn,
        outputPath: macbookOut,
        threshold: 245, // white studio bg (removes edge halos)
        softness: 22,
        cropPadding: 4,
      });
      console.log(`- macbook.png → ${path.relative(ROOT, macbookOut)}`);
    }

    const iphoneIn = path.join(MOCKUPS_INPUT_DIR, "iphone-frame.png");
    if (await exists(iphoneIn)) {
      const iphoneOut = path.join(MOCKUPS_OUTPUT_DIR, "iphone-frame.webp");
      await keyOutLightBackgroundToWebp({
        inputPath: iphoneIn,
        outputPath: iphoneOut,
        threshold: 231, // removes checkerboard (≈232/255) without killing device edges
        softness: 14,
        cropPadding: 4,
      });
      console.log(`- iphone-frame.png → ${path.relative(ROOT, iphoneOut)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

