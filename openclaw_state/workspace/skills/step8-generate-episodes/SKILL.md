---
name: step8-generate-episodes
description: 承認済み台本から1話完結の4クリップ構成（起承転結 × 15秒）を生成し、セリフ・映像演出を具体化する。人間承認後にStep9（DB INSERT）へ渡す。Use when Step8（クリップ構成生成）を実行する時。
---

# Step8: 4クリップ構成生成（起承転結 × 15秒）

## 実行方法（必須）

このステップは **Claude Code** で実行する。openclawから以下のように呼び出すこと:

```bash
claude --print "step8-generate-episodes スキルを実行してください。job_id={job_id}"
```

⚠️ openclawが直接生成を行わないこと。必ず `claude` コマンドに委譲する。

## 手順

1. 対象 `generation_job_id` を確認する:
   ```sql
   SELECT id, series_title, prompt_review_status
   FROM generation_jobs
   WHERE prompt_review_status='approved'
   ORDER BY id DESC;
   ```
   - 1件のみの場合はそのまま使用。複数ある場合は**人間に選択させる**。
2. 指定された `job_id` のジョブから承認済み台本（`prompt_text`）を取得。
3. Step6の `clip_materials` を元に、4クリップの詳細構成を生成する。
4. 全クリップの内容を人間に提示する。
5. 人間の修正・承認を待つ。
6. 承認後、次ステップ（Step9/DB INSERT）へ渡す。

## Claudeへの依頼プロンプト

```
承認された台本「{title}」を4クリップ（起承転結 × 各15秒）の詳細構成に落とし込んでください。
⚠️ Sora 2のExtend方式で生成するため、各クリップは前のクリップから自然に続く構成にすること。
⚠️ セリフは短く（5〜10文字）。長いセリフはSora 2で正確に反映されない。

【台本概要】{summary}
【起承転結の流れ】{story_outline}
【感情アーク】{emotion_arc}

【Step6のクリップ素材（clip_materials）】
{clip_materials_json}
※ 上記の各クリップの dialogue_candidates / visual_direction / key_moment を
  活用し、具体的なシーン・セリフに落とし込むこと。

【キャラクター定義】
{character_definitions}

【ロケーション定義】
{location_definitions}

【Sora 2 Extend方式の制約（必須）】

Extendは前のクリップの最後のフレームから続きの映像を生成する。
このため:
- Clip1の最後のフレーム → Clip2の冒頭に自然につながること
- Clip2の最後のフレーム → Clip3の冒頭に自然につながること
- Clip3の最後のフレーム → Clip4の冒頭に自然につながること
- 急なロケーション変更やキャラクターの入れ替えは避ける
- シーン転換が必要な場合は、クリップの前半で転換し後半で新シーンを確立する

【セリフのルール（Sora 2制約）】

1. 1セリフ = 5〜10文字（日本語）/ 3〜8 words（英語）
2. 1クリップあたりセリフ1〜2個が上限
3. 全4クリップで合計4〜6個のセリフ
4. セリフは物語の核心を突く短い言葉にする
5. 沈黙・間も演出。全部セリフで埋めない
6. Step6の dialogue_candidates をベースにセリフを確定する（そのまま使ってもアレンジしてもよい）

セリフの品質基準:
- 短く、リアルな口語体
- 一言で感情が伝わるインパクト重視
- 「言い過ぎない」こと。余白を残す
- SNSでスクショされるような印象的なフレーズを最低1つ含める

【冒頭3秒フック（Clip1 必須・最重要）】

Clip1は必ず「3秒フック」から始めること。スクロールを止められなければ全て無駄になる。

フック手法:
- 衝撃的な短いセリフから始める（例: 「…嘘でしょ」と呟く顔のクローズアップ）
- 異常な状況の映像から始める（例: テーブルに叩きつけられた指輪）
- 結果から見せる（例: 泣いている顔→なぜ泣いているかは後で明かす）

❌ やってはいけない:
- ゆっくりしたフェードイン
- 説明的な導入
- 「ある日」「それは」などの平凡な語り出し

【各クリップの出力形式】

各クリップ（clip_no: 1〜4）ごとに以下を生成してください:

- clip_no: クリップ番号（1〜4）
- beat: 起/承/転/結
- clip_title: このクリップの小見出し（例: 「沈黙の食卓」「隠された手紙」）
- emotion_target: このクリップの狙い感情
- scenes: シーン配列（1クリップあたり1〜2シーン）。各シーン:
  - scene_no: シーン番号
  - scene_desc: 映像として何が見えるか・何が起こるかの具体的記述
  - characters_in_scene: 登場キャラクター名リスト
  - location_name: 場所名（location_definitions のいずれかと一致）
  - camera_suggestion: カメラワーク（英語。例: "Close-up → slow pull-back"）
  - lighting_mood: ライティング（英語。例: "warm golden hour, soft shadows"）
  - key_action: このシーンの決定的アクション（例: "手紙を握りしめる"）
  - bgm_mood: BGMムード（英語1〜3語）
  - dialogue: セリフ配列（0〜2個）。各セリフ:
    - character: 発話キャラクター名
    - line: セリフ本文（5〜10文字の短いセリフ）
    - direction: 演技指示（例: "小声で", "目を逸らしながら"）
- story_beat: このクリップのストーリービート（映像+セリフで何を伝えるかの1〜2行ガイド）
- transition_to_next: 次のクリップへのつなぎ方（最後のフレームの状態を記述。Extend用）
  ※ clip_no=4 の場合は「エンディング演出」を記述

【全体レベルの出力】

- episode_no: 1（1話完結）
- episode_title: 作品タイトル
- episode_summary: あらすじ（100字程度）
- emotion_arc: 感情アーク（Step6から引き継ぎ）
- character_definitions: キャラクター定義（Step6から引き継ぎ）
- location_definitions: ロケーション定義（Step6から引き継ぎ）
- clips: 4クリップの配列（上記形式）
- story_beats: 全体のストーリービート一覧
  例:
  1. 【起 0-15s】暗い食卓、女性が「…知ってたの？」と呟く → 男性の手が止まる
  2. 【承 15-30s】回想：二人が笑い合う写真 → 現在に戻り沈黙
  3. 【転 30-45s】女性がテーブルを叩き「もう終わりにしよう」→ 男性が封筒を差し出す
  4. 【結 45-60s】封筒の中身（手紙）を読む女性の涙 → 二人の手が重なる → 窓の外の夕焼け
```

## 介入点

- クリップ構成の修正・承認を受け付ける。
- セリフの変更、シーンの追加・削除に対応する。
- 承認後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 承認済みクリップ構成（`episode_title` / `episode_summary` / `emotion_arc` / `character_definitions` / `location_definitions` / `clips[]` / `story_beats`）
