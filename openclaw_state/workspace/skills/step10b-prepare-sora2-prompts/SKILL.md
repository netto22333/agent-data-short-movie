---
name: step10b-prepare-sora2-prompts
description: generated_videos・generation_jobsのDBデータを元に、Claudeが4クリップ分のセリフ・描写を創作してSora 2用の構造化プロンプトを生成・提示する。前話のcliffhanger/narration_scriptを参照してシリーズの辻褄を合わせる。Use when Step10b（Sora 2プロンプト準備）を実行する時。
---

# Step10b: Sora 2 プロンプト準備

## 呼び出し時の必須入力

- `generation_job_id`: 対象シリーズのジョブID（例: 2）
- `episode_no`: 対象話数（例: 3）

不明な場合は以下で確認:
```sql
-- 対象シリーズ一覧
SELECT id, series_title, video_generation_status
FROM generation_jobs
WHERE video_generation_status='episodes_ready';

-- 対象エピソード一覧
SELECT id, episode_no, episode_title
FROM generated_videos
WHERE generation_job_id = {generation_job_id}
ORDER BY episode_no;
```

## 処理フロー

1. 対象エピソードのDBデータを取得（`generation_job_id` と `episode_no` を明示して検索）:
   ```sql
   -- シリーズ情報
   SELECT prompt_text FROM generation_jobs WHERE id = {generation_job_id};

   -- 対象エピソード
   SELECT episode_no, episode_title, episode_summary, emotion_target_per_ep,
          episode_hook, cliffhanger_text, dialogue_motif_placement,
          scenes_json, narration_script
   FROM generated_videos
   WHERE generation_job_id = {generation_job_id} AND episode_no = {episode_no};
   ```
   取得フィールド:
   - `generated_videos`: `episode_no`, `episode_title`, `episode_summary`, `emotion_target_per_ep`, `episode_hook`, `cliffhanger_text`, `dialogue_motif_placement`, `scenes_json`, `narration_script`
   - `generation_jobs.prompt_text`: `character_definitions`, `location_definitions`, `emotion_arc`, `dialogue_motif`
2. 前話の情報を取得（episode_no > 1 の場合）:
   ```sql
   -- 前話（episode_no > 1 のみ）
   SELECT cliffhanger_text, narration_script
   FROM generated_videos
   WHERE generation_job_id = {generation_job_id} AND episode_no = {episode_no} - 1;
   ```
   - 前話（episode_no - 1）の `cliffhanger_text`
   - 前話の `narration_script`
3. 以下の「Claudeへの依頼プロンプト」に従い、Claudeが4クリップ分のセリフ・描写を**創作**する。
   - Step8の `narration_text` は「骨格（何が起きるかのメモ）」として扱い、Step10bでそれを実際のキャラクター間の**会話に肉付け**する。
   - 各クリップは**約15秒想定**。セリフ量はこれに合わせる（後述の「セリフ量の目安」参照）。
4. 生成結果を以下のパスにクリップごとに保存する:
   - `workspace/sora-prompts/ep{episode_no}/clip1.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip2.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip3.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip4.txt`
   - ディレクトリが存在しない場合は作成する。
   - 再生成時は上書き（バージョン管理不要）。
5. 保存完了後、ファイルパスを一覧で人間に提示してレビュー依頼。
6. 修正対応後、人間がSora 2で4クリップを生成。
7. 4クリップ生成完了確認 → 次ステップ（Step13b/Remotion合成）へ。

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
=== エピソード{episode_no}「{episode_title}」― Sora 2プロンプト保存完了 ===

📁 sora-prompts/ep{episode_no}/
   clip1.txt  （起）
   clip2.txt  （承）
   clip3.txt  （転）
   clip4.txt  （結）

各ファイルをSora 2のUIにコピペして生成してください。
生成後のファイル名: ep{episode_no}_clip1.mp4〜ep{episode_no}_clip4.mp4
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

- プロンプトの修正要望を受け付ける。
- キャラクター外見・ロケーション情報の不足がある場合は step8 のDB情報を再確認する。
- 前話情報の取得に失敗した場合（episode_no=1 または DB未登録）は前話参照なしで生成する。
- 4クリップすべての動画生成完了を人間に確認する。
- 確認後、次ステップ（Step13b/Remotion合成）へ進む。

## NanoBanana版（step10）との違い

| 項目 | step10（NanoBanana） | step10b（Sora 2） |
|------|---------------------|------------------|
| プロンプト単位 | シーンごと（細かい） | 4クリップ（グループ化） |
| セリフ言語 | 英語 | **日本語** |
| セリフ生成 | narration_textの英訳 | **Claudeが創作** |
| 秒数 | 含む（duration_sec） | **含まない**（UIで指定） |
| 質感指定 | なし | 必須（Photorealistic / 35mm film 等） |
| カメラ指示 | なし | 必須（1クリップ1ムーブ） |
| 前話参照 | なし | **cliffhanger/narration_script参照** |
| 次ステップ | step11-prepare-bgm-prompt | **Step13b**（Step11/12はスキップ） |

## 出力

- 4クリップ分のSora 2プロンプト（Claude創作済み）を人間に提示
- 次ステップ（Step13b/Remotion合成）への引き渡し
