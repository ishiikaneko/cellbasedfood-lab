import Anthropic from '@anthropic-ai/sdk';
import { config, requireConfig } from '../config.js';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export async function researchTopic(topic, { outputDir = 'content/sources' } = {}) {
  requireConfig('ANTHROPIC_API_KEY');
  const c = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  const today = new Date().toISOString().slice(0, 10);
  log.step(`Researching: "${topic}"`);

  const response = await c.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a research specialist on cultured meat. List primary sources (academic papers, government reports, official press releases) related to: "${topic}"

Output ONLY a JSON block:
\`\`\`json
{
  "topic": "${topic}",
  "searched_at": "${today}",
  "sources": [
    {
      "title": "document title",
      "url": "https://url",
      "type": "academic|government|press_release|industry_report",
      "publisher": "organization name",
      "date": "YYYY-MM-DD or null",
      "summary": "2-3 sentence summary",
      "key_facts": ["fact 1", "fact 2"]
    }
  ]
}
\`\`\``
    }]
  });

  const text = response.content[0].text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1].trim() : text.trim();
  const sourcesData = JSON.parse(jsonStr);

  const slug = topic.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const filename = `${today}-${slug}.json`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(sourcesData, null, 2), 'utf8');

  log.success(`Sources saved: ${filepath}`);
  return { filepath, sources: sourcesData };
}