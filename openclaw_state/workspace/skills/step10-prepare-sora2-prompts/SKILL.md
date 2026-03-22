---
name: step10-prepare-sora2-prompts
description: DBからクリップ構成を読み込み、Sora 2のInitial生成+Extend×6用のプロンプトを生成・ファイル保存する。Use when Step10（Sora2プロンプト生成）を実行する時。
---

# Step10: Sora 2プロンプト生成（Initial + Extend×6）

## 概要

Step8で生成された7クリップ構成を元に、Sora 2に直接コピペできるプロンプトを生成する。

- **clip1.txt**: Initial生成用（完全なプロンプト）
- **clip2.txt**: Extend用（Clip1から延長する指示）
- **clip3.txt**: Extend用（Clip2から延長する指示）
- **clip4.txt**: Extend用（Clip3から延長する指示）
- **clip5.txt**: Extend用（Clip4から延長する指示）
- **clip6.txt**: Extend用（Clip5から延長する指示）
- **clip7.txt**: Extend用（Clip6から延長する指示）

## フロー

### 1. データ取得

対象 `generation_job_id` を確認する:
```sql
SELECT id, series_title, video_generation_status
FROM generation_jobs
WHERE video_generation_status='episodes_ready'
ORDER BY id DESC;
```
- 1件のみの場合はそのまま使用。複数ある場合は**最新のものを自動選択する**。

`generated_videos` からクリップデータを取得する:
```sql
SELECT episode_no, episode_title, episode_summary, emotion_target_per_ep,
       scenes_json, story_beats
FROM generated_videos
WHERE generation_job_id = {job_id}
ORDER BY episode_no;
```

`generation_jobs.prompt_text` から以下を取得する:
- `character_definitions`
- `location_definitions`
- `emotion_arc`

### 2. プロンプト生成

各クリップについて、以下のプロンプトテンプレートに従いSora 2用プロンプトを生成する。

### 3. ファイル保存

- `workspace/sora-prompts/ep1/clip1.txt`
- `workspace/sora-prompts/ep1/clip2.txt`
- `workspace/sora-prompts/ep1/clip3.txt`
- `workspace/sora-prompts/ep1/clip4.txt`
- `workspace/sora-prompts/ep1/clip5.txt`
- `workspace/sora-prompts/ep1/clip6.txt`
- `workspace/sora-prompts/ep1/clip7.txt`

ディレクトリが存在しない場合は作成する。再生成時は上書き。

### 4. DB保存

生成したプロンプトを `generated_videos.sora2_prompts_json` にJSON形式で保存する。

```sql
UPDATE generated_videos
SET sora2_prompts_json = json_object(
  'clip1', '{clip1のプロンプト全文}',
  'clip2', '{clip2のプロンプト全文}',
  'clip3', '{clip3のプロンプト全文}',
  'clip4', '{clip4のプロンプト全文}',
  'clip5', '{clip5のプロンプト全文}',
  'clip6', '{clip6のプロンプト全文}',
  'clip7', '{clip7のプロンプト全文}'
)
WHERE generation_job_id = {job_id} AND episode_no = 1;
```

⚠️ ファイル保存とDB保存の両方を行うこと。ファイルはSora 2へのコピペ用、DBはデータ永続化・トレーサビリティ用。

### 5. 自動確定

生成したプロンプトをそのまま採用し、次ステップへ進む。

---

## Clip1 プロンプトテンプレート（Initial生成用）

Clip1はSora 2で新規生成するため、世界観・キャラクター・ロケーションを含む完全なプロンプトが必要。

