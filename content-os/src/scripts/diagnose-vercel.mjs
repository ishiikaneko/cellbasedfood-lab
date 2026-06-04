// Vercel Analytics 404 切り分け用の一時診断スクリプト (round 2)。
// 実トークンで複数パターンを叩き、HTTP ステータスを並べて出力する。
// (本番処理は変更しない。原因特定後に削除予定)
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const TOKEN   = process.env.VERCEL_API_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const TEAM    = process.env.VERCEL_TEAM_ID;

const auth = { Authorization: `Bearer ${TOKEN}` };
const trunc = (s, n = 400) => (s.length > n ? s.slice(0, n) + '…' : s);
const teamQ = TEAM ? `&teamId=${TEAM}` : '';
const teamQ1 = TEAM ? `?teamId=${TEAM}` : '';

async function probe(label, url) {
  try {
    const res = await fetch(url, { headers: auth });
    const body = await res.text();
    console.log(`\n[${label}]`);
    console.log(`  URL    : ${url}`);
    console.log(`  status : ${res.status} ${res.statusText}`);
    console.log(`  body   : ${trunc(body)}`);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    console.log(`\n[${label}] FETCH ERROR: ${e.message}`);
    return { ok: false, status: 0, body: '' };
  }
}

async function main() {
  console.log('=== Vercel diagnose round 2 ===');

  // 0) プロジェクトの web analytics / speed insights 有効状態を確認
  try {
    const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT}${teamQ1}`, { headers: auth });
    const p = await res.json();
    console.log('webAnalytics :', JSON.stringify(p.webAnalytics ?? null));
    console.log('speedInsights:', JSON.stringify(p.speedInsights ?? null));
    console.log('analyticsId  :', JSON.stringify(p.analyticsId ?? p.analytics ?? null));
  } catch (e) {
    console.log('project info error:', e.message);
  }

  const to   = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 864e5).toISOString();
  const toMs   = Date.now();
  const fromMs = toMs - 30 * 864e5;
  const DOM = 'www.cellbasedfood-lab.com';

  // 1) エンドポイントのパス候補を総当たり（正しいドメイン www 付きで）
  const variants = [
    ['vercel insights/stats/path',     `https://vercel.com/api/web/insights/stats/path?projectId=${PROJECT}&domain=${DOM}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`],
    ['vercel insights/stats/route',    `https://vercel.com/api/web/insights/stats/route?projectId=${PROJECT}&domain=${DOM}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`],
    ['vercel web-analytics/stats/path',`https://vercel.com/api/web-analytics/stats/path?projectId=${PROJECT}&domain=${DOM}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`],
    ['vercel insights/timeseries',     `https://vercel.com/api/web/insights/timeseries?projectId=${PROJECT}&domain=${DOM}&from=${from}&to=${to}&environment=production${teamQ}`],
    ['vercel insights ms-epoch',       `https://vercel.com/api/web/insights/stats/path?projectId=${PROJECT}&domain=${DOM}&from=${fromMs}&to=${toMs}&limit=20&environment=production${teamQ}`],
    ['vercel insights filter-json',    `https://vercel.com/api/web/insights/stats/path?projectId=${PROJECT}&filter=${encodeURIComponent(JSON.stringify({}))}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`],
    ['api.vercel insights/stats/path', `https://api.vercel.com/web/insights/stats/path?projectId=${PROJECT}&domain=${DOM}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`],
    ['api.vercel v1 web-analytics',    `https://api.vercel.com/v1/web-analytics/stats/path?projectId=${PROJECT}&domain=${DOM}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`],
  ];
  for (const [label, url] of variants) await probe(label, url);

  console.log('\n=== done ===');
}

main();
