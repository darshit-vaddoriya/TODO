/*
 * Imported into the generated service worker (see astro.config.mjs).
 *
 * The web can't schedule a notification for an exact future minute while the
 * app is fully closed, so Yaad's real scheduling runs in the page. This handler
 * is only a best-effort catch-up: on installed Chrome/Android, Periodic
 * Background Sync wakes the worker roughly once every few hours and, if any
 * interval reminder or task reminder has come due, shows a single nudge to
 * reopen the app. The browser decides if and how often it runs.
 *
 * It also routes notification buttons: Snooze / Done on a task notification open
 * the app at #/act/... and the app applies the change (recurrence and alert rules
 * live there, not here).
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

/** Epoch ms for a local "YYYY-MM-DD" date at "HH:MM" (mirrors alerts.ts localMoment). */
function localMoment(date, time) {
  const [y, m, d] = String(date).split('-').map(Number);
  const mins = clockToMinutes(time);
  return new Date(y, (m || 1) - 1, d || 1, Math.floor(mins / 60), mins % 60, 0, 0).getTime();
}

/** Task reminders that have come due and were never delivered (mirrors alerts.ts planAlerts, without quiet hours). */
async function countMissedTaskReminders(db, nowMs) {
  if (!db.objectStoreNames.contains('tasks')) return 0;
  let defaultTime = '09:00';
  if (db.objectStoreNames.contains('meta')) {
    const prefs = await request(db.transaction('meta').objectStore('meta').get('alertPrefs'));
    if (prefs && typeof prefs.defaultReminderTime === 'string') defaultTime = prefs.defaultReminderTime;
  }
  const tasks = await request(db.transaction('tasks').objectStore('tasks').getAll());
  let count = 0;
  for (const t of tasks) {
    if (t.done || !t.dueDate || !Array.isArray(t.reminders)) continue;
    if (t.snoozedUntil && t.snoozedUntil > nowMs) continue;
    const fired = Array.isArray(t.firedAlerts) ? t.firedAlerts : [];
    const due = localMoment(t.dueDate, t.dueTime || defaultTime);
    const hasDue = t.reminders.some((r) => {
      const moment = due - r.offsetMin * 60000;
      return moment <= nowMs && !fired.includes(t.id + ':' + r.id + ':' + moment);
    });
    if (hasDue) count++;
  }
  return count;
}

async function catchUp() {
  const db = await openExistingDb();
  if (!db) return;
  const now = new Date();
  const nowMs = now.getTime();
  let waiting = 0;
  if (db.objectStoreNames.contains('reminders')) {
    const all = await request(db.transaction('reminders').objectStore('reminders').getAll());
    waiting += all.filter((r) => r.enabled && withinWindow(r, now) && nowMs - (r.lastFiredAt || 0) >= r.intervalMin * 60000).length;
  }
  waiting += await countMissedTaskReminders(db, nowMs);
  if (waiting > 0) {
    await self.registration.showNotification('Yaad', {
      body: waiting === 1 ? CATCH_UP_TEXT.one : CATCH_UP_TEXT.many.replace('{n}', String(waiting)),
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

/** Write a change to one reminder, then tell any open page to re-read it. */
async function updateReminder(id, fields) {
  const db = await openExistingDb();
  if (!db || !db.objectStoreNames.contains('reminders')) return db && db.close();
  const store = db.transaction('reminders', 'readwrite').objectStore('reminders');
  const reminder = await request(store.get(id));
  if (reminder) await request(store.put({ ...reminder, ...fields }));
  db.close();
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const w of windows) w.postMessage({ type: 'reminder-changed', id });
}

/** Focus an open Yaad window and send it to `path`, or open one. */
async function openApp(path) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
  if (!open) return self.clients.openWindow(path);
  try {
    await open.focus();
    if ('navigate' in open) await open.navigate(path);
    else open.postMessage({ type: 'navigate', path });
  } catch {
    open.postMessage({ type: 'navigate', path });
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tag = String(event.notification.tag || '');

  // Task notifications (tags "yaad-task-<id>", "yaad-overdue", "yaad-summary"): route through the app.
  if (tag.startsWith('yaad-task-') || tag === 'yaad-overdue' || tag === 'yaad-summary') {
    const taskId = event.notification.data && event.notification.data.taskId;
    let path = '/';
    if (taskId && event.action === 'snooze') path = '/#/act/snooze/' + taskId;
    else if (taskId && event.action === 'done') path = '/#/act/done/' + taskId;
    else if (taskId) path = '/#/task/' + taskId;
    event.waitUntil(openApp(path));
    return;
  }

  // Interval-reminder notifications are tagged "yaad-<id>" (see notify.ts).
  const id = tag.replace(/^yaad-/, '');

  if (event.action === 'snooze' && id) {
    event.waitUntil(updateReminder(id, { snoozedUntil: Date.now() + 10 * 60000 }));
    return;
  }
  if (event.action === 'done' && id) {
    // Restart the interval from now (same as "I did it" in the app).
    event.waitUntil(updateReminder(id, { lastFiredAt: Date.now(), snoozedUntil: null }));
    return;
  }

  // A plain tap opens / focuses the app.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