```
以下の情報を元に、Sora 2のInitial生成用プロンプト（10秒）を生成してください。
⚠️ Sora 2にそのままコピペして使えるプロンプトを出力すること。
⚠️ セリフは短く、キャラクターの発話として自然に組み込むこと。

【クリップ情報】
- Clip1（フック / 0-10秒）: {clip1のbeat_summary}
- 感情ターゲット: {clip1のemotion_target}
- セリフ: {clip1のdialogue}
- シーン: {clip1のscenes}
- ストーリービート: {clip1のstory_beat}
- 次クリップへのつなぎ: {clip1のtransition_to_next}

【キャラクター定義】{character_definitions}
【ロケーション定義】{location_definitions}

【Sora 2 Initial プロンプトの形式】

以下の形式で出力すること:

---

[VISUAL IDENTITY]
Color palette: {3-5色のカラーアンカー。全7クリップで統一する}
Lens: {レンズ指定。例: "35mm prime, f/2.0, slight grain"}
Base lighting: {基本ライティング}

{character appearance}. {location appearance}.

{物語の状況・映像描写を具体的に記述。
 冒頭3秒のフック → 世界観の確立 → キャラクター登場 → 状況提示。
 具体的な素材・物理描写を使う（"wet asphalt" "steam rising from coffee cup" 等）。}

{キャラクターのセリフ・発話を映像アクションの一部として記述。
 例: "She whispers '嘘でしょ' while staring at the phone screen, her hand trembling slightly."}

Camera: {カメラワーク。1ショット=1アクション+1カメラムーブ}

{最後のフレームの状態を明確に記述する（Extend時の起点になるため）。
 例: "The scene ends with him frozen mid-reach, his hand hovering over the letter on the table."}

[QUALITY]
Photorealistic, cinematic color grading, {レンズ指定}, natural lighting
No subtitles, no text overlays, no captions, no titles burned into the video.

---

⚠️ ルール:
- 秒数はプロンプトに含めない（Sora 2 UIで10秒を指定する）
- 英語で記述する（Sora 2は英語プロンプトの精度が最も高い）
- セリフは日本語のまま引用符で囲む（例: whispers "知ってたよ"）
- 最後のフレームの状態を明確にする（Extend用の起点）
- 具体的な素材描写を使い、抽象表現を避ける
- **登場人物は老若男女問わず必ず美男美女として描写する**（後述「キャラクター外見ルール」参照）
- **動画内に字幕・テキスト・キャプションを一切入れない**（字幕はStep14でRemotionで後付けする）
```

---

## Clip2-7 プロンプトテンプレート（Extend用）

Clip2以降はSora 2のExtend機能で生成する。前のクリップの最後のフレームから続くため、世界観の再説明は不要。展開の指示のみ。

```
以下の情報を元に、Sora 2のExtend用プロンプト（10秒延長）を生成してください。
⚠️ Extendは前のクリップの最後のフレームから続きを生成する。新たに世界観やキャラクターを説明し直す必要はない。
⚠️ 「次に何が起きるか」の展開指示を簡潔に記述する。

【クリップ情報】
- Clip{N}（{beat} / {秒数}）: {beat_summary}
- 感情ターゲット: {emotion_target}
- セリフ: {dialogue}
- シーン: {scenes}
- ストーリービート: {story_beat}
- 前クリップからの状態: {前クリップのtransition_to_next}
- 次クリップへのつなぎ: {transition_to_next}（Clip7の場合はエンディング演出）

【Sora 2 Extend プロンプトの形式】

以下の形式で出力すること（簡潔に。世界観・キャラ説明の繰り返し不要）:

---

{前のクリップの最後の状態から、次に何が起きるかを具体的に記述。
 映像アクション + キャラクターの動き + 感情の変化を簡潔に。
 セリフがある場合はアクションの一部として組み込む。}

---

例（Clip2 / 発端）:
"He slowly picks up the letter from the table, his expression shifting from surprise to confusion.
She turns away, arms crossed. Camera pushes in on his trembling hands."

例（Clip4 / 転換）:
"He holds up the letter and says '全部知ってる' — his voice steady but his hands trembling.
She spins around, shock on her face, tears forming.
Quick cut to close-up — a photograph falls out onto the table."

例（Clip5 / 絶望）:
"She sinks into her chair, head in her hands. The café lights flicker.
He stares at the photograph, jaw clenched, then slowly pushes it across the table."

例（Clip7 / 決着＋余韻）:
"She looks up at him and whispers 'ごめんね'. He gently takes her hand.
Camera slowly pulls back through the café window — warm golden light returns.
Wide shot of the café exterior at sunset, two silhouettes visible through the glass."

⚠️ ルール:
- 秒数はプロンプトに含めない（Sora 2 UIで10秒を指定する）
- 英語で記述する
- セリフは日本語のまま引用符で囲む
- Clip7: 最後は余韻のある映像で締める（Wide shot、自然光、静かなエンディング）
- Extend用プロンプトは簡潔に（世界観・キャラ説明の繰り返し不要）
- 前クリップからの自然な連続性を保つ
- カメラワークの指示も含める
- **動画内に字幕・テキスト・キャプションを一切入れない**
```

