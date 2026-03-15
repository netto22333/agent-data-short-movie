---
name: step10-prepare-scene-prompts
description: generated_videos の scenes_json からNanoBanana用プロンプトを整形して人間に提示する。Use when Step10（シーンプロンプト準備）を実行する時。
---

# Step10: シーンプロンプト準備（NanoBanana用）

1. `generation_jobs` から `character_definitions` / `location_definitions`（`prompt_text` 内に保存済み）を取得する。
2. 対象エピソードの `generated_videos.scenes_json` を取得する。
3. 各シーンの情報をNanoBanana操作用に整形して人間に提示する。
4. 人間がNanoBananaで画像生成 → 動画化を実行する。
5. 完了確認後、次ステップ（step11-prepare-bgm-prompt）へ進む。

## 提示フォーマット

各シーンを以下の形式で番号付きリスト表示する:

```
=== エピソード {episode_no}「{episode_title}」 シーン一覧 ===

【シーン 1】{scene_desc}（{duration_sec}秒）
  [image_prompt]
  {image_prompt}

  [video_motion_prompt]
  {video_motion_prompt}

【シーン 2】{scene_desc}（{duration_sec}秒）
  ...
```

## NanoBanana操作手順

1. image_prompt をそのままNanoBananaに貼り付けて画像生成
2. 生成された画像を選択し、video_motion_prompt を指定して動画化
3. 各シーンのクリップを保存（ファイル名: `ep{episode_no}_scene{scene_no}.mp4`）

## 介入点

- プロンプトの修正要望を受け付ける。
- 全シーンの動画クリップ生成完了を人間に確認する。
- 確認後、次ステップへ進む。

## 出力

- シーン数・合計秒数の確認
- 次ステップ（step11-prepare-bgm-prompt）への引き渡し
