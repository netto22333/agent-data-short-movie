---
name: step8-generate-episodes
description: 承認済みジョブから episode_count 分の各話要素を生成し、人間に確認させる。Use when Step8（エピソード生成）を実行する時。
---

# Step8: エピソード生成

1. `prompt_review_status='approved'` の最新 `generation_jobs` を取得する。
2. `episode_count` 分の各話要素を生成する:
   - `episode_title`
   - `episode_summary`
   - `episode_hook`
   - `cliffhanger_text`
   - `video_prompt`
3. 全話の内容を人間に提示する。
4. 人間の修正・承認を待つ。

## 介入点

- 各話内容の修正を受け付ける。
- 確定後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 確定済みエピソード一覧（`episode_count` 件）
