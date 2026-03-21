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
   - `duration_sec` = **60**（15秒×4クリップ）
2. INSERT 内容を人間に提示し、確認を得る。
3. `generation_jobs` に INSERT する。
4. 生成した `job_id` を表示する。

## INSERT SQL

```sql
INSERT INTO generation_jobs (
  trend_keywords, event_name, situation_text,
  story_type_id, hook_pattern_id, emotion_target,
  episode_count, duration_sec
) VALUES (?, ?, ?, ?, ?, ?, 1, 60);
```

## 介入点

- INSERT 前に内容確認・修正を受け付ける。

## 出力

- `job_id`: 新規作成されたジョブID
- ステータス: `pending`
