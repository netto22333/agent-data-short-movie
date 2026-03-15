---
name: step10b-prepare-sora2-prompts
description: generated_videos の scenes_json / narration_script からSora 2用の4クリップ構造化プロンプトを生成して人間に提示する。Use when Step10b（Sora 2プロンプト準備）を実行する時。
---

# Step10b: Sora 2 プロンプト準備

1. `generation_jobs` から `character_definitions` / `location_definitions`（`prompt_text` 内に保存済み）を取得する。
2. 対象エピソードの `generated_videos.scenes_json` および `narration_script` を取得する。
3. 全シーンを4クリップに均等分割する（端数は後半クリップに寄せる）。
4. 各クリップに対してSora 2用の構造化プロンプトを生成し、人間に提示する。
5. 人間がSora 2で4クリップを個別生成する（各クリップ最大20秒、計約60秒）。
6. 完了確認後、次ステップ（step11-prepare-bgm-prompt）へ進む。

## 4クリップ分割ルール

- 全シーン数を4で割り、均等グループ化する。
- 端数は後半（クリップ3・4）に寄せる。
  - 例: 5シーン → [1,2] / [3] / [4] / [5]
  - 例: 6シーン → [1,2] / [3,4] / [5] / [6]
  - 例: 8シーン → [1,2] / [3,4] / [5,6] / [7,8]
- 各クリップは1話の「起・承・転・結」に対応させる:
  - Clip 1（起）: 状況設定・キャラクター紹介
  - Clip 2（承）: 展開・葛藤の始まり
  - Clip 3（転）: クライマックス・転換点
  - Clip 4（結）: 解決・余韻・エンディング

## 各クリップのプロンプト構造

```
=== Clip {n}/4 ― {展開ラベル: 起/承/転/結} ===

[SCENE & CHARACTERS]
{character_definitions の appearance（外見・服装・表情）} in {location_definitions の appearance（場所・環境）}.
{カメラショットタイプ: Medium shot / Close-up / Wide shot 等}. {カメラムーブ: Slow push-in / Static / Tracking 等}. {ライティング描写}.

[SITUATION]
{このクリップのコンテキスト・状況・感情的な背景}（英語）

[DEVELOPMENT]
{このクリップ内で起きること・変化・アクション・キャラクターの動き}（英語）

[DIALOGUE]
{キャラ名}: "{セリフ（英語）}"
{キャラ名}: "{セリフ（英語）}"
※ セリフなしの場合はこのブロックを省略

[BGM & ATMOSPHERE]
{bgm_mood from generation_jobs}, {emotion_target_per_ep に基づく感情的なトーン}

[QUALITY & TEXTURE]
Photorealistic, shot on 35mm film with shallow depth of field,
cinematic color grading, {ライティングスタイル: golden hour / natural window light / neon / soft studio light 等}
```

## プロンプト生成のガイドライン

- **秒数はプロンプトに含めない**（Sora 2では秒数指定はUIで行う）
- 1クリップ = 1カメラムーブ。複数のカメラムーブを混在させない
- `[SCENE & CHARACTERS]` はcharacter_definitionsとlocation_definitionsの情報を必ず参照する
- セリフはnarration_scriptから該当シーンのセリフを抽出し、英訳して記載する
- `[DIALOGUE]` はセリフがない場合は省略する（音楽・効果音のみのクリップも有効）
- カメラショット・ムーブ・ライティングはシーンの感情トーンに合わせて選択する:
  - 起: Wide / Establishing shot → 状況を俯瞰で見せる
  - 承: Medium / Two-shot → 関係性・対話
  - 転: Close-up / Dramatic angle → 感情・緊張感
  - 結: Wide / Pull-back → 余韻・解放感

## 提示フォーマット

```
=== エピソード {episode_no}「{episode_title}」― Sora 2 プロンプト（4クリップ） ===
※ 各クリップをSora 2で個別生成し、後で繋げてください（目標: 各クリップ最大20秒 → 合計約60秒）

--- Clip 1/4（起）---
[SCENE & CHARACTERS]
...

[SITUATION]
...

[DEVELOPMENT]
...

[DIALOGUE]（セリフありの場合）
...

[BGM & ATMOSPHERE]
...

[QUALITY & TEXTURE]
...

--- Clip 2/4（承）---
...

--- Clip 3/4（転）---
...

--- Clip 4/4（結）---
...

=== 生成手順 ===
1. 上記の各クリッププロンプトをSora 2に入力
2. 解像度: 1080×1920（縦型）または 1920×1080（横型）を選択
3. 各クリップを保存（ファイル名: ep{episode_no}_clip{n}.mp4）
4. 4クリップ生成完了後、このステップの完了を報告してください
```

## NanoBanana版（step10）との違い

| 項目 | step10（NanoBanana） | step10b（Sora 2） |
|------|---------------------|------------------|
| プロンプト単位 | シーンごと（細かい） | 4クリップ（グループ化） |
| セリフ | narration_text のみ | 独立 `[DIALOGUE]` ブロック |
| 秒数 | 含む（duration_sec） | **含まない**（UIで指定） |
| 質感指定 | なし | 必須（Photorealistic / 35mm film 等） |
| カメラ指示 | なし | 必須（1クリップ1ムーブ） |

## 介入点

- プロンプトの修正要望を受け付ける。
- キャラクター外見・ロケーション情報の不足がある場合は step8 のDB情報を再確認する。
- 4クリップすべての動画生成完了を人間に確認する。
- 確認後、次ステップ（step11-prepare-bgm-prompt）へ進む。

## 出力

- 4クリップ分のSora 2プロンプト提示
- 次ステップ（step11-prepare-bgm-prompt）への引き渡し
