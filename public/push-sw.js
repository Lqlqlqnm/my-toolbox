// Push 通知 Service Worker
// 此文件放在 public/ 目录，部署后位于根路径 /push-sw.js

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'default',
      renotify: true,
      data: { url: '/' },
    }
    event.waitUntil(self.registration.showNotification(data.title || '通知', options))
  } catch {
    // fallback: plain text
    event.waitUntil(self.registration.showNotification('通知', { body: event.data.text() }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
