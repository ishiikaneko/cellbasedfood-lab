import { researchTopic } from './agents/researcher.js';
import { writeArticle }  from './roles/writer.js';
import { publish }       from './agents/publisher.js';

const [,, command, ...args] = process.argv;
const topic = args.join(' ') || process.env.TOPIC || '培養肉の最新技術動向';

async function run() {
  if (command === 'publish') {
    console.log(`📌 Topic: "${topic}"`);
    console.log('🔬 Step 1/3: Researching...');
    
    const { filepath: sourcesFile } = await researchTopic(topic);
    
    console.log('✍️  Step 2/3: Writing...');
    const { content } = await writeArticle(topic, { sourcesFile });
    
    console.log('🚀 Step 3/3: Publishing...');
    
    // WriterのJSON出力をパース
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1].trim() : content.trim();
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('❌ Failed to parse writer JSON output:', e.message);
      console.error('Raw content:', content.slice(0, 500));
      throw e;
    }
    
    // 記事本文から descriptionを抽出（最初の段落・HTMLタグ除去）
    const bodyLines = (parsed.body || '').split('\n').filter(l => l.trim());
    const firstParagraph = bodyLines.find(l => !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('-') && !l.startsWith('*')) || '';
    const description = firstParagraph
      .replace(/<[^>]+>/g, '')   // HTMLタグを除去
      .replace(/\*\*/g, '')      // Markdownの太字記号を除去
      .slice(0, 120)
      .replace(/\s+/g, ' ')
      .trim();
    
    const article = {
      title: parsed.title || topic,
      description: description,
      category: Array.isArray(parsed.category) ? parsed.category[0] : (parsed.category || '技術'),
      tags: [],
      body: parsed.body || '',
      aiGenerated: true,
    };
    
    const result = await publish(article);
    console.log(`✅ Done! ${result.filepath}`);
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});