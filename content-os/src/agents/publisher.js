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
import fetch from 'node-fetch';

// ── 設定 ──────────────────────────────────────────────────
const SITE_REPO_PATH = process.env.SITE_REPO_PATH || 'C:/Users/Yuji Matsuyoshi/Downloads/cellbasedfood-lab';
const BLOG_DIR       = path.join(SITE_REPO_PATH, 'src/content/blog');
const IMAGES_DIR     = path.join(SITE_REPO_PATH, 'public/images');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // DALL-E 3用（任意）

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

  // 1. スラッグ・ファイル名生成
  const date   = new Date().toISOString().split('T')[0]; // 2026-04-20
  const slug   = generateSlug(article.title);
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(BLOG_DIR, filename);

  // 2. ディレクトリ確認
  if (!existsSync(BLOG_DIR))   mkdirSync(BLOG_DIR,   { recursive: true });
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

  // 3. サムネイル画像生成（DALL-E 3 / フォールバック）
  let heroImage = '';
  if (OPENAI_API_KEY) {
    try {
      heroImage = await generateThumbnail(article, date, slug);
      console.log(`🖼  Thumbnail generated: ${heroImage}`);
    } catch (e) {
      console.warn(`⚠️  Thumbnail generation failed: ${e.message}`);
    }
  }

  // 4. カテゴリー正規化
  const category = CATEGORY_MAP[article.category] ?? 'ニュース';

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
async function generateThumbnail(article, date, slug) {
  // 画像生成プロンプトを記事タイトルから作成
  const prompt = buildImagePrompt(article.title, article.category);

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
      size: '1792x1024',      // ブログOGP推奨サイズ
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) throw new Error(`DALL-E API error: ${res.status}`);
  const data = await res.json();
  const b64  = data.data[0].b64_json;

  // base64 → PNG保存
  const imgFilename = `${date}-${slug}.png`;
  const imgPath     = path.join(IMAGES_DIR, imgFilename);
  writeFileSync(imgPath, Buffer.from(b64, 'base64'));

  return `/images/${imgFilename}`;
}

// 画像プロンプト生成
function buildImagePrompt(title, category) {
  const categoryPrompts = {
    '技術':      'scientific laboratory, cell culture, biotechnology, clean modern style,',
    '規制・政策': 'government documents, policy, law, formal official style,',
    '市場・投資': 'business chart, market data, investment, financial visualization,',
    'ニュース':   'breaking news, global food technology, modern editorial style,',
    'その他':    'thoughtful essay, researcher writing, academic atmosphere,',
  };
  const base = categoryPrompts[category] ?? '';
  return `${base} cultured meat, cell-based food technology, professional blog thumbnail, minimal clean design, no text, 16:9 ratio. Topic: ${title}`;
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
    execSync(`git push origin main`, opts);
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
