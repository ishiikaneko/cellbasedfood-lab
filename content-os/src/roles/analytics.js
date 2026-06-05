import { fetchTwitterStats } from '../analytics/twitter.js';
import { fetchWordPressStats } from '../analytics/wordpress.js';
import { fetchTopPages } from '../analytics/ga4.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

export async function runAnalytics({ platforms = ['twitter', 'wordpress', 'ga4'] } = {}) {
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

  if (platforms.includes('ga4')) {
    try {
      const pages = await fetchTopPages({ days: 7, topN: 10 });
      const totalViews = pages.reduce((s, p) => s + p.views, 0);
      results.ga4 = { totalViews, topPaths: pages };

      console.log(chalk.bold('\n--- Google Analytics (GA4, last 7 days) ---'));
      console.log(`Total page views: ${chalk.green(totalViews)}`);
      console.log(chalk.dim('\nTop pages:'));
      pages.forEach((p) => {
        console.log(`  ${chalk.cyan(p.path.padEnd(50))} ${p.views} views`);
      });
    } catch (err) {
      log.error(`GA4 analytics failed: ${err.message}`);
    }
  }

  return results;
}
