// Service Worker - 理美容卸売 販売管理システム v4
// キャッシュ名を更新日付で管理（ファイル更新時に自動でキャッシュ更新）

const CACHE_NAME = 'beauty-sales-v4-20260617';
const CACHE_FILES = [
  './beauty-sales-v4.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// インストール時：キャッシュ更新
self.addEventListener('install', event => {
  console.log('[SW] Installing cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(['./beauty-sales-v4.html', './manifest.json'])
        .then(() => Promise.allSettled([
          cache.add('./icon-192.png'),
          cache.add('./icon-512.png'),
        ]))
      )
      .then(() => self.skipWaiting())  // 即座に新バージョンを有効化
  );
});

// アクティベート時：古いキャッシュを全て削除
self.addEventListener('activate', event => {
  console.log('[SW] Activating, clearing old caches');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())  // 全クライアントを即座に制御下に
  );
});

// フェッチ時：ネットワーク優先（オンライン時は常に最新を取得）
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  // beauty-sales-v4.html は常にネットワークから取得（最新版を保証）
  if (event.request.url.includes('beauty-sales-v4.html')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // 最新版をキャッシュに保存
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          }
          return networkResponse;
        })
        .catch(() => {
          // オフライン時はキャッシュから
          return caches.match(event.request);
        })
    );
    return;
  }

  // その他のリソースはキャッシュ優先
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const url = event.request.url;
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
            if (event.request.destination === 'document') {
              return caches.match('./beauty-sales-v4.html');
            }
          });
      })
  );
});
