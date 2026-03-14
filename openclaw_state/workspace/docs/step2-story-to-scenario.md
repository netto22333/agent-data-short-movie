# スキル②③: 物語設計 → シナリオ → 各話プロンプト（Step 6-9）

**実行主体**: openclaw から `claude` コマンドを呼び出し実行

---

## Step 6: 全体シナリオ生成（複数案）

対象: `generation_jobs` の `prompt_review_status = 'pending'` レコード

### DBから情報取得

```sql
SELECT
  j.*,
  st.name AS story_type_name,
  hp.name AS hook_pattern_name,
  hp.template AS hook_template
FROM generation_jobs j
LEFT JOIN story_types st ON st.id = j.story_type_id
LEFT JOIN hook_patterns hp ON hp.id = j.hook_pattern_id
WHERE j.prompt_review_status = 'pending'
ORDER BY j.created_at DESC
LIMIT 1;
```

### Claude に依頼するプロンプト例

```
以下の情報を元に、AIショートドラマシリーズの全体シナリオ案を2〜3案生成してください。

【状況】{situation_text}
【物語タイプ】{story_type_name}
【フックパターン】{hook_pattern_name}: {hook_template}
【ターゲット感情】{emotion_target}
【話数】{episode_count}話
【各話の長さ】{duration_sec}秒

各案に以下を含めてください:
- series_title: シリーズタイトル
- series_summary: シリーズ概要（100字程度）
- series_outline: 全話の流れ（各話1〜2行）
- emotion_arc: 感情の波（各話でどんな感情を引き出すか）
- hook: 第1話の冒頭フック（視聴者を引きつける一文）
```

### 出力形式

複数案をMarkdownまたはJSONで出力し、人間に提示する。

---

## 人間レビュー①: シナリオ案比較・選択・承認

1. 複数案を人間に提示（noVNCで確認可能）
2. 人間が1案を選択し、フィードバックを提供
3. 必要に応じて修正・再生成

承認後: `generation_jobs` を更新

```sql
UPDATE generation_jobs SET
  series_title = ?,
  series_summary = ?,
  series_outline = ?,
  prompt_text = ?,
  prompt_review_status = 'approved',
  updated_at = datetime('now')
WHERE id = ?;
```

---

## Step 7: 承認確認

```sql
SELECT id, series_title, prompt_review_status
FROM generation_jobs
WHERE prompt_review_status = 'approved'
ORDER BY updated_at DESC
LIMIT 1;
```

`prompt_review_status = 'approved'` を確認してから次へ進む。

---

## Step 8: エピソード分割 → 各話プロンプト生成

### Claude に依頼するプロンプト例

```
承認されたシリーズ「{series_title}」を{episode_count}話に分割し、
各話の詳細を生成してください。

【シリーズ概要】{series_summary}
【全体の流れ】{series_outline}

各話ごとに以下を生成:
- episode_no: 話数（1〜N）
- episode_title: 話タイトル
- episode_summary: あらすじ（100字程度）
- episode_hook: この話の冒頭フック（視聴者を引きつける一文）
- cliffhanger_text: 次話への引き（最終話はエンディングメッセージ）
- video_prompt: 動画生成AIへのプロンプト（英語、詳細な映像描写）
```

---

## Step 9: generated_videos レコード作成

各話ごとに `generated_videos` テーブルに INSERT:

```sql
INSERT INTO generated_videos (
  generation_job_id,
  episode_no,
  episode_title,
  episode_summary,
  episode_hook,
  cliffhanger_text,
  video_review_status,
  post_status
) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'not_posted');
```

全話分 INSERT 後、`generation_jobs` を更新:

```sql
UPDATE generation_jobs SET
  video_generation_status = 'episodes_ready',
  updated_at = datetime('now')
WHERE id = ?;
```

---

## 完了条件

- `generation_jobs.prompt_review_status = 'approved'`
- `generated_videos` に `episode_count` 件のレコードが存在
- 各レコードに `episode_title`, `episode_summary`, `episode_hook`, `cliffhanger_text` が設定されている
- `generation_jobs.video_generation_status = 'episodes_ready'`
