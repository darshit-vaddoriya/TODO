# Changelog

All notable changes to Yaad are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[semantic versioning](https://semver.org/). The current version is also shown
in the app's Settings screen and written into backup files.

## [2.2.0] — 2026-10-16

### Changed
- **New colour theme.** The all-green look is replaced by an indigo brand with a
  cool-white (light) or deep-navy (dark) canvas; amber marks today and warnings,
  cyan marks habits and low priority, and green now only ever means *done*. Every
  pair still passes WCAG AA (checked by a test). The app icon, launch screens,
  Android widget and status-bar colours follow.
- **Calendar is easier to read.** Rows are separated, today has a ring and the
  selected day a filled circle, marks are larger and show state by colour *and*
  shape (open, overdue, done, hollow ring for a future repeat), busy days show
  "+N", a legend explains the marks, and the day list says "N to do · M done".
- The `teal` colour token is now called `brand`.

## [2.1.1] — 2026-10-16

### Changed
- **Custom reminder intervals** (any 1–1440 minutes) are sturdier: the box can't
  be saved empty or at 0, a number above a day is capped, and the form states
  the result ("Every 7m — about 103 pings a day").
- **Exact cadence**: a repeating reminder keeps its rhythm instead of drifting a
  few seconds later with every ping (the check that notices it runs every ~20 s).
- Changing a reminder's interval restarts the count from now, so it no longer
  pings straight away because of the old schedule.
- Android: up to 48 upcoming pings per reminder (200 in all) are scheduled while
  the app is closed, so short intervals cover several hours. Very short
  intervals (under 5 minutes) only ring on time for that stretch until you open
  Yaad again.

## [2.1.0] — 2026-10-16

### Added
- **Real notifications in the Android app** (`@capacitor/local-notifications`).
  Task alerts and repeating reminders are scheduled with the phone's alarm
  system ahead of time, so they ring while Yaad is closed. The plan (next two
  weeks of task alerts, next two days of pings) respects quiet hours, snooze and
  Do Not Disturb and is rebuilt whenever your data changes.
- Snooze / Done buttons on notifications, tapping opens the task, a Reminders
  channel, and a status-bar icon.
- Overdue nudges, the morning summary and the test notification post immediately
  while the app is running.

### Notes
- Needs the notification permission (and, on newer Android, "Alarms & reminders"
  for exact timing; otherwise Android may delay a ping by a few minutes).
- Browsers and the PWA behave as before.

## [2.0.0] — 2026-10-16

### Added
- **Today widget** on Home: concentric rings for tasks done and reminder pings
  acknowledged, with an overdue shortcut.
- **App icon badge** (Badging API) showing tasks due or overdue; toggle in Settings.
- **New logo and icon set**: any-purpose, maskable and monochrome (Android themed)
  icons, Apple touch icon, notification badge, iOS launch images.
- **Long-press shortcuts**: Add a task, Today's tasks, Calendar, New reminder.
- ARCHITECTURE.md.

### Changed
- **Filtering**: the tab bar and chip rows are gone. A filter icon opens a sheet
  (view, category, priority, tag) and a sort icon opens the order sheet.
- **Layered code structure**: `domain`, `data`, `services`, `ui`, with a test that
  enforces the dependency rules. Projects are now called Categories; existing
  data and backups migrate automatically.

## [1.5.0] — 2026-10-16

A UX pass: less chrome, clearer hierarchy, more feedback.

### Changed
- **Tasks screen** is compact: the first task is now visible without scrolling
  on a phone. The five views are one tab bar whose numbers show what is in each
  (Overdue turns red); today's progress is a single thin strip; search and the
  category chips are slimmer, with sort / priority / tag filters behind one
  button.
- **Task rows** are easier to scan: a priority flag instead of a dot, icons for
  the date, reminder, repeat, subtasks and category, today in teal and overdue in
  red, and a 44 px check target.
- **Home** leads with a single *Today* card — a progress ring, "3 tasks to go",
  and tappable due / overdue chips — instead of four tiles plus a progress card.
  The greeting is the title ("Good morning, Darshit"), and a new **Coming up**
  list previews the next few tasks.
- **Task editor**: one-tap times (9 AM, noon, 3 PM, 6 PM, 9 PM), reminders sit
  right under the date, and a bolder title field.
- **Calendar** no longer puts a dot on every day for a daily task.
- **Toasts** sit above the Add button and tab bar, are two lines (title + detail)
  and show at most two at a time.
- Empty states have an icon and a clear next step.
- **Colour theme tuned to WCAG AA.** An audit found the light theme failing in
  many places (teal and amber text at 3.5–4.1:1, white-on-teal buttons at 4.0:1,
  unchecked boxes at 2.1:1). Brand teal, amber, red and muted grey are each
  darkened by the minimum needed, so all text and controls now pass in both
  themes. Switches and checkboxes have a visible outline, priority flags use
  distinct colours (high red, medium amber, low blue), the warning toast has
  readable text, and the browser/status-bar colour follows the light or dark
  scheme from the first paint. A unit test reads the tokens from the stylesheet
  and fails if any pair drops below AA.

### Added
- **Completion feedback**: the check pops, the row slides away, and a light
  vibration on phones; Undo still works.
- A **startup splash** instead of a blank screen, subtle card shadows in light
  mode, and press feedback on buttons and chips.

## [1.4.0] — 2026-10-15

A full personal todo-and-reminder app: everything stays on the device, works
offline, and uses the best notification support the browser offers — without
promising what the web can't do.

### Added
- **Task editor** (Add / Edit): title, description, date **and time**, priority,
  category, tags, **repeat** (daily, weekly on chosen days, monthly, custom
  every N days / weeks / months), **several reminders per task** (at time, 5 /
  10 / 30 min, 1 hour, 1 day before, or custom), and subtasks.
- **Task views**: Today, Upcoming, All, Overdue and Completed, with counts; the
  Completed view is a dated **history** (repeating tasks show once per day done).
- **Calendar**: a month grid (week starts Monday or Sunday), repeating tasks
  projected forward, and a day panel to complete or add tasks.
- **Categories** screen (formerly "lists"): counts, rename, delete (tasks go back
  to the Inbox).
- **Recurring tasks advance on completion** to their next occurrence, reset
  their subtasks and reminders, and are logged in the history.
- **Notifications that don't lie.** One scheduler (serialized, exclusive across
  tabs) fires each reminder **once**; recalculates when a task is edited or
  completed; never alerts for completed tasks; **snooze** (5 / 10 / 15 / 30 /
  60 min) from the in-app alert or the notification button; and shows alerts
  that came due while the app was closed as **missed reminders** on reopening
  instead of flooding late notifications. Quiet hours hold alerts overnight.
  In-app alerts always show, even with notifications blocked, and the app says
  clearly when they are blocked or unavailable.
