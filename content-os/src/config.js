import 'dotenv/config';

export const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET,

  WORDPRESS_URL: process.env.WORDPRESS_URL,
  WORDPRESS_USER: process.env.WORDPRESS_USER,
  WORDPRESS_APP_PASSWORD: process.env.WORDPRESS_APP_PASSWORD,

  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

export function requireConfig(...keys) {
  const missing = keys.filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}. See .env.example`);
  }
}
