// Service Worker: Offline-Cache + Push-Nachrichten
const CACHE = 'duo-v4';
const SHELL = ['./', './index.html', './style.css', './app.js', './data.js', './backend.js', './crypto.js',
  './vendor/supabase.js', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Supabase-Anfragen nie cachen
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.origin === location.origin) {
    // Netzwerk zuerst (damit Updates sofort ankommen), offline aus dem Cache
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    // Bibliotheken: Cache zuerst (versioniert, ändern sich nie)
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
  }
});

// Push-Inhalte sind Ende-zu-Ende-verschlüsselt und werden erst hier mit eurem Schlüssel geöffnet
async function openPush(c) {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('duo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rec = await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get('couple');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  if (!rec || !c || !c.startsWith('v1:')) return null;
  const raw = Uint8Array.from(atob(c.slice(3)), ch => ch.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, rec.key, raw.subarray(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let msg = null, tag = 'duo';
    try { const d = e.data.json(); tag = d.tag || tag; msg = await openPush(d.c); } catch {}
    msg = msg || { title: 'Duo', body: 'Es gibt Neuigkeiten 💪' };
    await self.registration.showNotification(msg.title || 'Duo', {
    body: msg.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag, renotify: true,
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