- **Daily summary** and **overdue** reminders (each optional).
- **Settings**: theme, layout (comfortable / compact), date format, 12 / 24-hour
  clock, week start, default priority, default reminder time, snooze length,
  quiet hours, daily summary, overdue reminders, notification status + test,
  install status. A separate **Reminder settings** screen holds the
  notification options and the honest limits of closed-app notifications.
- **Floating Add Task button**, and a **left navigation rail** on desktop.
- Quick-add now understands times and repeats: `Gym every monday 6:30am !high #health`.
- Best-effort **closed-app catch-up** (installed Chrome / Android only): the
  service worker can nudge about task reminders that came due while closed.

### Changed
- Reminders are explicit per task. The old automatic once-a-day "due today" ping
  is gone; use a reminder, or the overdue / daily-summary options.
- Stored tasks and backups migrate automatically (the old `daily` flag and
  `everyNDays` rule become the new repeat rules). Backup files are version 5;
  older files still import.
- **Home is now a "today" dashboard.** Instead of only listing reminders, the
  first screen opens with a greeting and date, at-a-glance counts (due today,
  overdue, done today, reminders on), the tasks that need attention today
  (overdue + due, with inline check-off and a link to all tasks), and then the
  reminders with their next ping. Tasks and reminders finally share one home.
- **Personal greeting.** Set your name in Settings → You and the Home greeting
  becomes “Good morning, <name>”.

### Fixed
- A reminder whose moment had already passed when it was saved (for example
  "1 day before" on a task due tomorrow evening) no longer appears instantly as
  a missed reminder.

## [1.3.0] — 2026-10-13

### Added
- **A full task manager.** The Tasks screen now has priorities (None / Low /
  Medium / High with coloured markers), **due dates**, and per-task **repeat
  rules** (once / daily / weekly). Tasks group into **smart views** — Overdue,
  Today, Upcoming, No date — and completed tasks sit below.
