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

  const prompt = `You are a research specialist on cultured meat and cellular agriculture.

Select the SINGLE BEST primary source related to: "${topic}"

Choose the most specific, informative, and recent source available. Return exactly 1 source.

Acceptable source types:
- "academic"   : peer-reviewed journal articles (PubMed, bioRxiv, etc.)
- "government" : official documents from FDA, USDA, EFSA, 農水省, etc.
- "report"     : industry reports from GFI, FAO, OECD, etc.
- "press"      : official press releases from companies (Upside Foods, GOOD Meat, Mosa Meat, etc.)
- "linkedin"   : posts by company official accounts or leading researchers on LinkedIn

For LinkedIn sources:
- Only include posts from verified company pages or well-known researchers
- Use https://www.linkedin.com/company/<company-slug>/ for company pages
- Use https://www.linkedin.com/in/<profile-slug>/ for researcher profiles
- If the exact post URL is unknown, use the profile/company page URL

Output ONLY a JSON object with this structure, no code blocks, no other text:
{"topic":"${topic}","searched_at":"${today}","sources":[{"title":"...","url":"https://...","type":"academic","publisher":"...","date":"YYYY-MM-DD","summary":"...","key_facts":["fact1","fact2","fact3","fact4","fact5"]}]}`;

  const response = await c.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  const sourcesData = JSON.parse(jsonStr);

  const slug = topic.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const filename = today + '-' + slug + '.json';
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(sourcesData, null, 2), 'utf8');

  log.success('Sources saved: ' + filepath);
  return { filepath, sources: sourcesData };
}