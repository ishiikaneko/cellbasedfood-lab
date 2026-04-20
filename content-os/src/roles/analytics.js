import { fetchTwitterStats } from '../analytics/twitter.js';
import { fetchWordPressStats } from '../analytics/wordpress.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

export async function runAnalytics({ platforms = ['twitter', 'wordpress'] } = {}) {
  log.step('Fetching analytics...');
  const results = {};

  if (platforms.includes('twitter')) {
    try {
      const tw = await fetchTwitterStats({ count: 10 });
      results.twitter = tw;

      console.log(chalk.bold('\n--- X (Twitter) Analytics ---'));
      console.log(`Account: @${tw.username}`);
      console.log(`Period: ${tw.period}`);
      console.log(chalk.dim('Totals:'), tw.totals);
      console.log(chalk.dim('\nTop tweets:'));
      tw.tweets.slice(0, 5).forEach((t) => {
        console.log(`  ${chalk.cyan(t.text)}`);
        console.log(`    likes:${t.likes}  RT:${t.retweets}  replies:${t.replies}  impressions:${t.impressions}`);
      });
    } catch (err) {
      log.error(`Twitter analytics failed: ${err.message}`);
    }
  }

  if (platforms.includes('wordpress')) {
    try {
      const wp = await fetchWordPressStats({ count: 10 });
      results.wordpress = wp;

      console.log(chalk.bold('\n--- WordPress Analytics ---'));
      console.log(`Site: ${wp.siteUrl}`);
      console.log(chalk.dim('Recent posts:'));
      wp.recentPosts.slice(0, 5).forEach((p) => {
        console.log(`  [${p.date.slice(0, 10)}] ${p.title}`);
      });
      if (wp.scheduledPosts.length > 0) {
        console.log(chalk.dim('\nScheduled posts:'));
        wp.scheduledPosts.forEach((p) => {
          console.log(`  [${p.date.slice(0, 16)}] ${p.title}`);
        });
      }
    } catch (err) {
      log.error(`WordPress analytics failed: ${err.message}`);
    }
  }

  return results;
}
