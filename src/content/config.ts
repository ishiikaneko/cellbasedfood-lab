import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    category: z.enum(['技術', '規制・政策', '市場・投資', 'ニュース', 'その他']),
    tags: z.array(z.string()),
    heroImage: z.string().optional(),   // public/images/ 以下のパス
    aiGenerated: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
