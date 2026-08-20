import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
  'https://amzn.to/3SYURN3',
  'https://amzn.to/4gIL4DS',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function extractNameMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']|` +
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    'i'
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? '').trim() || null;
}

// タイトルと著者名を分離して返す
function parseAmazonTitle(rawTitle) {
  if (!rawTitle) return { title: null, author: null };

  let t = rawTitle;
  let author = null;

  // Strip "Amazon.co.jp: " prefix
  t = t.replace(/^Amazon\.co\.jp\s*:\s*/i, '');

  // "| AUTHOR" パターンで著者抽出（| 本/通販/Amazon 以外）
  const pipeIdx = t.search(/\s*[|｜]/);
  if (pipeIdx > 0) {
    let afterPipe = t.slice(pipeIdx).replace(/^\s*[|｜]\s*/, '').trim();
    // 著者文字列末尾の "|本|通販|Amazon" を除去
    afterPipe = afterPipe.replace(/\s*[|｜].*$/i, '').trim();
    if (afterPipe && !/^(本|書籍|通販|Amazon|アマゾン)/i.test(afterPipe)) {
      author = afterPipe;
    }
    t = t.slice(0, pipeIdx).trim();
  }

  // " eBook : AUTHOR: Kindleストア" から著者抽出（まだ取れていない場合）
  if (!author) {
    const ebookMatch = t.match(/\s+(?:eBook|電子書籍)\s*:\s*([^:]+):\s*Kindleストア/i);
    if (ebookMatch) author = ebookMatch[1].trim();
  }

  // " eBook : ..." 以降を除去
  t = t.replace(/\s+(?:eBook|Kindle版|単行本|電子書籍)\s*:.*$/i, '');

  return { title: t.trim() || null, author: author || null };
}

// descriptionから著者名を抽出（タイトルに著者がない場合のフォールバック）
function extractAuthorFromDescription(desc) {
  if (!desc) return null;
  const m = desc.match(/(?:eBook|電子書籍)\s*:\s*([^:]+):\s*Kindleストア/i);
  return m ? m[1].trim() : null;
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

    // 最大450KB読み取り。商品画像のsrc=が見つかったら早期終了
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

    const rawTitle = extractNameMeta(html, 'title');
    const desc     = extractNameMeta(html, 'description');
    const { title, author: titleAuthor } = parseAmazonTitle(rawTitle);
    const author = titleAuthor ?? extractAuthorFromDescription(desc);
    const image  = html.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/)?.[1] ?? null;

    if (!html.includes('amazon')) throw new Error('Robot check page');
    console.log(`  OK  ${url} → ${title?.slice(0, 40)} / ${author ?? '著者不明'}`);
    return { ok: true, item: { url, title: title ?? 'Amazon商品を見る', author, image } };
  } catch (err) {
    console.warn(`  FAIL ${url}: ${err.message}`);
    return { ok: false, item: { url, title: 'Amazon商品を見る', author: null, image: null } };
  }
}

async function main() {
  console.log('Fetching OGP data for sponsored URLs...');
  const outDir  = join(__dirname, '../src/data');
  const outPath = join(outDir, 'ogp-cache.json');

  // 既存キャッシュ: 取得失敗時のフォールバック & ローカル画像(/images/...)の保持に使う
  const prev = new Map();
  try {
    const cached = JSON.parse(readFileSync(outPath, 'utf-8'));
    for (const it of cached.items ?? []) prev.set(it.url, it);
  } catch {}

  const results = [];
  for (const url of BANNER_URLS) {
    const { ok, item } = await fetchOgp(url);
    const old = prev.get(url);
    if (!ok && old) {
      results.push(old);          // 失敗時は前回のキャッシュを維持
    } else {
      if (old?.image?.startsWith('/')) item.image = old.image; // リポジトリ内画像を優先
      else if (!item.image && old?.image) item.image = old.image;
      results.push(item);
    }
    await new Promise(r => setTimeout(r, 800));
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify({ fetchedAt: new Date().toISOString(), items: results }, null, 2), 'utf-8');
  console.log(`Wrote ${results.length} entries → ${outPath}`);
}

main();
