#!/usr/bin/env node
/**
 * Sora 2 自動動画生成 — CDPブラウザ操作
 *
 * DBから sora2_prompts_json を取得し、Sora 2で
 * Initial生成 + Extend×(clip数-1) + ダウンロードを自動化する。
 *
 * フロー:
 *   1. draftsページにアクセス
 *   2. clip1プロンプト入力 → Duration 15s → Generate → 完了待機
 *   3. 完了した動画ページでそのままExtend → 次のclipプロンプト → Generate → 完了待機
 *   4. プロンプトがなくなったらダウンロード
 *   5. DB更新
 *
 * Usage:
 *   node scripts/sora2-generate-cdp.mjs --job-id=1
 *   node scripts/sora2-generate-cdp.mjs --job-id=1 --cdp=http://127.0.0.1:18803 --output-dir=workspace/videos/ep1
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// better-sqlite3 は /app/node_modules にあるためcreateRequireで解決
const require = createRequire('/app/package.json');
const Database = require('better-sqlite3');

// --- CLI args ---
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const jobId     = Number(args['job-id']);
const cdp       = args.cdp || 'http://127.0.0.1:18803';
const outputDir = args['output-dir'] || '/home/node/.openclaw/workspace/videos/ep1';
const dbPath    = process.env.DB_PATH || '/home/node/.openclaw/short-movie.db';

if (!jobId) {
  console.error('Usage: node scripts/sora2-generate-cdp.mjs --job-id=<id>');
  process.exit(1);
}

// --- Constants ---
const SORA_URL = 'https://sora.chatgpt.com/drafts';
const POLL_INTERVAL_MS = 60000;   // 1分ごとにポーリング
const POLL_TIMEOUT_MS  = 600000;  // 10分タイムアウト
const WAIT_AFTER_NAV_MS = 5000;   // ページ遷移後の待機
const WAIT_AFTER_ACTION_MS = 2000; // アクション後の短い待機

// --- HTTP helper ---
function httpReq(u, method = 'GET') {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname, search } = new URL(u);
    const req = http.request({ hostname, port, path: pathname + search, method }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

// --- Sleep helper ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- DB helpers ---
function getPromptsFromDB() {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.prepare(`
      SELECT gv.sora2_prompts_json
      FROM generated_videos gv
      WHERE gv.generation_job_id = ? AND gv.episode_no = 1
    `).get(jobId);
    if (!row?.sora2_prompts_json) {
      throw new Error(`job_id=${jobId} の sora2_prompts_json が見つかりません。step10を先に実行してください。`);
    }
    return JSON.parse(row.sora2_prompts_json);
  } finally {
    db.close();
  }
}

function updateVideoDB(videoPath) {
  const db = new Database(dbPath);
  try {
    db.prepare(`
      UPDATE generated_videos
      SET video_path = ?, video_review_status = 'pending', updated_at = datetime('now')
      WHERE generation_job_id = ? AND episode_no = 1
    `).run(videoPath, jobId);

    db.prepare(`
      UPDATE generation_jobs
      SET video_generation_status = 'video_ready', updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
  } finally {
    db.close();
  }
}

// --- CDP wrapper ---
class CDPSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.msgId = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }

  async ready() {
    await new Promise((r) => (this.ws.onopen = r));
  }

  send(method, params = {}) {
    return new Promise((res) => {
      const id = ++this.msgId;
      this.pending.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r?.result?.exceptionDetails) {
      throw new Error(`evaluate error: ${JSON.stringify(r.result.exceptionDetails)}`);
    }
    return r?.result?.result?.value;
  }

  async click(x, y) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
  }

  async setDownloadBehavior(downloadPath) {
    await this.send('Browser.setDownloadBehavior', {
      behavior: 'allowAndName',
      downloadPath,
      eventsEnabled: true,
    });
  }

  close() {
    this.ws.close();
  }
}

// ===========================================================
// Sora 2 UI セレクタ・操作関数
// ===========================================================
// ⚠️ Sora 2のUIは動的に変更される可能性あり。
//    セレクタが合わない場合は noVNC で実際のDOMを確認し修正すること。

/** プロンプト入力欄にテキストを設定する */
const SET_PROMPT_EXPR = (text) => `(() => {
  const textarea = document.querySelector('textarea[placeholder], div[contenteditable="true"]');
  if (!textarea) return false;
  if (textarea.tagName === 'TEXTAREA') {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(textarea, ${JSON.stringify(text)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    textarea.innerText = ${JSON.stringify(text)};
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return true;
})()`;

/** Settings（プロンプト横のスライダーアイコン）を開いてDuration 15sを選択する。
 *  CDPのマウスクリックを使うため、session経由で呼ぶ。 */
