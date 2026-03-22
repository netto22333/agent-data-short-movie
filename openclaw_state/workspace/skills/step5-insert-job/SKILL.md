---
name: step5-insert-job
description: 確定済みの全情報を generation_jobs に INSERT し、job_id を記録する。Use when Step5（ジョブ登録）を実行する時。
---

# Step5: ジョブ登録（generation_jobs INSERT）

1. 以下の確定済み情報を受け取る:
   - `trend_keywords`
   - `event_name`
   - `situation_text`
   - `story_type_id`
   - `hook_pattern_id`
   - `emotion_target`
   - `episode_count` = **1**（1話完結固定）
   - `duration_sec` = **75**（15秒×5クリップ）
2. `generation_jobs` に INSERT する。
4. 生成した `job_id` を表示する。

## INSERT SQL

```sql
INSERT INTO generation_jobs (
  trend_keywords, event_name, situation_text,
  story_type_id, hook_pattern_id, emotion_target,
  episode_count, duration_sec
) VALUES (?, ?, ?, ?, ?, ?, 1, 60);
```

## 自動処理

- 確認なしで自動INSERTし、次ステップへ進む。

## 出力

- `job_id`: 新規作成されたジョブID
- ステータス: `pending`
