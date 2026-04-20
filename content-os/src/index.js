/**
 * content-os/src/index.js
 * CLIエントリーポイント
 */

import { research } from './agents/researcher.js';
import { write }    from './roles/writer.js';
import { publish }  from './agents/publisher.js';

const [,, command, ...args] = process.argv;
const topic = args.join(' ') || process.env.TOPIC || '';

async function run() {
  switch (command) {

    case 'publish': {
      console.log('🔬 Step 1/3: Researching...');
      const sources = await research(topic);

      console.log('✍️  Step 2/3: Writing...');
      const article = await write(sources, topic);

      console.log('🚀 Step 3/3: Publishing...');
      const result = await publish(article);

      console.log(`\n✅ Done!`);
      console.log(`   File: ${result.filepath}`);
      break;
    }

    default:
      console.log(`
使い方:
  node src/index.js publish            # 記事生成 → GitHub push
  node src/index.js publish "トピック"  # 指定トピックで生成
      `);
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});