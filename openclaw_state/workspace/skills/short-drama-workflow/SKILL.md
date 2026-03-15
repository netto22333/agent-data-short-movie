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
8. **Step8**: `step8-generate-episodes` — エピソード生成・確認（キャラクター定義・シーン分割含む）
9. **Step9**: `step9-insert-videos` — generated_videos INSERT（scenes_json / narration_script 含む）
10. **Step10**: `step10-prepare-scene-prompts` — NanoBanana用プロンプト提示（**人間が画像→動画生成**）
    **Step10b**: `step10b-prepare-sora2-prompts` — Sora 2用プロンプト提示（**代替**: 人間が4クリップ生成）
    ※ Step10 / Step10b はどちらか一方を選択して実行
11. **Step11**: `step11-prepare-bgm-prompt` — BGMプロンプト提示（Suno/Udio、**人間が生成**）
12. **Step12**: `step12-prepare-narration` — ナレーションスクリプト提示（ElevenLabs、**人間が生成**）
13. **Step13**: `step13-prepare-remotion` — Remotion合成設定提示（**人間がrender**）

## ルール

- 人間レビュー①（Step6）承認なしで Step7 以降へ進まない。
- 人間レビュー②承認なしで投稿フェーズへ進まない。
- Step10〜13 は「プロンプト・設定の提示」のみ行う。実際の生成・合成は人間が実行する。
- 全ステップ結果をDB記録し、監査可能性を維持する。
- 不明点は人間確認する。

## 制作ツール

| フェーズ | ツール | 担当 |
|---------|--------|------|
| 画像・動画生成 | NanoBanana または Sora 2 | 人間 |
| BGM生成 | Suno / Udio | 人間 |
| ナレーション | ElevenLabs（1声優） | 人間 |
| 合成・字幕 | Remotion | 人間 |
