/**
 * content-os/src/index.js
 * CLIエントリーポイント
 *
 * 使い方:
 *   node src/index.js publish            # 記事1本生成してpush
 *   node src/index.js publish "トピック"  # 指定トピックで生成
 *   node src/index.js write "トピック"   # 記事生成のみ（push不要）
 */

import { publish } from './agents/publisher.js';
import { research } from './agents/researcher.js';
import { write }    from './agents/writer.js';
import { edit }     from './agents/editor.js';

const [,, command, ...args] = process.argv;
const topic = args.join(' ') || process.env.TOPIC || '';

async function run() {
  switch (command) {

    // ── 記事生成 + GitHub push（本番用）──
    case 'publish': {
      console.log('🔬 Step 1/3: Researching...');
      const sources = await research(topic);

      console.log('✍️  Step 2/3: Writing...');
      const draft = await write(sources, topic);

      console.log('🔍 Step 3/3: Editing...');
      const article = await edit(draft);

      console.log('🚀 Publishing...');
      const result = await publish(article);

      console.log(`\n✅ Done!`);
      console.log(`   Slug: ${result.slug}`);
      console.log(`   File: ${result.filepath}`);
      if (result.heroImage) console.log(`   Image: ${result.heroImage}`);
      break;
    }

    // ── 記事生成のみ（ローカル確認用）──
    case 'write': {
      if (!topic) { console.error('Usage: node src/index.js write "トピック"'); process.exit(1); }
      const sources = await research(topic);
      const draft   = await write(sources, topic);
      const article = await edit(draft);
      console.log('\n── 生成された記事 ──\n');
      console.log(article.body);
      break;
    }

    default:
      console.log(`
CellBasedFood Lab コンテンツOS

コマンド:
  publish [トピック]   記事生成 → GitHub push → Vercel自動デプロイ
  write <トピック>     記事生成のみ（ローカル確認用）

例:
  node src/index.js publish
  node src/index.js publish "GFI 2025年次報告書"
  node src/index.js write "培養肉の規制動向"
      `);
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
