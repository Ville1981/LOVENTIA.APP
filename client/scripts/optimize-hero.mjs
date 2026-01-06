import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const input = path.join(root, "public", "hero.jpg");

if (!fs.existsSync(input)) {
  console.error("❌ hero.jpg not found at:", input);
  process.exit(1);
}

const outDir = path.join(root, "public");
const widths = [480, 768, 1024, 1280, 1536, 1920];

const img = sharp(input);
const meta = await img.metadata();

console.log("✅ hero.jpg metadata:", {
  width: meta.width,
  height: meta.height,
  format: meta.format,
});

for (const w of widths) {
  const base = sharp(input).resize({ width: w, withoutEnlargement: true });

  // AVIF (best compression)
  await base
    .clone()
    .avif({ quality: 45, effort: 5 })
    .toFile(path.join(outDir, `hero-${w}.avif`));

  // WEBP (very good)
  await base
    .clone()
    .webp({ quality: 70, effort: 5 })
    .toFile(path.join(outDir, `hero-${w}.webp`));

  // JPG fallback (progressive)
  await base
    .clone()
    .jpeg({ quality: 75, progressive: true, mozjpeg: true })
    .toFile(path.join(outDir, `hero-${w}.jpg`));

  console.log(`✅ Generated ${w}px variants`);
}

console.log("🎉 Done. Files written to client/public as hero-{w}.avif/.webp/.jpg");
