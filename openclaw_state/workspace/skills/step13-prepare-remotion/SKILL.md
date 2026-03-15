---
name: step13-prepare-remotion
description: Remotion合成用props JSONと合成手順を整形して提示する。Use when Step13（Remotion合成準備）を実行する時。
---

# Step13: Remotion合成準備

1. 対象エピソードの `generated_videos.scenes_json` を取得する。
2. Remotion用 props JSON を生成して人間に提示する。
3. 合成手順を提示する。
4. 人間がRemotionでレンダリングを実行する。
5. 完了後、`generated_videos.video_path` の UPDATE を案内する。

## Remotion props JSON生成

`scenes_json` の `narration_text` と `duration_sec` から以下のフォーマットで props JSON を生成する:

```json
{
  "scenes": [
    { "scene_no": 1, "duration_sec": 5, "subtitle": "ナレーションテキスト" },
    { "scene_no": 2, "duration_sec": 4, "subtitle": "ナレーションテキスト" }
  ]
}
```

## 提示フォーマット

```
=== エピソード {episode_no}「{episode_title}」 Remotion合成設定 ===

【props.json】
{props_json}

【合成素材チェックリスト】
- [ ] NanoBanana動画クリップ: ep{episode_no}_scene1.mp4 〜 ep{episode_no}_scene{scene_count}.mp4
- [ ] BGM: ep{episode_no}_bgm.mp3
- [ ] ナレーション音声: ep{episode_no}_narration.mp3

【Remotion合成手順】
1. props.json をRemotionプロジェクトの src/props/ に配置
2. シーン動画クリップを時間軸で並べる（各クリップを duration_sec に合わせてトリミング）
3. narration_text を duration_sec に合わせて字幕として配置（subtitle フィールド使用）
4. BGM（ep{episode_no}_bgm.mp3）をバックグラウンドレイヤーに追加
5. ナレーション音声（ep{episode_no}_narration.mp3）をボイスレイヤーに追加
6. 以下コマンドで最終mp4を書き出し:

npx remotion render src/index.ts Episode{episode_no} --props src/props/ep{episode_no}.json out/ep{episode_no}_final.mp4

【出力ファイル】
- 保存先: out/ep{episode_no}_final.mp4
- 完成後、以下SQLでパスを登録:
  UPDATE generated_videos SET video_path = 'out/ep{episode_no}_final.mp4', updated_at = datetime('now')
  WHERE generation_job_id = {job_id} AND episode_no = {episode_no};
```

## 介入点

- props JSONの修正要望を受け付ける。
- レンダリング完了を人間に確認する。
- `video_path` UPDATE の完了を確認する。

## 出力

- Remotion props JSON
- 合成手順の確認
- `generated_videos.video_path` UPDATE完了の確認
