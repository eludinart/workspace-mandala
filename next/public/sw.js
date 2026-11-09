/* Mandala service worker — Web Push + offline minimale (TWA / Play) */
const OFFLINE_URL = '/offline.html'
const OFFLINE_CACHE = 'mandala-offline-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      await cache.add(OFFLINE_URL)
    })()
  )
  self.skipWaiting()
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

function isStandaloneDisplay() {
  try {
    if (self.navigator && self.navigator.standalone) return true
  } catch {
    /* ignore */
  }
  try {
    return self.matchMedia && self.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

async function ackPush(sendId, sig, eventName) {
  if (!sendId || !sig) return
  const payload = {
    sendId: Number(sendId),
    sig: String(sig),
    event: eventName,
    standalone: isStandaloneDisplay(),
    userAgent: (self.navigator && self.navigator.userAgent) || '',
  }
  try {
    await fetch('/api/notifications/push_ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      keepalive: true,
    })
  } catch {
    try {
      await fetch('/api/notifications/push_ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
      })
    } catch {
      /* ignore */
    }
  }
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'Mandala',
    body: 'Nouvelle notification',
    url: '/app?page=notifications',
    sendId: 0,
    sig: '',
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
  const url = data.url || '/app?page=notifications'
  const title = data.title || 'Mandala'
  const body = data.body || ''
  const sendId = data.sendId
  const sig = data.sig
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: false,
    vibrate: [120, 40, 120],
    requireInteraction: false,
    data: { url, sendId, sig },
    ...(tag ? { tag, renotify: true } : {}),
  }
  event.waitUntil(
    (async () => {
      await notifyOpenClients({
        type: 'MDL_PUSH_RECEIVED',
        title,
        body,
        url,
      })
      await self.registration.showNotification(title, options)
      await ackPush(sendId, sig, 'delivered')
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const nData = event.notification.data || {}
  const raw = nData.url || '/app?page=notifications'
  const targetUrl = new URL(raw, self.location.origin).href
  const sendId = nData.sendId
  const sig = nData.sig

  event.waitUntil(
    (async () => {
      await ackPush(sendId, sig, 'opened')
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
