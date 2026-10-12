# Yaad — Design

Sibling to Hisaab, same native-app feel, retuned for a calm wellness tool.
A near-black green canvas (dark) / soft grey-green (light), raised rounded
cards without shadows, bold Manrope headings, full-round pill buttons, and a
floating 3-slot tab bar (Reminders · + · Presets). Tokens live in
`src/styles/global.css`.

| Token | Dark | Light | Role |
|---|---|---|---|
| paper | `#0b0f0e` | `#eef1ef` | Canvas |
| surface | `#14191a` | `#ffffff` | Cards, segmented track |
| field | `#1e2426` | `#e4e8e5` | Inputs, emoji tiles |
| ink | `#eef2f0` | `#0d1110` | Text, headings |
| teal (brand) | `#4fd6b4` | `#0d8f74` | Active toggles, primary buttons, next-ping time |
| accent (danger) | `#ff7a7a` | `#d13434` | Delete |
| haldi | `#f7b955` | `#b26f00` | "Due now" warning |

Type: Manrope Variable (800 for headings, tabular numbers for clocks).
Logo: a white reminder bell with a small drop on a teal rounded tile
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
4. **Brand colour moved from blue to teal-green** so it reads as a calm
   wellness app rather than a fintech one.
```
