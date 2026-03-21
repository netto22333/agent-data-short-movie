# ワークフロー概要 — 1話完結AIショートドラマ制作

## 設計原則

- **1話完結**: 60秒の起承転結ある物語
- **セリフ駆動**: 短いセリフで物語を進め、映像演出で感情を増幅
- **Sora 2 Extend方式**: 15秒Initial生成 + Extend×3 = 合計60秒
- **プロンプト出力**: 人間がSora 2にコピペして動画生成

## 全体フロー（12ステップ）

```
[フェーズ1: トレンド調査・状況設計]
  Step 1: トレンドキーワード収集（openclaw / ブラウザ）
  Step 2: イベント抽出（トレンド → ドラマ化できるイベントへ変換）
  Step 3: 状況生成（舞台・シチュエーション確定）
  Step 4: story_type / hook_pattern 選定
  Step 5: DB記録 → generation_jobs INSERT（episode_count=1, duration_sec=60）

[フェーズ2: 台本設計]
  Step 6: 1話完結の台本生成（起承転結 + セリフ候補）（Claude Code / Codex）
  ★ 人間レビュー: 台本案比較・選択・承認
  Step 7: 承認台本をDBに記録（prompt_review_status = approved）

[フェーズ3: クリップ構成]
  Step 8: 4クリップ構成生成（起承転結 × 15秒。セリフ・映像演出を具体化）（Claude Code）
  ★ 人間レビュー: クリップ構成確認・承認
  Step 9: generated_videos レコード作成

[フェーズ4: Sora 2 動画生成]
  Step 10: Sora 2用プロンプト生成（Initial + Extend×N）+ DB保存
  ★ 人間レビュー: プロンプト確認
  Step 11: Sora 2 自動動画生成（CDPブラウザ操作）
    → Initial生成 + Extend×(clip数-1) + ダウンロード + DB更新

[フェーズ5: 後処理]
  Step 12: ウォーターマーク削除（Sora2WatermarkRemover）
    → AI inpainting でSora 2ロゴを除去 + DB更新
```

## 起承転結 × Extend の構成

| クリップ | 秒数 | 起承転結 | Sora2操作 |
|---------|------|---------|-----------|
| Clip1 | 0-15s | 起（Setup） | Initial生成 |
| Clip2 | 15-30s | 承（Development） | Extend |
| Clip3 | 30-45s | 転（Twist） | Extend |
| Clip4 | 45-60s | 結（Resolution） | Extend |

## 詳細ドキュメント

| フェーズ | ファイル |
|---------|---------|
| Step 1-5: トレンド〜状況 | docs/step1-trend-to-situation.md |
| Step 6-9: 台本〜クリップ構成 | docs/step2-story-to-scenario.md |
| Step 11: Sora 2自動動画生成 | skills/step11-sora2-generate/SKILL.md |
| Step 12: ウォーターマーク削除 | skills/step12-remove-watermark/SKILL.md |
| ワークフロー全体 | skills/sora2-drama-workflow/SKILL.md |

## 重要ルール

- **人間レビュー承認なしに次フェーズへ進まない**
- 各ステップの結果は必ずDBに記録する
- セリフは短く（5〜10文字）。Sora 2で反映できる長さにする
- エラーや不明点は人間に報告・確認を求める
