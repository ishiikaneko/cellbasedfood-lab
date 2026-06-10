import { defineCollection, z } from 'astro:content';

// 一次ソース（引用文献）。本文末尾の「引用文献」セクションが人間可読の表示、
// この frontmatter が機械可読の正本で、構造化データ（schema.org citation）に流す。
const reference = z.object({
  title: z.string(),
  url: z.string().url(),
  type: z.string().optional(),   // 原著論文 / 行政資料 / 企業発表 など
  note: z.string().optional(),   // 何の根拠に使ったかのメモ
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    category: z.enum(['細胞', '培養液', '培養方法', 'その他培養資材', '細胞培養食品', 'コラム']),
    tags: z.array(z.string()),
    heroImage: z.string().optional(),   // public/images/ 以下のパス
    references: z.array(reference).default([]),
    aiGenerated: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
