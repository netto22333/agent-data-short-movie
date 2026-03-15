---
name: step7-save-approved
description: 承認済みシナリオを generation_jobs に UPDATE し、prompt_review_status を approved にする。Use when Step7（承認済み保存）を実行する時。
---

# Step7: 承認済みシナリオ保存

1. 承認済みシナリオ案を受け取る。
2. `generation_jobs` を UPDATE する:
   - `series_title`
   - `series_summary`
   - `series_outline`
   - `prompt_text`
   - `prompt_review_status = 'approved'`
3. 更新件数・`prompt_review_status` を再確認して表示する。

## 制約

- UPDATE 後は件数・状態を必ず再確認する。

## 出力

- 更新件数
- `prompt_review_status = 'approved'` の確認
