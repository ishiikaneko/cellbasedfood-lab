import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { config, requireConfig } from '../config.js';
import { log } from '../utils/logger.js';

const STYLE_PREFIX =
  'Cinematic documentary photography, photorealistic, high resolution, 16:9 landscape, professional lighting. ';

function getClient() {
  requireConfig('OPENAI_API_KEY');
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

async function downloadImage(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buf));
}

export async function generateSegmentImage(brollPrompt, outputPath, { force = false } = {}) {
  if (!force && fs.existsSync(outputPath)) {
    log.dim(`  Skip (exists): ${path.basename(outputPath)}`);
    return outputPath;
  }

  const client = getClient();
  const prompt = `${STYLE_PREFIX}${brollPrompt}`.slice(0, 1000);

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1792x1024',
    quality: 'standard',
    n: 1,
  });

  const url = response.data[0].url;
  const revisedPrompt = response.data[0].revised_prompt;
  await downloadImage(url, outputPath);

  // Save revised prompt alongside the image for debugging/reproducibility
  fs.writeFileSync(
    outputPath.replace(/\.\w+$/, '.prompt.txt'),
    `Original: ${brollPrompt}\n\nRevised: ${revisedPrompt}`
  );

  log.success(`  Image: ${path.basename(outputPath)}`);
  return outputPath;
}

// Returns [{key, path}] for every script segment in order
export async function generateAllImages(script, imagesDir, { force = false } = {}) {
  fs.mkdirSync(imagesDir, { recursive: true });

  const segments = [
    { key: '00-hook', broll: script.hook.broll },
    { key: '01-intro', broll: script.intro.broll },
    ...script.sections.map((s, i) => ({
      key: `${String(i + 2).padStart(2, '0')}-section`,
      broll: s.broll,
    })),
    { key: `${String(script.sections.length + 2).padStart(2, '0')}-outro`, broll: script.outro.broll },
  ];

  const results = [];
  for (const { key, broll } of segments) {
    const outputPath = path.join(imagesDir, `${key}.png`);
    await generateSegmentImage(broll, outputPath, { force });
    results.push({ key, path: outputPath });
  }

  return results;
}
