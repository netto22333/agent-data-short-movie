#!/usr/bin/env node
import http from 'node:http';

// --- CLI args ---
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);
const cdp    = args.cdp    || 'http://127.0.0.1:18803';
const geo    = args.geo    || 'JP';
const hours  = args.hours  || '168';
const limit  = Number(args.limit  || 50);
const format = args.format || 'json'; // json | text
const url = `https://trends.google.co.jp/trending?geo=${encodeURIComponent(geo)}&hours=${encodeURIComponent(hours)}`;

// --- HTTP helper (no external deps) ---
function httpGet(u, method = 'GET') {
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

// --- Volume helpers ---
const VOL_RE = /^(\d[\d,]*(?:\.\d+)?)(万|千)?\+$/;

function volToNumber(v) {
  const m = v.match(VOL_RE);
  if (!m) return 0;
  let n = Number(m[1].replace(/,/g, ''));
  if (m[2] === '万') n *= 10000;
  if (m[2] === '千') n *= 1000;
  return n;
}

// --- Browser expressions (run inside the page via CDP) ---
// volRe must be re-declared here because it runs in the browser context
const SCRAPE_EXPR = `(() => {
  const lines = document.body.innerText.split('\\n').map(s => s.trim()).filter(Boolean);
  const volRe = /^(\\d[\\d,]*(?:\\.\\d+)?)(万|千)?\\+$/;
  const junk  = new Set(['トレンド','検索ボリューム','発生日時','関連度順','新しい順','有効','過去 7 日間']);
  const rows  = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const kw = lines[i], vol = lines[i + 1];
    if (volRe.test(vol) && kw.length > 1 && !junk.has(kw) && !kw.startsWith('+ ') && !kw.includes('並べ替え'))
      rows.push({ keyword: kw, volume: vol });
  }
  return rows;
})()`;

const NEXT_COORDS_EXPR = `(() => {
  window.scrollTo(0, document.body.scrollHeight);
  const btn =
    document.querySelector('.pYTkkf-Bz112c-RLmnJb button:not([disabled])') ||
    Array.from(document.querySelectorAll('button')).find(el => {
      const r = el.getBoundingClientRect();
      return !el.disabled && (el.getAttribute('aria-label') || '').includes('次のページ') && r.width > 0;
    });
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;

// --- Main ---
async function main() {
  const tab = JSON.parse(await httpGet(`${cdp}/json/new?${encodeURIComponent(url)}`, 'PUT'));

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true })
    .then((r) => r?.result?.result?.value);

  await new Promise((r) => (ws.onopen = r));
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 9000));

  try {
    // Page 1
    const rows1 = await evaluate(SCRAPE_EXPR) ?? [];

    // Page 2: real mouse click via CDP Input API
    const coords = await evaluate(NEXT_COORDS_EXPR);
    await new Promise((r) => setTimeout(r, 300));
    if (coords) {
      const { x, y } = coords;
      await send('Input.dispatchMouseEvent', { type: 'mousePressed',  x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    await new Promise((r) => setTimeout(r, 2200));
    const rows2 = await evaluate(SCRAPE_EXPR) ?? [];

    // Deduplicate + sort by volume
    const seen = new Set();
    const uniq = [];
    for (const row of [...rows1, ...rows2]) {
      if (!seen.has(row.keyword)) {
        seen.add(row.keyword);
        uniq.push(row);
      }
    }
    uniq.sort((a, b) => volToNumber(b.volume) - volToNumber(a.volume));
    const out = uniq.slice(0, limit);

    if (format === 'text') {
      out.forEach((r, i) => console.log(`${i + 1}. ${r.keyword}\t${r.volume}`));
    } else {
      console.log(JSON.stringify(out, null, 2));
    }
  } finally {
    ws.close();
    await httpGet(`${cdp}/json/close/${tab.id}`);
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
