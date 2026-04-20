import fs from 'fs';
import path from 'path';
import { generateAllAudio } from './tts.js';
import { generateAllImages } from './images.js';
import { assembleVideo } from './video.js';
import { generateYouTubeThumbnail } from './thumbnail-youtube.js';
import { generateBlogThumbnail } from './thumbnail-blog.js';
import { log } from '../utils/logger.js';

export async function buildVideo(
  outputDirPath,
  { force = false, skipImages = false, skipTts = false, skipVideo = false, voice = 'en-US-AriaNeural' } = {}
) {
  const outDir = path.resolve(outputDirPath);
  const ytJsonPath = path.join(outDir, 'youtube.json');
  const wpJsonPath = path.join(outDir, 'wordpress.json');

  if (!fs.existsSync(ytJsonPath)) {
    throw new Error(`youtube.json not found in ${outDir}. Run 'transform' first.`);
  }

  const youtube = JSON.parse(fs.readFileSync(ytJsonPath, 'utf8'));
  const wordpress = fs.existsSync(wpJsonPath)
    ? JSON.parse(fs.readFileSync(wpJsonPath, 'utf8'))
    : null;

  const mediaDir = path.join(outDir, 'media');
  const audioDir = path.join(mediaDir, 'audio');
  const imagesDir = path.join(mediaDir, 'images');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  // 1. Generate images (DALL-E 3)
  let imageFiles;
  if (skipImages) {
    log.info('Skipping image generation.');
    imageFiles = collectExistingFiles(imagesDir, youtube.script);
  } else {
    log.step('Generating segment images (DALL-E 3)...');
    imageFiles = await generateAllImages(youtube.script, imagesDir, { force });
  }

  // 2. Generate audio (Edge TTS)
  let audioFiles;
  if (skipTts) {
    log.info('Skipping TTS generation.');
    audioFiles = collectExistingFiles(audioDir, youtube.script, '.mp3');
  } else {
    log.step('Generating narration audio (Edge TTS)...');
    audioFiles = await generateAllAudio(youtube.script, audioDir, { voice, force });
  }

  // 3. Generate thumbnails
  const ytThumbPath = path.join(mediaDir, 'thumbnail-youtube.png');
  const blogThumbPath = path.join(mediaDir, 'thumbnail-blog.png');

  log.step('Generating thumbnails...');

  const hookImagePath = imageFiles.find((f) => f.key === '00-hook')?.path || imageFiles[0]?.path;
  if (hookImagePath && fs.existsSync(hookImagePath)) {
    if (force || !fs.existsSync(ytThumbPath)) {
      await generateYouTubeThumbnail(hookImagePath, youtube.title, ytThumbPath);
    } else {
      log.dim('  Skip (exists): thumbnail-youtube.png');
    }
  } else {
    log.info('  No hook image found, skipping YouTube thumbnail.');
  }

  const blogTitle = wordpress?.title || youtube.title;
  const blogDate = new Date().toISOString().slice(0, 10);
  if (force || !fs.existsSync(blogThumbPath)) {
    await generateBlogThumbnail(blogTitle, { tagline: 'フードテック', date: blogDate }, blogThumbPath);
  } else {
    log.dim('  Skip (exists): thumbnail-blog.png');
  }

  // 4. Assemble video
  if (skipVideo) {
    log.info('Skipping video assembly (--skip-video).');
    return summarize(mediaDir, ytThumbPath, blogThumbPath, null);
  }

  const videoPath = path.join(mediaDir, 'video.mp4');
  if (!force && fs.existsSync(videoPath)) {
    log.info(`Video already exists: ${videoPath} (use --force to re-encode)`);
    return summarize(mediaDir, ytThumbPath, blogThumbPath, videoPath);
  }

  // Pair images + audio by position
  const segments = imageFiles.map((imgFile, i) => ({
    imagePath: imgFile.path,
    audioPath: audioFiles[i]?.path,
  }));

  const missingAudio = segments.filter((s) => !s.audioPath || !fs.existsSync(s.audioPath));
  if (missingAudio.length > 0) {
    throw new Error(
      `Missing audio files for segments: ${missingAudio.map((s) => s.imagePath).join(', ')}\nRun without --skip-tts.`
    );
  }

  await assembleVideo(segments, videoPath);

  return summarize(mediaDir, ytThumbPath, blogThumbPath, videoPath);
}

function collectExistingFiles(dir, script, ext = '.png') {
  const n = script.sections.length;
  const keys = [
    '00-hook',
    '01-intro',
    ...script.sections.map((_, i) => `${String(i + 2).padStart(2, '0')}-section`),
    `${String(n + 2).padStart(2, '0')}-outro`,
  ];
  return keys.map((key) => ({ key, path: path.join(dir, `${key}${ext}`) }));
}

function summarize(mediaDir, ytThumb, blogThumb, videoPath) {
  log.success('\nBuild complete:');
  log.info(`  Media dir:     ${mediaDir}`);
  if (fs.existsSync(ytThumb)) log.info(`  YT thumbnail:  ${ytThumb}`);
  if (fs.existsSync(blogThumb)) log.info(`  Blog OGP:      ${blogThumb}`);
  if (videoPath && fs.existsSync(videoPath)) {
    const size = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
    log.info(`  Video:         ${videoPath} (${size} MB)`);
  }
  return { mediaDir, ytThumb, blogThumb, videoPath };
}
