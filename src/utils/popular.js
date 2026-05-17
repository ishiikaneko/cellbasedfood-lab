import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const POPULAR_JSON_PATH = join(process.cwd(), 'src/data/popular.json');

export function getPopularPosts(allPosts, limit = 3) {
  let popularPosts = [];

  try {
    if (existsSync(POPULAR_JSON_PATH)) {
      const popularData = JSON.parse(readFileSync(POPULAR_JSON_PATH, 'utf-8'));
      const slugOrder = popularData.slugs ?? [];
      const slugSet = new Set(slugOrder);
      const found = allPosts.filter((p) => slugSet.has(p.slug));
      popularPosts = slugOrder
        .map((slug) => found.find((p) => p.slug === slug))
        .filter(Boolean);
    }
  } catch {
    popularPosts = [];
  }

  if (popularPosts.length < limit) {
    const existing = new Set(popularPosts.map((p) => p.slug));
    for (const post of allPosts) {
      if (popularPosts.length >= limit) break;
      if (!existing.has(post.slug)) popularPosts.push(post);
    }
  }

  return popularPosts.slice(0, limit);
}
