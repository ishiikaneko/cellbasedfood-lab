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
    const { filepath: draftFile, content } = await writeArticle(topic, { sourcesFile });
    
    console.log('🚀 Step 3/3: Publishing...');
    const article = {
      title: topic,
      description: content.slice(0, 120),
      category: '技術',
      tags: [],
      body: content,
      aiGenerated: true,
    };
    const result = await publish(article);
    console.log(`✅ Done! ${result.filepath}`);
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  console.error('Type:', err.constructor.name);
  console.error('Cause:', err.cause?.message || 'none');
  console.error('Stack:', err.stack);
  process.exit(1);
});