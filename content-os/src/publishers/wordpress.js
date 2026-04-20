import axios from 'axios';
import { config, requireConfig } from '../config.js';
import { log } from '../utils/logger.js';

function getClient() {
  requireConfig('WORDPRESS_URL', 'WORDPRESS_USER', 'WORDPRESS_APP_PASSWORD');
  const token = Buffer.from(`${config.WORDPRESS_USER}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return axios.create({
    baseURL: `${config.WORDPRESS_URL.replace(/\/$/, '')}/wp-json/wp/v2`,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

// Returns the next available publish slot: 09:00, 13:00, or 18:00 JST
// Fetches existing scheduled posts to avoid collisions
export async function nextPublishSlot(client) {
  const SLOT_HOURS = [9, 13, 18];
  const TZ = 'Asia/Tokyo';

  // Get scheduled posts to find occupied slots
  const { data: scheduled } = await client.get('/posts?status=future&per_page=50');
  const occupied = new Set(scheduled.map((p) => p.date.slice(0, 16))); // "YYYY-MM-DDTHH:MM"

  const now = new Date();

  // Try slots over the next 7 days
  for (let day = 0; day < 7; day++) {
    const base = new Date(now);
    base.setDate(base.getDate() + day);

    for (const hour of SLOT_HOURS) {
      // Build the slot time in JST
      const jstStr = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(base);

      const slotISO = `${jstStr}T${String(hour).padStart(2, '0')}:00:00`;

      // Skip if this slot is in the past (compare as UTC)
      const slotUTC = new Date(`${slotISO}+09:00`);
      if (slotUTC <= now) continue;

      const slotKey = slotISO.slice(0, 16);
      if (!occupied.has(slotKey)) {
        return slotISO; // WordPress expects local time in site timezone
      }
    }
  }

  throw new Error('No available publish slots in the next 7 days');
}

async function resolveTermIds(client, endpoint, names) {
  const ids = [];
  for (const name of names) {
    const { data: existing } = await client.get(`/${endpoint}?search=${encodeURIComponent(name)}`);
    if (existing.length > 0) {
      ids.push(existing[0].id);
    } else {
      const { data: created } = await client.post(`/${endpoint}`, { name });
      ids.push(created.id);
    }
  }
  return ids;
}

export async function publishToWordPress(data, { dryRun = false, status = 'future' } = {}) {
  if (dryRun) {
    log.info(`[DRY RUN] Would publish WordPress post: "${data.title}" as ${status}`);
    return { dryRun: true };
  }

  const client = getClient();
  log.step('Publishing to WordPress...');

  const [tagIds, categoryIds] = await Promise.all([
    resolveTermIds(client, 'tags', data.tags || []),
    resolveTermIds(client, 'categories', data.categories || []),
  ]);

  const payload = {
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    slug: data.slug,
    tags: tagIds,
    categories: categoryIds,
    status,
  };

  if (status === 'future') {
    payload.date = await nextPublishSlot(client);
    log.info(`Scheduled for: ${payload.date} JST`);
  }

  const { data: post } = await client.post('/posts', payload);
  log.success(`WordPress post created: ${post.link}`);

  return { postId: post.id, url: post.link, status: post.status, scheduledDate: payload.date };
}
