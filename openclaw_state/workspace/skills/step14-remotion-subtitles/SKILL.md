---
name: step14-remotion-subtitles
description: Step13の文字起こし結果を使い、Remotionで動画に字幕をオーバーレイしてレンダリングする。Mac miniコンテナ内で実行する。Use when Step14（Remotion字幕合成）を実行する時。
---

# Step14: Remotion字幕合成（Mac miniコンテナ実行）

## 概要

Step13でWhisper文字起こしした結果を使い、動画に字幕（テレビ字幕風の白文字 + 黒縁取り）をオーバーレイした動画を出力する。

- ツール: [Remotion](https://www.remotion.dev/)
- 実行環境: Mac miniコンテナ内（GPU不要）
- 字幕スタイル: 画面下部中央、白文字 + 黒縁取り、Noto Sans JP
- プロジェクト: `workspace/remotion-subtitles/`（既存の `remotion-props/` と同階層）

## 前提条件

- Step13が完了し、`generated_videos.subtitles_json` にデータが保存済みであること
- Mac miniコンテナ内に `remotion-subtitles` プロジェクトがセットアップ済みであること（初回セットアップ参照）

## 手順

### 1. DBから対象動画と字幕データを取得する

```sql
SELECT gv.id, gv.video_path, gv.subtitles_json, j.series_title
FROM generated_videos gv
JOIN generation_jobs j ON j.id = gv.generation_job_id
WHERE gv.subtitles_json IS NOT NULL
  AND gv.video_review_status = 'pending'
ORDER BY gv.id DESC;
```

### 2. propsファイルを作成する

```bash
# subtitles_jsonとvideo_pathからpropsファイルを生成
node -e "
const subtitles = {subtitles_json};
const props = {
  videoPath: '{absolute_video_path}',
  subtitles: subtitles
};
require('fs').writeFileSync('/tmp/subtitle-props.json', JSON.stringify(props, null, 2));
console.log('Props written:', JSON.stringify(props, null, 2));
"
```

### 3. Remotionでレンダリングする

```bash
cd ~/openclaw_state/workspace/remotion-subtitles

npx remotion render SubtitleComposition \
  --props=/tmp/subtitle-props.json \
  /tmp/output-with-subtitles.mp4
```

レンダリング時間の目安: 60秒の動画で約2〜5分（CPU依存）

### 4. 出力動画を保存する

```bash
# workspace/videosに保存
cp /tmp/output-with-subtitles.mp4 ~/openclaw_state/workspace/videos/{job_id}_ep{episode_no}_subtitled.mp4
```

### 5. DB更新

```sql
UPDATE generated_videos
SET video_path = 'workspace/videos/{job_id}_ep{episode_no}_subtitled.mp4',
    updated_at = datetime('now')
WHERE id = {video_id};
```

### 6. 目視確認

noVNC またはローカルで出力動画を再生し、字幕の表示タイミングと可読性を確認する。

## 初回セットアップ（Mac miniコンテナ、1回だけ）

### 1. プロジェクト作成

```bash
mkdir -p ~/openclaw_state/workspace/remotion-subtitles/src
cd ~/openclaw_state/workspace/remotion-subtitles
```

### 2. package.json

```bash
cat > package.json << 'EOF'
{
  "name": "remotion-subtitles",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "remotion render SubtitleComposition out.mp4"
  },
  "dependencies": {
    "@remotion/cli": "4.0.261",
    "@remotion/player": "4.0.261",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.261"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "typescript": "^5.7.2"
  }
}
EOF
```

### 3. remotion.config.ts

```bash
cat > remotion.config.ts << 'EOF'
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
EOF
```

### 4. src/Root.tsx

```bash
cat > src/Root.tsx << 'EOF'
import {Composition, staticFile} from 'remotion';
import {SubtitleComposition, SubtitleProps} from './SubtitleComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SubtitleComposition"
        component={SubtitleComposition}
        durationInFrames={30 * 60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoPath: '',
          subtitles: [],
        } satisfies SubtitleProps}
        calculateMetadata={async ({props}) => {
          // 動画の長さに合わせてdurationを動的に設定
          // subtitlesの最後のendタイムスタンプから計算
          const lastSubtitle = props.subtitles[props.subtitles.length - 1];
          const durationSec = lastSubtitle ? lastSubtitle.end + 1 : 60;
          return {
            durationInFrames: Math.ceil(durationSec * 30),
          };
        }}
      />
    </>
  );
};
EOF
```

### 5. src/SubtitleComposition.tsx

```bash
cat > src/SubtitleComposition.tsx << 'EOF'
import {AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';
import React from 'react';

type Subtitle = {
  start: number;
  end: number;
  text: string;
};

export type SubtitleProps = {
  videoPath: string;
  subtitles: Subtitle[];
};

export const SubtitleComposition: React.FC<SubtitleProps> = ({videoPath, subtitles}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTime = frame / fps;

  const currentSubtitle = subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoPath} />

      {currentSubtitle && (
        <div
          style={{
            position: 'absolute',
            bottom: 160,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 40px',
          }}
        >
          <span
            style={{
              fontFamily: '"Noto Sans JP", sans-serif',
              fontSize: 48,
              fontWeight: 700,
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.4,
              WebkitTextStroke: '2px #000000',
              paintOrder: 'stroke fill',
              textShadow: '3px 3px 6px rgba(0, 0, 0, 0.8)',
            }}
          >
            {currentSubtitle.text}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
EOF
```

### 6. 依存インストール

```bash
cd ~/openclaw_state/workspace/remotion-subtitles
npm install
```

### 7. 動作確認

```bash
# テストレンダリング（短い動画で確認）
npx remotion render SubtitleComposition \
  --props='{"videoPath":"/path/to/test.mp4","subtitles":[{"start":0,"end":3,"text":"テスト字幕"}]}' \
  /tmp/test-output.mp4
```

## 字幕スタイル仕様

| 項目 | 値 |
|------|-----|
| 位置 | 画面下部中央（bottom: 160px） |
| フォント | Noto Sans JP |
| フォントサイズ | 48px |
| フォントウェイト | 700 (Bold) |
| 文字色 | 白（#FFFFFF） |
| 縁取り | 黒 2px（WebkitTextStroke） |
| 影 | 黒 3px 3px 6px 80%透過 |
| 描画順 | stroke → fill（paintOrder） |

## トラブルシューティング

- **フォントが表示されない**: Mac miniコンテナのDockerfileで `fonts-noto-cjk` がインストール済み。`fc-list | grep Noto` で確認。
- **レンダリングが遅い**: CPUのみで処理するため、60秒の動画で2〜5分かかる。正常動作。
- **動画が読み込めない**: `videoPath` が絶対パスであることを確認。Remotionは相対パスを解決できない場合がある。
- **字幕のタイミングがずれる**: Step13のWhisper出力のタイムスタンプを確認。ずれが大きい場合はWhisperのモデルを `large` に変更して再実行。
- **npm install エラー**: Node.js 22 + npm が必要。コンテナ内で `node -v` を確認。

## 介入点

- 出力動画で字幕の表示・タイミングを目視確認する。
- 字幕の位置やフォントサイズを調整する場合は `SubtitleComposition.tsx` のスタイルを変更する。
- 字幕テキストに誤りがある場合はDBの `subtitles_json` を手動修正してから再レンダリングする。
