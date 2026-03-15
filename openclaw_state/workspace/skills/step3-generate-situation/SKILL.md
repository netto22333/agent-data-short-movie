---
name: step3-generate-situation
description: event_name に対して DB から story_type と hook_pattern を選定し、人間に確認させる。Use when Step3（ストーリータイプ・フックパターン選定）を実行する時。
---

# Step3: ストーリータイプ・フックパターン選定

1. 確定済み `event_name` を受け取る。
2. DBクエリを実行する:
   - `SELECT * FROM story_types WHERE is_active=1`
   - `SELECT * FROM hook_patterns WHERE is_active=1`
3. `event_name` に合う `story_type_id` と `hook_pattern_id` の組み合わせを選定し、人間に提示する。
4. 人間の選定変更・承認を待つ。

## 制約

- 選定理由にストーリー展開の詳細は書かない（それは Step4 の仕事）。
- 「このイベントにはこの型が合う」という構造的な判断のみ行う。

## 介入点

- `story_type_id` / `hook_pattern_id` の変更を受け付ける。
- 確定後、次ステップ（step4-select-type）へ渡す。

## 出力

- `story_type_id`: 確定済みストーリータイプID
- `hook_pattern_id`: 確定済みフックパターンID