async function selectDuration15s(session) {
  // 1. プロンプトエリア横のSettingsボタン座標を取得してマウスクリック
  const coords = await session.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label="Settings"][aria-haspopup="menu"]'));
    const btn = btns.find(b => b.getBoundingClientRect().width <= 40);
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!coords) return 'no settings btn';
  await session.click(coords.x, coords.y);
  await sleep(2000);

  // 2. Durationメニューアイテムをマウスクリック
  const durCoords = await session.evaluate(`(() => {
    const items = document.querySelectorAll('[role="menuitem"]');
    const dur = Array.from(items).find(el => el.innerText.includes('Duration'));
    if (!dur) return null;
    const r = dur.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!durCoords) return 'no duration item';
  await session.click(durCoords.x, durCoords.y);
  await sleep(2000);

  // 3. 「15 seconds」をマウスクリック
  const radio15Coords = await session.evaluate(`(() => {
    const radios = document.querySelectorAll('[role="menuitemradio"]');
    const r15 = Array.from(radios).find(el => el.innerText.includes('15'));
    if (!r15) return null;
    const r = r15.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!radio15Coords) return 'no 15s option';
  await session.click(radio15Coords.x, radio15Coords.y);
  await sleep(1000);

  return 'ok';
}

/** 「Create video」ボタンをクリックする */
const CLICK_CREATE_VIDEO_EXPR = `(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const btn = btns.find(el => {
    const t = el.textContent.trim().toLowerCase();
    return t === 'create video' || t === 'create';
  });
  if (btn && !btn.disabled) { btn.click(); return true; }
  return false;
})()`;


/** 生成完了を確認する */
const CHECK_GENERATION_DONE_EXPR = `(() => {
  const video = document.querySelector('video[src], video source[src]');
  const progress = document.querySelector('[role="progressbar"], .progress');
  if (video && !progress) return 'done';
  if (progress) return 'generating';
  return 'unknown';
})()`;

/** 生成完了後: 動画クリック → Edit → Extend の3ステップでエディタに入る */
async function navigateToExtend(session) {
  // 1. draftsページにいる場合、生成された動画（videoタグ）をクリック → 詳細ページ (/d/...)
  const videoCoords = await session.evaluate(`(() => {
    const video = document.querySelector('video');
    if (!video) return null;
    const r = video.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!videoCoords) throw new Error('動画が見つかりません。noVNCで確認してください。');
  await session.click(videoCoords.x, videoCoords.y);
  await sleep(3000);

  // 2. 詳細ページで「Edit」ボタンをクリック → エディタページ (/e/...)
  const editCoords = await session.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const edit = btns.find(b => b.textContent.trim() === 'Edit' && b.offsetParent !== null);
    if (!edit) return null;
    const r = edit.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!editCoords) throw new Error('Editボタンが見つかりません。noVNCで確認してください。');
  await session.click(editCoords.x, editCoords.y);
  await sleep(3000);

  // 3. エディタページで「Extend」ボタンをクリック
  const extCoords = await session.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ext = btns.find(b => b.textContent.trim() === 'Extend' && b.offsetParent !== null);
    if (!ext) return null;
    const r = ext.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!extCoords) throw new Error('Extendボタンが見つかりません。noVNCで確認してください。');
  await session.click(extCoords.x, extCoords.y);
  await sleep(2000);
}

/** 3点ドットメニュー → Download でダウンロードする */
async function downloadVideo(session) {
  // 1. エディタからdraftsに戻る
  await session.navigate(SORA_URL);
  await sleep(WAIT_AFTER_NAV_MS);

  // 2. 最新の動画をクリックして詳細ページへ
  const vCoords = await session.evaluate(`(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    const r = v.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!vCoords) return false;
  await session.click(vCoords.x, vCoords.y);
  await sleep(3000);

  // 3. 3点ドットメニューをクリック（aria-haspopup="menu" + テキスト空 + SVG付き）
  const dotCoords = await session.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-haspopup="menu"]'));
    const dot = btns.find(b => b.textContent.trim() === '' && b.querySelector('svg') && b.offsetParent !== null);
    if (!dot) return null;
    const r = dot.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!dotCoords) return false;
  await session.click(dotCoords.x, dotCoords.y);
  await sleep(2000);

  // 4. 「Download」メニューアイテムをクリック
  const dlCoords = await session.evaluate(`(() => {
    const items = document.querySelectorAll('[role="menuitem"]');
    const dl = Array.from(items).find(el => el.textContent.includes('Download'));
    if (!dl) return null;
    const r = dl.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  if (!dlCoords) return false;
  await session.click(dlCoords.x, dlCoords.y);
  return true;
}

// ===========================================================
// メインフロー
// ===========================================================
async function main() {
  console.log(`[step11] job_id=${jobId} のSora 2自動動画生成を開始`);

  // 1. DBからプロンプト取得
  const prompts = getPromptsFromDB();
  const clipKeys = Object.keys(prompts).sort(); // clip1, clip2, clip3, clip4...
  console.log(`[step11] ${clipKeys.length}クリップのプロンプトを取得: ${clipKeys.join(', ')}`);

  // 2. 出力ディレクトリ作成
  const absOutputDir = path.resolve(outputDir);
  fs.mkdirSync(absOutputDir, { recursive: true });

  // 3. CDPタブ作成
  const tab = JSON.parse(await httpReq(`${cdp}/json/new?${encodeURIComponent(SORA_URL)}`, 'PUT'));
  console.log(`[step11] CDPタブ作成: ${tab.id}`);

  const session = new CDPSession(tab.webSocketDebuggerUrl);
  await session.ready();
  await session.setDownloadBehavior(absOutputDir);

  try {
    // 4. Sora 2 draftsページへ遷移
    await session.navigate(SORA_URL);
    await sleep(WAIT_AFTER_NAV_MS);
    console.log(`[step11] Sora 2 draftsページにアクセス完了`);

    // 5. クリップを順番に処理
    for (const [i, key] of clipKeys.entries()) {
      const clipNo = i + 1;
      const clipPrompt = prompts[key];
      const isInitial = i === 0;

      console.log(`[step11] === Clip${clipNo} (${isInitial ? 'Initial生成' : 'Extend'}) ===`);

      if (!isInitial) {
        if (i === 1) {
          // 初回Extend: draftsから 動画クリック → Edit → Extend
          await navigateToExtend(session);
        } else {
          // 2回目以降: エディタに留まっているのでExtendボタンを直接クリック
          const extCoords = await session.evaluate(`(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const ext = btns.find(b => b.textContent.trim() === 'Extend' && b.offsetParent !== null);
            if (!ext) return null;
            const r = ext.getBoundingClientRect();
            return { x: r.left + r.width/2, y: r.top + r.height/2 };
          })()`);
          if (!extCoords) throw new Error(`Clip${clipNo}: Extendボタンが見つかりません。noVNCで確認してください。`);
          await session.click(extCoords.x, extCoords.y);
          await sleep(WAIT_AFTER_ACTION_MS);
        }
      }

      // プロンプト入力
      const setOk = await session.evaluate(SET_PROMPT_EXPR(clipPrompt));
      if (!setOk) throw new Error(`Clip${clipNo}: プロンプト入力欄が見つかりません。noVNCで確認してください。`);
      await sleep(WAIT_AFTER_ACTION_MS);

      // Duration 15s を設定（毎回）
      const durResult = await selectDuration15s(session);
      if (durResult !== 'ok') {
        console.warn(`[step11] Clip${clipNo} Duration設定: ${durResult}`);
      }
      await sleep(WAIT_AFTER_ACTION_MS);

      // 「Create video」クリック
      const genOk = await session.evaluate(CLICK_CREATE_VIDEO_EXPR);
      if (!genOk) throw new Error(`Clip${clipNo}: 「Create video」ボタンが見つかりません。noVNCで確認してください。`);
      console.log(`[step11] Clip${clipNo} 生成開始...`);

      // 生成完了をポーリングで待機（完了後もこのページに留まる）
      await waitForGeneration(session, clipNo);
    }

    // 6. 全clip完了 → ダウンロード（draftsに戻り → 動画クリック → 3点メニュー → Download）
    console.log(`[step11] === 全${clipKeys.length}クリップ完了 → ダウンロード ===`);

    const dlOk = await downloadVideo(session);
    if (!dlOk) {
      console.error('[step11] ダウンロードできませんでした。noVNCから手動でダウンロードしてください。');
    } else {
      console.log(`[step11] ダウンロード開始。保存先: ${absOutputDir}`);
      await sleep(30000); // ダウンロード完了待機
    }

    // 7. 保存されたファイルを検出
    const files = fs.readdirSync(absOutputDir).filter(f => f.endsWith('.mp4'));
    if (files.length > 0) {
      const latestFile = files.sort().pop();
      const videoPath = path.join(outputDir, latestFile);
      console.log(`[step11] 動画ファイル検出: ${videoPath}`);

      // 8. DB更新
      updateVideoDB(videoPath);
      console.log(`[step11] DB更新完了: video_path=${videoPath}, video_generation_status=video_ready`);
    } else {
      console.warn(`[step11] ${absOutputDir} にmp4ファイルが見つかりません。手動でダウンロード・DB更新してください。`);
    }

    console.log(`[step11] 完了`);
  } finally {
    session.close();
    await httpReq(`${cdp}/json/close/${tab.id}`);
  }
}

/** 動画生成完了をポーリングで待機（1分間隔） */
async function waitForGeneration(session, clipNo) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const status = await session.evaluate(CHECK_GENERATION_DONE_EXPR);
    if (status === 'done') {
      console.log(`[step11] Clip${clipNo} 生成完了`);
      return;
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`[step11] Clip${clipNo} 生成中... (${elapsed}s)`);
  }
  throw new Error(`Clip${clipNo} の生成が ${POLL_TIMEOUT_MS / 1000}秒以内に完了しませんでした`);
}

main().catch((e) => {
  console.error('[step11] ERROR:', e.message);
  process.exit(1);
});
