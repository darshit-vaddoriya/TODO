# Architecture

Yaad is a static Astro page that mounts one Preact app. Everything runs in the
browser; data lives in IndexedDB (tasks, categories, reminders) and localStorage
(settings).

## Layers

```
ui  →  services  →  data  →  domain
```

| Layer      | Holds                                                         | May import        | Must not use                     |
| ---------- | ------------------------------------------------------------- | ----------------- | -------------------------------- |
| `domain`   | Types, dates, repeat rules, alert planning, filters, progress | itself            | DOM, storage, Notification, Preact |
| `data`     | IndexedDB / localStorage stores, backup, stats                | domain            | Preact, UI                       |
| `services` | Scheduler, notifications, badge, PWA, toasts                  | domain, data      | Preact UI                        |
| `ui`       | Components, routing, features                                 | everything below  | —                                |

`src/architecture.test.ts` checks these rules and that `domain` contains no
browser API, so logic stays unit-testable.

Features under `src/ui/features/*` do not import from one another; shared pieces
live in `src/ui/components` and `src/ui/shared`.

## Runtime

- **One scheduler** (`services/scheduler.ts`) ticks in the page, plans alerts with
  the pure `domain/alerts.ts`, and uses Web Locks so two tabs never double-fire.
  Alerts are keyed `taskId:reminderId:moment` so each fires once; recent ones fire,
  older ones appear as "missed".
- **Closed-app limits**: a PWA cannot guarantee notifications while closed.
  `public/sw-reminders.js` handles notification buttons and a best-effort
  periodic-sync catch-up.
- **Routing** is hash-based so the scheduler and store survive navigation.
- **CSP** is strict (`'self'` only, no inline script or style).
- **Palette** tokens in `styles/global.css` are checked for WCAG AA by a test.

## Data

IndexedDB stores: `tasks`, `projects` (the store name is kept for existing users;
the app calls them categories), `reminders`. Records are normalised on read, which
is where legacy fields migrate (`projectId` → `categoryId`). Backups are versioned
(currently 6) and still accept older files.

## Android (Capacitor)

The same web build runs in a WebView. Native pieces live in `android/` (a widget
provider and a `YaadWidget` plugin) and talk to the app through two services:
`services/widget.ts` sends a summary computed by `domain/widget.ts`, and
`services/native-notify.ts` schedules alerts planned by `domain/native-schedule.ts`
with `@capacitor/local-notifications`. Both are no-ops in a browser.