---

## 保存ファイル構成

```
workspace/sora-prompts/
  ep1/
    clip1.txt    ← Initial生成用（完全プロンプト・フック）
    clip2.txt    ← Extend用（発端）
    clip3.txt    ← Extend用（圧迫）
    clip4.txt    ← Extend用（転換）
    clip5.txt    ← Extend用（絶望）
    clip6.txt    ← Extend用（覚醒）
    clip7.txt    ← Extend用（決着＋余韻）
```

---

## 完了メッセージ

```
=== Step10 完了 ― Sora 2 プロンプト生成完了 ===

workspace/sora-prompts/ep1/
  clip1.txt  ← Sora 2 Initial生成（10秒）
  clip2.txt  ← Clip1をExtend（10秒延長）
  clip3.txt  ← Clip2をExtend（10秒延長）
  clip4.txt  ← Clip3をExtend（10秒延長）
  clip5.txt  ← Clip4をExtend（10秒延長）
  clip6.txt  ← Clip5をExtend（10秒延長）
  clip7.txt  ← Clip6をExtend（10秒延長）

自動でStep11（Sora 2動画生成）へ進みます。
```

## プロンプト生成のガイドライン

- **英語で記述する**（Sora 2は英語プロンプトの精度が最も高い）
- **セリフは日本語のまま引用符で囲む**（例: whispers "知ってたよ"）
- **秒数はプロンプトに含めない**（Sora 2のUI側で10秒を指定）
- **Clip1は完全なプロンプト**（キャラ・ロケーション・映像スタイルを含む）
- **Clip2-7は展開指示のみ**（Extendなので世界観の再説明不要）
- **具体的な素材描写**を使い、抽象表現を避ける
- **1ショット = 1アクション + 1カメラムーブ**を遵守する
- **カラーアンカー・レンズ・ライティング**はClip1で定義し、一貫させる
- **各クリップの最後のフレーム状態**を明確に記述する（次のExtendの起点）

## キャラクター外見ルール（必須）

**登場人物は老若男女問わず、必ず美男美女として描写すること。**

キャラクターの外見描写（character appearance）には、以下の美形修飾語を必ず含める:
- 若い男女: "strikingly attractive", "beautiful", "handsome", "with sharp refined features"
- 中年: "elegantly aging", "distinguished and attractive", "with refined handsome/beautiful features"
- 高齢者: "gracefully aged", "with dignified attractive features", "silver-haired and strikingly handsome/beautiful"

例:
- ❌ "Japanese woman, late 20s, black shoulder-length hair"
- ✅ "Strikingly beautiful Japanese woman, late 20s, black shoulder-length hair, delicate features, flawless skin"
- ❌ "Japanese man, mid 50s, graying hair"
- ✅ "Distinguished and handsome Japanese man, mid 50s, salt-and-pepper hair, sharp jawline, refined features"

⚠️ character_definitions の外見描写をそのまま使わず、上記ルールで美形修飾を追加してからプロンプトに組み込むこと。

## 自動処理

- プロンプト生成後、自動で確定し次ステップ（step11-sora2-generate）へ進む。
