import { researchTopic } from './agents/researcher.js';
import { writeArticle }  from './roles/writer.js';
import { publish }       from './agents/publisher.js';

const [,, command, ...args] = process.argv;
const topic = args.join(' ') || process.env.TOPIC || '培養肉の最新技術動向';

async function run() {
  switch (command) {

    case 'publish': {
      console.log(`📌 Topic: "${topic}"`);

      console.log('🔬 Step 1/3: Researching...');
      const { filepath: sourcesFile } = await researchTopic(topic);

      console.log('✍️  Step 2/3: Writing...');
      const { filepath: draftFile, content } = await writeArticle(topic, { sourcesFile });

      console.log('🚀 Step 3/3: Publishing...');

      // writerの出力からタイトル・本文を抽出してpublishに渡す
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : topic;
      const description = content.slice(0, 200).replace(/^#.+\n/, '').trim().slice(0, 120);

      const article = {
        title,
        description,
        category: detectCategory(topic),
        tags: [],
        body: content,
        aiGenerated: true,
      };

      const result = await publish(article);
      console.log(`\n✅ Done! File: ${result.filepath}`);
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

function detectCategory(topic) {
  if (/規制|政策|承認|法|政府/.test(topic)) return '規制・政策';
  if (/市場|投資|資金|スタートアップ|企業/.test(topic)) return '市場・投資';
  if (/ニュース|発表|速報/.test(topic)) return 'ニュース';
  return '技術';
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});