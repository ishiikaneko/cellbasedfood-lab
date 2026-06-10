import Anthropic from '@anthropic-ai/sdk';
import { config, requireConfig } from '../config.js';
import { log } from './logger.js';

let _client;

function client() {
  if (!_client) {
    requireConfig('ANTHROPIC_API_KEY');
    _client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Call Claude with a stable system prompt (prompt-cached) and variable user content.
 *
 * The system prompt is marked cache_control: ephemeral so repeated calls with the
 * same prompt skip re-tokenization. Cache hits require the system prompt to be at
 * least 4096 tokens for claude-opus-4-8 — expand prompts if cache_read_input_tokens
 * stays at zero across repeated calls.
 *
 * Returns the full text response and usage stats.
 */
export async function callClaude(systemPrompt, userContent) {
  const c = client();

  let text = '';
  process.stdout.write('\n');

  const stream = c.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  });

  stream.on('text', (delta) => {
    text += delta;
    process.stdout.write(delta);
  });

  const final = await stream.finalMessage();
  process.stdout.write('\n\n');

  const { cache_creation_input_tokens: created, cache_read_input_tokens: read } = final.usage;
  if (created) log.dim(`Cache write: ${created} tokens`);
  if (read) log.dim(`Cache hit:   ${read} tokens`);

  return text;
}

/**
 * Same as callClaude but parses the response as JSON.
 * Strips markdown code fences if Claude wraps the output.
 */
export async function callClaudeJSON(systemPrompt, userContent) {
  const raw = await callClaude(systemPrompt, userContent);
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  return JSON.parse(cleaned);
}
