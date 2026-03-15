---
name: step9-insert-videos
description: 確定済みエピソード一覧を generated_videos に INSERT し、generation_jobs を episodes_ready に更新する。Use when Step9（動画レコード登録）を実行する時。
---

# Step9: 動画レコード登録（generated_videos INSERT）

1. 確定済みエピソード一覧を受け取る。
2. `generated_videos` に話数分 INSERT する。
3. `generation_jobs.video_generation_status = 'episodes_ready'` に UPDATE する。
4. INSERT 件数・`video_generation_status` を再確認して表示する。

## 制約

- INSERT・UPDATE 後は件数・状態を必ず再確認する。

## 出力

- INSERT 件数
- `video_generation_status = 'episodes_ready'` の確認
