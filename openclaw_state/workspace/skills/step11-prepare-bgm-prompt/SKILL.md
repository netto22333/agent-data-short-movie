---
name: step11-prepare-bgm-prompt
description: BGMプロンプトを整形してSuno/Udio向けに提示する。Use when Step11（BGMプロンプト準備）を実行する時。
---

# Step11: BGMプロンプト準備（Suno/Udio用）

1. 対象エピソードの `generated_videos.scenes_json` から `bgm_mood` の代表値を取得する。
2. `generation_jobs.emotion_target_per_ep`（または `emotion_target`）を参照する。
3. Suno/Udio向けプロンプトを整形して人間に提示する。
4. 人間がSuno/Udioで音楽生成を実行する。
5. 完了確認後、次ステップ（step12-prepare-narration）へ進む。

## bgm_mood代表値の決定ルール

- シーン数が3以上の場合: 最も多く出現する `bgm_mood` 値を代表値とする
- タイ・1シーンの場合: そのままの値を使用

## 提示フォーマット

```
=== エピソード {episode_no}「{episode_title}」 BGMプロンプト ===

【Suno/Udio向けプロンプト】
cinematic background music, {bgm_mood}, no lyrics, loop-friendly, {total_duration_sec}s

【補足情報】
- エピソード全体の感情: {emotion_target_per_ep}
- 合計尺: {total_duration_sec}秒
- 推奨: ループ可能な構成、フェードイン/アウト対応

【生成設定の目安】
- ジャンル: Cinematic / Instrumental
- テンポ: {bgm_mood} に合わせて調整
- 尺: {total_duration_sec}秒以上（編集で合わせる）
```

## Suno/Udio操作手順

1. 上記プロンプトをSuno（またはUdio）に貼り付けて生成
2. 複数候補を生成し、最も合うものを選択
3. ファイルを保存（ファイル名: `ep{episode_no}_bgm.mp3`）

## 介入点

- プロンプトの調整要望を受け付ける。
- BGM生成完了を人間に確認する。
- 確認後、次ステップへ進む。

## 出力

- BGMプロンプトの確認
- 次ステップ（step12-prepare-narration）への引き渡し
