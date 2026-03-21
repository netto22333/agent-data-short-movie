---
name: sora2-drama-workflow
description: 1話完結AIショートドラマ制作ワークフロー（セリフ駆動 × Sora 2 Extend方式）。起承転結の物語を15秒×4クリップで構成する。Use when 全体進行管理、現在地確認、次ステップ判断を行う時。
---

# Visual Storytelling Workflow（セリフ駆動 × Sora 2 Extend）

1話完結のAIショートドラマ制作ワークフロー。起承転結のある面白い物語を、短いセリフと映像演出で60秒にまとめる。

**設計原則**: セリフ駆動 + 映像演出。短いセリフで物語を進め、映像・動き・表情・ライティングで感情を増幅させる。

## 動画生成方式: Sora 2 Extend

- **Clip1（起）**: Sora 2で15秒のInitial生成
- **Clip2（承）**: Clip1をExtendで+15秒延長
- **Clip3（転）**: Clip2をExtendで+15秒延長
- **Clip4（結）**: Clip3をExtendで+15秒延長
- **合計60秒**の1話完結動画

⚠️ Extendは前のクリップの最後のフレームから自然に続く映像を生成する。そのためクリップ間の映像的連続性が自動的に保たれる。

## ステップ構成

0. **【対象ジョブ選択】**（既存ジョブを続行する場合）
   - `generation_jobs` から作業対象のジョブ一覧を表示する:
     ```sql
     SELECT id, series_title, prompt_review_status, video_generation_status
     FROM generation_jobs
     ORDER BY id DESC;
     ```
   - **人間が job_id を確認・選択する**
   - 新規作成（Step1〜5）の場合はこの選択ステップは不要

1. **Step1**: `step1-collect-trends` — トレンドキーワード収集・確認
2. **Step2**: `step2-extract-event` — イベント候補抽出・選択
3. **Step3**: `step3-generate-situation` — ストーリータイプ選定・フックパターン（任意）
4. **Step4**: `step4-select-type` — 状況文生成・承認
5. **Step5**: `step5-insert-job` — generation_jobs INSERT（episode_count=1, duration_sec=60）
6. **Step6**: `step6-generate-scenarios` — **起承転結の台本生成**（セリフ付き物語設計）（**人間レビュー必須**）
7. **Step7**: `step7-save-approved` — 承認済み台本保存
8. **Step8**: `step8-generate-episodes` — **4クリップ構成生成**（起承転結 = 15s×4）（**人間レビュー必須**）
9. **Step9**: `step9-insert-videos` — generated_videos INSERT
10. **Step10**: `step10-prepare-sora2-prompts` — **Sora 2プロンプト生成**（Initial + Extend×3）（**人間レビュー必須**）

## ストーリーテリング4原則（Step6で適用）

1. **ワンテーマ・ワンエモーション**: 1話（60秒）で伝えるのは1つの感情変化のみ
2. **フック**: 冒頭3秒で視聴者を掴む（衝撃的なセリフ or 映像）
3. **セリフ駆動 + 映像演出**: 短いセリフで物語を進め、映像・表情・カメラワークで感情を増幅させる
4. **起承転結（4ビート）**: 起(0-15s) → 承(15-30s) → 転(30-45s) → 結(45-60s)

## セリフの制約（Sora 2対応）

- **1セリフ = 5〜10文字（日本語）/ 3〜8 words（英語）**
- 1クリップあたりセリフ1〜2個（長すぎるとSora 2で反映されない）
- プロンプトでは「キャラクターがこのセリフを話している」として指示
- セリフは物語の核心を突く短い言葉を選ぶ（例: 「嘘でしょ」「知ってたよ」「行かないで」）

## 起承転結 × Extend の構成

| クリップ | 秒数 | 起承転結 | Sora2操作 | 内容 |
|---------|------|---------|-----------|------|
| Clip1 | 0-15s | 起（Setup） | **Initial生成** | 世界観確立、キャラ登場、状況提示、フック |
| Clip2 | 15-30s | 承（Development） | **Extend** | 関係性深化、問題の顕在化 |
| Clip3 | 30-45s | 転（Twist） | **Extend** | 転換点、衝撃、対立の頂点 |
| Clip4 | 45-60s | 結（Resolution） | **Extend** | 解決、感情の着地、余韻 |

## ルール

- **全ステップは選択した job_id に紐づくデータのみを参照すること**。
- Step6（人間レビュー）承認なしで Step7 以降へ進まない。
- Step8はクリップ構成生成のみ行う。人間承認後にStep9（DB INSERT）へ渡す。
- Step10完了後、人間がSora 2 UIでプロンプトをコピペして動画生成する。
- **episode_count は常に 1**（1話完結）。
- 全ステップ結果をDB記録し、監査可能性を維持する。
- 不明点は人間確認する。

## 制作ツール

| フェーズ | ツール | 担当 |
|---------|--------|------|
| 台本生成 | Claude Code / Codex | エージェント |
| 動画生成 | Sora 2（Initial + Extend×3） | 人間 |

## 人間が行うSora 2操作手順

1. **Clip1**: `clip1.txt` のプロンプトをSora 2にコピペ → 15秒で生成
2. **Clip2**: 生成されたClip1動画を選択 → Extend → `clip2.txt` のプロンプトを入力 → 15秒延長
3. **Clip3**: Clip2まで延長された動画を選択 → Extend → `clip3.txt` のプロンプトを入力 → 15秒延長
4. **Clip4**: Clip3まで延長された動画を選択 → Extend → `clip4.txt` のプロンプトを入力 → 15秒延長
5. 合計60秒の動画が完成
