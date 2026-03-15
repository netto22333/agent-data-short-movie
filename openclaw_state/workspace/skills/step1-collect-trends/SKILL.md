---
name: step1-collect-trends
description: Google Trends JP（過去168時間）をCDPブラウザ経由で2ページ分スクレイプし、急上昇キーワードを最大50件収集して人間に提示する。Use when Step1（トレンド収集）を実行する時。
---

# Step1: トレンドキーワード収集

## 実行方法（必須）

1. 以下のコマンドを実行する（CDP経由で自動スクレイプ、RSS/API直読みは使わない）:
   ```
   node scripts/collect-trends-cdp.mjs --limit=50 --format=text
   ```
   - 1ページ目（25件）取得 → 「次のページに移動」ボタンをクリック → 2ページ目（25件）取得
   - 重複除去・検索ボリューム降順でソートして最大50件を出力
2. 出力された `trend_keywords` リストを人間に提示する。
3. 人間の確認・取捨選択・追加を待つ。

## エラー時の扱い

- `ERROR:` が出力された場合:
  - CDP エンドポイント（`http://127.0.0.1:18803`）に接続できているか確認する。
  - 接続できない場合は `openclaw gateway restart` 後に再実行する。
  - 接続復旧までは Step1 完了扱いにしない。

## 介入点

- キーワードの削除・追加・優先順位変更を受け付ける。
- 確定後、次ステップ（step2-extract-event）へ渡す。

## 出力

- `trend_keywords`: 確定済みキーワードリスト
