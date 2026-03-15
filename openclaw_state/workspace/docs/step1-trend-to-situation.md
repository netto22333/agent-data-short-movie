# スキル①: トレンド → 状況（Step 1-5）

**実行主体**: openclawエージェント（ブラウザ/CDP使用）

---

## Step 1: トレンドキーワード収集

openclawエージェントがブラウザ（CDP: `http://[::1]:18803`）を使い自律的に実行:

1. **Google Trends（日本）** にアクセスしてトレンドキーワードを収集
   - URL: `https://trends.google.co.jp/trending?geo=JP&hours=168`
   - 過去7日間（168時間）の急上昇キーワード一覧をページからすべて取得する

収集するキーワード: 10〜20件

---

## Step 2: イベント抽出

収集したキーワードから「ドラマ化できるイベント」を抽出する。

### ターゲット視聴者

**AIにあまり詳しくない一般層**（30〜50代、スマホで動画を見る普通の人）が共感・反応しやすいトピックを選ぶ。

### 選定基準

**優先するもの:**
- 日常生活・身近な人間関係に関わる話題（家族・職場・恋愛・友人）
- 「あるある」と感じる普遍的な感情（嫉妬・後悔・驚き・感動）
- 世代を問わず伝わるわかりやすいテーマ

**避けるもの:**
- 専門知識がないと理解できない話題（IT・金融・医療等の専門用語）
- 炎上リスクのあるトピック（政治・宗教・差別・特定企業・著名人批判）
- テクノロジーや最新トレンドが前提の話題

出力: `event_name`（1〜3件の候補）、各候補に「なぜこの層に刺さるか」を一言添える

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
