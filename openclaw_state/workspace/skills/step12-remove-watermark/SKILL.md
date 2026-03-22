---
name: step12-remove-watermark
description: Step11でダウンロードした動画からSora 2のウォーターマークをWSL2上のDockerコンテナ（GPU）で除去する。Use when Step12（ウォーターマーク削除）を実行する時。
---

# Step12: ウォーターマーク削除（WSL2 GPUリモート実行）

## 概要

Step11でダウンロードした動画に含まれるSora 2のウォーターマークを、Windows PC（WSL2 + RTX 1070）上のDockerコンテナで除去する。

- ツール: [Sora2WatermarkRemover](https://github.com/GitHub30/Sora2WatermarkRemover)
- 実行環境: WSL2上のDockerコンテナ（`--gpus all` でGPUパススルー）
- 接続方式: 2段SSH（gpu-remote-executeスキル参照）

## 前提条件

- Step11が完了し、動画ファイルが保存済みであること
- gpu-remote-executeスキルのSSH接続が確認済みであること
- WSL上でDockerが利用可能で、NVIDIA Container Toolkitがインストール済みであること
- WSL上の `~/gpu-jobs/Sora2WatermarkRemover/` にリポジトリがclone済みであること（初回セットアップ参照）

## 手順

### 1. 対象動画を確認する

```sql
SELECT gv.id, gv.video_path, j.series_title
FROM generated_videos gv
JOIN generation_jobs j ON j.id = gv.generation_job_id
WHERE j.video_generation_status = 'video_ready'
  AND gv.video_path IS NOT NULL
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
  "scp -P 2222 -o StrictHostKeyChecking=no /tmp/{filename} runner@host.docker.internal:~/gpu-jobs/Sora2WatermarkRemover/input/"
```

### 4. WSL上のDockerコンテナでウォーターマーク削除を実行する

⚠️ **スリープ防止**: GPU処理中にWindowsがスリープしないよう、処理前後でスリープ制御を行う。trapにより異常終了時も自動復帰する。

```bash
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "ssh -p 2222 -o StrictHostKeyChecking=no runner@host.docker.internal \
    'PWSH=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe && \
     \$PWSH -Command \"powercfg /change standby-timeout-ac 0\" && \
     trap \"\$PWSH -Command \\\"powercfg /change standby-timeout-ac 30\\\"\" EXIT && \
     cd ~/gpu-jobs/Sora2WatermarkRemover && \
     docker run --rm --gpus all \
       -v \$(pwd)/input:/app/input \
       -v \$(pwd)/output:/app/output \
       sora2-watermark-remover \
       python remwm.py /app/input/{filename} /app/output/{filename}'"
```

- Dockerコンテナ内で処理するため、WSLのホスト環境にPython/condaは不要
- `--gpus all` でRTX 1070をコンテナにパススルー
- スリープ設定は処理完了後（正常・異常問わず）に自動で30分に復帰する

### 5. 処理済み動画を2段SCPで取得する

```bash
# WSL → 開発用コンテナ
ssh -i ~/.ssh/devpc_container_ed25519 -p 2223 -o StrictHostKeyChecking=no dev@192.168.0.103 \
  "scp -P 2222 -o StrictHostKeyChecking=no runner@host.docker.internal:~/gpu-jobs/Sora2WatermarkRemover/output/{filename} /tmp/"

# 開発用コンテナ → Mac miniコンテナ
scp -i ~/.ssh/devpc_container_ed25519 -P 2223 -o StrictHostKeyChecking=no \
  dev@192.168.0.103:/tmp/{filename} {output_video_path}
```

### 6. DB更新

```sql
UPDATE generated_videos
SET video_path = '{output_video_path}',
    updated_at = datetime('now')
WHERE generation_job_id = {job_id} AND episode_no = 1;
```

### 7. 目視確認

noVNC またはローカルで出力動画を再生し、ウォーターマークが除去されていることを確認する。

## 初回セットアップ（WSL側、1回だけ）

### 1. NVIDIA Container Toolkit の確認

```bash
# WSL上で確認
nvidia-smi  # GPUが見えること
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi  # Docker内からGPUが見えること
```

### 2. リポジトリclone & Dockerイメージビルド

```bash
# WSL上で実行
mkdir -p ~/gpu-jobs
cd ~/gpu-jobs
git clone https://github.com/GitHub30/Sora2WatermarkRemover.git
cd Sora2WatermarkRemover
mkdir -p input output

# Dockerイメージをビルド
docker build -t sora2-watermark-remover .
```

もし `Dockerfile` がリポジトリに無い場合は以下を作成:

```dockerfile
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3 python3-pip git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt
COPY . .

ENTRYPOINT []
```

## トラブルシューティング

- **docker: Error response from daemon: could not select device driver**:
  NVIDIA Container Toolkit未インストール。WSL上で `sudo apt install -y nvidia-container-toolkit && sudo systemctl restart docker`
- **CUDA out of memory**: RTX 1070は8GB VRAM。他のGPU処理が動いていないか `nvidia-smi` で確認。
- **接続拒否**: Windows PCがスリープ中。gpu-remote-executeスキルのWake on LANで起動する。
- **Docker image not found**: WSL上で `docker images | grep sora2` を確認。無ければ初回セットアップを実行。

## 介入点

- 出力動画の品質を目視確認する。
- ウォーターマークが残っている場合はパラメータ調整して再実行。
