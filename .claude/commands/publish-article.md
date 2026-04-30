---
description: ChatGPTで完成させた原稿を貼り付けるとMarkdown配置・build確認・GitHub pushまで実行
allowed-tools: Read, Write, Glob, Grep, Bash(node:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git log:*), Bash(git diff:*), Bash(npm run build:*), Bash(mkdir:*)
---

あなたはこのブログ（Astro静的サイト、Vercel自動デプロイ）に **ChatGPT で完成済みの原稿を配置・公開する** 担当です。**調査も内容補強も一切しません**。受け取った原稿を完成原稿として扱い、整形・配置・build確認・git push までを実行します。

# 入力

ユーザーから ChatGPT 原稿が貼られます。理想形は以下の YAML frontmatter 風ヘッダ + 本文です。

```
---
title:
description:
slug:
category:
tags:
date:
references:
---

body:
本文
```

ヘッダや個別フィールドが欠落していてもよい。欠けたものだけを下記ルールで補完する。

# 厳守事項（絶対禁止）

- 一次ソース探索・WebSearch・自動調査をしない（このコマンドは WebSearch 権限を持たない）
- 本文の文言・主張・専門用語を変更しない、リライトしない
- 参考文献にない企業名・大学名・規制動向・数値を追加しない
- 主張を補強するために新しい情報を追加しない
- 論文に書かれていないことを論文の主張のように書き換えない
- 断定表現を勝手に強めない
- 本文中に内部リンクを inline 挿入しない（関連記事は末尾セクションのみ）

整形は **Markdown 構文の構造整理のみ**（H2/H3 の見出しレベル、`**強調**`、箇条書き、参考文献節への整形）。

# 手順

## 1. ブランチガード

```
git rev-parse --abbrev-ref HEAD
```
`main` でなければ「公開は main からのみ可能です。`git checkout main && git pull origin main` してから再実行してください」と表示し、**以降の処理は全て中止**する。`gitPush` ヘルパーは無条件で `git push origin main` するため必須。

## 2. 原稿パース

- ユーザーメッセージから `---` で囲まれた YAML 風 frontmatter ブロックを抽出（コードフェンス ` ``` ` で囲まれていても認識する）。
- frontmatter が無ければ全体を body とみなす。
- frontmatter から `title / description / slug / category / tags / date / references` を取り出す。
- body から `body:` ラベルを除いた本文を取り出す。

## 3. メタデータ補完（**欠損項目のみ**、既存値は上書きしない）

- **title**: 本文冒頭が `# ` 見出しならそれを採用、なければ意味段落から 25–45 字の見出しを生成。
- **description**: 最初の段落から 100–120 字の要約を生成（記号・HTMLタグ除去）。
- **slug**: ASCII 英数 + ハイフン、最大 60 字、英語 3–5 単語。日本語のみのタイトルでも英語スラグを生成。
- **category**: 以下の 5 値のいずれかに正規化。`コラム` は提示しない（schema にはあるが `その他` に丸める）。
  - `技術` / `規制・政策` / `市場・投資` / `ニュース` / `その他`
  - 推定指針: 論文・実験・スケールアップ等 → `技術`、規制・承認・法案 → `規制・政策`、資金調達・市場規模・企業動向 → `市場・投資`、業界ニュース → `ニュース`、上記以外 → `その他`
- **tags**: 本文から名詞句 3–5 個を抽出。
- **date**: 日本時間（JST, UTC+9）の今日。会話コンテキストの `currentDate` を `YYYY-MM-DD` で使う。`new Date()` は使わない（UTC ずれ防止）。
- **最終 Markdown では `date:` ではなく `pubDate:` キーで書き出す**（Astro schema が `pubDate` を要求するため、入力 frontmatter の `date` も `pubDate` に正規化）。

## 4. 必須項目検証

`title / description / slug / category / pubDate` のいずれかが補完不能なら、**ここで停止**してユーザーに不足項目を提示し確認を求める。

## 5. slug 衝突チェック

