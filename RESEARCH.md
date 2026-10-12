# Yaad — the research behind the preset intervals

The wellness presets (`src/lib/presets.ts`) use intervals drawn from widely
published public-health guidance. They are **general nudges, not medical
advice** — individual needs vary, so every preset can be edited after it's
added. Sources below reflect commonly cited guidance as of the app's build.

| Preset | Interval | Why this interval |
|---|---|---|
| 💧 Drink water | every 2h, 8am–10pm | Spreading fluids through the day keeps intake steady. A 2-hour cadence across a 14-hour waking window works out to roughly 8 servings. General adequate-intake figures: ~2.0 L/day total fluids for women and ~2.5 L/day for men (EFSA, 2010), ~2.7 L / 3.7 L total water including food (U.S. National Academies / IOM, 2005). |
| 👀 Rest your eyes (20-20-20) | every 20m, 9am–9pm | The 20-20-20 rule for digital eye strain: every 20 minutes, look at something about 20 feet (6 m) away for 20 seconds. Promoted by the American Optometric Association and the American Academy of Ophthalmology as a simple way to reduce screen-related eye fatigue. |
| 🧍 Stand up & move | every 30m, 9am–6pm | Breaking up prolonged sitting is beneficial independently of planned exercise. Studies and guidelines suggest interrupting sitting at least every 30 minutes; the WHO 2020 physical-activity guidelines advise replacing sedentary time with activity of any intensity. |
| 🤸 Stretch | every 60m, 9am–6pm | A brief hourly movement/stretch break helps counter the neck, shoulder and wrist load of continuous desk and screen work (ergonomics guidance, e.g. OSHA computer-workstation recommendations). |
| 🪑 Posture check | every 45m, 9am–6pm | A periodic cue to reset shoulder position and screen height supports neutral posture during long seated work; 30–60 minutes is the commonly cited window for a micro-break. |
| 🫁 Breathe & reset | every 90m, 9am–9pm | Attention and energy tend to move in ~90-minute "ultradian" cycles; pausing for a real break between focus blocks is a widely recommended productivity and stress-management practice. |

## Why these are *interval* reminders

Yaad reminds on a repeating interval rather than at fixed clock times because
that's what most of this guidance is about — a *cadence* ("every 20 minutes",
"at least every 30 minutes") within your waking/working window, not a specific
appointment. The active-hours window on each preset keeps pings out of your
quiet time.

## A note on honesty

These are starting points. If a clinician has given you specific advice
(fluid limits, eye conditions, mobility needs), follow that and adjust the
presets to match.
