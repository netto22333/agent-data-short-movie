# Tools — 環境メモ

## ブラウザ（CDP）

- **URL**: `http://[::1]:18803`
- openclawプロファイル名: `chrome`
- 操作方法: `openclaw browser` コマンド、またはCDP直接接続

## Gateway

- **アドレス**: `127.0.0.1:18789`
- loopbackのみでコンテナ内から接続可能

## ディスプレイ

- **DISPLAY**: `:99`
- 解像度: 1366x768

## noVNC（人間確認用）

- **URL**: `http://localhost:6082/vnc.html`
- ブラウザの状態を人間がリアルタイムで確認・操作できる

## データベース

- **パス**: `/home/node/.openclaw/short-movie.db`
- エンジン: SQLite3（better-sqlite3）
- テーブル: `story_types`, `hook_patterns`, `generation_jobs`, `generated_videos`

## Claude Code

- コマンド: `claude`
- OAuth認証: `/home/node/.claude/` に永続化済み

## ログ

- fluxbox: `/tmp/fluxbox.log`
- x11vnc: `/tmp/x11vnc.log`
- noVNC: `/tmp/novnc.log`
- Chromium: `/tmp/chromium.log`
- OpenClaw Gateway: `/tmp/openclaw-gateway.log`
