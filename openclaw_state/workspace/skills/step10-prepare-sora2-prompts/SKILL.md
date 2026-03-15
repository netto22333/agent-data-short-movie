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
  narration_textのみを参照して創作すること。

- 対象エピソードのscenes_jsonのシーンを均等に4グループに分割する:
  Clip1=起、Clip2=承、Clip3=転、Clip4=クリフハンガー（最終話のみ=結）
- ⚠️ **各話は「フック→感情→裏切り→続きが気になる」のループ構造**にする。Clip4は原則として未解決で終わること。最終話のみ Clip4=結（解決・余韻）として扱う。
- 端数は後半クリップに寄せる
  - 例: 5シーン → [scene1,2] / [scene3] / [scene4] / [scene5]
  - 例: 6シーン → [scene1,2] / [scene3,4] / [scene5] / [scene6]
  - 例: 8シーン → [scene1,2] / [scene3,4] / [scene5,6] / [scene7,8]
- プロンプト生成前に、各クリップへのシーン割り当てを明示すること:
  例）「Clip1: scene1-2、Clip2: scene3-4、Clip3: scene5-6、Clip4: scene7-8」

【各クリップで生成すること】

1. [SCENE & CHARACTERS]（英語）
   character_definitionsのappearance + location_definitionsのappearanceを組み合わせて描写。
   カメラショット（起=Wide, 承=Medium, 転=Close-up, クリフハンガー=Extreme Close-up or Freeze frame, 最終話結=Wide/Pull-back）を指定。
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

【Clip 4の必須制約】

**非最終話（クリフハンガー）:**
- cliffhanger_textをClip 4の[DEVELOPMENT]の締めに「状況として」反映する。
  ⚠️ cliffhanger_textをセリフとして台詞に使わないこと（「妻がXXXと言う」ではなく「XXXの状況で暗転」のように映像描写で表現する）。
- [DIALOGUE]はそのクリップのシーンnarration_textから創作し、cliffhanger_textと自然につながるセリフで締めること。
- **「答えを出さずに終わる」**こと。視聴者が「え、どうなるの？」と感じる瞬間で必ずカットする。解決しない。

**最終話（結）:**
- cliffhanger_textをエンディングメッセージとして使う。感情の解放・余韻で締める。
- [DIALOGUE]は感情の着地点を描き、[DEVELOPMENT]はWide/Pull-backで余韻を持たせる。

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
--- Clip {n}/4（{起/承/転/クリフハンガー or 結}）ep{episode_no}「{episode_title}」---

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
- 1クリップ = 1カメラムーブ。複数のカメラムーブを混在させない
- `[SCENE & CHARACTERS]` はcharacter_definitions・location_definitionsを必ず参照する
- セリフはnarration_textを骨格として、Claudeがキャラクターの声で**脚本的な会話に肉付け**する（narration_textの要約・英訳ではない）
- カメラショット・ムーブ・ライティングはシーンの感情トーンに合わせて選択する:
  - 起: Wide / Establishing shot → 状況を俯瞰で見せる（フックで掴む）
  - 承: Medium / Two-shot → 関係性・感情の積み上げ
  - 転: Close-up / Dramatic angle → 裏切り・緊張感の頂点
  - クリフハンガー（非最終話）: Extreme Close-up or Freeze frame → 未解決のまま暗転・画面停止
  - 結（最終話のみ）: Wide / Pull-back → 余韻・解放感

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

- プロンプトの修正要望を受け付ける。特定話のクリップのみ再生成も可。
- 確定後、次ステップ（step13b-prepare-remotion）へ渡す。
