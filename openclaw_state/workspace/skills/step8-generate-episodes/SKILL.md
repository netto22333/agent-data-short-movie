---
name: step8-generate-episodes
description: 承認済みジョブからepisode_count分の各話要素を生成し、人間承認後にStep9（DB INSERT）へ渡す。Use when Step8（エピソード構造生成）を実行する時。
---

# Step8: エピソード構造生成

1. 対象 `generation_job_id` を確認する（ワークフローから引き継ぐか、以下で確認）:
   ```sql
   SELECT id, series_title, prompt_review_status
   FROM generation_jobs
   WHERE prompt_review_status='approved'
   ORDER BY id DESC;
   ```
   - 1件のみの場合はそのまま使用する。
   - 複数ある場合は**人間に選択させる**（自動選択しない）。
2. 指定された `job_id` のジョブを取得して `episode_count` 分の各話要素を生成する。下記各話設計の必須要件を守ること。
3. 全話の内容を人間に提示する。
4. 人間の修正・承認を待つ。
5. 承認後、次ステップ（Step9/DB INSERT）へ渡す。

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

【キャラクター定義（character_definitions）】
シリーズに登場するキャラクターを定義してください。
Sora 2で毎シーン同じ見た目を再現するため、外見を固定の英語描写で定義します。

各キャラクター:
- name: キャラクター名（日本語）
- role: 役割（例: 主人公, 同僚, 上司）
- appearance: 外見の固定描写（英語・Sora 2用。髪色/髪型/目の色/服装スタイルを含む）
  例: "Japanese woman in her late 20s, black shoulder-length hair, dark eyes, wearing a white blouse"

【ロケーション定義（location_definitions）】
シリーズに登場する場所を定義してください。
シーンが変わっても同じ場所なら見た目が変わらないよう、外見を固定の英語描写で定義します。

各ロケーション:
- name: 場所名（日本語）
- appearance: 場所の固定描写（英語・Sora 2用。部屋の構造/照明/背景要素を含む）
  例: "modern Japanese office, large windows on the left, natural daylight, open floor plan, white desks"

【シーン分割（scenes）】
各話ごとにシーン配列と narration_script を生成してください。
シーン数は可変（duration_sec の合計が {duration_sec} 秒になるよう調整）。

各シーン:
- scene_no: シーン番号
- scene_desc: シーン概要（日本語・1行）
- duration_sec: このシーンの秒数
- characters_in_scene: このシーンに登場するキャラクター名リスト
- location_name: このシーンの場所名（location_definitions のいずれかと一致させる）
- image_prompt: Sora 2用プロンプト（英語）
  ※ 必ず以下を順番に埋め込む:
    1. characters_in_scene の appearance（外見描写をそのままコピー）
    2. location_name の appearance（場所描写をそのままコピー）
    3. カメラアングル・感情表現・その話固有の状況描写
  ※ 同じキャラクター・同じ場所のシーンは1と2を完全に同一文にすること
- video_motion_prompt: 動き指示（英語・Sora 2動画生成向け・カメラムーブや動作）
- narration_text: このシーンのナレーション（日本語）
- bgm_mood: BGMムード（英語1〜3語、例: "tense suspense" / "melancholic hope"）

narration_script: 全シーンの narration_text を通し順に結合した文字列（ElevenLabs入力用）

各話ごとに以下を生成:
- episode_no: 話数（1〜N）
- episode_title: 話タイトル
- episode_summary: あらすじ（100字程度）
- emotion_target_per_ep: この話で引き出す感情（例: 不安, 疑念, 衝撃, 解放）
- episode_hook: この話の冒頭フック（3秒で状況が伝わる感情直球の一文、説明・挨拶なし）
- cliffhanger_text: 次話への引き（答えを出さずに終わる最高潮の一文。最終話はエンディングメッセージ）
- dialogue_motif_placement: この話における台詞リフレインの使い方（伏線 / 回収 / なし）
- character_definitions: シリーズ共通キャラクター定義（JSON配列、第1話のみ出力・他話は省略可）
- location_definitions: シリーズ共通ロケーション定義（JSON配列、第1話のみ出力・他話は省略可）
- scenes: シーン配列（JSON配列）
- narration_script: 全シーン narration_text の連結文字列
```

## 介入点

- 各話内容の修正を受け付ける。
- 確定後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 確定済みエピソード一覧（`episode_count` 件）
- 各話に `episode_title` / `episode_summary` / `emotion_target_per_ep` / `episode_hook` / `cliffhanger_text` / `dialogue_motif_placement` / `character_definitions` / `location_definitions` / `scenes` / `narration_script` を含む
