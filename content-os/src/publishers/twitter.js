import { TwitterApi } from 'twitter-api-v2';
import { config, requireConfig } from '../config.js';
import { log } from '../utils/logger.js';

function getClient() {
  requireConfig('TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET');
  return new TwitterApi({
    appKey: config.TWITTER_API_KEY,
    appSecret: config.TWITTER_API_SECRET,
    accessToken: config.TWITTER_ACCESS_TOKEN,
    accessSecret: config.TWITTER_ACCESS_SECRET,
  });
}

function buildTweet2(title, articleUrl) {
  const url = articleUrl || '[ARTICLE_URL]';
  return `📝 ${title}\n${url}`;
}

export async function publishToTwitter(data, { dryRun = false, articleUrl = null } = {}) {
  const { tweet, title } = data;
  const tweet2 = buildTweet2(title, articleUrl);

  if (dryRun) {
    log.info(`[DRY RUN] Would post 2-tweet thread:`);
    log.info(`  [1] (${tweet.length} chars) ${tweet}`);
    log.info(`  [2] ${tweet2}`);
    return { dryRun: true, charCount: tweet.length };
  }

  const client = getClient();
  log.step('Posting to X...');

  const { data: first } = await client.v2.tweet({ text: tweet });
  log.success(`Tweet 1 posted (${first.id})`);

  const { data: second } = await client.v2.tweet({
    text: tweet2,
    reply: { in_reply_to_tweet_id: first.id },
  });
  log.success(`Tweet 2 posted (${second.id})`);

  return {
    tweetIds: [first.id, second.id],
    url: `https://twitter.com/i/web/status/${first.id}`,
  };
}
