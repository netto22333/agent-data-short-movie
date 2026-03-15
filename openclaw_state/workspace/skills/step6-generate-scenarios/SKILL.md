---
name: step6-generate-scenarios
description: pending の generation_jobs から全体シナリオ複数案を生成し、人間レビュー①を得る。Use when Step6（シナリオ生成）を実行する時。
---

# Step6: 全体シナリオ生成（人間レビュー①必須）

1. `generation_jobs` の最新 pending レコードを取得する。
2. 下記バイラル設計5要素を必ず組み込んだ全体シナリオ案を2〜3案生成する。
3. 各案を人間に提示する。
4. **人間レビュー①承認を得るまで先へ進まない。**

## バイラル設計の5要素

**① Zeigarnik効果（未解決の認知的引っかかり）**
- 毎話の最後に「解決しない問い」を仕込む
- 例: 真実が明かされる直前で終わる、返事を聞く前で終わる

**② 台詞の二重性設計**
- 第1話に登場した台詞が最終話で全く違う意味を持つ「キーフレーズ」を設定する
- 表面的なやりとりの裏に真の感情を隠す

**③ 感情アーク設計**
- シリーズ全体の感情の波を明示（例: 不安→疑念→衝撃→解放）
- `emotion_target`（DBの値）を軸に各話の感情の振れ幅を最大化する

**④ コメント促進設計**
- 「どっちだと思う？」と議論したくなる曖昧な要素を入れる
- 主人公の判断に道徳的グレーゾーンを1か所設ける

**⑤ 冒頭3秒フック**
- 説明なし・挨拶なし・直接最も引きつけるシーンから始める
- 「誰が・どんな立場で・何が起きているか」が3秒で伝わる設計
- `hook_pattern_name` と `hook_template` をそのまま反映させる

## DB取得クエリ

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

## Claudeへの依頼プロンプト

```
以下の情報を元に、AIショートドラマシリーズの全体シナリオ案を2〜3案生成してください。

【状況】{situation_text}
【物語タイプ】{story_type_name}
【フックパターン】{hook_pattern_name}: {hook_template}
【ターゲット感情】{emotion_target}
【話数】{episode_count}話
【各話の長さ】{duration_sec}秒

【バイラル設計の必須要件】
1. 感情アーク: 各話で視聴者の感情が必ず動くよう設計し、全体の感情の波（例: 不信→衝撃→葛藤→解放）を明示すること
2. Zeigarnik終わり: 各話の終わりは「最も気になる瞬間」で切る。答えを出さない
3. 台詞のリフレイン: 第1話に登場した台詞が最終話で全く別の意味を持つ「キーフレーズ」を1つ設定すること
4. コメント設計: 「主人公の判断は正しいか？」と視聴者が議論したくなる道徳的グレーゾーンを1か所入れること
5. 冒頭フック: 第1話の冒頭は説明・挨拶なし。最も引きつけるシーンから直接始めること
6. 日常の絶妙なズレ: 「現実でありえそうだが実際にはなかなか起こらない」線を狙うこと

各案に以下を含めてください:
- series_title: シリーズタイトル
- series_summary: シリーズ概要（100字程度）
- series_outline: 全話の流れ（各話1〜2行）
- emotion_arc: 感情の波（各話でどんな感情を引き出すか、例: 第1話:不安, 第2話:疑念, ...）
- dialogue_motif: 台詞リフレイン用のキーフレーズ（第1話での意味 / 最終話での意味の変化を明記）
- cliffhanger_design: 各話のクリフハンガー配置（各話の終わり方の一文）
- hook: 第1話の冒頭フック（視聴者を引きつける一文、説明・挨拶なし）
```

## 介入点

- シナリオ案の選択・修正・却下を受け付ける。
- 承認後、次ステップ（step7-save-approved）へ渡す。

## 出力

- 承認済みシナリオ案（`series_title` / `series_summary` / `series_outline` / `prompt_text` / `emotion_arc` / `dialogue_motif` / `cliffhanger_design`）
