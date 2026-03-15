---
name: step10-prepare-sora2-prompts
description: DBからエピソードデータを読み込み、各話を4クリップに分割してSora2プロンプトを生成・ファイル保存する。Use when Step10（Sora2プロンプト生成）を実行する時。
---

# Step10: 各話Sora2プロンプト生成

## フロー

1. 対象 `generation_job_id` を確認する（`video_generation_status='episodes_ready'` のジョブから選択）:
   ```sql
   SELECT id, series_title, video_generation_status
   FROM generation_jobs
   WHERE video_generation_status='episodes_ready'
   ORDER BY id DESC;
   ```
   - 1件のみの場合はそのまま使用する。
   - 複数ある場合は**人間に選択させる**（自動選択しない）。

2. `generated_videos` から全エピソードを取得する:
   ```sql
   SELECT episode_no, episode_title, episode_summary, emotion_target_per_ep,
          episode_hook, cliffhanger_text, dialogue_motif_placement,
          scenes_json, narration_script
   FROM generated_videos
   WHERE generation_job_id = {job_id}
   ORDER BY episode_no;
   ```

3. `generation_jobs.prompt_text` から以下を取得する:
   - `character_definitions`
   - `location_definitions`
   - `emotion_arc`
   - `dialogue_motif`

4. 各エピソードについて順次、以下「Claudeへの依頼プロンプト」に従い4クリッププロンプトを生成する。
   - `episode_no > 1` の場合は直前話の `cliffhanger_text` と `narration_script` を参照する。

5. 各クリップを以下のパスに保存する:
   - `workspace/sora-prompts/ep{episode_no}/clip1.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip2.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip3.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip4.txt`
   - ディレクトリが存在しない場合は作成する。
   - 再生成時は上書き（バージョン管理不要）。

6. 全話分の保存完了後、ファイルパス一覧を人間に提示してレビュー依頼。

7. 修正対応後、次ステップ（Step13b）へ。

## Claudeへの依頼プロンプト

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
  narration_textのみを参照して創作すること。他クリップのシーンのnarration_textは参照しない。

- 対象エピソードのscenes_jsonのシーンを均等に4グループに分割する
- 端数は後半クリップに寄せる
  - 例: 5シーン → [scene1,2] / [scene3] / [scene4] / [scene5]
  - 例: 6シーン → [scene1,2] / [scene3,4] / [scene5] / [scene6]
  - 例: 8シーン → [scene1,2] / [scene3,4] / [scene5,6] / [scene7,8]
- プロンプト生成前に、各クリップへのシーン割り当てを以下の形式で必ず明示すること:
  例）「Clip1: scene1-2、Clip2: scene3-4、Clip3: scene5-6、Clip4: scene7-8」

【各クリップのプロンプト形式（OpenAI公式テンプレート準拠）】

{character_definitionsのappearance}. {location_definitionsのappearance}.
{このクリップに割り当てたシーンのscene_descから読み取れる状況を1〜2文。ライティング描写もここに含める}

Cinematography:
Camera shot: {フレーミングとカメラムーブを1文で。例: "Medium two-shot, slow push-in"}
Mood: {emotion_target_per_epに基づくトーン。例: "quiet tension, muted and cold"}

Actions:
- {このクリップのscene_descから導いた具体的アクションビート}
- {次のビート（あれば）}

Dialogue: （**このクリップに割り当てたシーンのnarration_textのみを参照すること。他クリップのシーンのセリフを混入しない。セリフなし場面はブロック全体を省略する**）
（**自然なセリフのルール（下記参照）を必ず守ること**）
{キャラ名}「{1行}」
{キャラ名}「{返答1行}」
（15秒 = 3〜4行が目安）

Background Sound:
{bgm_mood}, {環境音}

[QUALITY & TEXTURE]
Photorealistic, shot on 35mm film with shallow depth of field,
cinematic color grading, {ライティングスタイル}

【自然なセリフを書くためのルール（Dialogue生成時に必ず参照）】

1. **キャラクターの口調・語尾を反映する**
   - character_definitionsの各キャラクターのpersonality/speech_styleを参照し、
     キャラクターごとに異なる口調・語尾で書く。
   - 例: 真面目な上司は「〜だ」「〜だろう」、感情的な若手は「〜じゃないですか」「〜なんですよ」

2. **感情は言葉にしない（サブテキスト）**
   - 「悲しい」「辛い」「嬉しい」などの感情語は使わない。
   - 代わりに語気・間・言葉の選び方・言い淀みで感情を表現する。
   - NG例: 田中「嬉しいです、ありがとうございます」
   - OK例: 田中「……そう、ですか（一拍置いて）ありがとう、ございます」

