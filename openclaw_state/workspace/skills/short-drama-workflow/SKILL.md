---
name: short-drama-workflow
description: AIショートドラマ制作の全ステップを管理し、各ステップ skill を順番に呼び出す。Use when 全体進行管理、現在地確認、次ステップ判断を行う時。
---

# Short Drama Workflow

各ステップを独立した skill として順番に呼び出す。

1. **Step1**: `step1-collect-trends` — トレンドキーワード収集・確認
2. **Step2**: `step2-extract-event` — イベント候補抽出・選択
3. **Step3**: `step3-generate-situation` — ストーリータイプ・フックパターン選定
4. **Step4**: `step4-select-type` — 状況文生成・承認
5. **Step5**: `step5-insert-job` — generation_jobs INSERT
6. **Step6**: `step6-generate-scenarios` — シナリオ複数案生成（**人間レビュー①必須**）
7. **Step7**: `step7-save-approved` — 承認済みシナリオ保存
8. **Step8**: `step8-generate-episodes` — エピソード生成・確認
9. **Step9**: `step9-insert-videos` — generated_videos INSERT

## ルール

- 人間レビュー①（Step6）承認なしで Step7 以降へ進まない。
- 人間レビュー②承認なしで投稿フェーズへ進まない。
- 全ステップ結果をDB記録し、監査可能性を維持する。
- 不明点は人間確認する。
