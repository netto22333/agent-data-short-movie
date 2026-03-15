---
name: sora2-drama-workflow
description: Sora 2専用のAIショートドラマ制作ワークフロー。映像・音声・BGMをSora 2が一括生成するため、Step11（Suno/Udio）・Step12（ElevenLabs）はスキップする。Use when Sora 2ルートで全体進行管理、現在地確認、次ステップ判断を行う時。
---

# Sora 2 Drama Workflow

Sora 2専用の完結したワークフロー。Step1〜9はNanoBananaワークフロー（`short-drama-workflow`）と共通、Step10b以降がSora 2固有。

1. **Step1**:  `step1-collect-trends`             — トレンドキーワード収集・確認
2. **Step2**:  `step2-extract-event`              — イベント候補抽出・選択
3. **Step3**:  `step3-generate-situation`         — ストーリータイプ・フックパターン選定
4. **Step4**:  `step4-select-type`                — 状況文生成・承認
5. **Step5**:  `step5-insert-job`                 — generation_jobs INSERT（duration_sec=60 で登録）
6. **Step6**:  `step6-generate-scenarios`         — シナリオ複数案生成（**人間レビュー必須**）
7. **Step7**:  `step7-save-approved`              — 承認済みシナリオ保存
8. **Step8**:  `step8-generate-episodes`          — エピソード外枠生成（4クリップ構成前提）
9. **Step9**:  `step9-insert-videos`              — generated_videos INSERT
10. **Step10b**: `step10b-prepare-sora2-prompts`  — Sora 2プロンプト生成（Claude創作）→ 人間が4クリップ生成
11. **Step11**:  ~~`step11-prepare-bgm-prompt`~~  — **[スキップ]** Sora 2が音声・BGMを内包するため不要
12. **Step12**:  ~~`step12-prepare-narration`~~   — **[スキップ]** 同上
13. **Step13b**: `step13b-prepare-remotion`       — Remotion合成（4クリップ結合 + 字幕のみ）

## ルール

- Step6（人間レビュー）承認なしで Step7 以降へ進まない。
- Step10b は「プロンプトの生成・提示のみ」。実際のSora 2生成は人間が実行する。
- Step10b完了後、Sora 2が生成した4クリップを `ep{N}_clip{1-4}.mp4` で保存させる。
- **Step11・Step12は明示的にスキップ**。NanoBananaワークフローとは異なりSora 2が映像・セリフ音声・BGMを一括生成するため、個別のBGM生成・ナレーション生成ステップは不要。
- Step13b（Remotion合成）では4クリップの結合と字幕追加のみを行う。
- 全ステップ結果をDB記録し、監査可能性を維持する。
- 不明点は人間確認する。

## 制作ツール

| フェーズ | ツール | 担当 |
|---------|--------|------|
| 映像・音声・BGM一括生成 | Sora 2（4クリップ） | 人間 |
| 字幕合成 | Remotion | 人間 |

## NanoBananaワークフローとの違い

| 項目 | short-drama-workflow（NanoBanana） | sora2-drama-workflow（Sora 2） |
|------|-----------------------------------|-------------------------------|
| Step10 | `step10-prepare-scene-prompts` | **Step10b** `step10b-prepare-sora2-prompts` |
| Step11 | `step11-prepare-bgm-prompt`（実行） | **スキップ** |
| Step12 | `step12-prepare-narration`（実行） | **スキップ** |
| Step13 | `step13-prepare-remotion`（映像+BGM+ナレ合成） | **Step13b**（4クリップ結合+字幕のみ） |
| 映像品質指定 | なし | 必須（Photorealistic / 35mm film 等） |
| セリフ言語 | 英語 | **日本語** |
