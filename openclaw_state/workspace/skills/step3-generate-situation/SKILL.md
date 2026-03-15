---
name: step3-generate-situation
description: 選択済みイベントから状況文を生成し、人間に承認させる。Use when Step3（状況文生成）を実行する時。
---

# Step3: 状況文生成

1. 確定済み `event_name` を受け取る。
2. `situation_text`（約200字）を生成する。
3. 生成結果を人間に提示する。
4. 人間の修正・承認を待つ。

## 介入点

- 状況文の修正・承認を受け付ける。
- 確定後、次ステップ（step4-select-type）へ渡す。

## 出力

- `situation_text`: 確定済み状況文（約200字）
