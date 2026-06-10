import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://cellbasedfood-lab.com';

export const GET: APIRoute = async (context) => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: '細胞培養食品ラボ│CellBasedFood lab',
    description: '現役の培養肉研究員が開発現場から解説する、培養肉専門の技術情報サイトです。',
    site: context.site ?? SITE,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.slug}`,
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: '<language>ja</language>',
  });
};
