---
name: step11-sora2-generate
description: Sora 2にブラウザ自動操作でプロンプトを投入し、Initial生成+Extend×(clip数-1)で動画を生成・ダウンロードする。Use when Step11（Sora 2動画生成）を実行する時。
---

# Step11: Sora 2 自動動画生成（CDPブラウザ操作）

## 概要

DBに保存されたSora 2プロンプト（`sora2_prompts_json`）を使い、CDPブラウザ操作で自動的に動画を生成する。

- Clip1: Initial生成（15秒）
- Clip2〜N: Extend（各15秒延長）× プロンプト数に応じた回数
- 完成動画をダウンロードしてファイル保存 + DB更新

## 前提条件

- Step10が完了し、`generated_videos.sora2_prompts_json` にプロンプトが保存済みであること
- Sora 2（ChatGPT）にログイン済みであること（noVNCで事前確認）
- CDPエンドポイント（`http://127.0.0.1:18803`）が稼働していること

## 手順

1. 対象 `job_id` を確認する:
   ```sql
   SELECT j.id, j.series_title, j.video_generation_status,
          gv.sora2_prompts_json IS NOT NULL AS has_prompts
   FROM generation_jobs j
   JOIN generated_videos gv ON gv.generation_job_id = j.id
   WHERE j.video_generation_status = 'episodes_ready'
   ORDER BY j.id DESC;
   ```

2. CDPスクリプトを実行する:
   ```bash
   node scripts/sora2-generate-cdp.mjs --job-id={job_id}
   ```

   オプション引数:
   - `--cdp=http://127.0.0.1:18803` — CDPエンドポイント（デフォルト）
   - `--output-dir=workspace/videos/ep1` — 動画保存先（デフォルト）

3. noVNC（`http://localhost:6082`）でブラウザ操作を目視確認する。

4. 完了後、DB更新を確認する:
   ```sql
   SELECT video_path, video_review_status
   FROM generated_videos
   WHERE generation_job_id = {job_id};

   SELECT video_generation_status
   FROM generation_jobs
   WHERE id = {job_id};
   ```

## 自動処理の流れ

```
1. DB → sora2_prompts_json 取得（clip1, clip2, ..., clipN）
2. CDP → https://sora.chatgpt.com/drafts にアクセス
3. Clip1: プロンプト入力 → Duration 15s → Generate → 完了待機
4. Clip2〜N: 動画選択 → Extend → プロンプト入力 → Generate → 完了待機
   ※ clip数に応じて動的にExtend回数が決まる
5. 完成動画をダウンロード → workspace/videos/ep1/ に保存
6. DB更新: generated_videos.video_path, generation_jobs.video_generation_status='video_ready'
```

## トラブルシューティング

- **プロンプト入力欄が見つからない**: Sora 2のUIが変更された可能性。noVNCで実際のDOMを確認し、`sora2-generate-cdp.mjs` のセレクタを修正する。
- **ログインが切れている**: noVNCでブラウザを開き、ChatGPTに再ログインする。
- **生成がタイムアウト**: Sora 2の負荷状況により10分以上かかる場合がある。タイムアウト値を `--poll-timeout` で調整するか、手動で完了を待つ。
- **ダウンロードが失敗**: noVNCから手動でダウンロードし、`workspace/videos/ep1/` に保存後、DBを手動更新する。

## 介入点

- スクリプト実行中もnoVNCでブラウザ操作を監視・介入可能。
- エラー発生時は手動操作に切り替えてよい。
- 動画ダウンロード後、品質を目視確認してから次のステップへ進む。
