import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const POPULAR_JSON_PATH = join(process.cwd(), 'src/data/popular.json');

export function getPopularPosts(allPosts, limit = 3) {
  let popularPosts = [];

  try {
    if (existsSync(POPULAR_JSON_PATH)) {
      const popularData = JSON.parse(readFileSync(POPULAR_JSON_PATH, 'utf-8'));

      // 手動で固定したい記事（manual）を最優先、次に Analytics 由来（slugs）。
      // 重複は先勝ちで除外し、指定順を維持する。
      const manual = Array.isArray(popularData.manual) ? popularData.manual : [];
      const analytics = Array.isArray(popularData.slugs) ? popularData.slugs : [];
      const slugOrder = [...new Set([...manual, ...analytics])];

      const slugSet = new Set(slugOrder);
      const found = allPosts.filter((p) => slugSet.has(p.slug));
      popularPosts = slugOrder
        .map((slug) => found.find((p) => p.slug === slug))
        .filter(Boolean);
    }
  } catch {
    popularPosts = [];
  }

  // 指定が limit に満たない場合は最新記事で補完する。
  if (popularPosts.length < limit) {
    const existing = new Set(popularPosts.map((p) => p.slug));
    for (const post of allPosts) {
      if (popularPosts.length >= limit) break;
      if (!existing.has(post.slug)) popularPosts.push(post);
    }
  }

  return popularPosts.slice(0, limit);
}
