import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    category: z.enum(['細胞', '培養液', '培養方法', 'その他培養資材', '細胞性食品', 'コラム']),
    tags: z.array(z.string()),
    heroImage: z.string().optional(),   // public/images/ 以下のパス
    aiGenerated: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
