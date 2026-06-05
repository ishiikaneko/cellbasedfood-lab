import { config, requireConfig } from '../config.js';

const TOKEN_URL     = 'https://oauth2.googleapis.com/token';
const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';

// リフレッシュトークンからアクセストークンを取得する。
async function getAccessToken() {
  requireConfig('GA_OAUTH_CLIENT_ID', 'GA_OAUTH_CLIENT_SECRET', 'GA_OAUTH_REFRESH_TOKEN');

  const body = new URLSearchParams({
    client_id:     config.GA_OAUTH_CLIENT_ID,
    client_secret: config.GA_OAUTH_CLIENT_SECRET,
    refresh_token: config.GA_OAUTH_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`OAuth token refresh failed ${res.status}: ${await res.text()}`);

  const json = await res.json();
  if (!json.access_token) throw new Error('OAuth token refresh returned no access_token');
  return json.access_token;
}

// GA4 Data API (runReport) で pagePath 別のページビューを取得する。
export async function fetchTopPages({ days = 30, topN = 200 } = {}) {
  requireConfig('GA4_PROPERTY_ID');
  const accessToken = await getAccessToken();

  const url = `${DATA_API_BASE}/properties/${config.GA4_PROPERTY_ID}:runReport`;
  const reqBody = {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics:    [{ name: 'screenPageViews' }],
    orderBys:   [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit:      String(topN),
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(reqBody),
  });
  if (!res.ok) throw new Error(`GA4 Data API ${res.status}: ${await res.text()}`);

  const json = await res.json();
  return (json.rows ?? []).map((r) => ({
    path:  r.dimensionValues?.[0]?.value ?? '',
    views: Number(r.metricValues?.[0]?.value ?? 0),
  }));
}

// 記事 (/blog/<slug>) のみ抽出し、ページビュー降順で上位 N 件の slug を返す。
// vercel.js と同じシグネチャなので generate-popular 側は差し替えるだけで動く。
export async function fetchPopularBlogSlugs({ days = 30, topN = 3 } = {}) {
  const pages = await fetchTopPages({ days, topN: 200 });

  // trailing slash 等の表記ゆれを吸収するため slug 単位で集計する。
  const bySlug = new Map();
  for (const p of pages) {
    if (!p.path.startsWith('/blog/')) continue;
    const slug = p.path.replace('/blog/', '').replace(/\/$/, '');
    if (!slug || slug.includes('/')) continue; // /blog/ 自身や /blog/page/2 等を除外
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + p.views);
  }

  const blogPaths = [...bySlug.entries()]
    .map(([slug, views]) => ({ slug, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, topN);

  return {
    period:     `last ${days} days`,
    totalViews: pages.reduce((s, p) => s + p.views, 0),
    blogPaths,
  };
}
