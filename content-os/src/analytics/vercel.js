import { config, requireConfig } from '../config.js';

const VERCEL_API_BASE = 'https://vercel.com';

export async function fetchVercelStats({ days = 7, topN = 10 } = {}) {
  requireConfig('VERCEL_API_TOKEN', 'VERCEL_PROJECT_ID');

  const to   = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    projectId:   config.VERCEL_PROJECT_ID,
    domain:      config.VERCEL_ANALYTICS_DOMAIN || 'cellbasedfood-lab.com',
    from:        from.toISOString(),
    to:          to.toISOString(),
    limit:       String(topN),
    environment: 'production',
  });
  if (config.VERCEL_TEAM_ID) params.set('teamId', config.VERCEL_TEAM_ID);

  const url = `${VERCEL_API_BASE}/api/web/insights/stats/path?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.VERCEL_API_TOKEN}` },
  });

  if (!res.ok) {
    const body = await res.text();
    // 404 not_found はプロジェクトがスコープ外で見つからないケースが大半。
    // チーム配下のプロジェクトは teamId 必須なので、未設定なら明示的に案内する。
    if (res.status === 404 && !config.VERCEL_TEAM_ID) {
      throw new Error(
        `Vercel Analytics API 404 (not_found). プロジェクトがチーム配下にある場合は ` +
        `VERCEL_TEAM_ID の設定が必須です（GitHub Secrets / .env）。response: ${body}`
      );
    }
    throw new Error(`Vercel Analytics API ${res.status}: ${body}`);
  }

  const json = await res.json();
  const paths = (json?.data ?? json ?? []).map((item) => ({
    path:  item.key ?? item.path,
    views: item.total ?? item.count ?? 0,
  }));
  paths.sort((a, b) => b.views - a.views);

  return {
    period:     `last ${days} days`,
    totalViews: paths.reduce((s, p) => s + p.views, 0),
    topPaths:   paths.slice(0, topN),
  };
}

export async function fetchPopularBlogSlugs({ days = 30, topN = 3 } = {}) {
  const stats = await fetchVercelStats({ days, topN: 20 });
  const blogPaths = stats.topPaths
    .filter((p) => p.path.startsWith('/blog/'))
    .map((p) => ({ slug: p.path.replace('/blog/', '').replace(/\/$/, ''), views: p.views }))
    .slice(0, topN);
  return { period: stats.period, totalViews: stats.totalViews, blogPaths };
}
