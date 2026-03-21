---
name: gpu-remote-execute
description: Windows PC（WSL2 + GPU）にSSH接続してGPUを使う処理を実行する。ウォーターマーク削除やAI推論など、ローカルコンテナでは実行できないGPU処理を委譲する。Use when GPU処理が必要な時。
---

# GPU リモート実行（Windows PC / WSL2）

## 概要

Mac mini上のコンテナからGPUは使えない（Docker Desktop for MacはGPUパススルー非対応）。
GPUが必要な処理は、Windows PC（WSL2 + RTX 1070）にSSH接続して実行する。

## 構成

```
Mac mini (コンテナ)
  → SSH (port 2223) → Windows PC 開発用コンテナ
    → SSH (port 2222) → WSL2 (Ubuntu + GPU)
      → GPU処理実行
```

## 接続情報

| 項目 | 値 |
|------|-----|
| Windows PC IP | 192.168.0.103 |
| 開発用コンテナ SSH | port 2223, user: dev |
| WSL SSH | port 2222, user: runner (host.docker.internal経由) |
| SSH鍵 | ~/.ssh/devpc_container_ed25519 |
| GPU | NVIDIA RTX 1070 (8GB VRAM) |

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

### 3. WSL上でGPU処理を実行

⚠️ SSH経由では `.bashrc` が読まれないため、GPU関連コマンドはPATH追加が必要。

```bash
export PATH=$PATH:/usr/lib/wsl/lib:/usr/local/cuda/bin
# GPU確認
nvidia-smi

# 例: ウォーターマーク削除
cd ~/gpu-jobs
python remwm.py input.mp4 output.mp4
```

## 一括実行（SSHトンネル経由）

2段SSHをワンライナーで実行する場合:

```bash
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "ssh -p 2222 -o StrictHostKeyChecking=no runner@host.docker.internal 'export PATH=\$PATH:/usr/lib/wsl/lib:/usr/local/cuda/bin; {command}'"
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
# 1. 動画をWSLに転送
# 2. WSL上で実行:
cd ~/gpu-jobs/Sora2WatermarkRemover
python remwm.py ~/gpu-jobs/video.mp4 ~/gpu-jobs/video_clean.mp4
# 3. 結果を取得
```

### その他のGPU処理

- AI推論（Whisper音声認識、画像生成等）
- 動画エンコード（NVENC）
- 機械学習モデルの実行

## トラブルシューティング

- **接続拒否**: Windows PCがスリープ中。Wake on LANで起動する。
- **kex_exchange_identification エラー**: WSL側のsshdが起動していない。WSL内で `sudo /usr/sbin/sshd` を実行（systemctlが使えない場合）。
- **2222ポートが応答しない**: WSL側で `sudo ss -lntp | grep 2222` でlistenを確認。
- **GPU not found**: WSLでdocker経由の場合 `--gpus all` フラグが必要。ネイティブ実行なら `nvidia-smi` で確認。

## 事前セットアップ（WSL側、初回のみ）

```bash
# SSH鍵の配置
mkdir -p ~/.ssh
# authorized_keys に公開鍵を追加

# sshdの設定（Port 2222）
sudo apt install -y openssh-server
echo -e "Port 2222\nListenAddress 0.0.0.0" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart ssh

# GPU処理環境
mkdir -p ~/gpu-jobs
```
