import Anthropic from '@anthropic-ai/sdk';
import { config, requireConfig } from '../config.js';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `You are a research specialist whose sole job is to find and verify primary sources on a given topic.

## Definition of primary source (include ONLY these)
- Official press releases from companies or organizations
- Government or regulatory authority announcements and documents
- Academic papers and peer-reviewed research
- Reports published directly by industry bodies, research institutes, or international organizations
- Official product or approval announcements from regulatory agencies (FDA, SFA, EMA, etc.)

## Excluded sources (never include)
- News articles, journalism, or media coverage
- Blog posts or opinion pieces
- Aggregator sites (Google News, Yahoo News, Flipboard, etc.)
- Social media posts
- Secondary sources that summarize primary sources

## Search strategy
1. Search for the specific event, announcement, or topic
2. Follow up with searches targeting the issuing organization directly
3. Search for regulatory filings, academic databases (PubMed, arXiv), official government portals
4. Verify each URL leads to the original issuing organization

## Output format
After completing all searches, output ONLY a single JSON code block with this exact structure:
\`\`\`json
{
  "topic": "exact topic as given",
  "searched_at": "YYYY-MM-DD",
  "sources": [
    {
      "title": "Exact document title",
      "url": "https://direct-url-to-primary-source",
      "type": "press_release|government|academic|industry_report|regulatory_approval",
      "publisher": "Name of the issuing organization",
      "date": "YYYY-MM-DD or null if unknown",
      "summary": "2-3 sentence summary of what this source says about the topic",
      "key_facts": ["Specific claim or data point", "Another specific fact"]
    }
  ]
}
\`\`\`

Do not include any text before or after the JSON code block in your final response.`;

export async function researchTopic(topic, { outputDir = 'content/sources' } = {}) {
  requireConfig('ANTHROPIC_API_KEY');
  const c = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  const today = new Date().toISOString().slice(0, 10);
  const userMessage = `Research the following topic and find all available primary sources.

Topic: "${topic}"

Search broadly across:
1. Official announcements from the organizations named in the topic
2. Regulatory agency databases and approval records
3. Academic paper databases for related research
4. International organization reports and publications

Today's date: ${today}

After completing all searches, output the sources JSON block.`;

  log.step(`Researching: "${topic}"`);

  const messages = [{ role: 'user', content: userMessage }];
  let finalText = '';

  // Defensive agentic loop — web_search is server-side so usually resolves in one turn
  for (let turn = 0; turn < 8; turn++) {
    const response = await c.messages.create(
      {
        model: 'claude-opus-4-7',
        max_tokens: 16000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages,
      },
      { headers: { 'anthropic-beta': 'web-search-2025-03-05' } }
    );

    // Print progress and collect text
    for (const block of response.content) {
      if (block.type === 'text') {
        process.stdout.write(block.text);
        finalText = block.text; // keep the last text block (will be the JSON)
      } else if (block.type === 'tool_use' && block.name === 'web_search') {
        log.step(`  Searching: "${block.input?.query ?? ''}"`);
      }
    }

    if (response.stop_reason === 'end_turn') break;

    // Shouldn't happen for server-side web_search, but handle gracefully
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const inlineResults = response.content.filter((b) => b.type === 'tool_result');

      if (inlineResults.length === 0) {
        // Results not inline — send empty placeholders to unblock the loop
        messages.push({
          role: 'user',
          content: toolUseBlocks.map((tu) => ({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: 'No results available.',
          })),
        });
      }
    }
  }

  process.stdout.write('\n\n');

  // Parse the JSON block from the final text
  const match = finalText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1].trim() : finalText.trim();
  const sourcesData = JSON.parse(jsonStr);

  // Save output
  const slug = topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const filename = `${today}-${slug}.json`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(sourcesData, null, 2), 'utf8');

  log.success(`Sources saved: ${filepath} (${sourcesData.sources?.length ?? 0} sources)`);
  return { filepath, sources: sourcesData };
}
