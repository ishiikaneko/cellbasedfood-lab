# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                      # install dependencies

# Transform only (saves JSON to output/<slug>/)
node src/index.js transform content/article.md --platforms twitter,wordpress,youtube

# Publish only (from a previous transform run)
node src/index.js publish output/article-slug --platforms twitter --dry-run

# Transform + publish in one step
node src/index.js run content/article.md --platforms twitter,wordpress

# YouTube OAuth (run once to store tokens/youtube.json)
node src/index.js youtube-auth

# All run/publish commands accept:
#   --dry-run            print output without posting
#   --wp-status draft    WordPress post status (draft|publish)
#   --yt-privacy private YouTube privacy (private|unlisted|public)
#   --video-file path    video file to upload to YouTube
```

## Architecture

### Data flow

```
content/<article>.md
        │
        ▼
src/pipeline.js  ──transform()──▶  src/transformers/{platform}.js
                                           │  calls Claude API (cached system prompt)
                                           ▼
                                   output/<slug>/{platform}.json
                                           │
                ──publish()────────────────▼
                                   src/publishers/{platform}.js
                                           │  posts to API
                                           ▼
                                   Twitter thread / WP post / YouTube upload
```

The `run` command chains `transform` then `publish` in one call. The `transform` step is the expensive Claude API step; `publish` is idempotent-safe to retry separately.

### Key modules

- **`src/utils/claude.js`** — Singleton Anthropic client. `callClaude(systemPrompt, content)` streams the response using `claude-opus-4-8` with adaptive thinking. The system prompt is marked `cache_control: ephemeral` so repeated calls with the same transformer skip re-tokenization. `callClaudeJSON` wraps that and parses the JSON response. Cache hits are logged to console; verify caching is working by checking that `cache_read_input_tokens` appears after the first call.

- **`src/transformers/*.js`** — Each file exports one async function that calls `callClaudeJSON` with a large, stable system prompt and the article as the user message. The system prompt encodes all platform rules (tweet character limits, HTML structure for WordPress, script pacing for YouTube). Output is a typed JSON object saved to `output/<slug>/<platform>.json`.

- **`src/publishers/*.js`** — Each file reads the JSON produced by its transformer and posts to the target API. Publishers are thin API wrappers; all content decisions happen in transformers.

- **`src/pipeline.js`** — Orchestrates transform → save → publish. `outputDir()` creates `output/<article-slug>/` automatically. Platforms are processed sequentially to avoid rate-limit issues.

### Platform-specific notes

**Twitter/X** — Uses `twitter-api-v2` with OAuth 1.0a (4 env vars). Posts as a reply chain to form a thread. The transformer enforces 280-char limits in the system prompt; validate manually if a tweet is truncated.

**WordPress** — Uses the WP REST API (`/wp-json/wp/v2/posts`) with HTTP Basic auth via Application Passwords. Tags and categories are auto-created if they don't exist. Default publish status is `draft` — pass `--wp-status publish` when ready.

**YouTube** — Requires a Google Cloud OAuth2 app (Desktop Application type). Run `youtube-auth` once; tokens are stored in `tokens/youtube.json` and auto-refreshed. The transformer generates script + metadata; actual video upload requires `--video-file <path>`. Without a video file, the command saves the script to output and skips upload.

### Prompt caching

The transformer system prompts are cached with `cache_control: ephemeral` (5-minute TTL). For `claude-opus-4-8`, caching requires the prompt to be ≥4096 tokens. If `cache_read_input_tokens` stays at 0 across repeated calls, expand the system prompt in the transformer file. Runs within the same 5-minute window will see the biggest savings (~90% cost reduction on the system prompt tokens).

### Adding a new platform

1. Create `src/transformers/<platform>.js` — export `transformTo<Platform>(articleContent)` using `callClaudeJSON`
2. Create `src/publishers/<platform>.js` — export `publishTo<Platform>(data, options)`
3. Register both in `src/pipeline.js` `TRANSFORMERS` and `PUBLISHERS` maps
4. Add the platform name to `PLATFORMS` in `src/index.js`
