const scope = self.registration.scope;
const prefix = 'sp-familybook:' + scope + ':';
const cacheName = prefix + 'bc28393f857a528a';
const assets = new Set(["assets/html2canvas-pro.esm-DtKkrmF-.js","assets/index-1_JpNZ4R.js","assets/index-ENB6yhdO.css","assets/logo-dgHSd-ed.jpg","assets/poultry_logo-RsWDEZrg.jpg","assets/vendor-db-CViI1DE6.js","assets/vendor-firebase-CqNMPG7D.js","assets/vendor-react-C88NtW8Y.js","assets/vendor-ui-C3712G9a.js","icon-180.png","icon-192.png","icon-512.png","index.html","manifest.webmanifest","vite.svg"].map(path => new URL(path, scope).href));
const home = new URL('index.html', scope).href;

self.addEventListener('install', event => {
    event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
        [...assets].map(url => new Request(url, { cache: 'reload' }))
    )));
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