- **Search, sort and tag filter.** Search across title, notes, tags and
  subtasks; sort by manual order, due date, priority, newest, or A–Z; and
  filter by tag chips.
- **Inline editing & subtasks.** Tap a task to expand it and edit its priority,
  due date, repeat, notes and tags, and add a **nested subtask checklist** with
  its own progress count.
- **Natural-language quick-add.** Type `Pay rent tomorrow !high #home` and the
  due date, priority and tags are pulled out automatically; anything not
  recognised stays in the title.
- **Undo delete.** Deleting a task shows an **Undo** toast that restores it
  exactly as it was.
- **Keyboard shortcuts** on the Tasks screen: `n` to jump to the add box, `/`
  to jump to search.
- **Swipe actions.** Swipe a task right to complete it, left to delete it (with
  the same Undo toast); the coloured action shows behind the row as it moves,
  and vertical scrolling still works.
- **Drag to reorder.** With the **Manual** sort selected (and no filter active),
  the to-do list shows a drag grip on each row; press and drag to reorder, and
  the new order is saved. Works with touch and mouse.
- **Due-date notifications.** While Yaad is open, a task that is due today or
  overdue pings once a day (respecting Do Not Disturb, and not before 7 am).
- **Lists (projects).** Group tasks into named lists with a chip row (All /
  Inbox / your lists / + New); new tasks join the selected list, each task can
  be moved between lists, and deleting a list sends its tasks back to the Inbox.

### Changed
- **Task data model** now carries notes, a due date, a priority, tags, nested
  subtasks, a manual sort order, a list, and a richer repeat rule (one-off,
  daily, weekly on chosen weekdays, or every N days) in place of the old
  `daily` flag. Stored tasks and imported backups are migrated forward
  automatically (IndexedDB schema v4); backup files are now version 4 and older
  backups still import.

## [1.2.0] — 2026-10-13

### Added
- **Daily tasks (to-do list)** — a new Tasks tab: add one-off tasks or ones that
  **repeat every day** (reset each morning), check them off, and clear completed.
- **Report** — a new Report tab: today's reminder completions and tasks done, a
  **last-7-days** activity chart, per-reminder counts, and **export to a .txt file**.
  Activity is logged on-device (last 30 days) in the `meta` store.
- **Send a test notification** in Settings → Pings, to diagnose when reminders
  aren't arriving, with guidance to install + allow notifications.

### Changed
- Bottom navigation is now Reminders · Tasks · [+] · Report · Presets.
- Backups now include tasks as well as reminders (backup format v2; older
  reminder-only backups still import).
- IndexedDB upgraded to v2 (adds the `tasks` store); existing data is preserved.

## [1.1.0] — 2026-10-13

### Added
- **Do Not Disturb** — pause every reminder for 1 hour, 3 hours, or until
  tomorrow morning, from the Home header or Settings.
- **"Did it" + daily progress** — each reminder tile has a progress bar
  (completions today vs. the window's target) and a "Did it" button that logs
  a completion and restarts the interval.
- **Snooze** — a "Snooze 10 min" action on every notification (handled by the
  service worker and synced back to the app), plus a Snooze button on each tile.
- **Test ping** — "Send a test ping now" in the reminder form, to preview the
  notification immediately.
- **Backup & restore** — export all reminders to a JSON file and import them
  back, from Settings.
- **"Next up" summary** on Home showing the soonest upcoming reminder.
- **App version** shown in Settings; this changelog added.

### Changed
- The paused-reminders list on Home is now labelled "Off" (a disabled reminder),
  distinct from the new Do Not Disturb pause.

## [1.0.0] — 2026-10-11

### Added
- Initial release: interval reminders (15m / 30m / 1h / 2h / custom) with an
  active time window and weekday selection.
- Research-backed wellness presets (water, 20-20-20 eyes, move, stretch,
  posture, breathe) — see [RESEARCH.md](RESEARCH.md).
- System notifications with optional chime and vibration; in-page scheduler.
- Offline-first PWA, installable, all data stored on-device in IndexedDB.

[1.2.0]: https://github.com/darshit-vaddoriya/TODO/releases/tag/v1.2.0
[1.1.0]: https://github.com/darshit-vaddoriya/TODO/releases/tag/v1.1.0
[1.0.0]: https://github.com/darshit-vaddoriya/TODO/releases/tag/v1.0.0
