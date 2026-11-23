// DBスペシャリスト学習ノート PWA Service Worker
// ビルド時に __PWA_CACHE_VERSION__ が dist/index.html のコンテンツハッシュへ自動置換されます。
const CACHE_PREFIX = 'db-exam-bootcamp-';
const CACHE_VERSION = '__PWA_CACHE_VERSION__';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// 同一ディレクトリ基準の相対パス（ルート配信・GitHub Pagesサブパス配信の両方で動作）
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './sql-wasm.wasm',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// インストール時：アプリ本体とSQLite WASM・アイコンをプリキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (assetUrl) => {
          try {
            const req = new Request(assetUrl, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(assetUrl, res);
            }
          } catch {
            // 個別取得失敗時はオンラインアクセス時のランタイムキャッシュへ委ねる
          }
        })
      );
      // 初回インストール時は即座にアクティブ化してオフライン準備を完了する
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })()
  );
});

// アクティベート時：旧バージョンのキャッシュをクリーンアップ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// アプリ側からの即時更新指示およびキャッシュ状態照会に応答
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// タイムアウト付き fetch（地下鉄等の低速・不安定回線でも素早くキャッシュへフォールバック）
async function fetchWithTimeout(request, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(request, controller ? { signal: controller.signal } : undefined);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. ページナビゲーション（HTML）：Network-first（3秒タイムアウト）＋ キャッシュフォールバック
  const isNavigation =
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkResponse = await fetchWithTimeout(request, 3000);
          if (networkResponse && networkResponse.ok) {
            cache.put('./index.html', networkResponse.clone()).catch(() => {});
            cache.put('./', networkResponse.clone()).catch(() => {});
            return networkResponse;
          }
        } catch {
          // オフラインまたはタイムアウト時はキャッシュへフォールバック
        }
        const cached =
          (await cache.match(request, { ignoreSearch: true })) ||
          (await cache.match('./index.html')) ||
          (await cache.match('./'));
        if (cached) return cached;
        return fetch(request);
      })()
    );
    return;
  }

  // 2. 静的アセット（sql-wasm.wasm / アイコン / manifest 等）：Cache-first ＋ バックグラウンド更新
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        return cached;
      }
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch {
        // 最後のフォールバック
        const fallback = await cache.match(request);
        if (fallback) return fallback;
        throw new Error('Offline resource not cached');
      }
    })()
  );
});
