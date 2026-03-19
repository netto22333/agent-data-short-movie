---
name: step8-generate-episodes
description: 承認済みジョブからepisode_count分の各話要素を映像中心で生成し、Step6のscript_materialを元にセリフ/台本も生成する。人間承認後にStep9（DB INSERT）へ渡す。Use when Step8（エピソード構造生成）を実行する時。
---

# Step8: エピソード構造 + セリフ/台本生成

## 実行方法（必須）

このステップは **Claude Code** で実行する。openclawから以下のように呼び出すこと:

```bash
claude --print "step8-generate-episodes スキルを実行してください。job_id={job_id}"
```

⚠️ openclawが直接エピソード生成を行わないこと。必ず `claude` コマンドに委譲する。

## 手順

1. 対象 `generation_job_id` を確認する（ワークフローから引き継ぐか、以下で確認）:
   ```sql
   SELECT id, series_title, prompt_review_status
   FROM generation_jobs
   WHERE prompt_review_status='approved'
   ORDER BY id DESC;
   ```
   - 1件のみの場合はそのまま使用する。
   - 複数ある場合は**人間に選択させる**（自動選択しない）。
2. 指定された `job_id` のジョブを取得して `episode_count` 分の各話要素を生成する。**Step6で生成された `episodes[]`（`script_material` 含む）を必ず参照**し、セリフ/台本も生成する。
3. 全話の内容を人間に提示する。
4. 人間の修正・承認を待つ。
5. 承認後、次ステップ（Step9/DB INSERT）へ渡す。

## 各話設計の必須要件

### 映像要素
- `visual_hook`: 冒頭3秒の映像描写（Step6の `episode_hook` を具体化。構図・ライティング・アクション）
- `cliffhanger_visual`: 映像で表現する引き（Step6の `cliffhanger` を具体化。映像的な終わり方）
- `emotion_target_per_ep`: この話で引き出す感情（Step6の `emotion_target` を引き継ぐ）
- `key_action`: この話の核となる1アクション（映像で見せる決定的瞬間）

### セリフ/台本要素（Step6のscript_materialを元に生成）
- `dialogue_lines`: セリフ一覧（各シーンに紐づく）
- `narration_script`: ナレーション台本（必要な場合のみ）

⚠️ **廃止された要素**（生成しない）:
- ~~dialogue_motif_placement~~（旧セリフベース概念）
- ~~image_prompt~~（Step10のSora 2プロンプトに統合）
- ~~video_motion_prompt~~（同上）

## Claudeへの依頼プロンプト

