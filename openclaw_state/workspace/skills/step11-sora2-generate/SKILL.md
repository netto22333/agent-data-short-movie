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

## 生成完了の判定方法

1分間隔でSora 2のDOMをポーリングし、以下の条件で完了を判定する:

| DOM状態 | 判定 |
|---|---|
| `video[src]`あり + `[role="progressbar"]`なし | **完了** |
| `[role="progressbar"]`あり | 生成中（待機続行） |
| どちらもなし | 不明（待機続行） |

- **ポーリング間隔**: 1分（`POLL_INTERVAL_MS = 60000`）
- **タイムアウト**: 10分（`POLL_TIMEOUT_MS = 600000`）
- タイムアウト時はエラーで停止する。Sora 2の負荷状況でタイムアウトが足りない場合は `--poll-timeout` で調整可能

## ブラウザページクリーンアップ

動画生成完了後、Sora 2で開いたページを閉じる。ページが蓄積するとメモリを圧迫しブラウザが不安定になる。

```javascript
const {chromium} = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18803');
  const context = browser.contexts()[0];
  for (const page of context.pages()) {
    const url = page.url();
    if (url.includes('sora.chatgpt.com')) {
      await page.close();
      console.log('CLOSED:', url);
    }
  }
  console.log('Remaining pages:', context.pages().length);
  process.exit(0);
})();
```

## トラブルシューティング

- **プロンプト入力欄が見つからない**: Sora 2のUIが変更された可能性。noVNCで実際のDOMを確認し、`sora2-generate-cdp.mjs` のセレクタを修正する。
- **ログインが切れている**: noVNCでブラウザを開き、ChatGPTに再ログインする。
- **生成がタイムアウト**: Sora 2の負荷状況により10分以上かかる場合がある。タイムアウト値を `--poll-timeout` で調整して自動リトライする。
- **ダウンロードが失敗**: 自動リトライする。3回失敗した場合はエラーログを残して停止する。

## 自動処理

- 全工程自動実行。エラー発生時は自動リトライする。
- 動画ダウンロード完了後、自動で次ステップへ進む。
