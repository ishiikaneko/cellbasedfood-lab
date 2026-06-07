# CLAUDE.md

このリポジトリで作業する際の指針。特に **記事公開のワークフロー** は必ず守ること。

## プロジェクト概要

Astro 製の静的サイト（培養肉・細胞農業の一次ソース解説ブログ）。
記事は `src/content/blog/*.md`（frontmatter + 本文）。スキーマは `src/content/config.ts`。

```bash
npm install
npm run dev       # localhost:4321
npm run build     # generate-og → astro build（OGP PNG生成を含む）
```

## 記事公開のワークフロー（デフォルト・必須）

新しい記事を公開するときは、**必ず以下をワンセットで行う**。途中で省略しない。

1. **本文 Markdown** を `src/content/blog/<slug>.md` に作成する。
   - frontmatter は `src/content/config.ts` のスキーマに従う。
   - 必須: `title` / `description` / `pubDate`(YYYY-MM-DD) / `category`(下記enum) / `tags`(配列)。
   - `category` は `細胞` / `培養液` / `培養方法` / `その他培養資材` / `細胞培養食品` / `コラム` のいずれか。
   - `heroImage` は **SVG** を指定する: `/images/<pubDate>-<slug>.svg`。

2. **ヒーロー画像 SVG** を `public/images/<pubDate>-<slug>.svg` に作成する。
   - viewBox は `0 0 1792 1024`。背景はカテゴリーの配色に合わせる
     （例: `その他培養資材` は紫グラデーション `#A87FCC`→`#8A5BB5`）。
   - 既存記事の SVG（同カテゴリー）を参考に絵柄・配色を揃える。

3. **OGP 用 PNG を生成する**（X/Twitter・Facebook 対策）。
   - SNS のカードクローラーは `og:image` に SVG を認識しない（PNG/JPEG/WebP/GIF のみ）。
   - `BaseLayout.astro` は `/images/*.svg` を `/og/*.png` に読み替えて OGP に使う。
   - そのため **`npm run generate-og` を実行**して
     `public/og/<pubDate>-<slug>.png` を焼き込む。
   - ⚠ `npx astro build` で `generate-og` を飛ばさないこと。PNG が欠けると
     X 共有時にカード画像が出ない。

4. **3ファイルをまとめてコミットする**。`public/og/*.png` はリポジトリ管理対象
   （既存記事も全て PNG をコミット済み）。漏らさないこと。
   - `src/content/blog/<slug>.md`
   - `public/images/<pubDate>-<slug>.svg`
   - `public/og/<pubDate>-<slug>.png`

5. ビルドが通ることを確認してから push する（`npm run build` または
   依存が揃っていれば `npx astro build`）。

> まとめ: **heroImage は SVG、OGP は SVG から生成した PNG。両方を必ずコミット。**

## ブランチ運用

- 指定された作業ブランチで開発・コミット・push する。
- `main` への直接 push / マージはユーザーの明示的な許可があるときのみ。
