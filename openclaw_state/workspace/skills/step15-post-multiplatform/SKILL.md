---
name: step15-post-multiplatform
description: Step14で完成した字幕付き動画を5プラットフォーム（YouTube Shorts, Instagram Reels, Threads, TikTok, X）にCDP経由で予約投稿する。Use when Step15（マルチプラットフォーム自動投稿）を実行する時。
---

# Step15: マルチプラットフォーム自動投稿（CDP）

## 概要

Step14で字幕合成が完了した動画を、5つのプラットフォームにCDP（Playwright `connectOverCDP`）で予約投稿する。
各プラットフォームの予約投稿機能を使い、時差投稿でリーチを最大化する。

- ツール: Playwright（`connectOverCDP`）
- 実行環境: short-movie-agentコンテナ内の Chromium
- CDPエンドポイント: `http://127.0.0.1:18803`
- 対象: YouTube Shorts, Instagram Reels, Threads, TikTok, X

## 前提条件

- Step14が完了し、`generated_videos.video_path` に字幕付き動画が保存済みであること
- コンテナ内のChromiumで対象プラットフォームにログイン済み（noVNC `http://localhost:6082` で事前確認）
- CDPエンドポイントが稼働中: `curl -sf http://127.0.0.1:18803/json/version`

## 予約投稿スケジュール（JST基準）

| プラットフォーム | 予約時間 | 理由 |
|---|---|---|
| TikTok | 19:00 | 夕方〜夜のピーク、若年層中心 |
| Instagram Reels | 20:00 | 夜のSNS巡回時間帯 |
| YouTube Shorts | 21:00 | 動画視聴ピーク |
| X | 22:00 | 深夜の話題拡散 |
| Threads | 22:30 | Xと同時間帯でクロスポスト |

**スケジュール決定ロジック**:
- 現在JST 19:00以降 → 翌日の19:00から開始
- 現在JST 19:00以前 → 当日の19:00から開始

## CDP共通パターン

全スクリプトで以下のパターンを使う:

```javascript
const {chromium} = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18803');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // ダイアログ自動処理（beforeunload等）
  page.on('dialog', async dialog => {
    console.log('Dialog:', dialog.type(), dialog.message());
    await dialog.accept();
  });

  try {
    await page.setViewportSize({width: 1280, height: 900});
    // ... 操作 ...
  } catch (e) {
    console.error('ERROR:', e.message);
    await page.screenshot({path: '/tmp/{platform}-error.png', fullPage: true});
    process.exit(1);
  } finally {
    await page.close();
  }
  process.exit(0);
})();
```

**モーダル自動処理ヘルパー**（全プラットフォーム共通）:

```javascript
// 動的モーダルを閉じる汎用関数
async function dismissModals(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const dismiss = btns.filter(b =>
      /^(got it|cancel|close|allow|ok|閉じる|キャンセル)$/i.test(b.textContent.trim())
    );
    dismiss.forEach(b => b.click());
  });
  await page.waitForTimeout(1000);
}
```

## 手順

### 1. DBから対象動画を取得する

```sql
SELECT gv.id, gv.video_path, gv.episode_title, gv.episode_summary, gv.episode_hook,
       j.series_title, j.trend_keywords
FROM generated_videos gv
JOIN generation_jobs j ON j.id = gv.generation_job_id
WHERE gv.video_path IS NOT NULL
  AND gv.post_status = 'not_posted'
ORDER BY gv.id DESC;
```

動画ファイルのコンテナ内絶対パスを確認:
```bash
VIDEO_PATH="/home/node/.openclaw/{video_path}"
ls -la "$VIDEO_PATH"
```

### 2. キャプションを生成する

DBの `series_title`, `episode_summary`, `trend_keywords` からプラットフォーム別にキャプションを生成する。

#### プラットフォーム別フォーマット

**YouTube Shorts**:
- タイトル: `{series_title}`（`#textbox` 1番目）
- 説明文: `{episode_summary}`（`#textbox` 2番目。ハッシュタグは `keyboard.type` で入力し、サジェストが出たら即 `Escape` で閉じる）

