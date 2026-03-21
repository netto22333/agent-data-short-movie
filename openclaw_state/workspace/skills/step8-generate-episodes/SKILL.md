---
name: step8-generate-episodes
description: 承認済み台本から1話完結の4クリップ構成（起承転結 × 15秒）を生成し、セリフ・映像演出を具体化する。人間承認後にStep9（DB INSERT）へ渡す。Use when Step8（クリップ構成生成）を実行する時。
---

# Step8: 4クリップ構成生成（起承転結 × 15秒）

## 実行方法（必須）

このステップは **Claude Code** のスキルとして実行する。openclawから以下のように呼び出すこと:

```bash
claude --dangerously-skip-permissions "/step8-generate-episodes job_id={job_id}"
```

⚠️ openclawが直接生成を行わないこと。必ず Claude Code のスキル `/step8-generate-episodes` に委譲する。
⚠️ クリップ構成生成の詳細ロジック（Sora 2制約・セリフルール・出力形式）は Claude Code 側のスキル定義に含まれている。
⚠️ 人間レビューが必要なため `--print` は使わず対話モードで実行する。
⚠️ `--dangerously-skip-permissions` でワークスペース信頼確認・ツール実行許可をスキップする。

## 手順

1. 対象の `generation_jobs` レコードの `job_id` を確認する。
2. 上記コマンドで Claude Code のスキル `/step8-generate-episodes` を呼び出す。
3. Claude Code が承認済み台本から4クリップの詳細構成を生成して人間に提示する。
4. **人間レビュー承認を得るまで先へ進まない。**

## DB確認クエリ（対象job_idの確認用）

```sql
SELECT id, series_title, prompt_review_status
FROM generation_jobs
WHERE prompt_review_status = 'approved'
ORDER BY id DESC;
```

## 介入点

- クリップ構成の修正・承認を受け付ける。
- セリフの変更、シーンの追加・削除に対応する。
- 承認後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 承認済みクリップ構成（`episode_title` / `episode_summary` / `emotion_arc` / `character_definitions` / `location_definitions` / `clips[]` / `story_beats`）
