---
name: step8-generate-episodes
description: 承認済みジョブからepisode_count分の各話要素を生成し、承認後にSora2プロンプトを一括生成・保存する。Use when Step8（エピソード生成 + Sora2プロンプト生成）を実行する時。
---

# Step8: エピソード生成 + Sora2プロンプト一括生成

## Phase A: エピソード構造生成

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

## 各話設計の必須要件

- `episode_hook`: 3秒以内に状況が伝わる冒頭の一文（説明的でなく感情直球型）
- `cliffhanger_text`: 視聴者が最も「続きが気になる」瞬間で終わる文（答えを出さない）
- `emotion_target_per_ep`: この話で引き出す感情（シリーズ全体の感情アークに基づく）
- `dialogue_motif_placement`: 台詞のリフレイン用キーフレーズの伏線・回収場所を明示

## Claudeへの依頼プロンプト（Phase A）

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

## Phase B: Sora2プロンプト生成

Phase Aの承認後、メモリ上のエピソードデータを使って各話の4クリップSora2プロンプトを順次生成する。
DBアクセス不要（Phase Aで生成したデータをそのまま使用する）。

5. 各エピソードについて順次、以下「Claudeへの依頼プロンプト（Phase B）」に従い4クリッププロンプトを生成する。
   - episode_no > 1 の場合は直前話の `cliffhanger_text` と `narration_script` を参照する（すでにメモリ上にある）。
6. 各クリップを以下のパスに保存する:
   - `workspace/sora-prompts/ep{episode_no}/clip1.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip2.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip3.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip4.txt`
   - ディレクトリが存在しない場合は作成する。
   - 再生成時は上書き（バージョン管理不要）。
7. 全話分の保存完了後、ファイルパス一覧を人間に提示してレビュー依頼。
8. 修正対応後、次ステップ（Step9/DB INSERT）へ。

## Claudeへの依頼プロンプト（Phase B）

```
以下の情報を元に、Sora 2用の4クリップ構造化プロンプトを生成してください。

【シリーズ情報】
- emotion_arc: {emotion_arc}
- dialogue_motif（台詞リフレイン）: {dialogue_motif}
- character_definitions: {character_definitions}
- location_definitions: {location_definitions}

【今話の情報】
- エピソード{episode_no}「{episode_title}」
- あらすじ: {episode_summary}
- 感情ターゲット: {emotion_target_per_ep}
- episode_hook（冒頭フック）: {episode_hook}
- cliffhanger_text（次話への引き）: {cliffhanger_text}
- dialogue_motif_placement（台詞リフレインの使い方）: {dialogue_motif_placement}
- scenes_json: {scenes_json}
- narration_script: {narration_script}

【前話の情報】（episode_no > 1 の場合のみ）
- 前話cliffhanger: {前話cliffhanger_text}
- 前話narration_script: {前話narration_script}

【4クリップ生成ルール】
⚠️ 重要: 4クリップは「このエピソード1話分のシーン群を4分割したもの」である。
  「Clip1=ep1、Clip2=ep2、Clip3=ep3、Clip4=ep4」ではない。
  各クリップのセリフ・状況描写は、必ずそのクリップに割り当てられたシーン（scene_no）の
  narration_textのみを参照して創作すること。

- 対象エピソードのscenes_jsonのシーンを均等に4グループに分割する:
  Clip1=起、Clip2=承、Clip3=転、Clip4=結
- 端数は後半クリップに寄せる
  - 例: 5シーン → [scene1,2] / [scene3] / [scene4] / [scene5]
  - 例: 6シーン → [scene1,2] / [scene3,4] / [scene5] / [scene6]
  - 例: 8シーン → [scene1,2] / [scene3,4] / [scene5,6] / [scene7,8]
- プロンプト生成前に、各クリップへのシーン割り当てを明示すること:
  例）「Clip1: scene1-2、Clip2: scene3-4、Clip3: scene5-6、Clip4: scene7-8」

【各クリップで生成すること】

1. [SCENE & CHARACTERS]（英語）
   character_definitionsのappearance + location_definitionsのappearanceを組み合わせて描写。
   カメラショット（起=Wide, 承=Medium, 転=Close-up, 結=Wide/Pull-back）を指定。
   カメラムーブ（1クリップ1ムーブ）を指定。
   ライティング描写を追加。

2. [SITUATION]（英語）
   scene_desc + emotion_target_per_ep から状況・感情背景を3〜4文で創作。

3. [DEVELOPMENT]（英語）
   このクリップで何が起きるか・どう変化するかをアクション描写で創作。

4. [DIALOGUE]（日本語）
   narration_textを「骨格」として、そこからキャラクター間の自然な会話に肉付けして創作。
   形式: キャラ名「セリフ」（A→B→A... の交互形式で往復させる）
   ※ 1クリップ約15秒想定 → **4〜6行・合計60〜80文字**を目安とする（下記「セリフ量の目安」参照）。
   ※ 無言シーン（1〜2行しかない）は必ず理由のある演出意図がある場合のみ。
   ※ セリフが全くない場面（モンタージュ等）のみブロック省略可。

5. [BGM & ATMOSPHERE]（英語）
   bgm_mood + emotion_target_per_ep から雰囲気・音響イメージを描写。

6. [QUALITY & TEXTURE]（英語・固定）
   Photorealistic, shot on 35mm film with shallow depth of field,
   cinematic color grading, {シーンに合うライティングスタイル}

【Clip 1（起）の必須制約】
- episode_hookをClip 1の冒頭シーン・最初のセリフに必ず反映する。
  「3秒で状況が伝わる感情直球」の掴みを映像とセリフ両方で体現すること。
- episode_no > 1: 前話cliffhangerへの回答・解決をClip 1の前半で描写する。
- キャラクターの感情状態が前話から自然につながるよう、[SITUATION]と最初のセリフに反映する。

【Clip 4（結）の必須制約】
- cliffhanger_textはClip 4の[DEVELOPMENT]の締めに「状況として」反映する。
  ⚠️ cliffhanger_textをセリフとして台詞に使わないこと（「妻がXXXと言う」ではなく「XXXの状況で暗転」のように映像描写で表現する）。
- [DIALOGUE]はそのクリップのシーンnarration_textから創作し、cliffhanger_textの内容と自然につながるセリフで締めること。
- 「答えを出さずに終わる」緊張感・余韻で締めること（最終話はエンディングメッセージとして使う）。

【dialogue_motif（台詞リフレイン）の使い方】
- dialogue_motif_placementに従って、該当クリップの[DIALOGUE]にdialogue_motifを組み込む。
  - 「伏線」の話: セリフの中に自然に紛れ込ませる（まだ意味が見えない形で）
  - 「回収」の話: 伏線との対比が際立つよう、意図的に同じフレーズを使う
  - 「なし」の話: dialogue_motifを使わない
- プロンプトに秒数を含めない（Sora 2のUI側で指定）。
```