**Instagram Reels**:
- キャプション: `{series_title}` + 改行×2 + `{episode_summary}` + 改行×2 + ハッシュタグ（最大30個）

**Threads**:
- テキスト: episode_hookベースの短い紹介文（1〜2文）+ ハッシュタグ1〜2個

**TikTok**:
- キャプション: `{series_title}` + スペース + ハッシュタグ（全体150文字以内）

**X**:
- テキスト: episode_hookベースのフック文 + `{series_title}` + ハッシュタグ2〜3個（全体280文字以内）

### 3. video_postsテーブルに予約レコードを作成する

```sql
INSERT INTO video_posts (video_id, platform, post_status, scheduled_at, caption, hashtags)
VALUES
  ({video_id}, 'tiktok',          'pending', '{tiktok_scheduled}',    '{tiktok_caption}',    '{hashtags_json}'),
  ({video_id}, 'instagram_reels', 'pending', '{instagram_scheduled}', '{instagram_caption}', '{hashtags_json}'),
  ({video_id}, 'youtube_shorts',  'pending', '{youtube_scheduled}',   '{youtube_caption}',   '{hashtags_json}'),
  ({video_id}, 'x',              'pending', '{x_scheduled}',         '{x_caption}',         '{hashtags_json}'),
  ({video_id}, 'threads',         'pending', '{threads_scheduled}',   '{threads_caption}',   '{hashtags_json}');
```

### 4. 各プラットフォームにCDPで投稿する

投稿順序: TikTok → Instagram Reels → YouTube Shorts → X → Threads

スクリプトはホスト側で作成後 `docker cp` でコンテナにコピーし、`docker exec` で実行する:
```bash
docker cp /tmp/post-{platform}.js short-movie-agent:/tmp/
docker exec short-movie-agent node /tmp/post-{platform}.js
```

各投稿の前後でDBのステータスを更新する。

---

#### 4-1. TikTok

**URL**: `https://www.tiktok.com/tiktokstudio/upload`（`/upload` → TikTok Studioにリダイレクトされる）

**実証済みUI構造**:
- ファイルinput: `input[type="file"][accept="video/*"]`（メインページ直下、iframeなし）
- キャプション: `[contenteditable="true"]`（DraftEditorコンポーネント、`role="combobox"`）
- Scheduleラジオ: `input[type="radio"][value="schedule"]`（name="postSchedule"）
- 投稿ボタン: Schedule選択後は `button:has-text("Schedule")`、未選択時は `button:has-text("Post")`

**⚠️ 必ず出現するモーダル（順番に処理する）**:
1. **「Turn on automatic content checks?」** → `Cancel` をクリック（または `Allow`）
2. **「Allow your video to be saved for scheduled posting?」** → `Allow` をクリック（Schedule選択時のみ）

**⚠️ 予約投稿の日時ピッカー**:
- 日付: `input[type="text"]` value=`YYYY-MM-DD` 形式
- 時間: `input[type="text"]` value=`HH:MM` 形式
- **注意**: `nativeInputValueSetter` でのReact state変更は反映されない。キーボード操作（トリプルクリック→入力）で変更するか、即時投稿（Schedule未選択で Post）を使う

```javascript
// ファイルアップロード
await page.locator('input[type="file"][accept="video/*"]').setInputFiles(VIDEO_PATH);
// エディター出現待ち
await page.waitForSelector('[contenteditable="true"]', {timeout: 60000});
await page.waitForTimeout(5000);

// モーダル処理（evaluateで強制クリック）
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const target = btns.find(b => /^(Cancel|Allow|Got it)$/i.test(b.textContent.trim()));
  if (target) target.click();
});
await page.waitForTimeout(1500);

// キャプション入力（force: trueでモーダル残りを無視）
const editor = page.locator('[contenteditable="true"]').first();
await editor.click({force: true});
await page.keyboard.press('Control+A');
await page.keyboard.press('Backspace');
await page.keyboard.type(CAPTION, {delay: 20});

// Scheduleラジオ選択
await page.evaluate(() => {
  const radio = document.querySelector('input[type="radio"][value="schedule"]');
  if (radio) { radio.click(); radio.dispatchEvent(new Event('change', {bubbles: true})); }
});
await page.waitForTimeout(2000);

// Allow保存モーダル処理
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Allow');
  if (btn) btn.click();
});
await page.waitForTimeout(1500);

// 日時設定（トリプルクリック→キーボード入力）
const dateInput = /* input[type="text"] with YYYY-MM-DD value */;
await dateInput.click({clickCount: 3});
await page.keyboard.type(TARGET_DATE); // '2026-03-23'
const timeInput = /* input[type="text"] with HH:MM value */;
await timeInput.click({clickCount: 3});
await page.keyboard.type(TARGET_TIME); // '19:00'

// Scheduleボタン（evaluateで直接クリック）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Schedule');
  if (btn) btn.click();
});
// 成功時は tiktokstudio/content にリダイレクトされる
```