```
承認されたシリーズ「{series_title}」を{episode_count}話に分割し、
各話の詳細を**映像中心 + セリフ/台本**で生成してください。
⚠️ 映像が主軸。セリフは映像を補強し、感情を増幅させる役割。
⚠️ Step6で設計されたscript_materialを必ず活用し、バズる台本を生成すること。

【シリーズ概要】{series_summary}
【全体の流れ】{series_outline}
【感情アーク（4ビート）】{emotion_arc}

【Step6の各話設計（script_material）】
{episodes_json}
※ 上記の各話 episode_hook / emotion_target / cliffhanger / script_material を
  そのまま活用し、具体的なシーン・セリフに落とし込むこと。

【各話設計の必須要件 — 映像】
- visual_hookは「冒頭3秒で目を引く映像」を具体的に記述すること（構図・ライティング・アクション）
  → Step6の episode_hook を映像仕様に具体化する
- cliffhanger_visualは「映像で表現する引き」にすること（言語的でなく映像的）
  → Step6の cliffhanger を映像仕様に具体化する
- emotion_target_per_ep（各話の狙い感情）→ Step6の emotion_target を引き継ぐ
- key_action（その話の核となる1アクション）を映像で見せる決定的瞬間として記述すること
  → Step6の turning_point を映像化する

【各話設計の必須要件 — セリフ/台本】
Step6のscript_materialを元に、バズる台本を生成してください。

セリフ生成のルール:
1. core_tension を軸にドラマを構築する
2. key_phrases をベースにセリフを磨く（そのまま使ってもアレンジしてもよい）
3. dialogue_direction に従ったセリフの演出をする
4. emotional_contrast を活かした感情表現にする
5. unspoken_subtext は「言わないこと」として設計する（沈黙・間・表情で表現）
6. viral_element をセリフや展開に織り込む

セリフの品質基準:
- 短く、リアルな口語体（書き言葉禁止）
- 一言で感情が伝わるインパクト重視
- 「言い過ぎない」こと。余白を残す
- SNSでスクショされるような印象的なフレーズを最低1つ含める
- 本音と建前のギャップがある場合、両方を設計する

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

【シーン分割（scenes）— 映像描写 + セリフ】
各話ごとにシーン配列と story_beats を生成してください。
⚠️ シーンは「映像として何が見えるか・何が動くか」を主軸に記述し、セリフを補助的に配置する。

各シーン:
- scene_no: シーン番号
- scene_desc: 映像として何が見えるか・何が起こるかの具体的記述（日本語）
  ※ 感情や内面の説明は書かない。代わりにcamera_suggestion/lighting_moodで表現する
- characters_in_scene: このシーンに登場するキャラクター名リスト
- location_name: このシーンの場所名（location_definitions のいずれかと一致させる）
- camera_suggestion: カメラワーク提案（英語。例: "Wide establishing → slow push-in"）
- lighting_mood: ライティングの雰囲気（英語。例: "cold blue, single streetlight"）
- key_action: このシーンの具体的な1アクション（例: "手が震える", "振り返る", "封筒を握りしめる"）
- bgm_mood: BGMムード（英語1〜3語。例: "tension, ambient drone"）
- dialogue: このシーンのセリフ配列（ない場合は空配列）。各セリフ:
  - character: 発話キャラクター名
  - line: セリフ本文（短く、口語体）
  - direction: 演技指示（例: "小声で", "目を逸らしながら", "間を置いて"）
  - subtext: このセリフの裏にある本音（演技の参考用。映像には出さない）

⚠️ 以下は生成しない:
- image_prompt（Step10のSora 2プロンプトに統合）
- video_motion_prompt（同上）
- duration_sec（シーン単位の秒数はStep10で決定）

【ストーリービート（story_beats）】
各話のストーリービート一覧を生成してください。映像+セリフで何を伝えるかのガイドです。
各ビートで「映像として何を見せるか」「セリフがある場合はどんな一言か」を簡潔に列挙する。
例:
  1. 暗い部屋で携帯の光だけが女性の顔を照らす（無言）
  2. 男性が背を向けたまま「…知ってたよ」と呟く
  3. テーブルの上の指輪にカメラがゆっくりズーム（沈黙）

各話ごとに以下を生成:
- episode_no: 話数（1〜N）
- episode_title: 話タイトル
- episode_summary: あらすじ（100字程度・映像+感情を中心に記述）
- emotion_target_per_ep: この話で引き出す感情（Step6のemotion_targetを引き継ぐ）
- visual_hook: この話の冒頭映像描写（Step6のepisode_hookを映像仕様に具体化）
- cliffhanger_visual: 映像で表現する引き（非最終話）/ エンディング映像演出（最終話）
- key_action: この話の核となる1アクション
- character_definitions: シリーズ共通キャラクター定義（JSON配列、第1話のみ出力・他話は省略可）
- location_definitions: シリーズ共通ロケーション定義（JSON配列、第1話のみ出力・他話は省略可）
- scenes: シーン配列（JSON配列。dialogue含む）
- story_beats: ストーリービート一覧（映像+セリフで何を伝えるかのガイド）
```

## 介入点

- 各話内容・セリフの修正を受け付ける。
- 確定後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 確定済みエピソード一覧（`episode_count` 件）
- 各話に `episode_title` / `episode_summary` / `emotion_target_per_ep` / `visual_hook` / `cliffhanger_visual` / `key_action` / `character_definitions` / `location_definitions` / `scenes`（`dialogue` 含む） / `story_beats` を含む
