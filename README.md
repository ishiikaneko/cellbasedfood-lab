# CellBasedFood Lab

培養肉企業研究員・石井金子による一次ソース解説ブログ。

## セットアップ

```bash
npm install
npm run dev       # localhost:4321
npm run build     # dist/ に出力
npm run preview   # ビルド結果をプレビュー
```

## ディレクトリ構成

```
src/
├── content/
│   ├── config.ts          # 記事スキーマ定義
│   └── blog/              # ← 自動投稿はここにMarkdownを追加
├── layouts/
│   └── BaseLayout.astro   # HTML共通シェル（OGP含む）
├── components/
│   ├── Header.astro       # ナビ・検索・カテゴリーバー
│   ├── ArticleCard.astro  # 記事カード
│   └── Footer.astro       # フッター
├── pages/
│   └── index.astro        # ホームページ
└── styles/
    └── global.css         # フォント・変数・リセット
```

## 記事のFrontmatter

```yaml
---
title: "記事タイトル"
description: "120字以内のSEO用説明文"
pubDate: 2026-04-20        # YYYY-MM-DD
category: 技術              # 技術 / 規制・政策 / 市場・投資 / ニュース / コラム
tags: [足場材料, コスト削減]  # 自由に追加可
heroImage: /images/xxx.png  # DALL-E 3 生成画像のパス（省略可）
aiGenerated: true           # Claude自動生成記事はtrue
draft: false                # trueにすると非公開
---
```

## 自動投稿パイプライン

```
GitHub Actions (cron: 09:00 / 13:00 / 18:00 JST)
  → content-os/index.js
    → Researcher: 論文・特許・レポート収集
    → Writer: 記事生成 (Claude API)
    → Editor: 校閲
    → Publisher: Markdown生成 + DALL-E 3画像 → src/content/blog/ に保存
  → git commit & push
  → Vercel: 自動ビルド & デプロイ
```

## GitHub Secrets 設定

| 変数名 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API キー |
| `GH_PAT` | repo書き込み権限のPAT |

## カテゴリー・タグ

カテゴリーは固定5種（`src/content/config.ts` で管理）。  
タグは記事frontmatterに自由に追加するだけで自動的にトップページに反映される。
