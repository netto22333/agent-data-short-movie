---
name: step3-generate-situation
description: event_name に対して DB から story_type を自動選定し、hook_pattern を任意で選択、ビジュアルフックの方向性を決定する。Use when Step3（ストーリータイプ・フックパターン選定）を実行する時。
---

# Step3: ストーリータイプ・フックパターン選定

1. 確定済み `event_name` を受け取る。
2. DBクエリを実行する:
   - `SELECT * FROM story_types WHERE is_active=1`
   - `SELECT * FROM hook_patterns WHERE is_active=1`
3. `event_name` に合う `story_type_id` を自動選定する。
4. `hook_pattern_id` は**任意選択**とする。`event_name` に最適なものを自動で選択する（不要と判断した場合はNULL）。
5. **ビジュアルフック（Visual Hook）の方向性**を自動決定する:
   - 「冒頭3秒で目を引く映像的な掴み」のアイデアを1案決定
6. 自動で確定し、次ステップへ進む。

## hook_patternの扱い

- hook_patternは**参考パターン**の位置づけ。選択は任意。
- 選択した場合も「このパターンはあくまで雰囲気の参考。映像で表現可能な形にアレンジすること」が前提。
- hook_patternのテンプレート（「{人物A}は{人物B}の{秘密}を知ってしまった」等）に忠実に従う必要はない。

## ビジュアルフック（Visual Hook）

- **必須**: 冒頭3秒で視聴者を掴む映像的な掴みの方向性を決める。
- 言語的フック（「実は…」「知ってたのに…」）ではなく、**映像で表現する掴み**を設計する。
- 具体的な映像イメージ（構図・ライティング・動き）で記述する。

## 制約

- 選定理由にストーリー展開の詳細は書かない（それは Step4 の仕事）。
- 「このイベントにはこの型が合う」という構造的な判断のみ行う。
- ビジュアルフックはあくまで方向性の提案。具体化はStep6で行う。

## 自動処理

- すべて自動選定し、次ステップ（step4-select-type）へ渡す。

## 出力

- `story_type_id`: 確定済みストーリータイプID
- `hook_pattern_id`: 確定済みフックパターンID（「なし」の場合はNULL）
- `visual_hook_direction`: ビジュアルフックの方向性メモ（Step6で参照）
