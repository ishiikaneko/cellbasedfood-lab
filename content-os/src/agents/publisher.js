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

  // 1. スラッグ・ファイル名生成
  const date   = new Date().toISOString().split('T')[0]; // 2026-04-20
  const slug   = generateSlug(article.title);
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(BLOG_DIR, filename);

  // 2. ディレクトリ確認
  if (!existsSync(BLOG_DIR))   mkdirSync(BLOG_DIR,   { recursive: true });
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

  // 3. カテゴリー正規化
  const category = CATEGORY_MAP[article.category] ?? 'ニュース';

  // 4. サムネイル画像生成（DALL-E 3 → SVGフォールバック）
  let heroImage = '';
  if (OPENAI_API_KEY) {
    try {
      heroImage = await generateThumbnail(article, category, date, slug);
      console.log(`🖼  Thumbnail generated: ${heroImage}`);
    } catch (e) {
      console.error(`❌ DALL-E thumbnail generation failed: ${e.message}`);
    }
  } else {
    console.warn('⚠️  OPENAI_API_KEY is not set. Falling back to SVG placeholder.');
  }

  // DALL-E未設定・失敗時はSVGプレースホルダーを生成（heroImageを必ず持つ）
  if (!heroImage) {
    heroImage = await generateSvgPlaceholder(article, category, date, slug);
    console.log(`🖼  SVG placeholder generated: ${heroImage}`);
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

async function generateThumbnail(article, category, date, slug) {
  // 4-1. 記事内容から中央アイコンの具体モチーフを決定（Claudeに抽出させる）
  const iconConcept = await deriveIconConcept(article, category);
  console.log(`🎯 Icon concept: ${iconConcept}`);

  // 4-2. カテゴリー色 ＋ 記事固有アイコン で DALL-E プロンプトを組み立てる
  const prompt = buildImagePrompt(iconConcept, category);

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
    const body = await res.text().catch(() => '');
    throw new Error(`DALL-E API error: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64  = data.data?.[0]?.b64_json;
  if (!b64) throw new Error(`DALL-E response missing b64_json: ${JSON.stringify(data).slice(0, 200)}`);

  const imgFilename = `${date}-${slug}.png`;
  const imgPath     = path.join(IMAGES_DIR, imgFilename);
  writeFileSync(imgPath, Buffer.from(b64, 'base64'));

  return `/images/${imgFilename}`;
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

// ── SVGプレースホルダー生成（記事内容対応） ─────────────────
const SVG_CATEGORY_STYLES = {
  '技術':       { bg: '#0F6E56', accent: '#5DCAA5' },
  '規制・政策': { bg: '#1A3A5C', accent: '#6A9FD8' },
  '市場・投資': { bg: '#00AA55', accent: '#66DD99' },
  'ニュース':   { bg: '#CC5200', accent: '#FF9966' },
  'その他':     { bg: '#5B3A8C', accent: '#B088DD' },
};

// アイコン定義（100x100 viewBox、白シェイプのみ）
const ICON_SHAPES = {
  dna: `
    <path d="M32,12 C44,22 56,32 68,42 C56,52 44,62 32,72 C44,82 56,90 66,95" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
    <path d="M68,12 C56,22 44,32 32,42 C44,52 56,62 68,72 C56,82 44,90 34,95" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
    <line x1="44" y1="24" x2="56" y2="30" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="37" y1="42" x2="63" y2="42" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="44" y1="60" x2="56" y2="54" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="37" y1="74" x2="63" y2="74" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`,
  cell: `
    <ellipse cx="50" cy="50" rx="33" ry="28" fill="none" stroke="white" stroke-width="3"/>
    <ellipse cx="50" cy="50" rx="14" ry="12" fill="white" opacity="0.85"/>
    <circle cx="36" cy="38" r="4" fill="white" opacity="0.6"/>
    <circle cx="64" cy="60" r="3.5" fill="white" opacity="0.6"/>
    <circle cx="40" cy="65" r="3" fill="white" opacity="0.5"/>`,
  flask: `
    <path d="M40,14 L40,46 L19,76 Q14,88 26,88 L74,88 Q86,88 81,76 L60,46 L60,14 Z" fill="none" stroke="white" stroke-width="3.5" stroke-linejoin="round"/>
    <line x1="33" y1="14" x2="67" y2="14" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="40" cy="66" r="4" fill="white" opacity="0.75"/>
    <circle cx="55" cy="74" r="3" fill="white" opacity="0.75"/>
    <circle cx="46" cy="59" r="3" fill="white" opacity="0.6"/>`,
  chart: `
    <rect x="13" y="55" width="16" height="27" rx="2" fill="white"/>
    <rect x="36" y="36" width="16" height="46" rx="2" fill="white"/>
    <rect x="59" y="18" width="16" height="64" rx="2" fill="white"/>
    <line x1="8" y1="85" x2="90" y2="85" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="8" y1="85" x2="8" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`,
  checkmark: `
    <circle cx="50" cy="50" r="35" fill="none" stroke="white" stroke-width="4"/>
    <path d="M27,50 L42,65 L73,34" fill="none" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ban: `
    <circle cx="50" cy="50" r="35" fill="none" stroke="white" stroke-width="4.5"/>
    <line x1="24" y1="76" x2="76" y2="24" stroke="white" stroke-width="4.5" stroke-linecap="round"/>`,
  scaffold: `
    <rect x="15" y="15" width="70" height="70" rx="3" fill="none" stroke="white" stroke-width="3"/>
    <line x1="38" y1="15" x2="38" y2="85" stroke="white" stroke-width="2"/>
    <line x1="62" y1="15" x2="62" y2="85" stroke="white" stroke-width="2"/>
    <line x1="15" y1="38" x2="85" y2="38" stroke="white" stroke-width="2"/>
    <line x1="15" y1="62" x2="85" y2="62" stroke="white" stroke-width="2"/>
    <circle cx="38" cy="38" r="4.5" fill="white"/>
    <circle cx="62" cy="38" r="4.5" fill="white"/>
    <circle cx="38" cy="62" r="4.5" fill="white"/>
    <circle cx="62" cy="62" r="4.5" fill="white"/>`,
  document: `
    <rect x="22" y="10" width="56" height="72" rx="4" fill="none" stroke="white" stroke-width="3"/>
    <line x1="33" y1="30" x2="67" y2="30" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="33" y1="43" x2="67" y2="43" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="33" y1="56" x2="54" y2="56" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="66" cy="74" r="11" fill="none" stroke="white" stroke-width="2.5"/>
    <path d="M60,74 L64,78 L72,68" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  droplet: `
    <path d="M50,12 C50,12 18,50 18,65 C18,83 33,92 50,92 C67,92 82,83 82,65 C82,50 50,12 50,12 Z" fill="none" stroke="white" stroke-width="3.5"/>
    <ellipse cx="40" cy="72" rx="9" ry="5.5" fill="white" opacity="0.55" transform="rotate(-25 40 72)"/>`,
  microscope: `
    <rect x="40" y="10" width="20" height="36" rx="3" fill="none" stroke="white" stroke-width="3"/>
    <circle cx="50" cy="50" r="18" fill="none" stroke="white" stroke-width="3"/>
    <circle cx="50" cy="50" r="7" fill="white" opacity="0.85"/>
    <rect x="44" y="68" width="12" height="20" fill="white" opacity="0.9"/>
    <line x1="28" y1="88" x2="72" y2="88" stroke="white" stroke-width="3" stroke-linecap="round"/>`,
  megaphone: `
    <path d="M18,38 L18,62 L34,62 L62,80 L62,20 L34,38 Z" fill="none" stroke="white" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="18" y="38" width="16" height="24" rx="2" fill="white" opacity="0.85"/>
    <path d="M70,35 Q80,50 70,65" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M74,28 Q88,50 74,72" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,
};

// iconConceptのキーワードから最適なアイコンキーを選択
function selectIconKey(iconConcept) {
  const c = (iconConcept || '').toLowerCase();
  if (c.includes('dna') || c.includes('helix') || c.includes('gene') || c.includes('sequence') || c.includes('chromos')) return 'dna';
  if (c.includes('chart') || c.includes('bar') || c.includes('graph') || c.includes('invest') || c.includes('market') || c.includes('report')) return 'chart';
  if (c.includes('ban') || c.includes('prohibit') || c.includes('forbid') || c.includes('restrict')) return 'ban';
  if (c.includes('approv') || c.includes('check') || c.includes('certif') || c.includes('permit') || c.includes('grant')) return 'checkmark';
  if (c.includes('scaffold') || c.includes('matrix') || c.includes('polymer') || c.includes('biomaterial') || c.includes('grid')) return 'scaffold';
  if (c.includes('flask') || c.includes('beaker') || c.includes('media') || c.includes('tank') || c.includes('bioreactor') || c.includes('culture')) return 'flask';
  if (c.includes('fat') || c.includes('adipose') || c.includes('lipid') || c.includes('droplet')) return 'droplet';
  if (c.includes('microscop') || c.includes('single') || c.includes('magnif')) return 'microscope';
  if (c.includes('megaphon') || c.includes('news') || c.includes('announce') || c.includes('broadcast')) return 'megaphone';
  if (c.includes('document') || c.includes('law') || c.includes('regulat') || c.includes('seal') || c.includes('official') || c.includes('policy') || c.includes('scale of just')) return 'document';
  if (c.includes('cell') || c.includes('satellite') || c.includes('stem') || c.includes('myosatellite') || c.includes('progenitor') || c.includes('nucleus')) return 'cell';
  return 'dna'; // デフォルト
}

async function generateSvgPlaceholder(article, category, date, slug) {
  const { bg } = SVG_CATEGORY_STYLES[category] ?? SVG_CATEGORY_STYLES['その他'];

  // 記事内容からアイコンコンセプトを取得し、対応する定義済みアイコンを選択
  const iconConcept = await deriveIconConcept(article, category);
  console.log(`🎯 Icon concept: ${iconConcept}`);
  const iconKey = selectIconKey(iconConcept);
  const shapes = ICON_SHAPES[iconKey];

  // アイコンを1792x1024キャンバスの中央に配置（100x100→300x300にスケール）
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1792 1024" width="1792" height="1024">
  <rect width="1792" height="1024" fill="${bg}"/>
  <g transform="translate(746,362) scale(3)">${shapes}
  </g>
</svg>`;

  const imgFilename = `${date}-${slug}.svg`;
  const imgPath = path.join(IMAGES_DIR, imgFilename);
  writeFileSync(imgPath, svg, 'utf-8');
  return `/images/${imgFilename}`;
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
    // HEADにpush（どのブランチでも正しく動作する）
    execSync(`git push origin HEAD`, opts);
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
