# ワークフロー概要 — AIショートドラマ制作

## 全体フロー（13ステップ）

```
[フェーズ1: トレンド調査・状況設計]
  Step 1: トレンドキーワード収集（openclaw / ブラウザ）
  Step 2: イベント抽出（トレンド → ドラマ化できるイベントへ変換）
  Step 3: 状況生成（舞台・シチュエーション確定）
  Step 4: story_type / hook_pattern 選定
  Step 5: DB記録 → generation_jobs INSERT

[フェーズ2: シナリオ設計]
  Step 6: 全体シナリオ生成（複数案）（Claude Code / Codex）
  ★ 人間レビュー①: シナリオ案比較・選択・承認
  Step 7: 承認シナリオをDBに記録（prompt_review_status = approved）

[フェーズ3: エピソード分割]
  Step 8: エピソード分割 → 各話プロンプト生成（Claude Code）
  Step 9: generated_videos レコード作成

[フェーズ4: 動画生成]（将来実装）
  Step 10: 各話プロンプトで動画生成（外部API）
  ★ 人間レビュー②: 動画確認・承認

[フェーズ5: 投稿・実績]（将来実装）
  Step 11: 動画投稿（YouTube / TikTok等）
  Step 12: 投稿実績記録（views / likes / comments / shares）
  Step 13: 実績分析・次回への改善点抽出
```

## 詳細ドキュメント

| フェーズ | ファイル |
|---------|---------|
| Step 1-5: トレンド〜状況 | docs/step1-trend-to-situation.md |
| Step 6-9: シナリオ〜エピソード | docs/step2-story-to-scenario.md |
| Step 10-13: 動画〜投稿（将来） | 未実装 |

## 重要ルール

- **人間レビュー①②の承認なしに次フェーズへ進まない**
- 各ステップの結果は必ずDBに記録する
- エラーや不明点は人間に報告・確認を求める
