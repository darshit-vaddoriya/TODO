/*
 * Imported into the generated service worker (see astro.config.mjs).
 *
 * The web can't schedule a notification for an exact future minute while the
 * app is fully closed, so Yaad's real scheduling runs in the page. This handler
 * is only a best-effort catch-up: on installed Chrome/Android, Periodic
 * Background Sync wakes the worker roughly once every few hours and, if any
 * enabled reminder is overdue, shows a single nudge to reopen the app.
 */
const CATCH_UP_TEXT = {
  one: 'A reminder is waiting. Open Yaad to catch up.',
  many: '{n} reminders are waiting. Open Yaad to catch up.',
};

function openExistingDb() {
  return new Promise((resolve) => {
    const req = indexedDB.open('yaad');
    // Never create the database from here — the app owns its schema.
    req.onupgradeneeded = () => req.transaction.abort();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function request(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function clockToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function withinWindow(r, now) {
  const days = r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(now.getDay())) return false;
  const mins = minutesOfDay(now);
  return mins >= clockToMinutes(r.startTime) && mins <= clockToMinutes(r.endTime);
}

async function catchUp() {
  const db = await openExistingDb();
  if (!db || !db.objectStoreNames.contains('reminders')) return db && db.close();
  const all = await request(db.transaction('reminders').objectStore('reminders').getAll());
  const now = new Date();
  const nowMs = now.getTime();
  const overdue = all.filter(
    (r) => r.enabled && withinWindow(r, now) && nowMs - (r.lastFiredAt || 0) >= r.intervalMin * 60000,
  );
  if (overdue.length > 0) {
    await self.registration.showNotification('Yaad', {
      body: overdue.length === 1 ? CATCH_UP_TEXT.one : CATCH_UP_TEXT.many.replace('{n}', String(overdue.length)),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'yaad-catchup',
    });
  }
  db.close();
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'yaad-catchup') event.waitUntil(catchUp());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
