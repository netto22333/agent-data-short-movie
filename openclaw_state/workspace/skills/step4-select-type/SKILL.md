---
name: step4-select-type
description: situation_text に最適な story_type と hook_pattern を DB から選定し、人間に確認させる。Use when Step4（タイプ選定）を実行する時。
---

# Step4: ストーリータイプ・フックパターン選定

1. 確定済み `situation_text` を受け取る。
2. DBクエリを実行する:
   - `SELECT * FROM story_types WHERE is_active=1`
   - `SELECT * FROM hook_patterns WHERE is_active=1`
3. `situation_text` に最適な `story_type_id` と `hook_pattern_id` を選定し、理由とともに人間に提示する。
4. 人間の選定変更・承認を待つ。

## 介入点

- `story_type_id` / `hook_pattern_id` の変更を受け付ける。
- 確定後、次ステップ（step5-insert-job）へ渡す。

## 出力

- `story_type_id`: 確定済みストーリータイプID
- `hook_pattern_id`: 確定済みフックパターンID
