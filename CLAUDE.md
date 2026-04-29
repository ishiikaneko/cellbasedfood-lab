# CellBasedFood Lab — Claude Code ガイド

PCのClaude CodeがこのリポジトリでAIエージェントとして作業するための設定ドキュメント。

## リポジトリ構成

```
cellbasedfood-lab/
├── src/                    # Astroブログ本体
│   └── content/blog/       # ← 記事Markdownファイル（自動生成）
├── public/images/          # サムネイル画像（自動生成）
├── content-os/             # コンテンツパイプライン（Node.js）
│   ├── src/
│   │   ├── agents/         # publisher.js, researcher.js
│   │   ├── roles/          # writer.js, strategist.js, analytics.js
│   │   └── utils/          # claude.js, logger.js
│   └── .env                # ← ローカル環境変数（要作成）
├── scripts/
│   ├── sync.sh             # PC同期スクリプト（Mac/Linux）
│   └── sync.bat            # PC同期スクリプト（Windows）
└── .github/workflows/      # GitHub Actions（自動投稿）
```

## PCセットアップ手順

### 1. リポジトリのクローン

```bash
# Windows
git clone https://github.com/ishiikaneko/cellbasedfood-lab.git "C:\Users\Yuji Matsuyoshi\Downloads\cellbasedfood-lab"
cd "C:\Users\Yuji Matsuyoshi\Downloads\cellbasedfood-lab"

# Mac/Linux
git clone https://github.com/ishiikaneko/cellbasedfood-lab.git ~/cellbasedfood-lab
cd ~/cellbasedfood-lab
```

### 2. Node.js依存関係のインストール

```bash
# ブログ本体（Astro）
npm install

# コンテンツパイプライン
cd content-os && npm install && cd ..
```

### 3. 環境変数の設定

```bash
cp content-os/.env.example content-os/.env
# エディタで content-os/.env を開いてAPIキーを設定
```

必須キー：
- `ANTHROPIC_API_KEY` — Claude API（記事生成）
- `OPENAI_API_KEY` — DALL-E 3（サムネイル生成）

### 4. Git認証の確認

```bash
git remote -v
# → origin  https://github.com/ishiikaneko/cellbasedfood-lab.git

# Personal Access Token（PAT）が必要な場合
git config credential.helper store
git push origin main  # ← 初回にPATを入力
```

## PCからの記事生成・同期

### GitHubから最新記事を取得（Pull）

```bash
scripts/sync.sh pull      # Mac/Linux
scripts\sync.bat pull     # Windows
```

### 記事を手動生成してGitHubに同期（Push）

```bash
cd content-os
node src/index.js publish            # デフォルトトピックで生成
node src/index.js publish "足場材料の新手法"  # トピック指定
```

記事生成後、自動でgit commit & pushされVercelがデプロイします。

### PC↔GitHub双方向同期

```bash
scripts/sync.sh      # Mac/Linux（pull → 確認 → push）
scripts\sync.bat     # Windows
```

## ブログのローカルプレビュー

```bash
npm run dev     # http://localhost:4321 で確認
npm run build   # 本番ビルド（dist/）
```

## GitHub Actionsとの関係

| 実行場所 | トリガー | 動作 |
|---|---|---|
| GitHub Actions | 毎日09:00 JST (cron) | 記事を自動生成→push→Vercelデプロイ |
| PC（手動） | `node src/index.js publish` | 記事生成→push→Vercelデプロイ |
| PC（Claude Code） | このCLAUDE.mdを参照 | 上記と同様 |

## よく使うコマンド

```bash
# PCの変更をGitHubに反映
git add src/content/blog/ public/images/
git commit -m "add: 記事タイトル"
git push origin main

# GitHubの最新をPCに取得
git pull origin main

# 記事一覧を確認
ls src/content/blog/

# ブログをローカルで確認
npm run dev
```

## トラブルシューティング

**git push が失敗する場合**
- GitHub PATが設定されているか確認
- `git config --global credential.helper store` を実行後、再度push

**記事生成でAPIエラーが出る場合**
- `content-os/.env` にAPIキーが正しく設定されているか確認
- `ANTHROPIC_API_KEY` と `OPENAI_API_KEY` の両方が必要

**SITE_REPO_PATH のエラー**
- `content-os/.env` に `SITE_REPO_PATH=/path/to/cellbasedfood-lab` を追記
