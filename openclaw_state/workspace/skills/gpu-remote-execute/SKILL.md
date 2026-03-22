---
name: gpu-remote-execute
description: Windows PC（WSL2 + GPU）にSSH接続し、Dockerコンテナ内でGPU処理を実行する。WSL環境を汚染せず、使い捨てコンテナでウォーターマーク削除やAI推論等のGPU処理を委譲する。Use when GPU処理が必要な時。
---

# GPU リモート実行（Windows PC / WSL2 + Docker）

## 概要

Mac mini上のコンテナからGPUは使えない（Docker Desktop for MacはGPUパススルー非対応）。
GPUが必要な処理は、Windows PC（WSL2 + RTX 1070）にSSH接続し、**必ずDockerコンテナ内で**実行する。

⚠️ **重要ルール: WSL環境を直接汚染しない**
- GPU処理はすべてDockerコンテナ内で実行すること
- WSLホストには`pip install`や依存パッケージのインストールを行わない
- 作業ファイルの受け渡しは `~/gpu-jobs/` をバインドマウントして行う

## 構成

```
Mac mini (コンテナ)
  → SSH (port 2223) → Windows PC 開発用コンテナ
    → SSH (port 2222) → WSL2 (Ubuntu)
      → docker run --gpus all → GPUコンテナ内で処理実行
```

## 接続情報

| 項目 | 値 |
|------|-----|
| Windows PC IP | 192.168.0.103 |
| 開発用コンテナ SSH | port 2223, user: dev |
| WSL SSH | port 2222, user: runner (host.docker.internal経由) |
| SSH鍵 | ~/.ssh/devpc_container_ed25519 |
| GPU | NVIDIA RTX 1070 (8GB VRAM) |
| 作業ディレクトリ | ~/gpu-jobs/ (WSLホスト側、マウント用) |

## 手順

### 0. Windows PCの起動（スリープ中の場合）

⚠️ コンテナのbridgeネットワークからはLANブロードキャストが届かないため、`--network=host` でホストネットワークから送信する。

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
```

### 1. 開発用コンテナへSSH

```bash
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103
```

### 2. 開発用コンテナ → WSLへSSH

```bash
ssh -p 2222 -o StrictHostKeyChecking=no runner@host.docker.internal
```

### 3. WSL上でGPUコンテナを起動して処理実行

⚠️ **WSLホスト上で直接 python 等を実行しない。必ず Docker コンテナ内で行う。**

```bash
# GPU確認（コンテナ内で）
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi

# 処理実行（~/gpu-jobs/ をマウントして使い捨てコンテナで実行）
docker run --rm --gpus all \
  -v ~/gpu-jobs:/workspace \
  {gpu-image} \
  {command}
```

## GPUコンテナイメージ

処理ごとに専用のDockerイメージを用意する。WSLホストにはDockerイメージのみが残り、環境を汚さない。

### ウォーターマーク削除用イメージ

```dockerfile
# ~/gpu-jobs/Sora2WatermarkRemover/Dockerfile
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt
COPY . .

ENTRYPOINT ["python3", "remwm.py"]
```

```bash
# イメージのビルド（初回のみ）
cd ~/gpu-jobs/Sora2WatermarkRemover
docker build -t sora2-watermark-remover .
```

### 汎用GPU処理用イメージ

```bash
# PyTorch + CUDA の公式イメージをベースに使う
# 一時的な処理はこのイメージで十分
docker run --rm --gpus all \
  -v ~/gpu-jobs:/workspace \
  pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime \
  python3 /workspace/script.py
```

## 一括実行（SSHトンネル経由）

2段SSHをワンライナーで実行する場合:

```bash
# コンテナ内でGPU処理を実行
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "ssh -p 2222 -o StrictHostKeyChecking=no runner@host.docker.internal \
    'docker run --rm --gpus all -v ~/gpu-jobs:/workspace {gpu-image} {command}'"
```

## ファイル転送

### コンテナ → WSLへファイルを送る

```bash
# SCP 2段転送（コンテナ→開発用コンテナ→WSL）
scp -i ~/.ssh/devpc_container_ed25519 -P 2223 {local_file} dev@192.168.0.103:/tmp/
# 開発用コンテナ内から:
scp -P 2222 /tmp/{file} runner@host.docker.internal:~/gpu-jobs/
```

### WSL → コンテナへファイルを取得

```bash
# 逆方向
scp -P 2222 runner@host.docker.internal:~/gpu-jobs/{output_file} /tmp/
# 開発用コンテナ→Mac miniコンテナ
scp -P 2223 dev@192.168.0.103:/tmp/{output_file} {local_path}
```

## ユースケース例

### ウォーターマーク削除（Step12）

```bash
# 1. 動画をWSLに転送（上記ファイル転送を参照）

# 2. WSL上でコンテナ実行:
docker run --rm --gpus all \
  -v ~/gpu-jobs:/workspace \
  sora2-watermark-remover \
  /workspace/video.mp4 /workspace/video_clean.mp4

# 3. 結果を取得（上記ファイル転送を参照）
```

### その他のGPU処理

| 処理 | 推奨イメージ | 実行例 |
|------|-------------|--------|
| Whisper音声認識 | `onerahmet/openai-whisper-asr-webservice` | `docker run --rm --gpus all -v ~/gpu-jobs:/workspace ...` |
| 動画エンコード (NVENC) | `jrottenberg/ffmpeg:4.4-nvidia2004` | `docker run --rm --gpus all -v ~/gpu-jobs:/workspace ...` |
| 汎用PyTorch推論 | `pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime` | `docker run --rm --gpus all -v ~/gpu-jobs:/workspace ...` |

## トラブルシューティング

- **接続拒否**: Windows PCがスリープ中。Wake on LANで起動する。
- **kex_exchange_identification エラー**: WSL側のsshdが起動していない。WSL内で `sudo /usr/sbin/sshd` を実行（systemctlが使えない場合）。
- **2222ポートが応答しない**: WSL側で `sudo ss -lntp | grep 2222` でlistenを確認。
- **GPU not found**: `docker run` に `--gpus all` フラグを忘れていないか確認。`nvidia-smi` はコンテナ内で実行して確認。
- **Docker daemon not running**: WSL内で `sudo service docker start` を実行。
- **イメージが見つからない**: 初回は `docker build` または `docker pull` が必要。

## 事前セットアップ（WSL側、初回のみ）

```bash
# SSH鍵の配置
mkdir -p ~/.ssh
# authorized_keys に公開鍵を追加

# sshdの設定（Port 2222）
sudo apt install -y openssh-server
echo -e "Port 2222\nListenAddress 0.0.0.0" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart ssh

# Docker + NVIDIA Container Toolkit のインストール
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
sudo apt install -y docker.io nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
sudo usermod -aG docker $USER

# 作業ディレクトリ（ホスト側マウントポイント）
mkdir -p ~/gpu-jobs
```