**投稿後DB更新**:
```sql
UPDATE video_posts
SET post_status = 'posted', posted_at = datetime('now'), post_url = '{post_url}'
WHERE video_id = {video_id} AND platform = 'tiktok';
```

---

#### 4-2. Instagram Reels

**URL**: `https://www.instagram.com/`

**実証済みUI構造**（日本語UI、2026-03-22テスト）:
- 新規投稿ボタン: サイドバーの `a` リンク（テキスト「作成」を含む）。**`[aria-label="New post"]` は存在しない** → `page.locator('a').filter({hasText: '作成'}).first()` を使う
- ファイルinput: `input[type="file"]`（新規投稿ダイアログ内、ダイアログ表示後に出現）
- 次へボタン: テキスト「次へ」の `div[role="button"]`（`button` タグではない）→ `evaluate` でテキストマッチして `click()` を使う
- キャプション: `[aria-label="キャプションを入力…"]`（`contenteditable="true"` の `div`）
- シェアボタン: テキスト「シェア」のリンク（ダイアログ右上の青文字）
- 投稿完了: 「リール動画がシェアされました」ダイアログが表示される

**⚠️ 必ず出現するモーダル**:
1. **「お知らせをオンにする」** → 「後で」ボタンをクリック（ページ読み込み直後に表示）

**⚠️ 注意事項**:
- 動画アップロード後、Instagram側の処理に時間がかかる → `waitForTimeout(12000)` を十分に取る
- 「次へ」ボタンは動画処理完了まで非活性 → `waitForTimeout` で待つ
- Reelsとして投稿するにはアスペクト比9:16の動画が必要（short-movie動画は該当）
- **シェアボタンクリック後、サーバーへのアップロードに47MB動画で約80秒かかる**。「シェア中」テキストが消えるまでポーリングで待つこと
- **`page.close()` するとアップロードが中断される**。完了確認（「リール動画がシェアされました」検出）まで絶対にページを閉じない
- シェア後に投稿URLを取得するにはプロフィールページ `https://www.instagram.com/{username}/` の最新投稿リンクから取得
- シェアボタン（右上の「シェア」テキスト）は `evaluate` でy座標が最も小さい要素を選ぶ。画面下部の「シェア先」セクションと誤クリックしないよう注意

