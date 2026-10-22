// Minimal service worker: lets the app show notifications on Android (which requires
// one) and brings the app forward when a reminder notification is tapped.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/daily', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin))
      if (open) return open.focus().then((c) => c.navigate?.(url))
      return self.clients.openWindow(url)
    }),
  )
})
