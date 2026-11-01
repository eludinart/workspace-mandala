/* Mandala service worker — Web Push + offline minimale (TWA / Play) */
const OFFLINE_URL = '/offline.html'
const OFFLINE_CACHE = 'mandala-offline-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      await cache.add(OFFLINE_URL)
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        return await fetch(req)
      } catch {
        const cache = await caches.open(OFFLINE_CACHE)
        const cached = await cache.match(OFFLINE_URL)
        return cached || new Response('Hors ligne', { status: 503, statusText: 'Offline' })
      }
    })()
  )
})

function notifyOpenClients(message) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin)) {
        client.postMessage(message)
      }
    }
  })
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'Mandala',
    body: 'Nouvelle notification',
    url: '/app?page=notifications',
  }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    }
  } catch {
    try {
      const text = event.data && event.data.text()
      if (text) data.body = text
    } catch {
      /* ignore */
    }
  }

  const tag = data.tag ? String(data.tag).slice(0, 64) : ''
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: false,
    // Sans vibration, Android peut classer l'alerte comme silencieuse et ne pas la montrer.
    vibrate: [120, 40, 120],
    data: { url: data.url || '/app?page=notifications' },
    ...(tag ? { tag, renotify: true } : {}),
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Mandala', options),
      // Rafraîchir la cloche / le sous-menu si l'app est ouverte
      notifyOpenClients({
        type: 'MDL_PUSH_RECEIVED',
        title: data.title,
        body: data.body,
        url: data.url,
      }),
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = (event.notification.data && event.notification.data.url) || '/app?page=notifications'
  const targetUrl = new URL(raw, self.location.origin).href

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus()
          client.postMessage({ type: 'MDL_PUSH_NAV', url: raw })
          client.postMessage({ type: 'MDL_PUSH_RECEIVED', url: raw })
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })()
  )
})
