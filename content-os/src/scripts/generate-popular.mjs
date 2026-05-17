import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

import { fetchPopularBlogSlugs } from '../analytics/vercel.js';

// content-os/src/scripts/ → ../../.. → repo root → src/data/popular.json
const OUTPUT_PATH = join(__dirname, '../../../src/data/popular.json');

async function main() {
  const tokenPresent = Boolean(process.env.VERCEL_API_TOKEN);
  const projectIdPrefix = (process.env.VERCEL_PROJECT_ID ?? '').slice(0, 6);
  const teamIdPresent = Boolean(process.env.VERCEL_TEAM_ID);
  console.log(
    `Fetching popular blog posts from Vercel Analytics... ` +
    `(token: ${tokenPresent}, projectId: ${projectIdPrefix}…, teamId: ${teamIdPresent})`
  );

  const result = await fetchPopularBlogSlugs({ days: 30, topN: 3 });
  if (result.blogPaths.length === 0) {
    console.warn('No blog paths found in analytics. popular.json not written.');
    return;
  }
  const output = {
    generatedAt: new Date().toISOString(),
    period:      result.period,
    totalViews:  result.totalViews,
    slugs:       result.blogPaths.map((p) => p.slug),
  };
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Wrote popular.json → ${OUTPUT_PATH}`);
  result.blogPaths.forEach((p, i) => console.log(`  ${i + 1}. ${p.slug} (${p.views} views)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
