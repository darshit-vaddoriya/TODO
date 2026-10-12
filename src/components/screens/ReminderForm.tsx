/** Add or edit one reminder. */
import { useMemo, useState } from 'preact/hooks';
import { formatInterval, WEEKDAY_LABELS } from '../../lib/format';
import { pingsPerDay } from '../../lib/schedule';
import { blankReminder, getReminder, remove, save } from '../../lib/store';
import { toast } from '../../lib/toast';
import { INTERVAL_PRESETS, type Reminder, type Weekday } from '../../lib/types';
import { back, go } from '../router';
import { Dialog, Field, Header, Icon, Page, Switch } from '../ui';

const EMOJIS = ['⏰', '💧', '👀', '🧍', '🤸', '🪑', '🫁', '💊', '🍎', '🧘', '🚶', '📞', '📨', '🦷', '🌿', '☕'];
const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function ReminderForm({ id }: { id?: string }) {
  const existing = id ? getReminder(id) : undefined;
  const isNew = !existing;
  const [r, setR] = useState<Reminder>(() => existing ?? blankReminder());
  const [custom, setCustom] = useState(() => (INTERVAL_PRESETS.includes(r.intervalMin as (typeof INTERVAL_PRESETS)[number]) ? '' : String(r.intervalMin)));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Reminder>(key: K, value: Reminder[K]) => setR((prev) => ({ ...prev, [key]: value }));

  const perDay = useMemo(() => pingsPerDay(r), [r.intervalMin, r.startTime, r.endTime]);
  const validInterval = r.intervalMin >= 1;
  const validWindow = r.startTime < r.endTime;
  const canSave = r.title.trim().length > 0 && validInterval && validWindow;

  const onSave = async () => {
    if (!canSave) return;
    await save({ ...r, title: r.title.trim() });
    toast(isNew ? 'Reminder added' : 'Saved');
    back();
  };

  const onDelete = async () => {
    if (!existing) return;
    await remove(existing.id);
    toast('Reminder deleted');
    go('/');
  };

  const toggleDay = (day: Weekday) => {
    const base = r.days.length === 0 ? [...ALL_DAYS] : [...r.days];
    const next = base.includes(day) ? base.filter((d) => d !== day) : [...base, day];
    set('days', next.length === 7 ? [] : (next.sort((a, b) => a - b) as Weekday[]));
  };
  const dayOn = (day: Weekday) => r.days.length === 0 || r.days.includes(day);

  return (
    <>
      <Header title={isNew ? 'New reminder' : 'Edit reminder'} showBack />
      <Page class="space-y-5">
        {/* Title + emoji */}
        <div class="card flex items-center gap-3">
          <details class="relative">
            <summary class="grid size-12 cursor-pointer list-none place-items-center rounded-[14px] bg-field text-2xl" aria-label="Choose emoji">
              {r.emoji}
            </summary>
            <div class="absolute z-30 mt-2 grid w-64 grid-cols-6 gap-1 rounded-[18px] border border-rule bg-surface p-2 shadow-2xl">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  class={`grid size-9 place-items-center rounded-xl text-xl ${r.emoji === e ? 'bg-field' : ''}`}
                  onClick={(ev) => {
                    set('emoji', e);
                    (ev.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </details>
          <input
            class="field flex-1"
            placeholder="What to remind you of"
            value={r.title}
            maxLength={60}
            onInput={(e) => set('title', e.currentTarget.value)}
          />
        </div>

        {/* Interval */}
        <Field label="Remind me" hint={validWindow && perDay > 0 ? `About ${perDay} ${perDay === 1 ? 'ping' : 'pings'} a day in this window.` : undefined}>
          <div class="flex flex-wrap gap-2">
            {INTERVAL_PRESETS.map((m) => (
              <button
                type="button"
                key={m}
                role="radio"
                aria-checked={r.intervalMin === m && custom === ''}
                class="chip"
                onClick={() => {
                  set('intervalMin', m);
                  setCustom('');
                }}
              >
                every {formatInterval(m)}
              </button>
            ))}
            <div class={`chip gap-2 ${custom !== '' ? 'bg-teal text-on-teal' : ''}`}>
              <span>every</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                class="w-14 bg-transparent text-center font-bold outline-none"
                placeholder="min"
                value={custom}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  setCustom(v);
                  const n = parseInt(v, 10);
                  if (n >= 1) set('intervalMin', n);
                }}
              />
              <span>min</span>
            </div>
          </div>
        </Field>

        {/* Active window */}
        <Field label="Only between" hint={!validWindow ? 'The end time must be after the start time.' : 'No pings outside these hours (your quiet time).'}>
          <div class="flex items-center gap-3">
            <input type="time" class="field flex-1 tnum" value={r.startTime} onInput={(e) => set('startTime', e.currentTarget.value)} />
            <span class="text-muted">to</span>
            <input type="time" class="field flex-1 tnum" value={r.endTime} onInput={(e) => set('endTime', e.currentTarget.value)} />
          </div>
        </Field>

        {/* Days */}
        <Field label="On these days">
          <div class="flex justify-between gap-1.5">
            {ALL_DAYS.map((d) => (
              <button
                type="button"
                key={d}
                aria-pressed={dayOn(d)}
                aria-label={`Day ${d}`}
                class={`grid size-11 flex-1 place-items-center rounded-full font-bold ${dayOn(d) ? 'bg-teal text-on-teal' : 'bg-field text-muted'}`}
                onClick={() => toggleDay(d)}
              >
                {WEEKDAY_LABELS[d]}
              </button>
            ))}
          </div>
        </Field>

        {/* Vibrate */}
        <div class="card flex items-center gap-3">
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">Vibrate</span>
            <span class="block text-[0.8125rem] text-muted">Buzz the phone with each ping, where supported.</span>
          </span>
          <Switch checked={r.vibrate} onChange={(on) => set('vibrate', on)} label="Vibrate on ping" />
        </div>

        <div class="flex gap-3 pt-1">
          <button type="button" class="btn btn-primary flex-1" onClick={() => void onSave()} disabled={!canSave}>
            <Icon name="check" size={20} /> {isNew ? 'Add reminder' : 'Save'}
          </button>
          {existing && (
            <button type="button" class="btn btn-quiet px-4 text-accent" onClick={() => setConfirmDelete(true)} aria-label="Delete reminder">
              <Icon name="trash" size={20} />
            </button>
          )}
        </div>
      </Page>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this reminder?">
        <p class="text-muted">“{r.title}” will be removed. This can’t be undone.</p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn btn-quiet flex-1" onClick={() => setConfirmDelete(false)}>
            Keep
          </button>
          <button type="button" class="btn flex-1 bg-accent text-on-accent" onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </Dialog>
    </>
  );
}
