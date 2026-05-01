/**
 * publisher.js
 * 記事をMarkdownファイルとして生成し、GitHubにpushする
 * Vercelが自動ビルドしてサイトに反映される
 *
 * 旧: WordPress REST API投稿
 * 新: Markdown生成 → git commit & push → Vercel自動デプロイ
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ── 設定 ──────────────────────────────────────────────────
const SITE_REPO_PATH = process.env.SITE_REPO_PATH || 'C:/Users/Yuji Matsuyoshi/Downloads/cellbasedfood-lab';
const BLOG_DIR       = path.join(SITE_REPO_PATH, 'src/content/blog');
const IMAGES_DIR     = path.join(SITE_REPO_PATH, 'public/images');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// カテゴリーの正規化マップ
const CATEGORY_MAP = {
  '技術':      '技術',
  '科学':      '技術',
  '規制':      '規制・政策',
  '政策':      '規制・政策',
  '規制・政策': '規制・政策',
  '市場':      '市場・投資',
  '投資':      '市場・投資',
  '市場・投資': '市場・投資',
  'ニュース':  'ニュース',
  'コラム':    'その他',  // 旧名称（後方互換）
  'その他':    'その他',
};

// ── メイン関数 ────────────────────────────────────────────
export async function publish(article) {
  console.log(`📝 Publishing: ${article.title}`);

  // 1. スラッグ・ファイル名生成（衝突時はカウンタサフィックスで回避）
  const date = new Date().toISOString().split('T')[0]; // 2026-04-20
  let slug = generateSlug(article.title);
  let filename = `${date}-${slug}.md`;
  let filepath = path.join(BLOG_DIR, filename);
  let counter = 2;
  while (existsSync(filepath)) {
    slug = `${generateSlug(article.title)}-${counter}`;
    filename = `${date}-${slug}.md`;
    filepath = path.join(BLOG_DIR, filename);
    counter++;
  }

  // 2. ディレクトリ確認
  if (!existsSync(BLOG_DIR))   mkdirSync(BLOG_DIR,   { recursive: true });
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

  // 3. カテゴリー正規化
  const category = CATEGORY_MAP[article.category] ?? 'ニュース';

  // 4. サムネイル画像生成（DALL-E 3）
  let heroImage = '';
  if (OPENAI_API_KEY) {
    try {
      heroImage = await generateThumbnail(article, category, date, slug);
      console.log(`🖼  Thumbnail generated: ${heroImage}`);
    } catch (e) {
      console.warn(`⚠️  Thumbnail generation failed: ${e.message}`);
    }
  }

  // 5. Markdownファイル生成
  const markdown = buildMarkdown({ ...article, category, heroImage, date });
  writeFileSync(filepath, markdown, 'utf-8');
  console.log(`✅ Markdown written: ${filepath}`);

  // 6. git commit & push
  gitPush(filepath, article.title);

  return { slug, filepath, heroImage };
}

// ── Markdown生成 ───────────────────────────────────────────
function buildMarkdown({ title, description, category, tags, body, references, relatedLinks, heroImage, date, aiGenerated = true }) {
  const safeTags = (tags ?? []).map(t => `"${t}"`).join(', ');
  const heroLine = heroImage ? `\nheroImage: ${heroImage}` : '';

  const refsSection = references?.length
    ? `\n## 引用文献\n\n${references.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  const relatedSection = relatedLinks?.length
    ? `\n## 関連記事\n\n${relatedLinks.map(l => `- [${l.title}](${l.url})`).join('\n')}\n`
    : '';

  return `---
title: "${title.replace(/"/g, '\\"')}"
description: "${(description ?? '').replace(/"/g, '\\"')}"
pubDate: ${date}
category: ${category}
tags: [${safeTags}]
aiGenerated: ${aiGenerated}${heroLine}
draft: false
---

${body}
${refsSection}${relatedSection}`;
}

// ── DALL-E 3 サムネイル生成 ────────────────────────────────
// カテゴリーごとのベースカラー（記事カテゴリーで統一）
const CATEGORY_COLORS = {
  '技術':      'electric blue (#0066FF)',
  '規制・政策': 'deep navy (#1A3A5C)',
  '市場・投資': 'emerald green (#00AA55)',
  'ニュース':   'vivid orange (#FF6600)',
  'その他':    'soft purple (#7B4FBF)',
};

const RETRY_DELAYS = [5000, 10000, 20000]; // ms

async function generateThumbnail(article, category, date, slug) {
  // 4-1. 記事内容から中央アイコンの具体モチーフを決定（Claudeに抽出させる）
  const iconConcept = await deriveIconConcept(article, category);
  console.log(`🎯 Icon concept: ${iconConcept}`);

  // 4-2. カテゴリー色 ＋ 記事固有アイコン で DALL-E プロンプトを組み立てる
  const prompt = buildImagePrompt(iconConcept, category);

  const imgFilename = `${date}-${slug}.png`;
  const imgPath     = path.join(IMAGES_DIR, imgFilename);

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
          response_format: 'b64_json',
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`DALL-E API error: ${res.status} - ${errBody}`);
      }

      const data = await res.json();
      const b64  = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('DALL-E response missing b64_json');

      writeFileSync(imgPath, Buffer.from(b64, 'base64'));
      return `/images/${imgFilename}`;
    } catch (e) {
      if (attempt < RETRY_DELAYS.length) {
        const waitSec = RETRY_DELAYS[attempt] / 1000;
        console.warn(`⚠️  DALL-E attempt ${attempt + 1} failed: ${e.message}. Retrying in ${waitSec}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      } else {
        throw e;
      }
    }
  }
}

// 記事タイトル・要約からアイコンモチーフ（英語の短い名詞句）を抽出
async function deriveIconConcept(article, category) {
  const fallback = FALLBACK_ICON_BY_CATEGORY[category] ?? FALLBACK_ICON_BY_CATEGORY['その他'];
  if (!ANTHROPIC_API_KEY) return fallback;

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const prompt =
    `You pick a single iconic symbol that visually represents a Japanese article about cultivated meat / cellular agriculture.\n\n` +
    `Title: ${article.title}\n` +
    `Description: ${article.description ?? ''}\n` +
    `Category: ${category}\n\n` +
    `Reply with ONLY a 2–5 word English noun phrase describing one concrete object suitable as a flat white icon (e.g. "DNA double helix", "scale of justice", "bioreactor tank", "rising bar chart", "magnifying glass over molecule"). ` +
    `No punctuation, no quotes, no explanation.`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text?.trim();
    if (!text) return fallback;
    return text.replace(/^["'`]|["'`.]$/g, '').trim() || fallback;
  } catch (e) {
    console.warn(`⚠️  Icon concept derivation failed: ${e.message}`);
    return fallback;
  }
}

// Claude APIが使えない・失敗した場合のカテゴリー別フォールバックアイコン
const FALLBACK_ICON_BY_CATEGORY = {
  '技術':       'DNA double helix',
  '規制・政策': 'document with official seal',
  '市場・投資': 'rising bar chart',
  'ニュース':   'megaphone',
  'その他':     'lightbulb',
};

// 画像プロンプト生成（カテゴリー色 ＋ 記事固有アイコン）
function buildImagePrompt(iconConcept, category) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['ニュース'];

  return [
    `Flat vector icon illustration.`,
    `Solid background filled entirely with ${color}.`,
    `Centered subject: a single white icon depicting ${iconConcept}.`,
    `Perfectly centered in the middle of the canvas, clean geometric lines, generous padding around the icon.`,
    `No text, no letters, no numbers, no watermarks, no gradients, no photo-realism, no people, no borders.`,
    `Style: minimal app-icon aesthetic, 1792x1024 landscape composition.`,
  ].join(' ');
}

// ── Git操作 ────────────────────────────────────────────────
function gitPush(filepath, title) {
  try {
    const opts = { cwd: SITE_REPO_PATH, stdio: 'pipe' };

    // 変更ファイルをステージング（Markdownと画像）
    execSync(`git add src/content/blog/ public/images/`, opts);

    // 差分がなければスキップ
    const diff = execSync('git diff --staged --name-only', opts).toString().trim();
    if (!diff) {
      console.log('ℹ️  No changes to commit.');
      return;
    }

    const commitMsg = `auto: ${title.slice(0, 60)}`;
    execSync(`git commit -m "${commitMsg.replace(/"/g, "'")}"`, opts);
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', opts).toString().trim();
    execSync(`git push -u origin ${currentBranch}`, opts);
    console.log(`🚀 Pushed to GitHub: ${commitMsg}`);
  } catch (e) {
    console.error(`❌ Git push failed: ${e.message}`);
    throw e;
  }
}

// ── スラッグ生成 ───────────────────────────────────────────
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[\u3000-\u9fff\uff00-\uffef]/g, '') // 日本語文字を除去
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    || `post-${Date.now()}`;
}
