# Yaad — Design

Sibling to Hisaab, same native-app feel, retuned for a calm wellness tool.
A near-black green canvas (dark) / soft grey-green (light), raised rounded
cards without shadows, bold Manrope headings, full-round pill buttons, and a
floating 3-slot tab bar (Reminders · + · Presets). Tokens live in
`src/styles/global.css`.

| Token | Dark | Light | Role |
|---|---|---|---|
| paper | `#0e1020` | `#f5f6fb` | Canvas |
| surface | `#161934` | `#ffffff` | Cards, segmented track |
| field | `#21254a` | `#e9ebf6` | Inputs, tiles |
| ink | `#eceefc` | `#121430` | Text, headings |
| muted | `#9aa0c2` | `#585e7d` | Secondary text |
| brand | `#a5b4fc` | `#4338ca` | Primary buttons, links, selected states, open-task marks |
| accent | `#ff7a7a` | `#c42c2c` | Overdue, high priority, delete |
| haldi | `#f7b955` | `#935c00` | Warnings, medium priority |
| info | `#5cc8e6` | `#0b6a86` | Habits, low priority |
| positive | `#52d79a` | `#167745` | Done, success |

All pairs are checked for WCAG AA by `src/styles/palette.test.ts`.

Type: Manrope Variable (800 for headings, tabular numbers for clocks).
Logo: a white reminder bell with a small drop on an indigo rounded tile
(`scripts/make-icons.mjs`, regenerate with `npm run icons`).

## Screens

```
REMINDERS (Home)                      EDIT REMINDER
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ Yaad                      ⚙  │      │ ← New reminder               │
│ [🔔 Turn on notifications ]  │      │ (💧) [ Drink water        ]  │
│──────────────────────────────│      │ Remind me                    │
│ 💧 Drink water          ◯——● │      │ (15m)(30m)(1h)(2h)(every _m) │
│   every 2h · Every day · 8–10│      │ Only between  [08:00]→[22:00]│
│   Next in 1h 20m · 11:20 AM  │      │ On these days  S M T W T F S │
│   · 3 today                  │      │ Vibrate                 ●——◯ │
│──────────────────────────────│      │ [   ✓ Add reminder   ] [🗑]  │
│ 👀 Rest your eyes       ◯——● │      └──────────────────────────────┘
│   every 20m · 9–9 · Next 6m  │
│──────────────────────────────│      PRESETS
│  Reminders   [+]   Presets   │      ┌──────────────────────────────┐
└──────────────────────────────┘      │ ← Wellness presets           │
                                       │ 💧 Drink water        [Add]  │
                                       │   every 2h · 8–10 AM         │
                                       │   ~8 glasses across the day  │
                                       │ 👀 Rest eyes (20-20-20)[Add] │
                                       │ 🧍 Stand up & move    [✓]    │
                                       └──────────────────────────────┘
```

## Decisions

1. **No lock / no PIN.** Hisaab guards money data behind an encrypted vault.
   Reminders aren't sensitive, so Yaad drops the whole crypto layer — the
   privacy promise is simply "it never leaves the device" (plain IndexedDB).
2. **Interval, not clock time.** The whole model is "every N minutes inside a
   window", because that's what the health guidance describes and what the
   brief asked for (15/30/60/120/custom).
3. **Honesty about background limits**, stated in Settings and the README:
   pings are reliable while the app runs; the web can't fire them at an exact
   minute when fully closed. Same stance Hisaab's DESIGN.md takes on bill
   reminders.
4. **Brand colour is indigo** (it was teal-green): green is kept for "done"
   only, so a green mark always means finished, and amber/cyan carry today and habits.
```
