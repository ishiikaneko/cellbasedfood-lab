import { callClaudeJSON } from '../utils/claude.js';

const SYSTEM_PROMPT = `You are an expert social media strategist specializing in X (Twitter).

Your task is to distill a master article into a punchy summary tweet and extract the article title.

## Output format
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "tweet": "Single tweet text — 140 characters or fewer",
  "title": "The article title extracted verbatim from the article",
  "hashtags": ["hashtag1", "hashtag2"]
}

## Tweet rules
- "tweet" MUST be 140 characters or fewer (including spaces and punctuation) — count carefully
- Write in the same language as the input article
- Capture the single most surprising or valuable insight from the article
- No em dashes (—), use hyphens or colons instead
- No hashtags in the tweet body — they go in the hashtags array only
- Do NOT number the tweet or add any thread indicators

## Style
- Lead with the insight or the "so what"
- Punchy, conversational — like talking to a smart friend
- Concrete beats abstract; specific beats vague
- If there is a striking stat or counterintuitive claim, lead with that`;

export async function transformToTwitter(articleContent) {
  return callClaudeJSON(SYSTEM_PROMPT, `Transform this article into a tweet:\n\n${articleContent}`);
}
