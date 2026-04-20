import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

const DEFAULT_VOICE = 'en-US-AriaNeural';

// Strip all production-note markers from script text before TTS
const MARKER_RE = /\[(?:PAUSE|B-ROLL|SHOW GRAPHIC|VERIFY)[^\]]*\]/gi;

function cleanScript(text) {
  return text
    .replace(MARKER_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateSegmentAudio(text, outputPath, { voice = DEFAULT_VOICE } = {}) {
  const cleaned = cleanScript(text);
  if (!cleaned) throw new Error(`Empty script text for: ${outputPath}`);

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(cleaned);

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outputPath);
    audioStream.pipe(ws);
    audioStream.on('close', resolve);
    audioStream.on('error', reject);
    ws.on('error', reject);
  });

  log.success(`  Audio: ${path.basename(outputPath)}`);
  return outputPath;
}

// Returns [{key, path}] for every script segment in order
export async function generateAllAudio(script, audioDir, { voice = DEFAULT_VOICE, force = false } = {}) {
  fs.mkdirSync(audioDir, { recursive: true });

  const segments = [
    { key: '00-hook', content: script.hook.content },
    { key: '01-intro', content: script.intro.content },
    ...script.sections.map((s, i) => ({
      key: `${String(i + 2).padStart(2, '0')}-section`,
      content: s.content,
    })),
    { key: `${String(script.sections.length + 2).padStart(2, '0')}-outro`, content: script.outro.content },
  ];

  const results = [];
  for (const { key, content } of segments) {
    const outputPath = path.join(audioDir, `${key}.mp3`);
    if (!force && fs.existsSync(outputPath)) {
      log.dim(`  Skip (exists): ${key}.mp3`);
    } else {
      await generateSegmentAudio(content, outputPath, { voice });
    }
    results.push({ key, path: outputPath });
  }

  return results;
}
