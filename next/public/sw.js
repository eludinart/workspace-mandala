/* Mandala service worker — Web Push */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Mandala', {
        body: data.body || '',
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: { url: data.url || '/app?page=notifications' },
      }),
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
