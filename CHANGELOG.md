# Changelog

All notable changes to Yaad are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[semantic versioning](https://semver.org/). The current version is also shown
in the app's Settings screen and written into backup files.

## [Unreleased]

### Changed
- **Home is now a "today" dashboard.** Instead of only listing reminders, the
  first screen opens with a greeting and date, at-a-glance counts (due today,
  overdue, done today, reminders on), the tasks that need attention today
  (overdue + due, with inline check-off and a link to all tasks), and then the
  reminders with their next ping. Tasks and reminders finally share one home.
- **Personal greeting.** Set your name in Settings → You and the Home greeting
  becomes “Good morning, <name>”.

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
