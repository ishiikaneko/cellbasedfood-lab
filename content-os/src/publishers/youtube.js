import { google } from 'googleapis';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createReadStream, statSync } from 'fs';
import { resolve } from 'path';
import { config, requireConfig } from '../config.js';
import { log } from '../utils/logger.js';

const TOKENS_PATH = resolve('tokens/youtube.json');

function getOAuth2Client() {
  requireConfig('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET');
  return new google.auth.OAuth2(
    config.YOUTUBE_CLIENT_ID,
    config.YOUTUBE_CLIENT_SECRET,
    config.YOUTUBE_REDIRECT_URI,
  );
}

export async function runYouTubeAuth() {
  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
  });

  log.info('Visit this URL to authorize YouTube access:');
  console.log('\n' + authUrl + '\n');

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url.startsWith('/oauth2callback')) return;

      const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
      res.end('<h2>Authorized! You can close this tab.</h2>');
      server.close();

      try {
        const { tokens } = await oauth2Client.getToken(code);
        writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
        log.success(`YouTube tokens saved to ${TOKENS_PATH}`);
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(3000, () => log.info('Waiting for OAuth callback on http://localhost:3000 ...'));
    server.on('error', reject);
  });
}

function loadAuthClient() {
  if (!existsSync(TOKENS_PATH)) {
    throw new Error('YouTube not authenticated. Run: node src/index.js youtube-auth');
  }
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(JSON.parse(readFileSync(TOKENS_PATH, 'utf-8')));

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      const existing = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
      writeFileSync(TOKENS_PATH, JSON.stringify({ ...existing, ...tokens }, null, 2));
    }
  });

  return oauth2Client;
}

export async function publishToYouTube(data, { videoFile, dryRun = false, privacyStatus = 'private' } = {}) {
  if (dryRun) {
    log.info(`[DRY RUN] Would upload YouTube video: "${data.title}"`);
    log.info(`  Privacy: ${privacyStatus}`);
    log.info(`  Video file: ${videoFile || '(none provided — script only)'}`);
    return { dryRun: true };
  }

  if (!videoFile) {
    log.warn('No --video-file provided. Skipping YouTube upload. Script saved to output/.');
    return { skipped: true, reason: 'no-video-file' };
  }

  const auth = loadAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const videoPath = resolve(videoFile);
  const fileSize = statSync(videoPath).size;

  log.step(`Uploading to YouTube: "${data.title}" (${(fileSize / 1e6).toFixed(1)} MB)`);

  const { data: video } = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: data.title,
        description: data.description,
        tags: data.tags,
        categoryId: '27', // Education
      },
      status: { privacyStatus },
    },
    media: {
      mimeType: 'video/*',
      body: createReadStream(videoPath),
    },
  });

  const url = `https://youtu.be/${video.id}`;
  log.success(`YouTube upload complete: ${url}`);
  return { videoId: video.id, url, privacyStatus };
}
