---
name: step13-whisper-transcribe
description: Step12でウォーターマーク削除した動画からWhisperで日本語音声を文字起こしする。WSL2上のDockerコンテナ（GPU）で実行し、結果をDBに保存する。Use when Step13（Whisper文字起こし）を実行する時。
---

# Step13: Whisper文字起こし（WSL2 GPUリモート実行）

## 概要

Step12でウォーターマーク削除した動画から、OpenAI Whisperで日本語音声をテキストに変換する。

- ツール: [openai-whisper](https://github.com/openai/whisper)
- モデル: medium（日本語精度とVRAM使用量のバランス）
- 実行環境: WSL2上のDockerコンテナ（`--gpus all` でGPUパススルー）
- 接続方式: 2段SSH（gpu-remote-executeスキル参照）
- 出力: タイムスタンプ付きJSON → DBの `generated_videos.subtitles_json` に保存

## 前提条件

- Step12が完了し、ウォーターマーク削除済みの動画が `video_path` に存在すること
- gpu-remote-executeスキルのSSH接続が確認済みであること
- WSL上でDockerが利用可能で、NVIDIA Container Toolkitがインストール済みであること
- WSL上に `whisper-transcribe` Dockerイメージがビルド済みであること（初回セットアップ参照）

## 手順

### 1. 対象動画を確認する

```sql
SELECT gv.id, gv.video_path, j.series_title
FROM generated_videos gv
JOIN generation_jobs j ON j.id = gv.generation_job_id
WHERE gv.video_path IS NOT NULL
  AND gv.subtitles_json IS NULL
ORDER BY gv.id DESC;
```

### 2. Windows PCを起動する（スリープ中の場合）

gpu-remote-executeスキルのWake on LAN手順で起動し、SSH接続できることを確認する。

```bash
# Wake on LAN（ホストネットワーク経由で送信）
docker run --rm --network=host node:20-slim node -e "
const dgram = require('dgram');
const mac = '3C:7C:3F:1D:D6:FF';
const macBytes = Buffer.from(mac.replace(/:/g, ''), 'hex');
const magic = Buffer.alloc(102);
magic.fill(0xff, 0, 6);
for (let i = 0; i < 16; i++) macBytes.copy(magic, 6 + i * 6);
const sock = dgram.createSocket('udp4');
sock.once('listening', () => {
  sock.setBroadcast(true);
  sock.send(magic, 9, '255.255.255.255', (err) => {
    if (err) console.error('Error:', err.message);
    else console.log('Magic packet sent to', mac);
    sock.close();
  });
});
sock.bind();
"
# 起動待機（約60秒）
sleep 60

# SSH接続確認
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 echo "OK"
```

### 3. 動画をWSLに2段SCP転送する

```bash
# Mac miniコンテナ → 開発用コンテナ
scp -i ~/.ssh/devpc_container_ed25519 -P 2223 -o StrictHostKeyChecking=no \
  {video_path} dev@192.168.0.103:/tmp/

# 開発用コンテナ → WSL（2段SSH経由で実行）
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "scp -P 2222 -o StrictHostKeyChecking=no /tmp/{filename} runner@host.docker.internal:~/gpu-jobs/whisper-transcribe/input/"
```

### 4. WSL上のDockerコンテナでWhisper実行する

⚠️ **スリープ防止**: GPU処理中にWindowsがスリープしないよう、処理前後でスリープ制御を行う。trapにより異常終了時も自動復帰する。

```bash
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "ssh -p 2222 -o StrictHostKeyChecking=no runner@host.docker.internal \
    'PWSH=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe && \
     \$PWSH -Command \"powercfg /change standby-timeout-ac 0\" && \
     trap \"\$PWSH -Command \\\"powercfg /change standby-timeout-ac 30\\\"\" EXIT && \
     cd ~/gpu-jobs/whisper-transcribe && \
     docker run --rm --gpus all \
       -v \$(pwd)/input:/app/input \
       -v \$(pwd)/output:/app/output \
       whisper-transcribe \
       --model medium --language ja \
       /app/input/{filename}'"
```

処理時間の目安: 70秒の動画で約40〜70秒（RTX 1070 + mediumモデル）
スリープ設定は処理完了後（正常・異常問わず）に自動で30分に復帰する。

### 5. 結果（JSON）を2段SCPで取得する

Whisperは `{filename}.json` をoutputディレクトリに出力する。

```bash
# WSL → 開発用コンテナ
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "scp -P 2222 -o StrictHostKeyChecking=no runner@host.docker.internal:~/gpu-jobs/whisper-transcribe/output/{filename}.json /tmp/"

# 開発用コンテナ → Mac miniコンテナ
scp -i ~/.ssh/devpc_container_ed25519 -P 2223 -o StrictHostKeyChecking=no \
  dev@192.168.0.103:/tmp/{filename}.json /tmp/{filename}.json
```

### 6. JSON変換 & DB更新

Whisperの出力JSONからセグメント情報を抽出し、`subtitles_json` 形式に変換してDBに保存する。

```bash
# Whisper出力のsegmentsからstart/end/textを抽出
node -e "
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('/tmp/{filename}.json', 'utf8'));
const subtitles = raw.segments.map(s => ({
  start: Math.round(s.start * 100) / 100,
  end: Math.round(s.end * 100) / 100,
  text: s.text.trim()
}));
console.log(JSON.stringify(subtitles, null, 2));
" > /tmp/subtitles.json
```

```sql
UPDATE generated_videos
SET subtitles_json = '{subtitles_json_content}',
    updated_at = datetime('now')
WHERE id = {video_id};
```

### 7. AI校正（漢字誤変換の自動修正）

Whisperは音が近い漢字を誤変換しやすい（例: 「息抜き」→「駅抜き」）。Claude APIで文脈から自動校正する。人間の介入なしで完了する。

```bash
# subtitles.jsonをClaude APIで自動校正
node -e "
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const subtitles = JSON.parse(fs.readFileSync('/tmp/subtitles.json', 'utf8'));

const client = new Anthropic();
(async () => {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: \`以下はWhisper音声認識で生成した日本語字幕のJSONです。
漢字の誤変換を文脈から修正し、修正後のJSON配列をそのまま出力してください。
タイムスタンプ(start/end)は変更しないでください。テキストのみ修正してください。
修正不要ならそのまま出力してください。JSON以外は出力しないでください。

\${JSON.stringify(subtitles, null, 2)}\`
    }]
  });

  const corrected = JSON.parse(response.content[0].text);
  fs.writeFileSync('/tmp/subtitles.json', JSON.stringify(corrected, null, 2));

  // 差分表示
  for (let i = 0; i < subtitles.length; i++) {
    if (subtitles[i].text !== corrected[i].text) {
      console.log('修正:', subtitles[i].text, '→', corrected[i].text);
    }
  }
  console.log('校正完了:', corrected.length, 'segments');
})();
"
```

校正済みの `/tmp/subtitles.json` をそのままDB保存に使う（手順6のDB更新で保存）。

### 8. 結果確認

```sql
SELECT id, subtitles_json FROM generated_videos WHERE id = {video_id};
```

JSON内容を確認し、テキストとタイムスタンプが妥当であることを検証する。

## subtitles_json のフォーマット

```json
[
  {"start": 0.0, "end": 2.5, "text": "月末、二人はいつものように家計簿を開いた。"},
  {"start": 2.8, "end": 5.1, "text": "そんな余裕ないでしょ"},
  {"start": 5.5, "end": 8.2, "text": "配信開始まで、あと10分。"}
]
```

## 初回セットアップ（WSL側、1回だけ）

### 1. 作業ディレクトリ作成

```bash
# WSL上で実行
mkdir -p ~/gpu-jobs/whisper-transcribe/input
mkdir -p ~/gpu-jobs/whisper-transcribe/output
```

### 2. Dockerfile作成

```bash
cat > ~/gpu-jobs/whisper-transcribe/Dockerfile << 'EOF'
FROM nvidia/cuda:12.6.0-runtime-ubuntu24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/whisper-venv && \
    /opt/whisper-venv/bin/pip install --no-cache-dir \
    torch==2.4.1 --index-url https://download.pytorch.org/whl/cu124 && \
    /opt/whisper-venv/bin/pip install --no-cache-dir openai-whisper

ENV PATH="/opt/whisper-venv/bin:$PATH"

WORKDIR /app

ENTRYPOINT ["whisper", "--output_format", "json", "--output_dir", "/app/output"]
EOF
```

### 3. Dockerイメージビルド

```bash
cd ~/gpu-jobs/whisper-transcribe
docker build -t whisper-transcribe .
```

### 4. 動作確認

```bash
# テスト実行（GPUが正しく認識されることを確認）
docker run --rm --gpus all whisper-transcribe --help
```

## トラブルシューティング

- **CUDA out of memory**: mediumモデルは約5GB VRAM必要。RTX 1070（8GB）で十分だが、他のGPU処理が動いていないか `nvidia-smi` で確認。モデルを `small` に下げることも可能（精度は落ちる）。
- **日本語認識精度が低い**: `--language ja` が指定されていることを確認。BGMや効果音が大きい動画は精度が落ちる場合がある。
- **接続拒否**: Windows PCがスリープ中。gpu-remote-executeスキルのWake on LANで起動する。
- **Docker image not found**: WSL上で `docker images | grep whisper` を確認。無ければ初回セットアップを実行。
- **JSON出力が空**: 動画に音声トラックが含まれているか `ffprobe {video_path}` で確認。

## 介入点

なし。Whisper文字起こし → AI校正 → DB保存まで自動で完了する。
