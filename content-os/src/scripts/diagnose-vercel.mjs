// Vercel Analytics 404 切り分け用の一時診断スクリプト (round 3)。
// ルートは存在する想定で「識別子の指定方法」を総当たりする。
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
const trunc = (s, n = 300) => (s.length > n ? s.slice(0, n) + '…' : s);

async function probe(label, url, opts = {}) {
  try {
    const res = await fetch(url, { headers: auth, ...opts });
    const body = await res.text();
    const flag = res.ok ? '  <<< OK!' : (res.status !== 404 ? '  <<< non-404' : '');
    console.log(`\n[${label}] ${res.status} ${res.statusText}${flag}`);
    console.log(`  URL : ${url}`);
    console.log(`  body: ${trunc(body)}`);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    console.log(`\n[${label}] FETCH ERROR: ${e.message}`);
    return { ok: false, status: 0, body: '' };
  }
}

async function main() {
  console.log('=== Vercel diagnose round 3 ===');

  // プロジェクト情報から識別子を収集
  const teamQ1 = TEAM ? `?teamId=${TEAM}` : '';
  let name, accountId, waId, teamSlug;
  try {
    const p = await (await fetch(`https://api.vercel.com/v9/projects/${PROJECT}${teamQ1}`, { headers: auth })).json();
    name = p.name; accountId = p.accountId; waId = p.webAnalytics?.id;
    console.log(`project name=${name} accountId=${accountId} webAnalyticsId=${waId}`);
  } catch (e) { console.log('proj info err', e.message); }
  if (TEAM) {
    try {
      const t = await (await fetch(`https://api.vercel.com/v2/teams/${TEAM}`, { headers: auth })).json();
      teamSlug = t.slug;
      console.log(`team slug=${teamSlug}`);
    } catch (e) { console.log('team info err', e.message); }
  }

  const to   = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 864e5).toISOString();
  const base = `https://vercel.com/api/web/insights/stats/path`;
  const common = `from=${from}&to=${to}&limit=20&environment=production`;
  const DOM = 'www.cellbasedfood-lab.com';

  // 識別子の指定方法を総当たり
  await probe('teamId=ID',        `${base}?projectId=${PROJECT}&${common}&teamId=${TEAM}`);
  await probe('teamId=slug',      `${base}?projectId=${PROJECT}&${common}&teamId=${teamSlug}`);
  await probe('slug=teamSlug',    `${base}?projectId=${PROJECT}&${common}&slug=${teamSlug}`);
  await probe('projectId=name',   `${base}?projectId=${name}&${common}&teamId=${TEAM}`);
  await probe('projectId=waId',   `${base}?projectId=${waId}&${common}&teamId=${TEAM}`);
  await probe('ownerId=account',  `${base}?projectId=${PROJECT}&ownerId=${accountId}&${common}&teamId=${TEAM}`);
  await probe('no-projectId host',`${base}?host=${DOM}&${common}&teamId=${TEAM}`);
  await probe('deploymentId none+domain only', `${base}?domain=${DOM}&${common}&teamId=${TEAM}`);

  // 別パス: dashboard が使う可能性のある type 別
  await probe('filter/pages',     `https://vercel.com/api/web/insights/stats/filter/pages?projectId=${PROJECT}&${common}&teamId=${TEAM}`);
  await probe('v1 insights',      `https://vercel.com/api/v1/web/insights/stats/path?projectId=${PROJECT}&${common}&teamId=${TEAM}`);

  console.log('\n=== done ===');
}

main();