## 保存ファイル構成

各クリップを個別ファイルに保存する（Sora 2のUIにそのままコピペできる形式）。

**clip{n}.txt の中身:**
```
--- Clip {n}/4（{起/承/転/結}）ep{episode_no}「{episode_title}」---

[SCENE & CHARACTERS]
...

[SITUATION]
...

[DEVELOPMENT]
...

[DIALOGUE]
キャラA「セリフ」
キャラB「セリフ」

[BGM & ATMOSPHERE]
...

[QUALITY & TEXTURE]
...
```

**人間への提示メッセージ（保存完了後）:**
```
=== Step8完了 ― エピソード構造 + Sora 2プロンプト生成完了 ===

📁 sora-prompts/
   ep1/clip1.txt〜clip4.txt
   ep2/clip1.txt〜clip4.txt
   ...
   ep{N}/clip1.txt〜clip4.txt

各ファイルをSora 2のUIにコピペして生成してください。
生成後のファイル名: ep{N}_clip1.mp4〜ep{N}_clip4.mp4

次ステップ: Step9（generated_videos INSERT）へ進んでください。
```

## プロンプト生成のガイドライン

- **秒数はプロンプトに含めない**（Sora 2ではUIで指定）
- **セリフは日本語**で生成する（映像・状況・BGM指示系は英語）
- 1クリップ = 1カメラムーブ。複数のカメラムーブを混在させない
- `[SCENE & CHARACTERS]` はcharacter_definitions・location_definitionsを必ず参照する
- セリフはnarration_textを骨格として、Claudeがキャラクターの声で**脚本的な会話に肉付け**する（narration_textの要約・英訳ではない）
- カメラショット・ムーブ・ライティングはシーンの感情トーンに合わせて選択する:
  - 起: Wide / Establishing shot → 状況を俯瞰で見せる
  - 承: Medium / Two-shot → 関係性・対話
  - 転: Close-up / Dramatic angle → 感情・緊張感
  - 結: Wide / Pull-back → 余韻・解放感

## セリフ量の目安（各クリップ約15秒）

日本語ドラマの発話速度は約5文字/秒。15秒 = **75文字前後**が自然な発話量。

| 目安 | 行数 | 文字数（合計） |
|------|------|----------------|
| 最小（無言気味） | 2行 | 〜30文字 ❌ スカスカ |
| 推奨 | 4〜6行 | 60〜80文字 ✅ |
| 上限（早口） | 7〜8行 | 90〜100文字 ⚠️ 詰め込みすぎ |

**骨格→肉付けの例:**

```
narration_text（骨格）: 「主人公が上司に異動の話を切り出される」

[DIALOGUE]（肉付け後）:
上司「田中くん、ちょっといいか」
田中「はい、何でしょう」
上司「来月から大阪に行ってもらいたいんだが」
田中「……大阪、ですか」
上司「急な話なのはわかってる。でも君しかいないんだ」
```

- A→B→A→B... と往復させてテンポを作る
- 1行は10〜20文字程度（長すぎるセリフは分割する）
- 感情を乗せるために「……」「えっ」「でも」等の間・反応を適度に挟む

## 介入点

- Phase A: 各話内容の修正を受け付ける。
- Phase B: プロンプトの修正要望を受け付ける。特定話のクリップのみ再生成も可。
- 確定後、次ステップ（step9-insert-videos）へ渡す。

## 出力

- 確定済みエピソード一覧（`episode_count` 件）
- 各話に `episode_title` / `episode_summary` / `emotion_target_per_ep` / `episode_hook` / `cliffhanger_text` / `dialogue_motif_placement` / `character_definitions` / `location_definitions` / `scenes` / `narration_script` を含む
- 全話分の Sora2プロンプトファイル（`workspace/sora-prompts/ep{N}/clip1.txt` 〜 `clip4.txt`）
