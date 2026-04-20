import axios from 'axios';
import { config, requireConfig } from '../config.js';

function getClient() {
  requireConfig('WORDPRESS_URL', 'WORDPRESS_USER', 'WORDPRESS_APP_PASSWORD');
  const token = Buffer.from(`${config.WORDPRESS_USER}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return axios.create({
    baseURL: `${config.WORDPRESS_URL.replace(/\/$/, '')}/wp-json/wp/v2`,
    headers: { Authorization: `Basic ${token}` },
  });
}

export async function fetchWordPressStats({ count = 10 } = {}) {
  const client = getClient();

  const [postsRes, scheduledRes] = await Promise.all([
    client.get(`/posts?status=publish&per_page=${count}&orderby=date&order=desc`),
    client.get('/posts?status=future&per_page=5&orderby=date&order=asc'),
  ]);

  const posts = postsRes.data.map((p) => ({
    id: p.id,
    title: p.title.rendered,
    slug: p.slug,
    date: p.date,
    url: p.link,
    status: p.status,
  }));

  const scheduled = scheduledRes.data.map((p) => ({
    id: p.id,
    title: p.title.rendered,
    date: p.date,
  }));

  return { recentPosts: posts, scheduledPosts: scheduled, siteUrl: config.WORDPRESS_URL };
}
