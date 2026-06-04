// Vercel Analytics 404 切り分け用の一時診断スクリプト。
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
const DOMAIN  = process.env.VERCEL_ANALYTICS_DOMAIN || 'cellbasedfood-lab.com';

const auth = { Authorization: `Bearer ${TOKEN}` };
const trunc = (s, n = 300) => (s.length > n ? s.slice(0, n) + '…' : s);

async function probe(label, url) {
  try {
    const res = await fetch(url, { headers: auth });
    const body = await res.text();
    console.log(`\n[${label}]`);
    console.log(`  URL    : ${url.replace(TOKEN ?? '__none__', '***')}`);
    console.log(`  status : ${res.status} ${res.statusText}`);
    console.log(`  body   : ${trunc(body)}`);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    console.log(`\n[${label}] FETCH ERROR: ${e.message}`);
    return { ok: false, status: 0, body: '' };
  }
}

async function main() {
  console.log('=== Vercel diagnose ===');
  console.log(`token set: ${!!TOKEN}  project set: ${!!PROJECT}  team set: ${!!TEAM}  domain: ${DOMAIN}`);

  const teamQ = TEAM ? `&teamId=${TEAM}` : '';

  // 1) スコープ検証（公式・安定API）: project が token+team で見つかるか
  await probe('project (v9) +team', `https://api.vercel.com/v9/projects/${PROJECT}${TEAM ? `?teamId=${TEAM}` : ''}`);
  await probe('project (v9) no-team', `https://api.vercel.com/v9/projects/${PROJECT}`);

  // 2) team 検証
  if (TEAM) await probe('team (v2)', `https://api.vercel.com/v2/teams/${TEAM}`);

  // 3) プロジェクトに紐づくドメイン一覧（insights の domain param に使う正しい値を確認）
  await probe('project domains', `https://api.vercel.com/v9/projects/${PROJECT}/domains${TEAM ? `?teamId=${TEAM}` : ''}`);

  // 4) insights stats/path のパラメータ違いを総当たり
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 864e5).toISOString();
  const base = `https://vercel.com/api/web/insights/stats/path`;

  await probe('insights A full',
    `${base}?projectId=${PROJECT}&domain=${DOMAIN}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`);
  await probe('insights B no-domain',
    `${base}?projectId=${PROJECT}&from=${from}&to=${to}&limit=20&environment=production${teamQ}`);
  await probe('insights C no-env',
    `${base}?projectId=${PROJECT}&domain=${DOMAIN}&from=${from}&to=${to}&limit=20${teamQ}`);
  await probe('insights D minimal',
    `${base}?projectId=${PROJECT}&from=${from}&to=${to}${teamQ}`);

  console.log('\n=== done ===');
}

main();