```javascript
await page.goto('https://www.instagram.com/', {waitUntil: 'domcontentloaded'});
await page.waitForTimeout(5000);

// 「お知らせをオンにする」ポップアップを閉じる
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const dismiss = btns.find(b => /^(後で|Not Now|Later)$/i.test(b.textContent.trim()));
  if (dismiss) dismiss.click();
});
await page.waitForTimeout(2000);

// 新規投稿（サイドバーの「作成」リンク）
await page.locator('a').filter({hasText: '作成'}).first().click();
await page.waitForTimeout(3000);

// ファイルアップロード
await page.locator('input[type="file"]').setInputFiles(VIDEO_PATH);
await page.waitForTimeout(12000); // 動画処理待ち

// 「OK」ボタン（トリミング確認ダイアログが出る場合）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /^(OK|Got it)$/i.test(b.textContent.trim()));
  if (btn) btn.click();
});
await page.waitForTimeout(2000);

// 次へ × 2（トリミング → フィルター → キャプション画面）
// ⚠️ div[role="button"] なので evaluate でクリック
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, div[role="button"]')];
    const next = btns.find(b => /^(Next|次へ)$/i.test(b.textContent.trim()));
    if (next) next.click();
  });
  await page.waitForTimeout(3000);
}

// キャプション入力
const captionField = page.locator('[aria-label="キャプションを入力…"]')
  .or(page.locator('[aria-label="Write a caption..."]'));
await captionField.click();
await captionField.pressSequentially(INSTAGRAM_CAPTION, {delay: 30});
await page.waitForTimeout(1000);

// ハッシュタグサジェストが出たら閉じる
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// シェア（即時投稿）— 右上の「シェア」テキスト（y座標が最小のもの）
await page.evaluate(() => {
  const els = [...document.querySelectorAll('a, button, div[role="button"], span')];
  const shareEls = els
    .filter(e => /^(Share|シェア|シェアする)$/i.test(e.textContent.trim()) && e.children.length === 0 && e.offsetParent)
    .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
  if (shareEls.length > 0) shareEls[0].click();
});

// ⚠️ アップロード完了をポーリングで待つ（最大120秒）
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000);
  const status = await page.evaluate(() => {
    const allText = document.body.innerText;
    const sharing = allText.includes('シェア中');
    const done = allText.includes('リール動画がシェアされました') || allText.includes('シェアされました');
    return { sharing, done };
  });
  if (status.done || !status.sharing) break;
}
// ⚠️ ページを閉じない（page.close()でアップロードが中断される）
```

**投稿後DB更新**:
```sql
UPDATE video_posts
SET post_status = 'posted', posted_at = datetime('now'), post_url = '{post_url}'
WHERE video_id = {video_id} AND platform = 'instagram_reels';
```

---

#### 4-3. YouTube Shorts

**URL**: YouTube Studioのコンテンツページ → 「動画をアップロード」ボタン → アップロードダイアログ

**実証済みUI構造**（日本語UI）:
- コンテンツ一覧: `studio.youtube.com/channel/{CHANNEL_ID}/videos/upload`
- アップロード開始: `button:has-text("動画をアップロード")` クリック → ダイアログ表示
- ファイルinput: ダイアログ内 `input[type="file"]`
- タイトル: `#textbox` の1番目
- 説明文: `#textbox` の2番目
- 子ども向け: `#radioLabel` フィルタ `いいえ、子ども向けではありません`（`evaluate`でクリック推奨）
- ナビゲーション: `#next-button` ×3（詳細 → 動画の要素 → チェック → 公開設定）
- 公開設定のスケジュール: **ラジオボタンではなくアコーディオンセクション**。テキスト「スケジュールを設定」をクリックして展開
- 日付ピッカー: `#datepicker-trigger`（`YTCP-TEXT-DROPDOWN-TRIGGER`要素）→ クリックするとカレンダー表示
- 時間ピッカー: `#time-of-day-trigger`（ドロップダウンから時刻選択）
- 保存ボタン: `#done-button`（テキストは「スケジュールを設定」に変わる）

**⚠️ 注意事項**:
- `#datepicker-trigger` クリック後にオーバーレイ（`tp-yt-iron-overlay-backdrop`）が表示される。日付選択後に `Escape` で閉じるか、`evaluate` でオーバーレイを削除する
- 説明文にハッシュタグ入力するとサジェストドロップダウンが出る → `Escape` で閉じてから次へ進む
- ポリシー確認ダイアログ「YouTubeの新しいポリシーを遵守するには…」→ `閉じる` ボタンで dismiss
- `#done-button` のクリックは `evaluate` で直接クリック推奨（オーバーレイがブロックするため）

