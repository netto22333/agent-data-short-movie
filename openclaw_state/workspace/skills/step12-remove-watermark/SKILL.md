---
name: step12-remove-watermark
description: Step11でダウンロードした動画からSora 2のウォーターマークをGoogle Colab（GPU）で除去する。Use when Step12（ウォーターマーク削除）を実行する時。
---

# Step12: ウォーターマーク削除（Google Colab + Sora2WatermarkRemover）

## 概要

Step11でダウンロードした動画に含まれるSora 2のウォーターマークを、Google Colab上のGPUで高速に除去する。

- ツール: [Sora2WatermarkRemover](https://github.com/GitHub30/Sora2WatermarkRemover)
- 実行環境: Google Colab（GPU利用で高速処理）
- Colab notebook: https://colab.research.google.com/drive/1Iqu4RZ9WAhcbO1Jn0wCkMOsw2l1p6z62?usp=sharing

## 前提条件

- Step11が完了し、`workspace/videos/ep1/` に動画ファイルが保存済みであること
- Googleアカウントでログイン済みであること

## 手順

### 1. 対象動画を確認する

```sql
SELECT gv.id, gv.video_path, j.series_title
FROM generated_videos gv
JOIN generation_jobs j ON j.id = gv.generation_job_id
WHERE j.video_generation_status = 'video_ready'
  AND gv.video_path IS NOT NULL
ORDER BY gv.id DESC;
```

### 2. Google Colabでウォーターマーク削除を実行する

1. Colab notebookを開く:
   https://colab.research.google.com/drive/1Iqu4RZ9WAhcbO1Jn0wCkMOsw2l1p6z62?usp=sharing

2. 動画ファイルをColabにアップロードする

3. notebookのセルを順番に実行する:
   - セットアップ（リポジトリclone + 依存パッケージインストール）
   - ウォーターマーク削除実行
   - 処理済み動画のダウンロード

4. 処理済み動画をダウンロードして `workspace/videos/ep1/video_clean.mp4` に保存する

### 3. CDPブラウザ自動化で実行する場合

openclawのCDPブラウザ操作でColabを自動化することも可能:

```
1. CDP → https://colab.research.google.com/drive/... にアクセス
2. 動画ファイルをアップロード
3. セルを順番に実行
4. 処理済み動画をダウンロード
```

⚠️ Colabの自動化は UI変更のリスクがあるため、初期は手動実行を推奨。

### 4. DB更新

処理済み動画を保存後、DBを更新する:

```sql
UPDATE generated_videos
SET video_path = '{output_video_path}',
    updated_at = datetime('now')
WHERE generation_job_id = {job_id} AND episode_no = 1;
```

### 5. 目視確認

noVNC またはローカルで出力動画を再生し、ウォーターマークが除去されていることを確認する。

## なぜColabを使うか

- **GPU利用**: ローカル環境（Docker）はCPUのみで、450フレームの処理に25分以上かかる
- **メモリ**: Florence-2 + LaMAモデルのロードに約4GB必要。ローカル8-12GBでは他プロセスと競合する
- **Colab**: 無料GPUで数分で完了

## 介入点

- 出力動画の品質を目視確認する。
- ウォーターマークが残っている場合はColabのパラメータ調整して再実行。
