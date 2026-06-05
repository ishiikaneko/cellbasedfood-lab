import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

import { fetchPopularBlogSlugs } from '../analytics/vercel.js';

// content-os/src/scripts/ → ../../.. → repo root → src/data/popular.json
const OUTPUT_PATH = join(__dirname, '../../../src/data/popular.json');

function readExisting() {
  if (!existsSync(OUTPUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')) ?? {};
  } catch {
    return {};
  }
}

function writeOutput(payload) {
  // 手動キュレーション (manual) はサイト側で最優先表示されるため、
  // Analytics の自動更新で消えないよう常に保持する。
  const existing = readExisting();
  const manual = Array.isArray(existing.manual) ? existing.manual : [];
  const out = { manual, ...payload };
  writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf-8');
}

function readExistingSlugs() {
  const cur = readExisting();
  return Array.isArray(cur?.slugs) ? cur.slugs : [];
}

async function main() {
  console.log('Fetching popular blog posts from Vercel Analytics...');
  try {
    const result = await fetchPopularBlogSlugs({ days: 30, topN: 3 });
    if (result.blogPaths.length === 0) {
      console.warn('No blog paths found in analytics. Keeping previous slugs.');
      writeOutput({
        generatedAt: new Date().toISOString(),
        period:      result.period,
        totalViews:  result.totalViews ?? 0,
        slugs:       readExistingSlugs(),
      });
      return;
    }
    writeOutput({
      generatedAt: new Date().toISOString(),
      period:      result.period,
      totalViews:  result.totalViews,
      slugs:       result.blogPaths.map((p) => p.slug),
    });
    console.log(`Wrote popular.json → ${OUTPUT_PATH}`);
    result.blogPaths.forEach((p, i) => console.log(`  ${i + 1}. ${p.slug} (${p.views} views)`));
  } catch (err) {
    console.error(`Failed to fetch popular posts: ${err.message}`);
    // 既存ファイルがあれば触らずに正常終了 (workflow を落とさない)
    if (existsSync(OUTPUT_PATH)) {
      console.warn('Keeping existing popular.json.');
      return;
    }
    // 初回でファイルすら無い場合は空で書き出す
    writeOutput({
      generatedAt: new Date().toISOString(),
      period:      null,
      totalViews:  0,
      slugs:       [],
    });
  }
}

main();