3. **短い反応・間を入れる**
   - 一言反応（「え」「あ」「……」「そう」「うん」）を会話の中に挟む。
   - これがないと台詞が「朗読」になる。
   - 例: 上司「来月から大阪に行ってもらいたい」田中「……え」上司「急なのはわかってる」

4. **口語らしい省略・体言止めを使う**
   - 書き言葉ではなく話し言葉で書く。
   - 「それは違うと思います」→「違う、と思う」
   - 「どうして黙っているんですか」→「なんで、黙ってるんですか」

5. **1行は10〜15文字以内**
   - 長すぎるセリフは2行に分ける。
   - 実際のドラマの台詞は短い。

【Clip 1の必須制約】
- episode_hookをClip 1のActionsの冒頭・最初のセリフに必ず反映する。
  「3秒で状況が伝わる感情直球」の掴みを映像とセリフ両方で体現すること。
- episode_no > 1: 前話cliffhangerへの回答・解決をClip 1の前半で描写する。
- キャラクターの感情状態が前話から自然につながるよう、ProsとActionsと最初のセリフに反映する。

【Clip 4の必須制約】

**非最終話（クリフハンガー）:**
- cliffhanger_textをClip 4のActionsの締めに「映像描写として」反映する。
  ⚠️ cliffhanger_textをセリフとして台詞に使わないこと（「妻がXXXと言う」ではなく「XXXの状況で暗転」のように映像描写で表現する）。
- Dialogueはそのクリップのシーンnarration_textから創作し、cliffhanger_textと自然につながるセリフで締めること。
- **「答えを出さずに終わる」**こと。視聴者が「え、どうなるの？」と感じる瞬間で必ずカットする。解決しない。

**最終話（結）:**
- cliffhanger_textをエンディングメッセージとして使う。感情の解放・余韻で締める。
- Dialogueは感情の着地点を描き、ActionsはWide/Pull-backで余韻を持たせる。

【dialogue_motif（台詞リフレイン）の使い方】
- dialogue_motif_placementに従って、該当クリップのDialogueにdialogue_motifを組み込む。
  - 「伏線」の話: セリフの中に自然に紛れ込ませる（まだ意味が見えない形で）
  - 「回収」の話: 伏線との対比が際立つよう、意図的に同じフレーズを使う
  - 「なし」の話: dialogue_motifを使わない
- プロンプトに秒数を含めない（Sora 2のUI側で指定）。
```

## 保存ファイル構成

各クリップを個別ファイルに保存する（Sora 2のUIにそのままコピペできる形式）。

**clip{n}.txt の中身:**
```
--- Clip {n}/4  ep{episode_no}「{episode_title}」---

{character appearance}. {location appearance}.
{状況・感情 1〜2文}

Cinematography:
Camera shot: ...
Mood: ...

Actions:
- ...
- ...

Dialogue:
キャラA「セリフ」
キャラB「セリフ」

Background Sound:
...

[QUALITY & TEXTURE]
Photorealistic, shot on 35mm film with shallow depth of field,
cinematic color grading, ...
```

**人間への提示メッセージ（保存完了後）:**
```
=== Step10完了 ― Sora 2プロンプト生成完了 ===

📁 sora-prompts/
   ep1/clip1.txt〜clip4.txt
   ep2/clip1.txt〜clip4.txt
   ...
   ep{N}/clip1.txt〜clip4.txt

各ファイルをSora 2のUIにコピペして生成してください。
生成後のファイル名: ep{N}_clip1.mp4〜ep{N}_clip4.mp4

次ステップ: Step13b（Remotion合成）へ進んでください。
```

## プロンプト生成のガイドライン

- **秒数はプロンプトに含めない**（Sora 2ではUIで指定）
- **セリフは日本語**で生成する（映像・状況・BGM指示系は英語）
- Cinematographyは `Camera shot`（フレーミング + 1ムーブを1文）+ `Mood` のみ。Lightingは Prose に統合する
- Prose はcharacter_definitions・location_definitionsのappearanceを必ず参照する
- **Dialogueは各クリップに割り当てたシーンのnarration_textのみから創作する**（他クリップのシーンを参照しない）
- Dialogueは「自然なセリフのルール」（キャラ口調・サブテキスト・短い反応・口語省略・1行15文字以内）に従う
- セリフなし場面（モンタージュ等）はDialogueブロック全体を省略する
- 1クリップ約15秒 = 3〜4行が自然な発話量

## 介入点

- プロンプトの修正要望を受け付ける。特定話のクリップのみ再生成も可。
- 確定後、次ステップ（step13b-prepare-remotion）へ渡す。
