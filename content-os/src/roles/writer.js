import { callClaude } from '../utils/claude.js';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `You are an expert content writer. Your task is to write a thorough, well-researched, engaging master article on a given topic.

## Writing style
- Use ですます調 (polite Japanese) throughout the article — never である調
- Write in the language the user specifies (default: Japanese)
- Conversational yet authoritative tone

## Article format
- H1 title at the top
- Engaging intro paragraph that hooks the reader and previews the key insight
- H2 subheadings to organize sections
- No word limit — include ALL relevant information fully; do not truncate or summarize when detail is available
- End sections with a clear takeaway or conclusion
- No fluff — every paragraph must add value

## Inline hyperlinks
- On first mention, hyperlink company names, organizations, and key technical terms to their official website
- Use HTML anchor tags: <a href="https://example.com">Company Name</a>
- Only link to authoritative sources (official sites, government pages, peer-reviewed sources)
- Do not repeat the link for subsequent mentions of the same entity

## End of article — mandatory sections
Finish every article with these two sections in this exact format:

---
## 引用文献
- [Source title](URL) — Brief description of what this source covers

## 関連記事
- [Related article title](RELATED_ARTICLE_LINK)
---

For 引用文献: list every source cited or referenced in the article body, with a real URL where available.
For 関連記事: suggest 3-5 related topic titles with [RELATED_ARTICLE_LINK] as the URL placeholder.`;

const SOURCES_ADDENDUM = `## Source constraint (CRITICAL)
The user has provided verified primary sources for this article. You MUST:
- Base all factual claims strictly on the provided sources
- Cite specific sources inline where claims are made (e.g., "SFAの発表によると...")
- Do not introduce facts not present in the provided sources
- Do not fabricate URLs or data points
- Use the sources' key_facts and summaries as the factual backbone
- Include all provided sources in the 引用文献 section`;

export async function writeArticle(topic, { lang = 'Japanese', outputDir = 'content/drafts', sourcesFile = null } = {}) {
  log.step(`Writing article on: ${topic}`);

  let sources = null;
  if (sourcesFile) {
    const raw = fs.readFileSync(path.resolve(sourcesFile), 'utf8');
    sources = JSON.parse(raw);
    log.info(`Using ${sources.sources?.length ?? 0} verified sources from: ${sourcesFile}`);
  }

  const systemPrompt = sources
    ? `${SYSTEM_PROMPT}\n\n${SOURCES_ADDENDUM}`
    : SYSTEM_PROMPT;

  let userMessage = `Write a comprehensive master article about the following topic in ${lang}:\n\n${topic}`;

  if (sources) {
    const sourcesList = (sources.sources ?? [])
      .map(
        (s, i) =>
          `### Source ${i + 1}: ${s.title}
URL: ${s.url}
Type: ${s.type}
Publisher: ${s.publisher}
Date: ${s.date ?? 'unknown'}
Summary: ${s.summary}
Key facts:
${(s.key_facts ?? []).map((f) => `- ${f}`).join('\n')}`
      )
      .join('\n\n');

    userMessage += `\n\n---\n## Verified primary sources (use these as your factual foundation)\n\n${sourcesList}`;
  }

  const content = await callClaude(systemPrompt, userMessage);

  const slug = topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);

  const filename = `${new Date().toISOString().slice(0, 10)}-${slug}.md`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, content, 'utf8');

  log.success(`Article saved: ${filepath}`);
  return { filepath, content };
}
