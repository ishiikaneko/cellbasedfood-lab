/**
 * heroImage が未設定のブログ記事に SVG サムネを自動生成するスクリプト。
 * ANTHROPIC_API_KEY があればアイコンコンセプトを Claude で導出し、
 * なければカテゴリーごとのフォールバックアイコンを使う。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..');
const BLOG_DIR   = path.join(REPO_ROOT, 'src/content/blog');
const IMAGES_DIR = path.join(REPO_ROOT, 'public/images');

// ── SVG スタイル定義 ─────────────────────────────────────────
const SVG_CATEGORY_STYLES = {
  '技術':       { bg: '#0F6E56' },
  '規制・政策': { bg: '#1A3A5C' },
  '市場・投資': { bg: '#00AA55' },
  'ニュース':   { bg: '#CC5200' },
  'その他':     { bg: '#5B3A8C' },
};

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

const FALLBACK_ICON_BY_CATEGORY = {
  '技術':       'DNA double helix',
  '規制・政策': 'document with official seal',
  '市場・投資': 'rising bar chart',
  'ニュース':   'megaphone',
  'その他':     'lightbulb',
};

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
  if (c.includes('cell') || c.includes('satellite') || c.includes('stem') || c.includes('myosatellite') || c.includes('progenitor') || c.includes('nucleus') || c.includes('myoblast') || c.includes('muscle')) return 'cell';
  return 'dna';
}

async function deriveIconConcept(title, description, category) {
  const fallback = FALLBACK_ICON_BY_CATEGORY[category] ?? 'DNA double helix';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const prompt =
    `You pick a single iconic symbol that visually represents a Japanese article about cultivated meat / cellular agriculture.\n\n` +
    `Title: ${title}\nDescription: ${description ?? ''}\nCategory: ${category}\n\n` +
    `Reply with ONLY a 2–5 word English noun phrase describing one concrete object suitable as a flat white icon. No punctuation, no quotes, no explanation.`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text?.trim();
    return text?.replace(/^["'`]|["'`.]$/g, '').trim() || fallback;
  } catch {
    return fallback;
  }
}

function generateSvg(bg, iconKey) {
  const shapes = ICON_SHAPES[iconKey] ?? ICON_SHAPES.dna;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1792 1024" width="1792" height="1024">
  <rect width="1792" height="1024" fill="${bg}"/>
  <g transform="translate(746,362) scale(3)">${shapes}
  </g>
</svg>`;
}

// ── フロントマター解析 ────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, rest: content };
  const lines = match[1].split('\n');
  const meta = {};
  for (const line of lines) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { meta, frontmatterBlock: match[0], rest: content.slice(match[0].length) };
}

function injectHeroImage(content, heroImage) {
  // draft: の行の直前に heroImage を挿入（なければ --- の直前に）
  if (content.includes('\ndraft:')) {
    return content.replace('\ndraft:', `\nheroImage: ${heroImage}\ndraft:`);
  }
  return content.replace(/\n---\n/, `\nheroImage: ${heroImage}\n---\n`);
}

// ── メイン ────────────────────────────────────────────────────
async function main() {
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  let generated = 0;

  for (const file of files) {
    const filepath = path.join(BLOG_DIR, file);
    const content = readFileSync(filepath, 'utf-8');
    const { meta } = parseFrontmatter(content);

    if (meta.heroImage) {
      console.log(`⏭  Skip (already has heroImage): ${file}`);
      continue;
    }

    const title       = meta.title ?? file;
    const description = meta.description ?? '';
    const category    = meta.category ?? '技術';
    const pubDate     = meta.pubDate ?? new Date().toISOString().split('T')[0];

    // スラッグ: ファイル名から .md を除いたもの（日付プレフィックスがあれば除去）
    const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const imgFilename = `${pubDate}-${slug}.svg`;
    const imgPath     = path.join(IMAGES_DIR, imgFilename);
    const heroImage   = `/images/${imgFilename}`;

    console.log(`🎨 Generating thumbnail for: ${file}`);
    const iconConcept = await deriveIconConcept(title, description, category);
    console.log(`   Icon concept: ${iconConcept}`);

    const iconKey = selectIconKey(iconConcept);
    const { bg }  = SVG_CATEGORY_STYLES[category] ?? SVG_CATEGORY_STYLES['その他'];
    const svg     = generateSvg(bg, iconKey);

    writeFileSync(imgPath, svg, 'utf-8');
    console.log(`   Saved: ${imgPath}`);

    const updated = injectHeroImage(content, heroImage);
    writeFileSync(filepath, updated, 'utf-8');
    console.log(`   Updated frontmatter: ${filepath}`);

    generated++;
  }

  console.log(`\n✅ Done. Generated ${generated} thumbnail(s).`);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
