---
name: step10-prepare-sora2-prompts
description: DBからエピソードデータを読み込み、2フェーズ（通し生成→4分割）でSora2プロンプトを生成・ファイル保存する。Use when Step10（Sora2プロンプト生成）を実行する時。
---

# Step10: 各話Sora2プロンプト生成（2フェーズ方式）

## 概要

Step10は2フェーズで実行する:
- **フェーズA**: 1話分の通しプロンプトを生成 → 人間レビュー
- **フェーズB**: 承認された通しプロンプトを4クリップに分割 → 人間レビュー

この2段階により、セリフ/内容の断片化・重複を防ぐ。

## フロー

### 共通: データ取得

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

---

### フェーズA: 1話分の通しプロンプト生成

4. 各エピソードについて順次、以下「フェーズA用プロンプト」に従い**1話分の通し映像プロンプト**を生成する。
   - `episode_no > 1` の場合は直前話の `cliffhanger_text` と `narration_script` を参照する。
   - この段階では**クリップ分割を一切意識しない**。1話分を通しで記述する。

5. 通しプロンプトを以下のパスに保存する:
   - `workspace/sora-prompts/ep{episode_no}/full.txt`
   - ディレクトリが存在しない場合は作成する。
   - 再生成時は上書き（バージョン管理不要）。

6. 全話分の保存完了後、ファイル内容を人間に提示してレビュー依頼。
   - 修正要望があれば対応する。特定話のみ再生成も可。
   - **人間の承認を得てからフェーズBに進む。**

---

### フェーズB: 4クリップへの分割

7. 承認された通しプロンプト（`full.txt`）を入力として、以下「フェーズB用プロンプト」に従い4クリップに分割する。

8. 各クリップを以下のパスに保存する:
   - `workspace/sora-prompts/ep{episode_no}/clip1.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip2.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip3.txt`
   - `workspace/sora-prompts/ep{episode_no}/clip4.txt`
   - 再生成時は上書き（バージョン管理不要）。

9. 全話分の保存完了後、ファイルパス一覧を人間に提示してレビュー依頼。

10. 修正対応後、次ステップ（Step13b）へ。

---

## フェーズA用プロンプト（通し生成）

```
以下の情報を元に、このエピソード1話分の完全なSora 2映像プロンプトを「通し」で生成してください。
⚠️ この段階ではクリップ分割を一切意識しないこと。1話分をひとつの連続した映像として記述する。

【シリーズ情報】
- emotion_arc: {emotion_arc}
- character_definitions: {character_definitions}
- location_definitions: {location_definitions}

【今話の情報】
- エピソード{episode_no}「{episode_title}」
- あらすじ: {episode_summary}
- 感情ターゲット: {emotion_target_per_ep}
- episode_hook（冒頭フック）: {episode_hook}
- cliffhanger_text（次話への引き）: {cliffhanger_text}
- scenes_json: {scenes_json}
- narration_script: {narration_script}

【前話の情報】（episode_no > 1 の場合のみ）
- 前話cliffhanger: {前話cliffhanger_text}

【通しプロンプト生成ルール】

1. scenes_json全体のシーンを通して、1話分のストーリーを一貫した映像プロンプトとして記述する。
2. 以下の構成で出力する:

--- Episode {episode_no}「{episode_title}」 通しプロンプト ---

{character_definitionsのappearance}. {location_definitionsのappearance}.

Prose:
{scenes_json全体のscene_descを踏まえた、1話分の状況・感情・ライティングの流れを連続的に記述。
 冒頭からラストまで、シーンの展開順に自然な流れで書く。}

Cinematography:
{1話を通したカメラワークの流れ。冒頭のフレーミングから、展開に応じたカメラムーブの変化、
 クライマックスでの演出、ラストカットまでを連続的に記述。}
Mood: {emotion_target_per_epに基づく1話全体のトーン変化}

Actions:
- {scene_descから導いた具体的アクションビートを、ストーリー順に列挙}
- {次のビート}
- {…全シーン分を漏れなく列挙する}

Narration Script:
{narration_scriptを1話通しで記述。シーンの流れに沿った自然なナレーション。}

Background Sound:
{1話を通したBGM・環境音の流れ。シーン展開に合わせた変化を記述。}

[QUALITY & TEXTURE]
Photorealistic, shot on 35mm film with shallow depth of field,
cinematic color grading, {1話全体のライティングスタイル}

3. ⚠️ Dialogueブロックは生成しない。セリフ・台詞・会話は一切含めない。映像・音・動きのみで表現すること。
4. episode_hookを冒頭Proseの最初に反映する。「3秒で状況が伝わる感情直球」の掴みを映像で体現すること。
5. episode_no > 1の場合: 前話cliffhangerへの回答・解決を冒頭で描写する。
6. 非最終話: cliffhanger_textをラストのActionsの締めに「映像描写として」反映する。「答えを出さずに終わる」こと。
7. 最終話: cliffhanger_textをエンディングの映像演出として使う。感情の解放・余韻で締める。
8. プロンプトに秒数を含めない（Sora 2のUI側で指定）。
9. Actions は全シーンのscene_descを漏れなくカバーすること。省略しない。
```

---

## フェーズB用プロンプト（4クリップ分割）

