---
name: step10-prepare-sora2-prompts
description: DBからクリップ構成を読み込み、Sora 2のInitial生成+Extend×6用のプロンプトを生成・ファイル保存する。Use when Step10（Sora2プロンプト生成）を実行する時。
---

# Step10: Sora 2プロンプト生成（Initial + Extend×6）

## 実行方法（必須）

このステップは **Claude Code** のスキルとして実行する。openclawから以下のように呼び出すこと:

```bash
claude --dangerously-skip-permissions "/step10-prepare-sora2-prompts job_id={job_id}"
```

⚠️ openclawが直接プロンプト生成を行わないこと。必ず Claude Code のスキル `/step10-prepare-sora2-prompts` に委譲する。
⚠️ 全自動のため `--print` モードで実行してよい。
⚠️ `--dangerously-skip-permissions` でワークスペース信頼確認・ツール実行許可をスキップする。

## 手順

1. 対象の `generation_jobs` レコードの `job_id` を確認する。
2. 上記コマンドで Claude Code のスキル `/step10-prepare-sora2-prompts` を呼び出す。
3. Claude Code が7クリップのSora 2プロンプトを生成し、ファイル保存・DB保存まで実行する。

## DB確認クエリ（対象job_idの確認用）

```sql
SELECT id, series_title, video_generation_status
FROM generation_jobs
WHERE video_generation_status='episodes_ready'
ORDER BY id DESC;
```

## 自動処理

- 生成したプロンプトをそのまま採用し、次ステップ（step11-sora2-generate）へ進む。

## 出力

- `workspace/sora-prompts/ep1/clip{1-7}.txt`（Sora 2コピペ用）
- `generated_videos.sora2_prompts_json`（DB永続化）
