// Service Worker - 理美容卸売 販売管理システム v4
// オフライン動作・キャッシュ管理

const CACHE_NAME = 'beauty-sales-v4-cache-v1';

// キャッシュするファイル一覧
const CACHE_FILES = [
  './beauty-sales-v4.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Google Fontsはオンライン時のみ（オフライン時はシステムフォントにフォールバック）
];

// インストール時：必須ファイルをキャッシュ
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app files');
        // icon-192.png / icon-512.png は存在しない場合があるので個別に試みる
        return cache.addAll(['./beauty-sales-v4.html', './manifest.json'])
          .then(() => {
            return Promise.allSettled([
              cache.add('./icon-192.png'),
              cache.add('./icon-512.png'),
            ]);
          });
      })
      .then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ時：キャッシュ優先、なければネットワーク
self.addEventListener('fetch', event => {
  // Chrome拡張やデータURLは無視
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // キャッシュがあればそれを返す（オフライン対応）
          return cachedResponse;
        }
        // キャッシュになければネットワークから取得してキャッシュに保存
        return fetch(event.request)
          .then(networkResponse => {
            // Google Fonts等の外部リソースもキャッシュ
            if (networkResponse && networkResponse.status === 200) {
              const url = event.request.url;
              // 同一オリジンまたはGoogle Fontsのみキャッシュ
              if (url.includes(self.location.origin) ||
                  url.includes('fonts.googleapis.com') ||
                  url.includes('fonts.gstatic.com')) {
                const cloned = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
              }
            }
            return networkResponse;
          })
          .catch(() => {
            // オフラインかつキャッシュなし → メインHTMLを返す（SPAフォールバック）
            if (event.request.destination === 'document') {
              return caches.match('./beauty-sales-v4.html');
            }
          });
      })
  );
});
