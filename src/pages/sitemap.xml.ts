import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://cellbasedfood-lab.com';

const PAGE_SIZE = 9; // src/pages/blog/page/[page].astro と一致させる

const staticPages = [
  { url: '/', changefreq: 'daily', priority: '1.0' },
  { url: '/links', changefreq: 'weekly', priority: '0.7' },
  { url: '/column', changefreq: 'weekly', priority: '0.7' },
  { url: '/contact', changefreq: 'monthly', priority: '0.5' },
  { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  const blogEntries = posts.map((post) => ({
    url: `/blog/${post.slug}`,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: post.data.pubDate.toISOString().split('T')[0],
  }));

  // 記事一覧のページ送り（/blog/page/1..N）
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const pageEntries = Array.from({ length: totalPages }, (_, i) => ({
    url: `/blog/page/${i + 1}`,
    changefreq: 'weekly',
    priority: '0.5',
    lastmod: undefined,
  }));

  const allEntries = [
    ...staticPages.map((p) => ({ ...p, lastmod: undefined })),
    ...pageEntries,
    ...blogEntries,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries
  .map(
    (entry) => `  <url>
    <loc>${SITE}${entry.url}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
