---
name: step12-prepare-narration
description: narration_scriptをElevenLabs向けに整形して提示する。Use when Step12（ナレーション準備）を実行する時。
---

# Step12: ナレーション準備（ElevenLabs用）

1. 対象エピソードの `generated_videos.narration_script` を取得する。
2. ElevenLabs向けに整形して人間に提示する。
3. 人間がElevenLabsで音声生成を実行する。
4. 完了確認後、次ステップ（step13-prepare-remotion）へ進む。

## 提示フォーマット

```
=== エピソード {episode_no}「{episode_title}」 ナレーションスクリプト ===

【ElevenLabs入力テキスト】
---
{narration_script}
---

【文字数】{char_count}文字
【推定読み上げ時間】約{estimated_duration_sec}秒（通常速度）

【ElevenLabs推奨設定】
- 声優: 1名（シリーズ統一）
- Stability: 0.5
- Similarity Boost: 0.75
- Style: 0（ナレーション用）
- 言語: Japanese

【シーン別ナレーション内訳】
シーン1（{duration_sec}秒）: {narration_text}
シーン2（{duration_sec}秒）: {narration_text}
...
```

## 推定読み上げ時間の計算

- 日本語の標準読み上げ速度: 約5〜6文字/秒
- 推定秒数 = 文字数 ÷ 5.5（小数点以下切り上げ）

## ElevenLabs操作手順

1. 上記「ElevenLabs入力テキスト」をそのままElevenLabsに貼り付け
2. 推奨設定を適用して生成
3. 音声ファイルを保存（ファイル名: `ep{episode_no}_narration.mp3`）

## 介入点

- スクリプトの修正要望を受け付ける。
- 音声生成完了を人間に確認する。
- 確認後、次ステップへ進む。

## 出力

- ナレーションスクリプトと文字数の確認
- 次ステップ（step13-prepare-remotion）への引き渡し
