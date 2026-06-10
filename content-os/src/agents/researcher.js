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

## Task
Find the SINGLE BEST primary source for an article about: "${topic}"

## Search strategy (follow in order)
1. Search mentally using broad keywords: "cultivated meat", "cultured meat", "cell-based meat", "cellular agriculture"
2. Find a relevant result. If it is a secondary source (news article, blog post, summary), trace it back to the original primary source
3. Return the primary source — not the secondary source that referenced it

## Source type priority (prefer in this order)
1. "academic"   — peer-reviewed journal papers (Nature, Science, Cell, Food Chemistry, Biomaterials, Trends in Biotechnology, etc.)
2. "patent"     — patent filings (USPTO, EPO, J-PlatPat) on cultured meat technology
3. "government" — official regulatory documents (FDA, USDA, EFSA, 農水省, Singapore SFA, etc.)
4. "report"     — industry reports from GFI, FAO, OECD, etc. (use only if no academic/patent/government source fits the topic)
5. "press"      — official press releases from companies (Upside Foods, GOOD Meat, Mosa Meat, Aleph Farms, etc.)
6. "linkedin"   : posts by company official accounts or leading researchers on LinkedIn

## Diversity rule
Do NOT default to GFI reports every time. Actively seek academic papers and patents first.
If the topic is about a specific technology (scaffold, bioreactor, serum-free media, cell line, etc.), there is almost certainly a relevant journal article — find it.

## LinkedIn source rules
- Only verified company pages or known researchers
- Use https://www.linkedin.com/company/<slug>/ or https://www.linkedin.com/in/<slug>/
- If exact post URL unknown, use profile/company page URL

Output ONLY a JSON object with this structure, no code blocks, no other text:
{"topic":"${topic}","searched_at":"${today}","sources":[{"title":"...","url":"https://...","type":"academic","publisher":"...","date":"YYYY-MM-DD","summary":"...","key_facts":["fact1","fact2","fact3","fact4","fact5"]}]}`;

  const response = await c.messages.create({
    model: 'claude-opus-4-8',
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