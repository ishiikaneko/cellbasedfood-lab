/**
 * publish-from-markdown.js
 * 既存のMarkdownファイルを起点にDALL-Eサムネ生成 → heroImage行注入 → git push する
 * 想定起動: node content-os/src/agents/publish-from-markdown.js --payload-file /tmp/publish-<slug>.json
 *
 * payload JSON 形式:
 * { title, description, category, slug, date, markdownPath }
 *   markdownPath は SITE_REPO_PATH からの相対 or 絶対パス
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { generateThumbnail, gitPush, CATEGORY_MAP, SITE_REPO_PATH } from './publisher.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--payload-file') {
      out.payloadFile = argv[i + 1];
      i++;
    }
  }
  return out;
}

function injectHeroImage(filepath, heroImage) {
  const md = readFileSync(filepath, 'utf-8');
  if (md.includes('\nheroImage:')) return false;

  const lines = md.split('\n');
  if (lines[0] !== '---') {
    console.warn(`⚠️  Markdown has no frontmatter, skipping heroImage injection: ${filepath}`);
    return false;
  }

  // frontmatter終端を探す
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) {
    console.warn(`⚠️  Frontmatter not closed, skipping: ${filepath}`);
    return false;
  }

  // aiGenerated 行の直後に挿入。なければ frontmatter 終端の直前に挿入。
  let insertAt = endIdx;
  for (let i = 1; i < endIdx; i++) {
    if (lines[i].startsWith('aiGenerated:')) { insertAt = i + 1; break; }
  }

  lines.splice(insertAt, 0, `heroImage: ${heroImage}`);
  writeFileSync(filepath, lines.join('\n'), 'utf-8');
  return true;
}

async function main() {
  const { payloadFile } = parseArgs(process.argv.slice(2));
  if (!payloadFile) {
    console.error('❌ --payload-file <path> is required');
    process.exit(1);
  }
  if (!existsSync(payloadFile)) {
    console.error(`❌ payload file not found: ${payloadFile}`);
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(payloadFile, 'utf-8'));
  const { title, description, category, slug, date, markdownPath } = payload;

  if (!title || !category || !slug || !date || !markdownPath) {
    console.error('❌ payload missing required fields (title, category, slug, date, markdownPath)');
    process.exit(1);
  }

  const absMdPath = path.isAbsolute(markdownPath)
    ? markdownPath
    : path.join(SITE_REPO_PATH, markdownPath);

  if (!existsSync(absMdPath)) {
    console.error(`❌ markdown file not found: ${absMdPath}`);
    process.exit(1);
  }

  const normalizedCategory = CATEGORY_MAP[category] ?? 'ニュース';

  // 1. サムネ生成（失敗しても続行）
  let heroImage = '';
  if (process.env.OPENAI_API_KEY) {
    try {
      heroImage = await generateThumbnail({ title, description }, normalizedCategory, date, slug);
      console.log(`🖼  Thumbnail generated: ${heroImage}`);
    } catch (e) {
      console.warn(`⚠️  Thumbnail generation failed, continuing without heroImage: ${e.message}`);
    }
  } else {
    console.warn('⚠️  OPENAI_API_KEY not set, skipping thumbnail generation');
  }

  // 2. heroImage 行を Markdown に注入
  if (heroImage) {
    const injected = injectHeroImage(absMdPath, heroImage);
    if (injected) console.log(`✏️  heroImage injected into ${absMdPath}`);
  }

  // 3. git push
  gitPush(absMdPath, title);

  console.log('✅ publish-from-markdown done');
}

main().catch(e => {
  console.error(`❌ ${e.stack || e.message}`);
  process.exit(1);
});
