import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BANNER_URLS = [
  'https://amzn.to/4e4lE2Q',
  'https://amzn.to/4cuO3Oq',
  'https://amzn.to/3Qm6I6x',
  'https://amzn.to/4sTaH7O',
  'https://amzn.to/4sTaNMI',
  'https://amzn.to/4uaxsFv',
  'https://amzn.to/4udSzXI',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Amazon uses name="title" / name="description", not og: tags
function extractNameMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']|` +
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    'i'
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? '').trim() || null;
}

function extractProductImage(html) {
  // Product images are in src="..." around the 390KB mark in Amazon HTML
  const m = html.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg[^"]*)"/);
  return m?.[1] ?? null;
}

function cleanAmazonTitle(title) {
  if (!title) return null;
  // Strip "Amazon.co.jp: " prefix
  let t = title.replace(/^Amazon\.co\.jp\s*:\s*/i, '');
  // Strip " eBook : 著者名 : Kindleストア" and similar author/format suffixes
  t = t.replace(/\s+(?:eBook|Kindle版|単行本|電子書籍)\s*:.*$/i, '');
  // Strip " | 本 | 通販 | Amazon" and similar suffixes
  t = t.replace(/\s*[|｜]\s*(本|書籍|通販|Amazon|アマゾン).*$/i, '');
  return t.trim() || null;
}

async function fetchOgp(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Read up to 450KB – product images appear around the 390KB mark in Amazon HTML.
    // Stop early once we find an <img src="...amazon...jpg"> pattern.
    const reader = res.body.getReader();
    let html = '';
    let bytes = 0;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    while (bytes < 450_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytes += value.byteLength;
      if (/src="https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg/.test(html)) break;
    }
    reader.cancel();

    const rawTitle    = extractNameMeta(html, 'title');
    const title       = cleanAmazonTitle(rawTitle);
    const description = extractNameMeta(html, 'description');
    const image       = extractProductImage(html);

    if (!html.includes('amazon')) throw new Error('Robot check page');
    console.log(`  OK  ${url} → ${title?.slice(0, 50)}`);
    return { url, title: title ?? 'Amazon商品を見る', image, description };
  } catch (err) {
    console.warn(`  FAIL ${url}: ${err.message}`);
    return { url, title: 'Amazon商品を見る', image: null, description: null };
  }
}

async function main() {
  console.log('Fetching OGP data for sponsored URLs...');
  const results = [];
  for (const url of BANNER_URLS) {
    results.push(await fetchOgp(url));
    await new Promise(r => setTimeout(r, 800));
  }
  const outDir  = join(__dirname, '../src/data');
  const outPath = join(outDir, 'ogp-cache.json');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify({ fetchedAt: new Date().toISOString(), items: results }, null, 2), 'utf-8');
  console.log(`Wrote ${results.length} entries → ${outPath}`);
}

main();
