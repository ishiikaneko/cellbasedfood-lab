import { TwitterApi } from 'twitter-api-v2';
import { config, requireConfig } from '../config.js';

function getClient() {
  requireConfig('TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET');
  return new TwitterApi({
    appKey: config.TWITTER_API_KEY,
    appSecret: config.TWITTER_API_SECRET,
    accessToken: config.TWITTER_ACCESS_TOKEN,
    accessSecret: config.TWITTER_ACCESS_SECRET,
  });
}

export async function fetchTwitterStats({ count = 10 } = {}) {
  const client = getClient();

  const me = await client.v2.me();
  const userId = me.data.id;

  const timeline = await client.v2.userTimeline(userId, {
    max_results: count,
    'tweet.fields': 'public_metrics,created_at,text',
  });

  const tweets = timeline.data?.data ?? [];

  const stats = tweets.map((t) => ({
    id: t.id,
    text: t.text.slice(0, 80),
    created_at: t.created_at,
    likes: t.public_metrics.like_count,
    retweets: t.public_metrics.retweet_count,
    replies: t.public_metrics.reply_count,
    impressions: t.public_metrics.impression_count ?? 0,
  }));

  const totals = stats.reduce(
    (acc, t) => {
      acc.likes += t.likes;
      acc.retweets += t.retweets;
      acc.replies += t.replies;
      acc.impressions += t.impressions;
      return acc;
    },
    { likes: 0, retweets: 0, replies: 0, impressions: 0 }
  );

  return { userId, username: me.data.username, tweets: stats, totals, period: `last ${tweets.length} tweets` };
}
