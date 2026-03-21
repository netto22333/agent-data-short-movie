---
name: step12-remove-watermark
description: Step11でダウンロードした動画からSora 2のウォーターマークをAI inpaintingで除去する。Use when Step12（ウォーターマーク削除）を実行する時。
---

# Step12: ウォーターマーク削除（Sora2WatermarkRemover）

## 概要

Step11でダウンロードした動画に含まれるSora 2のウォーターマークを、[Sora2WatermarkRemover](https://github.com/GitHub30/Sora2WatermarkRemover) のAI inpainting（LaMAモデル）で除去する。

## 前提条件

- Step11が完了し、`workspace/videos/ep1/` に動画ファイルが保存済みであること
- Sora2WatermarkRemover がインストール済みであること（下記セットアップ参照）
- Python 3.12 + CUDA対応GPU（推奨）またはCPU

## セットアップ（初回のみ）

```bash
# リポジトリをclone
git clone https://github.com/GitHub30/Sora2WatermarkRemover.git /home/node/tools/Sora2WatermarkRemover

# セットアップ（Linux）
cd /home/node/tools/Sora2WatermarkRemover
bash setup.sh

# LaMAモデルダウンロード
iopaint download --model lama
```

## 手順

1. 対象 `job_id` を確認する:
   ```sql
   SELECT gv.id, gv.video_path, j.series_title
   FROM generated_videos gv
   JOIN generation_jobs j ON j.id = gv.generation_job_id
   WHERE j.video_generation_status = 'video_ready'
     AND gv.video_path IS NOT NULL
   ORDER BY gv.id DESC;
   ```

2. ウォーターマーク削除を実行する:
   ```bash
   cd /home/node/tools/Sora2WatermarkRemover
   python remwm.py {input_video_path} {output_video_path}
   ```

   例:
   ```bash
   python remwm.py \
     /home/node/.openclaw/workspace/videos/ep1/video.mp4 \
     /home/node/.openclaw/workspace/videos/ep1/video_clean.mp4
   ```

   オプション:
   - `--max-bbox-percent 10.0` — ウォーターマーク検出の閾値（デフォルト10%）
   - `--frame-step 1` — 全フレーム処理（デフォルト。高品質だが遅い）
   - `--target-fps 0` — 元動画のFPSを維持（デフォルト）

3. 処理完了後、DB更新:
   ```sql
   UPDATE generated_videos
   SET video_path = '{output_video_path}',
       updated_at = datetime('now')
   WHERE generation_job_id = {job_id} AND episode_no = 1;
   ```

4. noVNC で出力動画を目視確認する。

## 処理の流れ

```
1. 入力動画（ウォーターマーク付き）
2. Florence-2モデルで各フレームのウォーターマーク位置を検出
3. LaMAモデルでウォーターマーク部分をinpainting（自然に塗りつぶし）
4. 音声は元動画から保持（FFmpeg）
5. 出力動画（ウォーターマーク除去済み）
```

## トラブルシューティング

- **GPU不足**: `--frame-step 2` でフレームをスキップすると高速化できる
- **ウォーターマークが残る**: `--max-bbox-percent` を大きくする（例: 15.0）
- **出力品質が低い**: `--target-fps` を元動画と同じ値に明示指定する
- **FFmpegエラー**: `apt install ffmpeg` でFFmpegをインストールする

## 介入点

- 出力動画の品質を目視確認する。
- ウォーターマークが残っている場合はパラメータ調整して再実行。