```javascript
// コンテンツ一覧ページへ
await page.goto('https://studio.youtube.com/channel/{CHANNEL_ID}/videos/upload', ...);
// 「動画をアップロード」クリック
await page.locator('button:has-text("動画をアップロード")').first().click();
// ファイルアップロード
await page.locator('input[type="file"]').first().setInputFiles(VIDEO_PATH);
// エディター待ち
await page.waitForSelector('#textbox', {timeout: 120000});
await page.waitForTimeout(5000);

// 通知ダイアログ dismiss
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '閉じる');
  if (btn) btn.click();
});
await page.keyboard.press('Escape'); // サジェスト閉じ

// タイトル
const titleBox = page.locator('#textbox').first();
await titleBox.click();
await page.keyboard.press('Control+A');
await page.keyboard.type(TITLE, {delay: 30});

// 説明文（ハッシュタグ入力後にEscapeでサジェスト閉じ）
const descBox = page.locator('#textbox').nth(1);
await descBox.click();
await page.keyboard.press('Control+A');
await page.keyboard.press('Backspace');
await page.keyboard.type(DESCRIPTION, {delay: 10});
await page.keyboard.press('Escape');

// 「いいえ、子ども向けではありません」選択（evaluateで）
await page.evaluate(() => {
  const label = [...document.querySelectorAll('#radioLabel')]
    .find(l => l.textContent.includes('いいえ、子ども向けではありません'));
  if (label) label.click();
});

// 次へ ×3（詳細 → 動画の要素 → チェック → 公開設定）
for (let i = 0; i < 3; i++) {
  await page.locator('#next-button').click();
  await page.waitForTimeout(2500);
}

// 「スケジュールを設定」セクション展開（アコーディオン）
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')]
    .find(e => e.textContent.trim().startsWith('スケジュールを設定') && e.offsetParent && e.children.length < 5);
  if (el) el.click();
});
await page.waitForTimeout(2000);

// 日付ピッカー（#datepicker-trigger）
// デフォルトで翌日が選択されている場合はそのまま使う
// 変更が必要な場合: #datepicker-trigger クリック → カレンダーから日付選択 → Escape
await page.click('#datepicker-trigger');
// ... 日付選択 ...
await page.keyboard.press('Escape');

// オーバーレイ強制削除
await page.evaluate(() => {
  document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(b => b.remove());
});

// 保存（evaluateで直接クリック）
await page.evaluate(() => {
  const btn = document.querySelector('#done-button');
  if (btn) btn.click();
});
// 成功時: 「スケジュールされた動画」ダイアログにURLが表示される
```

**投稿後DB更新**:
```sql
UPDATE video_posts
SET post_status = 'posted', posted_at = datetime('now'), post_url = '{post_url}'
WHERE video_id = {video_id} AND platform = 'youtube_shorts';
```

---

#### 4-4. X（予約: 22:00 JST）

既存の `x-agent` の `x-post-run.js` と同パターン。

**実証済みUI構造**:
- テキスト入力: `[data-testid='tweetTextarea_0']`
- ファイルinput: `[data-testid='fileInput']`
- スケジュール: `[data-testid='scheduleOption']`
- 日時: `select` 要素6個（月/日/年/時12h/分/AM|PM）— **X UIはUTC表示なのでJST→UTC変換必須**
- Confirm: `[aria-label="Confirm"]`
- Schedule: `[data-testid='tweetButtonInline']` or `[data-testid='tweetButton']`

**JST → UTC変換**:
```javascript
const scheduledHourJST = 22;
const utcHour = scheduledHourJST - 9; // 13
const hour12h = utcHour > 12 ? utcHour - 12 : (utcHour === 0 ? 12 : utcHour); // 1
const ampm = utcHour >= 12 ? 'PM' : 'AM'; // PM
```

```javascript
await page.goto('https://x.com/home', {waitUntil: 'domcontentloaded'});
await page.waitForSelector("[data-testid='tweetTextarea_0']", {timeout: 15000});
await page.waitForTimeout(1000);

// テキスト入力
await page.locator("[data-testid='tweetTextarea_0']").first().click();
await page.locator("[data-testid='tweetTextarea_0']").first().pressSequentially(X_CAPTION, {delay: 50});

// 動画アップロード（47MBで10秒〜待ち）
await page.locator("[data-testid='fileInput']").setInputFiles(VIDEO_PATH);
await page.waitForTimeout(10000);

// スケジュール
await page.click("[data-testid='scheduleOption']");
await page.waitForTimeout(1500);

// 日時設定（select要素6個）
const selects = await page.$$('select');
await selects[0].selectOption(String(Number(mm)));       // 月
await selects[1].selectOption(String(Number(dd)));       // 日
await selects[2].selectOption(String(yyyy));             // 年
await selects[3].selectOption(String(hour12h));          // 時(12h)
await selects[4].selectOption(String(scheduledMin));     // 分
await selects[5].selectOption(ampm);                     // AM/PM

// Confirm → Schedule（evaluateでクリック推奨）
await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Confirm"]')
           || [...document.querySelectorAll('button')].find(b => /^confirm$/i.test(b.textContent.trim()));
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const btn = document.querySelector('[data-testid="tweetButtonInline"]')
           || document.querySelector('[data-testid="tweetButton"]');
  if (btn) btn.click();
});
```

