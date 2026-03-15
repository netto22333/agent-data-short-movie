---
name: step4-select-type
description: event_name / story_type_id / hook_pattern_id をもとに状況文を生成し、人間に承認させる。Use when Step4（状況文生成）を実行する時。
---

# Step4: 状況文生成

1. 確定済みの `event_name` / `story_type_id` / `hook_pattern_id` を受け取る。
2. 選定された型に沿った `situation_text`（約200字）を生成する。
3. 生成結果を人間に提示する。
4. 人間の修正・承認を待つ。

## 制約

- `story_type` と `hook_pattern` の構造を活かした場面設定にする。
- キャラクター名・固有名詞は出さない（場面・関係性・状況のみ）。

## 介入点

- 状況文の修正・承認を受け付ける。
- 確定後、次ステップ（step5-insert-job）へ渡す。

## 出力

- `situation_text`: 確定済み状況文（約200字）
