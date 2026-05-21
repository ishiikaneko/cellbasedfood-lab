import { Resvg } from '@resvg/resvg-js';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'public/images');
const OUT = join(ROOT, 'public/images/og');
const DEFAULT_SRC_BASENAME = '2026-05-02-cellbasedfood-lab-started.svg';
const DEFAULT_OUT = join(ROOT, 'public/og-default.png');

function rasterize(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: '#ffffff',
    font: { loadSystemFonts: true, defaultFontFamily: 'serif' },
  });
  return resvg.render().asPng();
}

function isUpToDate(srcPath, outPath) {
  if (!existsSync(outPath)) return false;
  return statSync(outPath).mtimeMs >= statSync(srcPath).mtimeMs;
}

function main() {
  mkdirSync(OUT, { recursive: true });

  const svgFiles = readdirSync(SRC).filter(n => n.endsWith('.svg'));
  let generated = 0;
  let skipped = 0;

  for (const f of svgFiles) {
    const srcPath = join(SRC, f);
    const outPath = join(OUT, basename(f, '.svg') + '.png');

    if (isUpToDate(srcPath, outPath)) {
      skipped++;
      continue;
    }

    const svg = readFileSync(srcPath, 'utf8');
    const png = rasterize(svg);
    writeFileSync(outPath, png);
    console.log(`OK  ${f} → og/${basename(outPath)}`);
    generated++;
  }

  const defaultSrc = join(SRC, DEFAULT_SRC_BASENAME);
  const defaultGeneratedPath = join(OUT, basename(DEFAULT_SRC_BASENAME, '.svg') + '.png');
  if (existsSync(defaultGeneratedPath)) {
    if (!existsSync(DEFAULT_OUT) || statSync(DEFAULT_OUT).mtimeMs < statSync(defaultGeneratedPath).mtimeMs) {
      copyFileSync(defaultGeneratedPath, DEFAULT_OUT);
      console.log(`OK  ${DEFAULT_SRC_BASENAME} → og-default.png`);
      generated++;
    } else {
      skipped++;
    }
  } else if (existsSync(defaultSrc)) {
    const svg = readFileSync(defaultSrc, 'utf8');
    writeFileSync(DEFAULT_OUT, rasterize(svg));
    console.log(`OK  ${DEFAULT_SRC_BASENAME} → og-default.png`);
    generated++;
  }

  console.log(`\nDone. generated=${generated}, skipped=${skipped}`);
}

main();
