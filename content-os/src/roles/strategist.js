import { callClaude } from '../utils/claude.js';
import { fetchTwitterStats } from '../analytics/twitter.js';
import { fetchWordPressStats } from '../analytics/wordpress.js';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `You are a senior content strategist. Based on performance data from X (Twitter) and WordPress, produce a monthly strategy review in Markdown.

## Report structure
1. **Performance Summary** — key numbers and trends
2. **What Worked** — top-performing content and why
3. **What Didn't Work** — underperformers and diagnosis
4. **Content Recommendations** — 3-5 specific topics to cover next month
5. **Distribution Recommendations** — optimal posting times, format tweaks
6. **Next Month Goal** — one measurable target

Write concisely. Be specific. Avoid generic advice.`;

export async function runStrategyReview({ outputDir = 'strategy/reports' } = {}) {
  log.step('Gathering data for strategy review...');

  const [tw, wp] = await Promise.all([
    fetchTwitterStats({ count: 20 }).catch((e) => ({ error: e.message })),
    fetchWordPressStats({ count: 20 }).catch((e) => ({ error: e.message })),
  ]);

  const dataSnapshot = JSON.stringify({ twitter: tw, wordpress: wp }, null, 2);

  log.step('Generating strategy report via Claude...');
  const report = await callClaude(
    SYSTEM_PROMPT,
    `Here is the performance data for this month. Generate a strategy review:\n\n\`\`\`json\n${dataSnapshot}\n\`\`\``
  );

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}.md`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, `# Strategy Review — ${date}\n\n${report}`, 'utf8');

  log.success(`Strategy report saved: ${filepath}`);
  return { filepath, report };
}
