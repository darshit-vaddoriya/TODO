# Yaad — a personal todo & reminder app

A private, offline-first PWA: **tasks with dates, times, repeats and reminders**,
plus gentle **interval reminders** (drink water, rest your eyes, stand up).
No account, no server, no cloud database — everything is stored on your device
(IndexedDB) and it keeps working offline once installed.

## What it does

**Tasks**
- Add, edit, delete and complete tasks with a **title, description, date, time
  and priority**; categories, tags and **subtasks**.
- **Views:** Today · Upcoming · All · Overdue · Completed (a dated history), a
  **Calendar** month view, and a **Categories** screen.
- **Recurring:** daily, weekly (chosen days), monthly or custom (every N days /
  weeks / months). Completing one schedules the next occurrence.
- **Search, filter and sort** (category, tag, priority; manual, due, priority,
  newest, A–Z); drag to reorder; swipe to complete or delete; **Undo** for both.
- **Quick-add** in plain language: `Gym every monday 6:30am !high #health`.
- **Daily progress** on Home and Today; overdue and urgent tasks are highlighted.

**Reminders & notifications**
- **Several reminders per task** (at time, 5 / 10 / 30 min, 1 hour, 1 day before,
  or custom), **snooze** (5–60 min), an optional **daily summary** and
  **overdue** nudges, and **quiet hours**.
- Each reminder fires **once**; it is recalculated when you edit or complete the
  task, and completed tasks never alert.
- Alerts that came due while Yaad wasn't running are shown as **missed
  reminders** when you reopen it.
- Interval reminders with active windows and weekdays, research-backed
  [presets](RESEARCH.md), "Did it" progress, and Do Not Disturb.

**Settings:** theme (light / dark / system), layout (comfortable / compact),
date format, 12 / 24-hour clock, week start, default priority, default reminder
time, snooze length, quiet hours, daily summary, overdue reminders,
notification status + test, install status, backup & restore.

See [CHANGELOG.md](CHANGELOG.md) for version history (current: **v1.4.0**).

## How notifications work — and what they can't promise

The web has **no supported way to wake a closed page at an exact minute** (the
Notification Triggers API that would have allowed it was dropped by browsers),
and a service worker does not run continuously. So Yaad is honest about it:

| Situation | What happens |
| --- | --- |
| **App open** (a tab, or an installed app kept running) | One scheduler checks every ~20 s. Reminders fire on time as an **in-app alert** and, if allowed, a **system notification** with Snooze / Done buttons. |
| **App closed or suspended** | Nothing is guaranteed. On **installed Chrome / Android** only, Periodic Background Sync *may* wake the service worker every few hours for a single "reminders are waiting" nudge — the browser decides if and when. iOS Safari, Firefox and desktop browsers generally won't. |
| **You reopen the app** | Anything that came due while it wasn't running is listed as a **missed reminder** (not a flood of late notifications), where you can mark it done or dismiss it. |
| **Notifications blocked / unsupported** | In-app alerts still show while the app is open, and the app says clearly that system notifications are unavailable. |

If **exact-time alarms while closed** matter to you, a web app can't deliver
that; use your phone's clock or calendar alarms alongside Yaad, or build a
native app. Duplicate delivery is prevented (a tab holds an exclusive lock on
the scheduler, and each alert is recorded as delivered before it is sent).

## Testing on a real device

Unit tests cover the date, recurrence and alert logic; a browser run covers
persistence, offline use, dedupe, missed reminders and snooze. These need a
**real phone/computer**, because headless browsers can't reproduce them:

- [ ] Install the app, allow notifications, and use **Settings → Reminder settings → Send test**.
- [ ] Add a task with an *at time* reminder two minutes ahead; confirm it alerts once with the app open and with it in the background.
- [ ] Close the app, let a reminder pass, reopen: it appears under **Missed reminders**.
- [ ] Switch to airplane mode, reopen from the home screen, create / complete a task; reconnect and refresh.
- [ ] Quit the browser and **restart the device**; confirm tasks, settings and reminders are all still there.
- [ ] Note whether your browser / OS shows any closed-app nudge at all.

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
    types.ts          Reminder · Task · Project · Preset shapes
    task-model.ts     defaults, record migration, repeat + completion logic  (unit-tested)
    task-view.ts      filter / sort / tab views / history / progress          (unit-tested)
    alerts.ts         pure alert planning: fire vs missed, snooze, quiet hours, summary  (unit-tested)
    calendar.ts       month grid + tasks per day, with repeat projection      (unit-tested)
    quick-parse.ts    natural-language quick-add                               (unit-tested)
    format.ts         time / date / interval formatting (12/24h, date styles)  (unit-tested)
    swipe.ts          swipe-gesture thresholds                                  (unit-tested)
    tasks.ts          the to-do store (memory ↔ IndexedDB)
    projects.ts       the categories store
    store.ts          interval reminders + backup / restore
    scheduler.ts      the single in-page scheduler (reminders + task alerts)
    notify.ts         permission + notification / in-app alert / sound / vibration
    schedule.ts       interval-reminder due logic                              (unit-tested)
    db.ts             IndexedDB wrapper (idb), schema migrations
    prefs.ts          settings (localStorage)
  components/
    App.tsx           load → start scheduler → route; nav rail / tab bar / Add button
    router.ts         hash routing + data hooks
    ui.tsx            shared pieces (Header, Segmented, Dialog, SwipeRow, ReorderList, …)
    MissedAlerts.tsx  missed-reminder panel
    screens/          Home · Tasks · TaskEditor · Calendar · Categories · Report ·
                      Presets · ReminderForm · Settings · ReminderSettings
public/
  sw-reminders.js     notification-button routing + best-effort closed-app catch-up
```
