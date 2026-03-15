---
name: step6-generate-scenarios
description: pending の generation_jobs から全体シナリオ複数案を生成し、人間レビュー①を得る。Use when Step6（シナリオ生成）を実行する時。
---

# Step6: 全体シナリオ生成（人間レビュー①必須）

1. `generation_jobs` の最新 pending レコードを取得する。
2. 全体シナリオ案を2〜3案生成する。
3. 各案を人間に提示する。
4. **人間レビュー①承認を得るまで先へ進まない。**

## 介入点

- シナリオ案の選択・修正・却下を受け付ける。
- 承認後、次ステップ（step7-save-approved）へ渡す。

## 出力

- 承認済みシナリオ案（`series_title` / `series_summary` / `series_outline` / `prompt_text`）
