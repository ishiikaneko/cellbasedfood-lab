// public/images/*.svg を OGP 用の PNG（public/og/*.png）に変換する。
//
// X（Twitter）や Facebook など主要 SNS のカードクローラーは og:image に
// SVG を指定しても画像として認識しない（PNG / JPEG / WebP / GIF のみ対応）。
// 記事のヒーロー画像は SVG なので、そのままだと URL を貼ってもカードに画像が
// 出ない。ここで同じ絵柄を PNG に焼き込み、BaseLayout がそちらを og:image /
// twitter:image に使えるようにする。
//
// 実行: npm run generate-og（build の前段でも自動実行される）
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '../public/images');
const OUT_DIR = join(__dirname, '../public/og');

// X 大判カードの推奨は横 1200px 以上・比率 1.91:1〜1:1。元 SVG の比率を保ったまま
// 横 1200px で書き出す（1792x1024 の SVG なら 1200x686 になり推奨範囲に収まる）。
const WIDTH = 1200;

mkdirSync(OUT_DIR, { recursive: true });

const svgFiles = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.svg'));

let count = 0;
for (const file of svgFiles) {
  const svg = readFileSync(join(SRC_DIR, file), 'utf-8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  const png = resvg.render().asPng();
  const outName = basename(file, '.svg') + '.png';
  writeFileSync(join(OUT_DIR, outName), png);
  console.log(`  OK  ${file} → og/${outName} (${png.length.toLocaleString()} bytes)`);
  count++;
}

console.log(`Generated ${count} OGP image(s) → ${OUT_DIR}`);
