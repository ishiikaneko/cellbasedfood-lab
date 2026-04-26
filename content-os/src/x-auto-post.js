import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { publishToTwitter } from './publishers/twitter.js';

const SITE_REPO_PATH = process.env.SITE_REPO_PATH || path.resolve('..', '..');
const BLOG_DIR       = path.join(SITE_REPO_PATH, 'src/content/blog');
const HISTORY_FILE   = path.join(SITE_REPO_PATH, 'data/x-post-history.json');
const SITE_URL       = process.env.SITE_URL || 'https://cellbasedfood-ishiikaneko.com';
const HOURS_GATE     = 36;
const HISTORY_WINDOW = 5;

async function main() {
  const history = loadHistory();

  if (!shouldPost(history)) {
    const lastPost = history.posts.at(-1);
    const elapsed = ((Date.now() - new Date(lastPost.postedAt)) / 3600000).toFixed(1);
    console.log(`⏳ Skip: 最終X投稿から ${elapsed}h（${HOURS_GATE}h 未満）`);
    process.exit(0);
  }

  const articles = readArticles(BLOG_DIR);
  if (articles.length === 0) {
    console.log('ℹ️  記事なし — スキップ');
    process.exit(0);
  }

  const recentSlugs = new Set(history.posts.slice(-HISTORY_WINDOW).map(p => p.slug));
  const pool = articles.filter(a => !recentSlugs.has(a.slug));
  const candidates = pool.length > 0 ? pool : articles;

  const article = candidates[Math.floor(Math.random() * candidates.length)];
  console.log(`📌 選択記事: ${article.slug}`);

  const tweet = await generateTweet(article);
  console.log(`✍️  ツイート(${tweet.length}字): ${tweet}`);

  const articleUrl = `${SITE_URL}/blog/${article.slug}`;
  const result = await publishToTwitter({ tweet, title: article.title }, { articleUrl });
  console.log(`✅ 投稿完了: ${result.url}`);

  history.posts.push({
    slug:     article.slug,
    title:    article.title,
    postedAt: new Date().toISOString(),
    tweetUrl: result.url,
  });
  saveHistory(history);
  commitHistory(SITE_REPO_PATH, HISTORY_FILE, article.title);
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return { posts: [] };
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
}

function saveHistory(h) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2));
}

function shouldPost(h) {
  if (h.posts.length === 0) return true;
  return (Date.now() - new Date(h.posts.at(-1).postedAt)) >= HOURS_GATE * 3600 * 1000;
}

function readArticles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const slug = f.replace(/\.md$/, '');
      const raw  = fs.readFileSync(path.join(dir, f), 'utf-8');
      const fm   = parseFm(raw);
      if (fm.draft === 'true' || fm.draft === true) return null;
      return { slug, title: fm.title || slug, description: fm.description || '' };
    })
    .filter(Boolean);
}

function parseFm(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return fm;
}

async function generateTweet(article) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content:
        `以下の培養肉ブログ記事を130文字以内の日本語ツイートに要約してください。\n` +
        `- 最も重要な知見を1〜2文で。ハッシュタグ不要。\n` +
        `- ツイート本文のみ出力（説明文・引用符なし）\n\n` +
        `タイトル: ${article.title}\n概要: ${article.description}`,
    }],
  });
  return res.content[0].text.trim().slice(0, 130);
}

function commitHistory(repoPath, historyFile, title) {
  const opts = { cwd: repoPath, stdio: 'pipe' };
  execSync(`git add "${historyFile}"`, opts);
  const diff = execSync('git diff --staged --name-only', opts).toString().trim();
  if (!diff) {
    console.log('ℹ️  履歴に変更なし');
    return;
  }
  const msg = `x-post: ${title.slice(0, 60).replace(/"/g, "'")}`;
  execSync(`git commit -m "${msg}"`, opts);
  execSync('git push origin main', opts);
  console.log('🚀 履歴をコミット・プッシュ');
}

main().catch(err => {
  console.error('❌ x-auto-post エラー:', err.message);
  process.exit(1);
});
