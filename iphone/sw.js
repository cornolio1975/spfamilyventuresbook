const scope = self.registration.scope;
const prefix = 'sp-familybook:' + scope + ':';
const cacheName = prefix + 'e1b75e2e0966d732';
const assets = new Set(["assets/html2canvas-pro.esm-DtKkrmF-.js","assets/index-Bym1Nida.css","assets/index-CbFW2rcr.js","assets/index-b08ac4db72a59911.js","assets/backup-17473a711e99d6f4.js","assets/index-DTZ96t8k.js","assets/index-DaQPru3v.js","assets/logo-dgHSd-ed.jpg","assets/poultry_logo-RsWDEZrg.jpg","assets/vendor-db-CViI1DE6.js","assets/vendor-firebase-DM9Qp84I.js","assets/vendor-react-C88NtW8Y.js","assets/vendor-ui-CBBuJmt5.js","assets/web-BPglCpuC.js","assets/web-C5vYmG5R.js","assets/web-SWUxVou-.js","icon-180.png","icon-192.png","icon-512.png","index.html","manifest.webmanifest","vite.svg"].map(path => new URL(path, scope).href));
const home = new URL('index.html', scope).href;

self.addEventListener('install', event => {
    event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
        [...assets].map(url => new Request(url, { cache: 'reload' }))
    )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
    if (request.mode === 'navigate' || assets.has(request.url)) {
        event.respondWith(caches.open(cacheName)
            .then(cache => cache.match(request.mode === 'navigate' ? home : request))
            .then(response => response || fetch(request)));
    }
});
