---
name: step6-generate-scenarios
description: pending の generation_jobs から1話完結の台本（起承転結 + セリフ）を自動生成する。Use when Step6（台本生成）を実行する時。
---

# Step6: 1話完結台本生成（全自動）

## 実行方法（必須）

このステップは **Claude Code** のスキルとして実行する。openclawから以下のように呼び出すこと:

```bash
claude --dangerously-skip-permissions "/step6-generate-scenarios job_id={job_id}"
```

⚠️ openclawが直接台本生成を行わないこと。必ず Claude Code のスキル `/step6-generate-scenarios` に委譲する。
⚠️ 台本生成の詳細ロジック（ストーリーテリング原則・プロンプト・出力形式）は Claude Code 側のスキル定義に含まれている。
⚠️ 全自動のため `--print` モードで実行してよい。
⚠️ `--dangerously-skip-permissions` でワークスペース信頼確認・ツール実行許可をスキップする。

## 手順

1. 対象の `generation_jobs` レコードの `job_id` を確認する。
2. 上記コマンドで Claude Code のスキル `/step6-generate-scenarios` を呼び出す。
3. Claude Code が台本を1案生成し、そのまま採用する。

## DB確認クエリ（対象job_idの確認用）

```sql
SELECT
  j.id, j.situation_text, j.emotion_target,
  st.name AS story_type_name,
  hp.name AS hook_pattern_name
FROM generation_jobs j
LEFT JOIN story_types st ON st.id = j.story_type_id
LEFT JOIN hook_patterns hp ON hp.id = j.hook_pattern_id
WHERE j.prompt_review_status = 'pending'
ORDER BY j.id DESC;
```

## 自動処理

- 生成した台本をそのまま採用し、次ステップ（step7-save-approved）へ渡す。

## 出力

- 承認済み台本案（`title` / `summary` / `story_outline` / `emotion_arc` / `character_definitions` / `location_definitions` / `clip_materials[]`）
