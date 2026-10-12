# Changelog

All notable changes to Yaad are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[semantic versioning](https://semver.org/). The current version is also shown
in the app's Settings screen and written into backup files.

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

[1.1.0]: https://github.com/darshit-vaddoriya/TODO/releases/tag/v1.1.0
[1.0.0]: https://github.com/darshit-vaddoriya/TODO/releases/tag/v1.0.0
