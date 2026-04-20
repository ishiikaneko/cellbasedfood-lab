import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

const FFMPEG = ffmpegInstaller.path;
const FFPROBE = ffprobeInstaller.path;
const execFileAsync = promisify(execFile);
const MAX_BUF = 50 * 1024 * 1024;

// Ken Burns effect expressions indexed by preset (0–3)
// Variables: on = current output frame, d = total frames (same value substituted)
const KEN_BURNS = [
  // 0: zoom in (1.0 → 1.3, center)
  (d) => ({
    z: `min(1+on/${d}*0.3\\,1.3)`,
    x: `iw/2-(iw/zoom/2)`,
    y: `ih/2-(ih/zoom/2)`,
  }),
  // 1: zoom out (1.3 → 1.0, center)
  (d) => ({
    z: `max(1.3-on/${d}*0.3\\,1.0)`,
    x: `iw/2-(iw/zoom/2)`,
    y: `ih/2-(ih/zoom/2)`,
  }),
  // 2: pan right (z=1.2, left → right)
  (d) => ({
    z: `1.2`,
    x: `(iw-iw/zoom)*on/${d}`,
    y: `ih/2-(ih/zoom/2)`,
  }),
  // 3: pan left (z=1.2, right → left)
  (d) => ({
    z: `1.2`,
    x: `(iw-iw/zoom)*(1-on/${d})`,
    y: `ih/2-(ih/zoom/2)`,
  }),
];

async function getAudioDuration(audioPath) {
  const { stdout } = await execFileAsync(FFPROBE, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    audioPath,
  ], { maxBuffer: MAX_BUF });

  const data = JSON.parse(stdout);
  return parseFloat(data.format.duration);
}

/**
 * Assembles all segments into a single video using a single FFmpeg pass.
 *
 * segments: [{imagePath, audioPath}]
 * outputPath: final .mp4 destination
 */
export async function assembleVideo(segments, outputPath) {
  log.step(`Measuring audio durations (${segments.length} segments)...`);
  const durations = await Promise.all(segments.map((s) => getAudioDuration(s.audioPath)));

  const args = [];

  // Interleaved inputs: -loop 1 -i image0 -i audio0 -loop 1 -i image1 -i audio1 ...
  for (const { imagePath, audioPath } of segments) {
    args.push('-loop', '1', '-i', imagePath);
    args.push('-i', audioPath);
  }

  // Build filter_complex
  const filterParts = [];

  for (let i = 0; i < segments.length; i++) {
    const frames = Math.max(1, Math.ceil(durations[i] * 30));
    const preset = i % 4;
    const { z, x, y } = KEN_BURNS[preset](frames);
    const imgIdx = i * 2;

    filterParts.push(
      `[${imgIdx}:v]scale=1920:1080:flags=lanczos,` +
        `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=1920x1080:fps=30[v${i}]`
    );
  }

  // Concat all segments
  const concatIn = segments.map((_, i) => `[v${i}][${i * 2 + 1}:a]`).join('');
  filterParts.push(`${concatIn}concat=n=${segments.length}:v=1:a=1[vout][aout]`);

  args.push(
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputPath
  );

  log.step(`Assembling video... (this takes several minutes)`);

  try {
    await execFileAsync(FFMPEG, args, { maxBuffer: MAX_BUF });
  } catch (err) {
    const msg = err.stderr?.slice(-1000) || err.message;
    throw new Error(`FFmpeg failed:\n${msg}`);
  }

  log.success(`Video saved: ${outputPath}`);
  return outputPath;
}