```
Glob: src/content/blog/{date}-{slug}.md
```
既存なら `-2`, `-3` のサフィックスを付ける（`src/content/blog/` には `nature-food` 系の連番衝突実例あり）。

## 6. 本文の構造整形（書き換え禁止、構文整形のみ）

- H2/H3 の見出しレベルを Markdown 構文として整える
- 強調・箇条書きの記号を Markdown 標準に揃える
- 文言・主張・数値・固有名詞は触らない

## 7. 参考文献セクション整形

入力 frontmatter の `references:` または本文末尾の参考文献記述を **`## 参考文献`** セクションに番号付きリストで整形する。

```markdown
## 参考文献

1. ...
2. ...
```

**入力に無い文献は絶対に追加しない**。

## 8. 関連記事セクション

```
Glob: src/content/blog/*.md
```
で既存記事一覧を取得し、各ファイルの先頭 10 行（frontmatter）を `Read` で読み、`title` を確認。意味的に近い 1〜3 件を選ぶ。本文末尾に追加：

```markdown
## 関連記事

- [{記事タイトル}](/blog/{slug}/)
```

slug は既存ファイル名 `YYYY-MM-DD-{slug}.md` から日付プレフィックスを除いたもの。**本文中への inline 挿入はしない**。

## 9. Markdown 書き込み

`Write` で `src/content/blog/{date}-{slug}.md` を作成。frontmatter は以下の固定スキーマ。`heroImage` 行は **入れない**（後段ヘルパーが注入する）。

```markdown
---
title: "{title}"
description: "{description}"
pubDate: {date}
category: {category}
tags: ["{tag1}", "{tag2}", ...]
aiGenerated: true
draft: false
---

{整形済み本文}

## 参考文献

{参考文献リスト}

## 関連記事

{関連記事リスト}
```

`title` と `description` 内のダブルクォートは `\"` でエスケープ。tags 配列は最低 1 個入れる（空配列でもスキーマは通るが補完ルールどおり 3–5 個）。

## 10. build 確認

```
npm run build
```
`/home/user/cellbasedfood-lab` の cwd で実行。

- **失敗した場合**: push せず、stderr を要約してユーザーに表示。よくある原因と修正候補（frontmatter スキーマ違反 = category の値、pubDate が date 型として読めない、ダブルクォート未エスケープ、本文中の HTML タグ崩れ等）を列挙して停止。
- **成功した場合**: 次のステップへ進む。

## 11. ペイロード JSON 出力

`Write` で `/tmp/publish-{slug}.json` に以下を書く。

```json
{
  "title": "...",
  "description": "...",
  "category": "{正規化済みカテゴリ}",
  "slug": "{slug}",
  "date": "{YYYY-MM-DD}",
  "markdownPath": "src/content/blog/{date}-{slug}.md"
}
```

## 12. ヘルパー起動（DALL-E + git push）

```
node content-os/src/agents/publish-from-markdown.js --payload-file /tmp/publish-{slug}.json
```

このヘルパーが
- `OPENAI_API_KEY` があれば DALL-E でサムネ生成 → frontmatter に `heroImage` 行を注入
- `OPENAI_API_KEY` 未設定 or 画像生成失敗時は heroImage なしで続行
- `git add src/content/blog/ public/images/` → `git commit -m "auto: {title}"` → `git push origin main`

を実行する。

ヘルパーが非ゼロ終了したら、その出力を要約してユーザーに表示。push 失敗時はリモート pull が必要な可能性も伝える。

## 13. 完了報告

以下を箇条書きで返す。

- ✅ Markdown: `src/content/blog/{date}-{slug}.md`
- 🖼 画像: `public/images/{date}-{slug}.png` （生成された場合のみ。失敗時は「画像生成スキップ」）
- 📦 commit: `git log -1 --oneline` の結果
- 🌐 公開URL: `https://cellbasedfood-ishiikaneko.com/blog/{date}-{slug}/`
- ⏱ Vercel デプロイ完了まで数分かかります、と添える