**投稿後DB更新**:
```sql
UPDATE video_posts
SET post_status = 'posted', posted_at = datetime('now'), post_url = '{post_url}'
WHERE video_id = {video_id} AND platform = 'x';
```

---

#### 4-5. Threads

**URL**: `https://www.threads.net/`（`threads.com` にリダイレクトされる）

**実証済みUI構造**（日本語UI、2026-03-22テスト）:
- 新規投稿ボタン: `div[role="button"]`（テキスト「作成」）— サイドバーの `+` アイコン。**`[aria-label="Create"]` は存在しない** → `page.locator('div[role="button"]').filter({hasText: /^作成$/}).first()` を使う
- テキスト入力: `[contenteditable="true"]`（ダイアログ内、`aria-label="テキストフィールドが空です。テキストを入力して新しい投稿を作成できます。"`）
- ファイルinput: `input[type="file"]`（**非表示だが DOM 上に存在**、`accept="image/avif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"`）→ `setInputFiles` で直接操作可能（添付ボタンのクリック不要）
- 投稿ボタン: `div[role="button"]`（テキスト「投稿」）— ダイアログ右下
- ダイアログタイトル: 「新規スレッド」

**⚠️ 注意事項**:
- ThreadsはInstagramアカウントでログイン済みであること（セッション共有）
- ハッシュタグ入力時にサジェストドロップダウンが表示される → `Escape` で閉じてから投稿ボタンをクリック
- テキストは500文字制限 → キャプションは短く（episode_hookベース1〜2文 + ハッシュタグ1〜2個）
- `input[type="file"]` は非表示（`visible: false`）だが `setInputFiles` で直接セット可能（実証済み）
- **投稿ボタンのクリックは `evaluate` の `.click()` では Reactイベントが発火しない**。必ず Playwright の `locator.click({force: true})` または `page.mouse.click(x, y)` を使うこと
- **投稿ボタンは `div[role="dialog"]` の子孫にある** `div[role="button"][tabindex="0"]`（テキスト「投稿」、クラス `x1i10hfl` を含む）。フィード上の「今なにしてる？」横にも同テキストのボタンがあるので、必ず `dialog` locator 内で検索すること
- 動画プレビュー（`video` 要素）が表示されるまで待ってから投稿ボタンをクリック

```javascript
await page.goto('https://www.threads.net/', {waitUntil: 'domcontentloaded'});
await page.waitForTimeout(5000);

// ポップアップを閉じる
await dismissModals(page);

// 新規投稿ボタン（「作成」テキストの div[role="button"]）
await page.locator('div[role="button"]').filter({hasText: /^作成$/}).first().click();
await page.waitForTimeout(3000);

// テキスト入力
const textArea = page.locator('[contenteditable="true"]').first();
await textArea.click();
await textArea.pressSequentially(THREADS_CAPTION, {delay: 30});
await page.waitForTimeout(500);

// ハッシュタグサジェストを閉じる
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// ファイル添付（非表示の input[type="file"] に直接セット）
await page.locator('input[type="file"]').setInputFiles(VIDEO_PATH);

// 動画プレビューが表示されるまで待つ
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000);
  if (await page.evaluate(() => document.querySelectorAll('video').length > 0)) break;
}
await page.waitForTimeout(3000); // 追加の安定待ち

// 投稿（即時投稿）
// ⚠️ evaluate の .click() では React イベントが発火しない
// ⚠️ 必ず dialog locator 内で検索し、Playwright の click を使う
const dialog = page.locator('div[role="dialog"]');
await dialog.locator('div[role="button"][tabindex="0"]').filter({hasText: /^投稿$/}).first().click({force: true});

// 投稿完了待ち（ダイアログが閉じるまでポーリング）
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000);
  const status = await page.evaluate(() => {
    const d = document.querySelector('div[role="dialog"]');
    if (!d) return { dialog: false };
    return { dialog: true, hasCaption: d.textContent.includes(THREADS_CAPTION.substring(0, 10)) };
  });
  if (!status.dialog || !status.hasCaption) break;
}
```

