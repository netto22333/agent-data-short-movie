---
name: step8-generate-episodes
description: 承認済みジョブから episode_count 分の各話要素を生成し、人間に確認させる。Use when Step8（エピソード生成）を実行する時。
---

# Step8: エピソード生成

1. `prompt_review_status='approved'` の最新 `generation_jobs` を取得する。
2. 下記各話設計の必須要件を守りながら `episode_count` 分の各話要素を生成する。
3. 全話の内容を人間に提示する。
4. 人間の修正・承認を待つ。

## 各話設計の必須要件

- `episode_hook`: 3秒以内に状況が伝わる冒頭の一文（説明的でなく感情直球型）
- `cliffhanger_text`: 視聴者が最も「続きが気になる」瞬間で終わる文（答えを出さない）
- `emotion_target_per_ep`: この話で引き出す感情（シリーズ全体の感情アークに基づく）
- `dialogue_motif_placement`: 台詞のリフレイン用キーフレーズの伏線・回収場所を明示

## Claudeへの依頼プロンプト

```
承認されたシリーズ「{series_title}」を{episode_count}話に分割し、
各話の詳細を生成してください。

【シリーズ概要】{series_summary}
【全体の流れ】{series_outline}
【感情アーク】{emotion_arc}
【台詞リフレイン（キーフレーズ）】{dialogue_motif}

【各話設計の必須要件】
- episode_hookは「3秒で状況が伝わる」感情直球の一文にすること
- cliffhanger_textは「答えを言わずに終わる」最高潮の瞬間にすること（解決しない）
- emotion_target_per_ep（各話の狙い感情）を必ず記載すること
- 全話を通じた「台詞のリフレイン」キーフレーズの伏線と回収場所を示すこと

各話ごとに以下を生成:
- episode_no: 話数（1〜N）
- episode_title: 話タイトル
- episode_summary: あらすじ（100字程度）
- emotion_target_per_ep: この話で引き出す感情（例: 不安, 疑念, 衝撃, 解放）
- episode_hook: この話の冒頭フック（3秒で状況が伝わる感情直球の一文、説明・挨拶なし）
- cliffhanger_text: 次話への引き（答えを出さずに終わる最高潮の一文。最終話はエンディングメッセージ）
- dialogue_motif_placement: この話における台詞リフレインの使い方（伏線 / 回収 / なし）
- video_prompt: 動画生成AIへのプロンプト（英語、詳細な映像描写）
```

## 介入点

- 各話内容の修正を受け付ける。
- 確定後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 確定済みエピソード一覧（`episode_count` 件）
- 各話に `episode_title` / `episode_summary` / `emotion_target_per_ep` / `episode_hook` / `cliffhanger_text` / `dialogue_motif_placement` / `video_prompt` を含む
