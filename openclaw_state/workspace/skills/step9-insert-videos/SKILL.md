---
name: step9-insert-videos
description: 確定済みエピソード一覧を generated_videos に INSERT し、generation_jobs を episodes_ready に更新する。Use when Step9（動画レコード登録）を実行する時。
---

# Step9: 動画レコード登録（generated_videos INSERT）

1. 確定済みエピソード一覧を受け取る。
2. `generated_videos` に話数分 INSERT する。
3. `generation_jobs.video_generation_status = 'episodes_ready'` に UPDATE する。
4. INSERT 件数・`video_generation_status` を再確認して表示する。

## INSERT SQL

```sql
INSERT INTO generated_videos (
  generation_job_id, episode_no, episode_title, episode_summary,
  episode_hook, cliffhanger_text,
  emotion_target_per_ep, dialogue_motif_placement,
  scenes_json, narration_script,
  video_review_status, post_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'not_posted');
```

- `scenes_json`: Step8で生成した `scenes` 配列を JSON 文字列にシリアライズして格納
- `narration_script`: Step8で生成した `narration_script` 文字列をそのまま格納
- `emotion_target_per_ep`: Step8で生成したこの話の感情ターゲット（例: 不安, 衝撃, 解放）
- `dialogue_motif_placement`: Step8で生成した台詞リフレインの使い方（伏線 / 回収 / なし）
- `character_definitions` / `location_definitions` は `generation_jobs.prompt_text` 内に保持（全話共通のため generation_jobs に持たせる）

## 制約

- INSERT・UPDATE 後は件数・状態を必ず再確認する。

## 出力

- INSERT 件数
- `video_generation_status = 'episodes_ready'` の確認