**投稿後DB更新**:
```sql
UPDATE video_posts
SET post_status = 'posted', posted_at = datetime('now'), post_url = '{post_url}'
WHERE video_id = {video_id} AND platform = 'threads';
```

---

### 5. generated_videosのpost_statusを更新する

全プラットフォームの投稿が完了したら:

```sql
UPDATE generated_videos
SET post_status = 'posted', posted_at = datetime('now'), updated_at = datetime('now')
WHERE id = {video_id};
```

一部失敗した場合は `post_status` を `partial` にする:

```sql
UPDATE generated_videos
SET post_status = 'partial', updated_at = datetime('now')
WHERE id = {video_id};
```

### 6. 不要なブラウザページを閉じる

全プラットフォームの投稿完了後、投稿処理で開いたページを閉じる。ページが蓄積するとメモリを圧迫しブラウザが不安定になる。

```javascript
const {chromium} = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18803');
  const context = browser.contexts()[0];
  const pages = context.pages();

  // 保持するページのURLパターン（ログインセッション維持用に1ページだけ残す）
  const keepPatterns = ['about:blank'];
  let kept = 0;

  for (const page of pages) {
    const url = page.url();
    const shouldKeep = keepPatterns.some(p => url.includes(p));
    if (shouldKeep && kept === 0) {
      kept++;
      console.log('KEEP:', url);
    } else {
      try {
        await page.close();
        console.log('CLOSED:', url);
      } catch (e) {
        console.log('SKIP:', url, e.message);
      }
    }
  }
  console.log('Cleanup done. Remaining pages:', context.pages().length);
  process.exit(0);
})();
```

### 7. 投稿結果を確認する

```sql
SELECT platform, post_status, scheduled_at, post_url, error_message
FROM video_posts
WHERE video_id = {video_id}
ORDER BY scheduled_at;
```

## エラーハンドリング

各プラットフォームの投稿でエラーが発生した場合:

1. `video_posts.post_status` を `failed` に更新
2. `video_posts.error_message` にエラー内容を記録
3. `video_posts.retry_count` をインクリメント
4. 他のプラットフォームの投稿は継続する（1つの失敗で全体を止めない）

**リトライ**:
```sql
-- 失敗したプラットフォームを確認
SELECT platform, error_message, retry_count
FROM video_posts
WHERE video_id = {video_id} AND post_status = 'failed';
```
失敗したプラットフォームのみ、上記の該当手順を再実行する。

## スケジュール計算の実装

```javascript
// JST現在時刻を取得
const now = new Date();
const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const jstHour = jst.getUTCHours();

// 基準日を決定（19:00以降なら翌日）
const baseDate = new Date(jst);
if (jstHour >= 19) {
  baseDate.setUTCDate(baseDate.getUTCDate() + 1);
}
const yyyy = baseDate.getUTCFullYear();
const mm = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
const dd = String(baseDate.getUTCDate()).padStart(2, '0');

// 各プラットフォームの予約時刻（JST）
const schedules = {
  tiktok:          `${yyyy}-${mm}-${dd}T19:00:00+09:00`,
  instagram_reels: `${yyyy}-${mm}-${dd}T20:00:00+09:00`,
  youtube_shorts:  `${yyyy}-${mm}-${dd}T21:00:00+09:00`,
  x:               `${yyyy}-${mm}-${dd}T22:00:00+09:00`,
  threads:         `${yyyy}-${mm}-${dd}T22:30:00+09:00`,
};
```