```
以下の「通しプロンプト」を4クリップに分割してください。
通しプロンプトの内容を忠実に分割すること。新たな内容の追加や、既存内容の改変はしない。

【通しプロンプト】
{full.txtの内容}

【scenes_json】
{scenes_json}

【シリーズ情報】
- character_definitions: {character_definitions}
- location_definitions: {location_definitions}

【今話の情報】
- エピソード{episode_no}「{episode_title}」
- episode_hook: {episode_hook}
- cliffhanger_text: {cliffhanger_text}

【4クリップ分割ルール】

1. scenes_jsonのシーンを均等に4グループに分割する。端数は後半クリップに寄せる。
   - 例: 5シーン → [scene1,2] / [scene3] / [scene4] / [scene5]
   - 例: 6シーン → [scene1,2] / [scene3,4] / [scene5] / [scene6]
   - 例: 8シーン → [scene1,2] / [scene3,4] / [scene5,6] / [scene7,8]

2. 分割前に、各クリップへのシーン割り当てを以下の形式で必ず明示すること:
   例）「Clip1: scene1-2、Clip2: scene3-4、Clip3: scene5-6、Clip4: scene7-8」

3. 通しプロンプトの該当部分を各クリップに割り当てる:
   - Prose: 該当シーン範囲の状況・感情描写を抜き出す
   - Cinematography: 該当シーン範囲のカメラワークを抜き出す
   - Actions: 該当シーン範囲のアクションビートを抜き出す
   - Narration Script: 該当シーン範囲のナレーションを抜き出す
   - Background Sound: 該当シーン範囲のBGM・環境音を抜き出す

4. ⚠️ 内容の重複禁止: 同じアクション・ナレーション・描写が複数クリップに現れないこと。
   通しプロンプトの各部分は必ず1つのクリップにのみ割り当てる。

5. 各クリップの冒頭にcharacter/location appearanceを付与する。

6. Clip 1の必須制約:
   - episode_hookをClip 1のActionsの冒頭に必ず反映する。
   - episode_no > 1: 前話cliffhangerへの回答・解決をClip 1の前半のActionsで描写する。

7. Clip 4の必須制約:
   - 非最終話: cliffhanger_textをClip 4のActionsの締めに「映像描写として」反映する。「答えを出さずに終わる」こと。
   - 最終話: cliffhanger_textをエンディングの映像演出として使う。感情の解放・余韻で締める。ActionsはWide/Pull-backで余韻を持たせる。

8. プロンプトに秒数を含めない。
9. Dialogueブロックは生成しない。セリフ・台詞・会話は一切含めない。

【各クリップの出力形式】

--- Clip {n}/4  ep{episode_no}「{episode_title}」---

{character appearance}. {location appearance}.
{このクリップに割り当てたProseの該当部分}

Cinematography:
Camera shot: {該当部分のカメラワーク}
Mood: {該当部分のムード}

Actions:
- {該当部分のアクションビート}
- {…}

Narration Script:
{該当部分のナレーション}

Background Sound:
{該当部分のBGM・環境音}

[QUALITY & TEXTURE]
Photorealistic, shot on 35mm film with shallow depth of field,
cinematic color grading, {該当部分のライティングスタイル}
```

---

## 保存ファイル構成

### フェーズA出力: 通しプロンプト
- `workspace/sora-prompts/ep{episode_no}/full.txt`

### フェーズB出力: クリップ別プロンプト
- `workspace/sora-prompts/ep{episode_no}/clip1.txt` 〜 `clip4.txt`

各クリップファイルはSora 2のUIにそのままコピペできる形式。

---

## 人間への提示メッセージ

**フェーズA完了後:**
```
=== Step10 フェーズA完了 ― 通しプロンプト生成完了 ===

📁 sora-prompts/
   ep1/full.txt
   ep2/full.txt
   ...
   ep{N}/full.txt

各エピソードの通しプロンプトを確認してください。
修正があれば指示してください。問題なければ「承認」と伝えてください。
承認後、フェーズB（4クリップ分割）に進みます。
```

**フェーズB完了後:**
```
=== Step10 フェーズB完了 ― 4クリップ分割完了 ===

📁 sora-prompts/
   ep1/full.txt, clip1.txt〜clip4.txt
   ep2/full.txt, clip1.txt〜clip4.txt
   ...
   ep{N}/full.txt, clip1.txt〜clip4.txt

各ファイルをSora 2のUIにコピペして生成してください。
生成後のファイル名: ep{N}_clip1.mp4〜ep{N}_clip4.mp4

次ステップ: Step13b（Remotion合成）へ進んでください。
```

## プロンプト生成のガイドライン

- **秒数はプロンプトに含めない**（Sora 2ではUIで指定）
- **セリフ・Dialogueブロックは生成しない**（映像・音・動きのみで表現する）
- Cinematographyは `Camera shot`（フレーミング + 1ムーブを1文）+ `Mood` のみ。Lightingは Prose に統合する
- Prose はcharacter_definitions・location_definitionsのappearanceを必ず参照する
- Actionsはscene_descから具体的な映像アクションビートとして列挙する

## 介入点

- フェーズA: 通しプロンプトの修正要望を受け付ける。特定話のみ再生成も可。
- フェーズB: クリップ分割の修正要望を受け付ける。特定話の特定クリップのみ再生成も可。
- 確定後、次ステップ（step13b-prepare-remotion）へ渡す。
