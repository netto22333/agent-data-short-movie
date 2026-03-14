# Bootstrap — 初回起動手順

## 概要

このドキュメントはエージェント「Reel」の初回起動時に実行すべき手順を記載します。

## 手順

### 1. 環境確認

```bash
# DBの確認
sqlite3 /home/node/.openclaw/short-movie.db ".tables"
sqlite3 /home/node/.openclaw/short-movie.db "SELECT * FROM story_types;"
sqlite3 /home/node/.openclaw/short-movie.db "SELECT * FROM hook_patterns;"

# ブラウザ確認（CDP）
curl -sf "http://[::1]:18803/json/version"
```

### 2. Claude Code 認証確認

```bash
claude --version
# 未認証の場合: claude auth login
```

### 3. ワークフロー開始

docs/workflow.md を読み、ステップ1（トレンド収集）から開始します。

```
openclaw agent run --prompt "docs/workflow.md を読んで、ステップ1のトレンド収集を開始してください"
```

## 注意事項

- 初回は必ず人間がnoVNC（localhost:6082）でブラウザの状態を確認すること
- Claude Code の OAuth 認証が必要な場合、人間に画面確認を依頼すること
- DBのシードデータが正しく入っているかを確認してから作業開始すること
