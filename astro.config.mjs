import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://cellbasedfood-lab.com',
  output: 'hybrid',
  adapter: vercel(),
});