## 実証済みの知見（2026-03-22テスト）

### TikTok
- `/upload` → `tiktokstudio/upload` にリダイレクトされる
- ファイルinputはiframe内ではなくメインページ直下
- アップロード後に2つのモーダルが連続出現する（content checks → video save）
- 日時ピッカーはReactコンポーネントで `nativeInputValueSetter` が効かない（キーボード入力必須）
- Postボタンクリック成功時は `tiktokstudio/content` にリダイレクト

### YouTube Shorts
- YouTube Studio日本語UIで動作確認済み
- チャンネルID: `UC6QEs4HWT0xy64R16QwA5gA`
- 「スケジュールを設定」はラジオボタンではなくアコーディオンセクション
- `#datepicker-trigger` クリック後のオーバーレイが `#done-button` のクリックをブロックする → `evaluate` で直接クリックするか、オーバーレイを削除
- 成功時: 「スケジュールされた動画」ダイアログに動画リンクが表示される

### Instagram Reels
- 日本語UIで動作確認済み・**投稿成功実証済み**（アカウント: `kyono.hanasi`、2026-03-22）
- 新規投稿ボタンは `[aria-label="New post"]` ではなく、テキスト「作成」を含む `a` リンク（サイドバー）
- ページ読み込み直後に「お知らせをオンにする」ポップアップが表示される → 「後で」ボタンで dismiss
- 「次へ」ボタンは `button` タグではなく `div[role="button"]` → `evaluate` でテキストマッチしてクリック
- キャプション入力は `[aria-label="キャプションを入力…"]`（`contenteditable="true"` の `div`）
- シェアボタンはダイアログ右上の青文字テキスト「シェア」（y座標が最小の要素。画面下部の「シェア先」セクションと混同しないこと）
- シェアクリック後、47MB動画のアップロードに約80秒かかる。「シェア中」→「リール動画がシェアされました」テキストが出るまでポーリングで待つ
- **`page.close()` でアップロードが中断される** → 完了確認まで絶対にページを閉じない
- 即時投稿で動作確認済み（予約投稿UIは未実証）

### Threads
- 日本語UIで動作確認済み・**投稿成功実証済み**（アカウント: `kyono.hanasi`、2026-03-22）
- URLは `threads.net` → `threads.com` にリダイレクトされる
- 新規投稿ボタンは `[aria-label="Create"]` ではなく、テキスト「作成」の `div[role="button"]`（サイドバー）
- 投稿ダイアログのタイトルは「新規スレッド」
- テキスト入力は `[contenteditable="true"]`（`aria-label="テキストフィールドが空です。テキストを入力して新しい投稿を作成できます。"`）
- `input[type="file"]` は非表示だがDOMに存在 → `setInputFiles` で直接セット可能（添付ボタンクリック不要）
- `input[type="file"]` の `accept` は `video/mp4,video/quicktime,video/webm` を含む
- ハッシュタグ入力時にサジェストドロップダウンが出る → `Escape` で閉じる
- **投稿ボタンのクリックは `evaluate` の `.click()` では動作しない（Reactイベントが発火しない）**。必ず Playwright の `locator.click({force: true})` を使う
- 投稿ボタンは `div[role="dialog"]` 内の `div[role="button"][tabindex="0"]`（テキスト「投稿」、クラス `x1i10hfl` を含む）。フィード上にも同テキストのボタンがあるため、**必ず `page.locator('div[role="dialog"]')` の子孫から検索**すること
- 動画プレビュー（`video` 要素）が表示されてから投稿ボタンをクリックすること
- 投稿成功時、ダイアログが閉じる（新しいダイアログにリセットされるのではなく消える）
- 即時投稿で動作確認済み（予約投稿UIは未実証）

## 検証

- noVNC（`http://localhost:6082`）でブラウザ操作を目視監視しながらテスト実行
- 各プラットフォームで予約投稿が正しく設定されていることを確認
- 予約時間に実際に投稿されることを翌日確認

## 介入点

なし。全自動で完了する。エラー時はDBの `error_message` を確認し、プラットフォーム個別にリトライ可能。
