import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { transformToTwitter } from './transformers/twitter.js';
import { transformToWordPress } from './transformers/wordpress.js';
import { transformToYouTube } from './transformers/youtube.js';
import { publishToTwitter } from './publishers/twitter.js';
import { publishToWordPress } from './publishers/wordpress.js';
import { publishToYouTube } from './publishers/youtube.js';
import { log } from './utils/logger.js';

const TRANSFORMERS = {
  twitter: transformToTwitter,
  wordpress: transformToWordPress,
  youtube: transformToYouTube,
};

const PUBLISHERS = {
  twitter: publishToTwitter,
  wordpress: publishToWordPress,
  youtube: publishToYouTube,
};

function articleSlug(filePath) {
  return basename(filePath, extname(filePath));
}

function outputDir(filePath) {
  const dir = resolve('output', articleSlug(filePath));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function transform(articlePath, platforms) {
  const article = readFileSync(resolve(articlePath), 'utf-8');
  const dir = outputDir(articlePath);
  const results = {};

  for (const platform of platforms) {
    log.step(`Transforming → ${platform}`);
    const transformer = TRANSFORMERS[platform];
    if (!transformer) throw new Error(`Unknown platform: ${platform}`);

    const data = await transformer(article);
    const outPath = resolve(dir, `${platform}.json`);
    writeFileSync(outPath, JSON.stringify(data, null, 2));
    log.success(`Saved: ${outPath}`);
    results[platform] = { data, path: outPath };
  }

  return results;
}

export async function publish(outputDirPath, platforms, options = {}) {
  const results = {};

  for (const platform of platforms) {
    const dataPath = resolve(outputDirPath, `${platform}.json`);
    let data;
    try {
      data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    } catch {
      log.error(`No output file found for ${platform}: ${dataPath}`);
      log.error(`Run 'transform' first, or specify the correct output directory.`);
      continue;
    }

    log.step(`Publishing → ${platform}`);
    const publisher = PUBLISHERS[platform];
    if (!publisher) throw new Error(`Unknown platform: ${platform}`);

    const result = await publisher(data, options);
    results[platform] = result;
  }

  return results;
}

export async function run(articlePath, platforms, options = {}) {
  log.step(`Article: ${articlePath}`);
  log.step(`Platforms: ${platforms.join(', ')}`);

  const transformed = await transform(articlePath, platforms);
  const publishResults = {};

  for (const platform of platforms) {
    if (!transformed[platform]) continue;
    log.step(`Publishing → ${platform}`);
    const publisher = PUBLISHERS[platform];

    // Pass WordPress URL to Twitter publisher when available
    const platformOptions = { ...options };
    if (platform === 'twitter' && publishResults.wordpress?.url) {
      platformOptions.articleUrl = publishResults.wordpress.url;
    }

    const result = await publisher(transformed[platform].data, platformOptions);
    publishResults[platform] = result;
    transformed[platform].published = result;
  }

  return transformed;
}
