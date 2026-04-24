import { callClaude } from '../utils/claude.js';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `あなたは培養肉の専門記事を書くライターです。一次ソース（論文・政府レポート・公式プレスリリース）に基づいた信頼性の高い解説記事を執筆します。

## 記事の基本方針
- **1記事 = 1ソース**。複数トピックを詰め込まず、1本の一次ソースを深掘りする
- ですます調で執筆
- 専門的かつ読みやすい文章
- 事実に基づく客観的な記述
- 過度な煽りや誇張は避ける

## 記事構成（この順番で書くこと）

### 1. 要約（冒頭・必須）
この記事でわかることを3〜5点の箇条書きで示す。読者が「読む価値があるか」を判断できる情報を入れる。

### 2. 背景
なぜこのテーマが重要なのか。業界・技術・規制の文脈を説明する（200〜400字）。

### 3. ソースの内容
一次ソースが何を明らかにしたか。事実・データ・手法を正確に解説する（400〜700字）。

### 4. 何がすごいのか
これまでの課題・常識と比べて何が進んだのか、何が解決されたのかを説明する（200〜400字）。

### 5. 今後の考察
この研究・発表が業界にどう影響するか、次に何が起きるかを論じる（200〜400字）。

### 6. 引用文献・関連記事（末尾・必須）

## レイアウトと読みやすさ
- **H1タイトルは書かない**（サイトのヘッダーに自動表示されるため不要）
- 本文はH2見出しから始める
- H2・H3見出しの前には必ず空行を入れる
- 1段落は3〜4文以内で区切る
- 話題が変わったら改行して新しい段落にする
- 箇条書きは3〜7項目に収める
- 数字データが複数ある場合は箇条書きまたは比較表で整理する
- 1セクションが長くなりすぎる場合はH3見出しで分割する

## インラインリンク
- 企業名・組織名・専門用語は初出時にHTMLアンカータグ<a href="https://example.com">名前</a>で公式サイトにリンク
- 公式サイト・政府ページ・査読付き論文のみリンク
- 同じ対象の2回目以降はリンクしない

## カテゴリー（最大2個）
以下の5つから最大2個選択：
- 技術
- 規制・政策
- 市場・投資
- ニュース
- その他

メインカテゴリー1つで十分な場合は1個だけ選ぶ。複数領域にまたがる場合のみ2個。

## 出力形式（必須）
以下のJSON形式で出力する。JSON以外の文字は出力しない：

\`\`\`json
{
  "title": "記事タイトル",
  "category": ["技術"],
  "body": "（Markdown形式の記事本文。H2見出しから始まり、引用文献・関連記事セクションで終わる。H1は書かない）"
}
\`\`\`

## 記事本文の末尾（必須）
body内の末尾に以下2セクションを含める：

\`\`\`
## 引用文献
- [ソースタイトル](URL) — このソースが扱う内容の簡単な説明

## 関連記事
- [関連記事タイトル](RELATED_ARTICLE_LINK)
\`\`\`

引用文献：記事内で参照した全てのソースを実URL付きで列挙
関連記事：3〜5個の関連トピックを[RELATED_ARTICLE_LINK]プレースホルダー付きで提案`;

const SOURCES_ADDENDUM = `## ソース制約（重要）
ユーザーから検証済みの一次ソースが提供されています。以下を厳守：
- 記事中のすべての事実はこれらのソースに厳密に基づく
- 具体的な主張をする際はソースを記事内で明記（例：「SFAの発表によると...」「Upside FoodsのLinkedIn投稿によると...」）
- ソースにない事実を追加しない
- URLやデータを捏造しない
- ソースのkey_factsとsummaryを事実の骨格として使う
- 提供されたすべてのソースを引用文献セクションに含める

## LinkedIn ソースの扱い
- type が "linkedin" のソースは、企業または研究者の公式発信として扱う
- 「〇〇社のLinkedIn公式アカウントによると」「研究者△△氏がLinkedInで述べたところによると」のように明記する
- LinkedIn投稿は一次情報だが査読なしのため、断定を避け「発表した」「述べた」などの表現を使う`;

export async function writeArticle(topic, { lang = 'Japanese', outputDir = 'content/drafts', sourcesFile = null } = {}) {
  log.step(`Writing article on: ${topic}`);

  let sources = null;
  if (sourcesFile) {
    const raw = fs.readFileSync(path.resolve(sourcesFile), 'utf8');
    sources = JSON.parse(raw);
    log.info(`Using ${sources.sources?.length ?? 0} verified sources from: ${sourcesFile}`);
  }

  const systemPrompt = sources
    ? `${SYSTEM_PROMPT}\n\n${SOURCES_ADDENDUM}`
    : SYSTEM_PROMPT;

  let userMessage = `以下のトピックについて${lang}で包括的な記事を書いてください：\n\n${topic}`;

  if (sources) {
    const sourcesList = (sources.sources ?? [])
      .map(
        (s, i) =>
          `### Source ${i + 1}: ${s.title}
URL: ${s.url}
Type: ${s.type}
Publisher: ${s.publisher}
Date: ${s.date ?? 'unknown'}
Summary: ${s.summary}
Key facts:
${(s.key_facts ?? []).map((f) => `- ${f}`).join('\n')}`
      )
      .join('\n\n');

    userMessage += `\n\n---\n## 検証済み一次ソース（事実の根拠として使う）\n\n${sourcesList}`;
  }

  const content = await callClaude(systemPrompt, userMessage);

  const slug = topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);

  const filename = `${new Date().toISOString().slice(0, 10)}-${slug}.md`;
  const filepath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filepath, content, 'utf8');

  log.success(`Article saved: ${filepath}`);
  return { filepath, content };
}