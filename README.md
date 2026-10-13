# Yaad — gentle reminders

A small, private PWA for **interval reminders**: drink water, rest your eyes,
stand up, stretch, or anything of your own — repeating every 15 min, 30 min,
1 hour, 2 hours, or a custom interval. Built as a sibling to
[Hisaab](../hisaab): same stack, same calm native-app feel, everything stored
on your device.

## What it does

- **Interval reminders.** Each reminder pings on a repeating interval. Chips
  for 15 m / 30 m / 1 h / 2 h, plus a custom minutes field.
- **Quiet hours & days.** A reminder only fires inside its active window
  (e.g. 8 am–10 pm) and on the weekdays you choose — no pings in the night.
- **Research-backed presets.** One-tap wellness reminders (water, 20-20-20 for
  eyes, move, stretch, posture, breathe) with the evidence behind each
  interval. See [RESEARCH.md](RESEARCH.md).
- **System notifications** with an optional soft chime and vibration, plus a
  **Snooze 10 min** action and a **"Did it"** button with per-reminder daily progress.
- **A full task manager.** A to-do list with **priorities**, **due dates**,
  **repeat rules** (one-off / daily / weekly), **tags**, **notes** and nested
  **subtasks**. Tasks group into **Overdue / Today / Upcoming / No date** smart
  views; search, sort (manual, due, priority, newest, A–Z) and filter by tag.
- **Lists.** Group tasks into named lists (projects); unfiled tasks live in the
  Inbox.
- **Quick-add** in plain language — `Pay rent tomorrow !high #home` fills in the
  due date, priority and tags for you.
- **Gestures & shortcuts.** Swipe a task right to complete, left to delete (with
  Undo); drag to reorder in Manual sort; `n` / `/` keyboard shortcuts.
- **Due-date pings.** A task due today or overdue notifies once a day while the
  app is open (respecting Do Not Disturb).
- **Report** — today's activity, a 7-day trend, per-reminder counts, export to text.
- **Do Not Disturb** — mute everything for 1h / 3h / until tomorrow morning.
- **Test notification** in Settings to check pings actually reach you.
- **Backup & restore** — export/import all reminders, tasks and lists as a JSON file.
- **Private & offline.** No account, no server. Everything lives in the browser's
  IndexedDB on this device only. Installable to the home screen.

See [CHANGELOG.md](CHANGELOG.md) for version history (current: **v1.3.0**).

## How reminders fire (and the honest limit)

The web **cannot** wake a fully-closed page to fire a notification at an exact
minute — the Notification Triggers API that would have allowed it was dropped
by browsers. So Yaad runs its scheduler **in the page**: while the app is open
(including an installed PWA kept running in the background), a ticker checks
every reminder about every 20 seconds and fires the ones that are due. That's
the reliable path.

As a best effort for installed Chrome/Android, a service worker also uses
Periodic Background Sync (`public/sw-reminders.js`) to show a single "you have
reminders waiting" nudge roughly every few hours when the app is closed — but
the browser decides if and how often that runs, so don't rely on it for
minute-accurate pings. For those, keep Yaad installed and open.

## Stack

Astro (static) · Preact · Tailwind v4 · `idb` for IndexedDB · `@vite-pwa/astro`
for the service worker and manifest. Strict CSP: same-origin files only, no
inline scripts or styles.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # scheduling + formatting unit tests
npm run build      # generates icons, type-checks, builds to dist/
npm run preview    # serve the production build (needed to test the PWA/SW)
```

Icons are generated from one SVG by `scripts/make-icons.mjs` (`npm run icons`);
nothing binary is committed.

## Project layout

```
src/
  lib/
    types.ts        Reminder · Task · Project · Preset shapes
    schedule.ts     pure reminder due / next-due logic  (unit-tested)
    scheduler.ts    the in-page ticker that fires reminder + task pings
    notify.ts       permission + the actual notification/sound/vibration
    store.ts        reminders in memory mirrored to IndexedDB + backup
    db.ts           IndexedDB wrapper (idb), schema migrations
    tasks.ts        the to-do store (memory ↔ IndexedDB)
    task-model.ts   task defaults, record migration, repeat logic  (unit-tested)
    task-view.ts    task filter / sort / smart-view grouping  (unit-tested)
    task-schedule.ts when a task's due notification fires  (unit-tested)
    quick-parse.ts  natural-language quick-add parsing  (unit-tested)
    swipe.ts        swipe-gesture thresholds  (unit-tested)
    projects.ts     the lists store (memory ↔ IndexedDB)
    presets.ts      research-backed wellness reminders
    format.ts       time / interval / day formatting  (unit-tested)
    prefs.ts        theme + small settings (localStorage)
  components/
    App.tsx         load → start scheduler → route
    router.ts       hash routing, useData / useTasks / useProjects hooks
    ui.tsx          shared pieces (Header, Segmented, Dialog, SwipeRow, ReorderList, …)
    screens/        Home · ReminderForm · Tasks · Report · Presets · Settings
public/
  sw-reminders.js   background catch-up handler (imported into the SW)
```
