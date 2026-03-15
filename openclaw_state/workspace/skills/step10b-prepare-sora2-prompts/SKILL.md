---
name: step10b-prepare-sora2-prompts
description: generated_videos・generation_jobsのDBデータを元に、Claudeが4クリップ分のセリフ・描写を創作してSora 2用の構造化プロンプトを生成・提示する。前話のcliffhanger/narration_scriptを参照してシリーズの辻褄を合わせる。Use when Step10b（Sora 2プロンプト準備）を実行する時。
---

# Step10b: Sora 2 プロンプト準備

## 処理フロー

1. 対象エピソードのDBデータを取得:
   - `generated_videos`: `episode_no`, `episode_title`, `episode_summary`, `emotion_target_per_ep`, `scenes_json`, `narration_script`, `cliffhanger_text`
   - `generation_jobs.prompt_text`: `character_definitions`, `location_definitions`, `emotion_arc`, `dialogue_motif`
2. 前話の情報を取得（episode_no > 1 の場合）:
   - 前話（episode_no - 1）の `cliffhanger_text`
   - 前話の `narration_script`
3. 以下の「Claudeへの依頼プロンプト」に従い、Claudeが4クリップ分のセリフ・描写を**創作**する（テンプレート埋めではなく、脚本家として内容を生成する）。
4. 生成結果を人間に提示・レビュー依頼。
5. 修正対応後、人間がSora 2で4クリップを生成。
6. 4クリップ生成完了確認 → 次ステップ（Step13b/Remotion合成）へ。

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
- scenes_json: {scenes_json}
- narration_script: {narration_script}

【前話の情報】（episode_no > 1 の場合のみ）
- 前話cliffhanger: {前話cliffhanger_text}
- 前話narration_script: {前話narration_script}

【4クリップ生成ルール】
- scenes_jsonを均等に4グループに分割（Clip1=起、Clip2=承、Clip3=転、Clip4=結）
- 端数は後半クリップに寄せる
  - 例: 5シーン → [1,2] / [3] / [4] / [5]
  - 例: 6シーン → [1,2] / [3,4] / [5] / [6]
  - 例: 8シーン → [1,2] / [3,4] / [5,6] / [7,8]

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
   narration_textをヒントにキャラクター間の自然な会話セリフを創作。
   形式: キャラ名「セリフ」
   ※ セリフがない場面は省略可。

5. [BGM & ATMOSPHERE]（英語）
   bgm_mood + emotion_target_per_ep から雰囲気・音響イメージを描写。

6. [QUALITY & TEXTURE]（英語・固定）
   Photorealistic, shot on 35mm film with shallow depth of field,
   cinematic color grading, {シーンに合うライティングスタイル}

【シリーズ辻褄ルール】
- episode_no > 1: Clip 1の冒頭で前話cliffhangerへの回答・解決を描写する。
- dialogue_motifの伏線・回収タイミングを各話のdialogue_motif_placementに従って守る。
- キャラクターの感情状態が前話から自然につながるよう、Clip 1の状況描写に反映する。
- プロンプトに秒数を含めない（Sora 2のUI側で指定）。
```

## 提示フォーマット

```
=== エピソード{episode_no}「{episode_title}」― Sora 2プロンプト（4クリップ） ===
※ 各クリップをSora 2で個別生成 → ファイル名: ep{N}_clip1.mp4〜ep{N}_clip4.mp4

--- Clip 1/4（起）---
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

--- Clip 2/4（承）---
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

--- Clip 3/4（転）---
...（以下同様）

--- Clip 4/4（結）---
...（以下同様）

=== 生成手順 ===
1. 上記の各クリッププロンプトをSora 2に入力
2. 解像度: 1080×1920（縦型）または 1920×1080（横型）を選択
3. 各クリップを保存（ファイル名: ep{episode_no}_clip{n}.mp4）
4. 4クリップ生成完了後、このステップの完了を報告してください
```

## プロンプト生成のガイドライン

- **秒数はプロンプトに含めない**（Sora 2ではUIで指定）
- **セリフは日本語**で生成する（映像・状況・BGM指示系は英語）
- 1クリップ = 1カメラムーブ。複数のカメラムーブを混在させない
- `[SCENE & CHARACTERS]` はcharacter_definitions・location_definitionsを必ず参照する
- セリフはnarration_scriptをヒントに、Claudeがキャラクターの声として**自然な会話として創作**する（narration_textの英訳ではなく、脚本的な台詞として書く）
- カメラショット・ムーブ・ライティングはシーンの感情トーンに合わせて選択する:
  - 起: Wide / Establishing shot → 状況を俯瞰で見せる
  - 承: Medium / Two-shot → 関係性・対話
  - 転: Close-up / Dramatic angle → 感情・緊張感
  - 結: Wide / Pull-back → 余韻・解放感

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
