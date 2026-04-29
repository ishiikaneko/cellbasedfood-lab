#!/usr/bin/env bash
# PC ↔ GitHub 双方向同期スクリプト（Mac/Linux用）
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-sync}"

pull() {
  echo "⬇️  GitHubから最新記事を取得中..."
  git fetch origin main
  LOCAL=$(git rev-parse main)
  REMOTE=$(git rev-parse origin/main)
  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ 既に最新です（変更なし）"
  else
    git pull origin main
    CHANGED=$(git diff --name-only HEAD@{1} HEAD -- src/content/blog/ public/images/ 2>/dev/null || true)
    if [ -n "$CHANGED" ]; then
      echo "📥 取得した記事・画像:"
      echo "$CHANGED" | sed 's/^/  /'
    fi
    echo "✅ Pull完了"
  fi
}

push() {
  echo "⬆️  PCの変更をGitHubに送信中..."
  git add src/content/blog/ public/images/ 2>/dev/null || true
  STAGED=$(git diff --staged --name-only)
  if [ -z "$STAGED" ]; then
    echo "ℹ️  送信する変更がありません"
    return
  fi
  echo "📤 送信するファイル:"
  echo "$STAGED" | sed 's/^/  /'
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  git commit -m "sync: PC同期 ${TIMESTAMP}"
  git push origin main
  echo "✅ Push完了 → Vercelが自動デプロイします"
}

case "$MODE" in
  pull)
    pull
    ;;
  push)
    push
    ;;
  sync)
    pull
    echo ""
    push
    ;;
  *)
    echo "使い方: $0 [pull|push|sync]"
    echo "  pull  — GitHubから最新記事をPCに取得"
    echo "  push  — PCの変更をGitHubに送信"
    echo "  sync  — pull → push の順に実行（デフォルト）"
    exit 1
    ;;
esac
