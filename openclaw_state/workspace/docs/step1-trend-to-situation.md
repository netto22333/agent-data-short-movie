# スキル①: トレンド → 状況（Step 1-5）

**実行主体**: openclawエージェント（ブラウザ/CDP使用）

---

## Step 1: トレンドキーワード収集

openclawエージェントがブラウザ（CDP: `http://[::1]:18803`）を使い自律的に実行:

1. **Google Trends** にアクセスし、直近の急上昇キーワードを収集
2. **ニュースサイト**（Google ニュース等）でトレンドトピックを確認
3. **SNS**（X/Twitter トレンド等）で話題のキーワードを収集

収集するキーワード: 5〜10件

---

## Step 2: イベント抽出

収集したキーワードから「ドラマ化できるイベント」を抽出:

- 人間関係・感情に関わるイベントを優先
- 普遍的な共感を得られるテーマを選ぶ
- 炎上リスクのあるトピック（政治・宗教・差別等）は除外

出力: `event_name`（1〜3件の候補）

---

## Step 3: 状況生成

抽出したイベントを元に「ドラマの舞台・シチュエーション」を確定:

- 具体的な場面設定（職場・学校・家族・恋愛等）
- 登場人物の関係性（同僚・元恋人・親子等）
- 時代背景・環境

出力: `situation_text`（200字程度）

---

## Step 4: story_type / hook_pattern 選定

DBから候補を取得し、状況に最適なものを選ぶ:

```sql
SELECT * FROM story_types WHERE is_active = 1;
SELECT * FROM hook_patterns WHERE is_active = 1;
```

選定基準:
- 状況との相性
- 視聴者の感情的引きつけ力
- バズりやすさ

---

## Step 5: DB記録

generation_jobs テーブルに INSERT:

```sql
INSERT INTO generation_jobs (
  trend_keywords,
  event_name,
  situation_text,
  story_type_id,
  hook_pattern_id,
  emotion_target,
  duration_sec,
  episode_count
) VALUES (?, ?, ?, ?, ?, ?, 20, 4);
```

INSERT後、`id` を記録して次のステップへ。

---

## 完了条件

- `generation_jobs` に新規レコードが作成されている
- `trend_keywords`, `event_name`, `situation_text` が埋まっている
- `story_type_id`, `hook_pattern_id` が設定されている
- `final_status = 'draft'`, `prompt_review_status = 'pending'`
