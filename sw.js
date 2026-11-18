/* 一天一件 — Service Worker
   目标只有一个：断网也能打开。
   策略刻意保守——不做花活，不接管非本域请求。 */

const VERSION = 'v5';
const CACHE = 'ytyj-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './manifest-dark.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/support-qr.png'
];

/* 安装：把壳子抓下来。单个文件失败不连坐，避免整包装不上。 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {
            /* 缺一个图标不值得让整个 SW 装失败 */
          })
        )
      )
    )
  );
});

/* 激活：清掉旧版本的缓存。 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ytyj-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只处理本域的 GET
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面本身：先网络后缓存，这样有网时总能拿到新版
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match('./index.html'))
            .then((hit) => hit || caches.match('./'))
        )
    );
    return;
  }

  // 静态资源：先缓存后网络，顺手补进缓存
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit)
    )
  );
});
