/**
 * Add / Edit Task: title, description, date and time, priority, category, tags,
 * repeat (daily / weekly on chosen days / monthly / custom), several reminders,
 * and subtasks. Edits are held in a draft and only written on Save. Adding a
 * reminder asks for notification permission, and says plainly when
 * notifications are blocked or unavailable.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { offsetLabel } from '../../lib/alerts';
import { addDays, dayOfMonth, newTaskId, normalizeTask, weekdayOf } from '../../lib/task-model';
import { formatClock, localDate } from '../../lib/format';
import { notificationsSupported, permission, requestPermission } from '../../lib/notify';
import { getPrefs } from '../../lib/prefs';
import { allTags } from '../../lib/task-view';
import { completeTaskById, getTask, removeTask, restoreTask, saveTask } from '../../lib/tasks';
import { toast } from '../../lib/toast';
import type { Priority, RepeatRule, RepeatUnit, Task, Weekday } from '../../lib/types';
import { back, go, useProjects, useTasks } from '../router';
import { Empty, Field, Header, Icon, Page, Section, Segmented } from '../ui';

const PRIORITY_OPTS: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

type RepeatKind = RepeatRule['kind'];
const REPEAT_OPTS: { value: RepeatKind; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

/** One-tap times of day. */
const QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00', '21:00'];

/** Quick reminder choices, in minutes before the due moment. */
const REMINDER_PRESETS = [0, 5, 10, 30, 60, 1440];
const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function blankTask(dateHint: string | null): Task {
  const now = Date.now();
  return normalizeTask({ id: newTaskId(), title: '', priority: getPrefs().defaultPriority, dueDate: dateHint, order: now, createdAt: now, updatedAt: now }, now);
}

/** Build a repeat rule of `kind`, keeping what the current rule already knows. */
function ruleFor(kind: RepeatKind, current: RepeatRule, dueDate: string): RepeatRule {
  switch (kind) {
    case 'none':
      return { kind: 'none' };
    case 'daily':
      return { kind: 'daily' };
    case 'weekly':
      return { kind: 'weekly', days: current.kind === 'weekly' && current.days.length > 0 ? current.days : [weekdayOf(dueDate)] };
    case 'monthly':
      return { kind: 'monthly', day: dayOfMonth(dueDate) };
    case 'custom':
      return current.kind === 'custom' ? current : { kind: 'custom', every: 2, unit: 'days' };
  }
}

export function TaskEditor({ id, dateHint }: { id?: string; dateHint?: string }) {
  const isNew = !id || id === 'new';
  const existing = isNew ? undefined : getTask(id);
  const [draft, setDraft] = useState<Task | null>(() => (isNew ? blankTask(dateHint ?? null) : (existing ?? null)));
  const [subTitle, setSubTitle] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customUnit, setCustomUnit] = useState<keyof typeof UNIT_MINUTES>('minutes');
  const [perm, setPerm] = useState(permission());
  const projects = useProjects();
  const tasks = useTasks();
  const titleRef = useRef<HTMLInputElement>(null);
  const prefs = getPrefs();
  const knownTags = useMemo(() => allTags(tasks), [tasks]);

  useEffect(() => {
    if (isNew) titleRef.current?.focus();
  }, []);

  if (!draft) {
    return (
      <>
        <Header title="Task" showBack />
        <Page>
          <Empty title="Task not found" body="It may have been deleted.">
            <button type="button" class="btn btn-primary" onClick={() => go('/tasks')}>
              Back to tasks
            </button>
          </Empty>
        </Page>
      </>
    );
  }

  const set = (patch: Partial<Task>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const today = localDate();

  // --- Date, time ---
  const setDate = (dueDate: string | null) => {
    setDraft((d) => {
      if (!d) return d;
      // Keep a monthly rule on the new date's day; drop time and reminders with the date.
      const repeat: RepeatRule = dueDate && d.repeat.kind === 'monthly' ? { kind: 'monthly', day: dayOfMonth(dueDate) } : d.repeat;
      return dueDate ? { ...d, dueDate, repeat } : { ...d, dueDate: null, dueTime: null, reminders: [], repeat: { kind: 'none' } };
    });
  };

  // --- Repeat ---
  const setRepeatKind = (kind: RepeatKind) => {
    setDraft((d) => {
      if (!d) return d;
      const dueDate = d.dueDate ?? today; // a repeating task needs a date to repeat from
      return { ...d, dueDate, repeat: ruleFor(kind, d.repeat, dueDate) };
    });
  };
  const toggleDay = (day: Weekday) => {
    if (draft.repeat.kind !== 'weekly') return;
    const days = draft.repeat.days.includes(day) ? draft.repeat.days.filter((x) => x !== day) : [...draft.repeat.days, day];
    if (days.length > 0) set({ repeat: { kind: 'weekly', days } }); // keep at least one day
  };

  // --- Reminders ---
  const hasReminder = (offset: number) => draft.reminders.some((r) => r.offsetMin === offset);
  const toggleReminder = async (offset: number) => {
    if (hasReminder(offset)) {
      set({ reminders: draft.reminders.filter((r) => r.offsetMin !== offset) });
      return;
    }
    set({ reminders: [...draft.reminders, { id: newTaskId(), offsetMin: offset }].sort((a, b) => b.offsetMin - a.offsetMin) });
    // Enabling reminders is the moment to ask for permission.
    if (notificationsSupported() && permission() === 'default') {
      setPerm(await requestPermission());
    }
  };
  const addCustomReminder = () => {
    const n = Math.floor(Number(customAmount));
    if (!Number.isFinite(n) || n < 1 || n > 60 * 24 * 60) return;
    const offset = n * UNIT_MINUTES[customUnit];
    setCustomAmount('');
    if (!hasReminder(offset)) void toggleReminder(offset);
  };
  const customOffsets = draft.reminders.map((r) => r.offsetMin).filter((o) => !REMINDER_PRESETS.includes(o));

  // --- Tags ---
  const toggleTag = (tag: string) => set({ tags: draft.tags.includes(tag) ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag] });

  // --- Subtasks ---
  const addSub = () => {
    const title = subTitle.trim();
    if (!title) return;
    set({ subtasks: [...draft.subtasks, { id: newTaskId(), title, done: false }] });
    setSubTitle('');
  };

  // --- Save / delete / complete ---
  const save = async () => {
    if (!draft.title.trim()) {
      toast('Give the task a title.', { tone: 'warn' });
      titleRef.current?.focus();
      return;
    }
    await saveTask(draft);
    toast(isNew ? 'Task added' : 'Task saved');
    back();
  };
  const remove = () => {
    const snapshot = existing!;
    void removeTask(snapshot.id);
    toast('Task deleted', { action: { label: 'Undo', run: () => void restoreTask(snapshot) } });
    back();
  };
  const complete = async () => {
    const before = await completeTaskById(draft.id);
    if (before) toast(before.repeat.kind === 'none' ? 'Task completed' : 'Done — next occurrence scheduled', { action: { label: 'Undo', run: () => void restoreTask(before) } });
    back();
  };

  const weekOrder: Weekday[] = prefs.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const repeat = draft.repeat;
  const notifyBlocked = draft.reminders.length > 0 && (!notificationsSupported() || perm === 'denied');

  return (
    <>
      <Header title={isNew ? 'New task' : 'Edit task'} showBack />
      <Page class="!pb-40">
        <Section>
          <div class="card space-y-3">
            <Field label="Title">
              <input
                ref={titleRef}
                class="field !text-[1.125rem] !font-bold"
                placeholder="What needs doing?"
                value={draft.title}
                maxLength={120}
                onInput={(e) => set({ title: e.currentTarget.value })}
                onKeyDown={(e) => e.key === 'Enter' && void save()}
              />
            </Field>
            <Field label="Description">
              <textarea class="field !min-h-20 resize-y" placeholder="Details, links, notes…" value={draft.notes} maxLength={1000} onInput={(e) => set({ notes: e.currentTarget.value })} />
            </Field>
          </div>
        </Section>

        <Section title="When">
          <div class="card space-y-3">
            <div class="flex flex-wrap gap-2">
              {[
                { label: 'Today', date: today },
                { label: 'Tomorrow', date: addDays(today, 1) },
                { label: 'Next week', date: addDays(today, 7) },
              ].map((c) => (
                <button key={c.label} type="button" class="chip" aria-pressed={draft.dueDate === c.date} onClick={() => setDate(c.date)}>
                  {c.label}
                </button>
              ))}
              <button type="button" class="chip" aria-pressed={draft.dueDate === null} onClick={() => setDate(null)}>
                No date
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="section-label flex-1">Date</span>
              <input type="date" class="field !min-h-11 !w-auto !py-1.5" value={draft.dueDate ?? ''} onInput={(e) => setDate(e.currentTarget.value || null)} aria-label="Due date" />
            </div>
            <div class="flex items-center gap-2">
              <span class="section-label flex-1">Time</span>
              <input
                type="time"
                class="field !min-h-11 !w-auto !py-1.5 disabled:opacity-40"
                value={draft.dueTime ?? ''}
                disabled={!draft.dueDate}
                onInput={(e) => set({ dueTime: e.currentTarget.value || null })}
                aria-label="Due time"
              />
              {draft.dueTime && (
                <button type="button" class="grid size-9 place-items-center rounded-full text-muted active:bg-field" aria-label="Clear time" onClick={() => set({ dueTime: null })}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            {draft.dueDate && (
              <div class="flex flex-wrap gap-2" role="group" aria-label="Quick times">
                {QUICK_TIMES.map((t) => (
                  <button key={t} type="button" class="chip !min-h-9 !px-3 text-[0.8125rem]" aria-pressed={draft.dueTime === t} onClick={() => set({ dueTime: t })}>
                    {formatClock(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Priority">
          <div class="card">
            <Segmented label="Priority" options={PRIORITY_OPTS} value={draft.priority} onChange={(v) => set({ priority: v })} />
          </div>
        </Section>

        <Section title="Reminders">
          <div class="card space-y-3">
            {!draft.dueDate ? (
              <p class="text-[0.875rem] text-muted">Set a date to add reminders.</p>
            ) : (
              <>
                <div class="flex flex-wrap gap-2">
                  {REMINDER_PRESETS.map((o) => (
                    <button key={o} type="button" class="chip" aria-pressed={hasReminder(o)} onClick={() => void toggleReminder(o)}>
                      {offsetLabel(o)}
                    </button>
                  ))}
                  {customOffsets.map((o) => (
                    <button key={o} type="button" class="chip" aria-pressed onClick={() => void toggleReminder(o)}>
                      {offsetLabel(o)} <Icon name="close" size={14} />
                    </button>
                  ))}
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    class="field !min-h-11 !w-20 !py-1.5 text-center"
                    placeholder="45"
                    value={customAmount}
                    onInput={(e) => setCustomAmount(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomReminder()}
                    aria-label="Custom reminder amount"
                  />
                  <select class="field !min-h-11 !w-auto !py-1.5" value={customUnit} onChange={(e) => setCustomUnit(e.currentTarget.value as keyof typeof UNIT_MINUTES)} aria-label="Custom reminder unit">
                    <option value="minutes">min before</option>
                    <option value="hours">hours before</option>
                    <option value="days">days before</option>
                  </select>
                  <button type="button" class="btn btn-quiet !min-h-11 shrink-0 px-4" onClick={addCustomReminder} disabled={!customAmount}>
                    Add
                  </button>
                </div>
                {draft.reminders.length > 0 && !draft.dueTime && (
                  <p class="text-[0.8125rem] text-muted">No time set, so reminders use your default reminder time ({formatClock(prefs.defaultReminderTime)}).</p>
                )}
              </>
            )}
            {notifyBlocked && (
              <p class="flex gap-2 rounded-xl bg-field p-3 text-[0.8125rem] leading-snug text-haldi">
                <Icon name="bell-off" size={17} class="mt-0.5 shrink-0" />
                <span>
                  {notificationsSupported()
                    ? 'Notifications are blocked, so reminders will only show inside the app while it’s open. Allow them in your browser settings for system alerts.'
                    : 'This browser can’t show notifications, so reminders will only show inside the app while it’s open.'}
                </span>
              </p>
            )}
            {draft.reminders.length > 0 && !notifyBlocked && (
              <p class="text-[0.75rem] leading-snug text-muted">Reminders fire while Yaad is open. Anything missed while it was closed is shown when you reopen it.</p>
            )}
          </div>
        </Section>

        <Section title="Repeat">
          <div class="card space-y-3">
            <Segmented<RepeatKind> label="Repeat" options={REPEAT_OPTS} value={repeat.kind} onChange={setRepeatKind} />
            {repeat.kind === 'weekly' && (
              <div class="flex gap-1.5" role="group" aria-label="Repeat on days">
                {weekOrder.map((d) => (
                  <button
                    key={d}
                    type="button"
                    class="chip !min-h-11 flex-1 justify-center !px-0 text-[0.8125rem]"
                    aria-pressed={repeat.days.includes(d)}
                    onClick={() => toggleDay(d)}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
            )}
            {repeat.kind === 'monthly' && <p class="text-[0.8125rem] text-muted">On day {repeat.day} of every month (the last day in shorter months).</p>}
            {repeat.kind === 'custom' && (
              <div class="flex items-center gap-2">
                <span class="section-label">Every</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  class="field !min-h-11 !w-20 !py-1.5 text-center"
                  value={repeat.every}
                  onInput={(e) => set({ repeat: { kind: 'custom', every: Math.max(1, Math.floor(Number(e.currentTarget.value)) || 1), unit: repeat.unit } })}
                  aria-label="Repeat every"
                />
                <select
                  class="field !min-h-11 !w-auto !py-1.5"
                  value={repeat.unit}
                  onChange={(e) => set({ repeat: { kind: 'custom', every: repeat.every, unit: e.currentTarget.value as RepeatUnit } })}
                  aria-label="Repeat unit"
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
            )}
            {repeat.kind !== 'none' && <p class="text-[0.8125rem] text-muted">When you complete it, the next one is scheduled automatically.</p>}
          </div>
        </Section>

        <Section title="Organise">
          <div class="card space-y-3">
            <div class="flex items-center gap-2">
              <span class="section-label flex-1">Category</span>
              <select class="field !min-h-11 !w-auto !py-1.5" value={draft.projectId ?? ''} onChange={(e) => set({ projectId: e.currentTarget.value || null })} aria-label="Category">
                <option value="">Inbox</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" class="text-[0.8125rem] font-bold text-teal" onClick={() => go('/categories')}>
                Manage
              </button>
            </div>
            <Field label="Tags">
              <input
                class="field !min-h-11"
                placeholder="comma, separated"
                value={draft.tags.join(', ')}
                onInput={(e) => set({ tags: e.currentTarget.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean) })}
              />
            </Field>
            {knownTags.length > 0 && (
              <div class="flex flex-wrap gap-2">
                {knownTags.map((t) => (
                  <button key={t} type="button" class="chip !min-h-9 !px-3 text-[0.8125rem]" aria-pressed={draft.tags.includes(t)} onClick={() => toggleTag(t)}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Subtasks">
          <div class="card space-y-2">
            {draft.subtasks.map((s) => (
              <div key={s.id} class="flex items-center gap-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.done}
                  aria-label={`${s.done ? 'Uncheck' : 'Check'} ${s.title}`}
                  class={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${s.done ? 'border-teal bg-teal text-on-teal' : 'border-rule text-transparent'}`}
                  onClick={() => set({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                >
                  <Icon name="check" size={13} />
                </button>
                <span class={`min-w-0 flex-1 truncate ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                <button type="button" class="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`Delete ${s.title}`} onClick={() => set({ subtasks: draft.subtasks.filter((x) => x.id !== s.id) })}>
                  <Icon name="close" size={15} />
                </button>
              </div>
            ))}
            <div class="flex items-center gap-2 pt-1">
              <input class="field !min-h-11 flex-1 !py-1.5" placeholder="Add a subtask…" value={subTitle} maxLength={80} onInput={(e) => setSubTitle(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} aria-label="New subtask" />
              <button type="button" class="grid size-11 shrink-0 place-items-center rounded-full bg-field text-teal" onClick={addSub} disabled={!subTitle.trim()} aria-label="Add subtask">
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        </Section>

        {!isNew && (
          <Section>
            <div class="flex flex-wrap gap-x-6 gap-y-2 px-1">
              {!draft.done && (
                <button type="button" class="flex items-center gap-2 text-[0.9375rem] font-bold text-teal" onClick={() => void complete()}>
                  <Icon name="check" size={17} /> Mark complete
                </button>
              )}
              <button type="button" class="flex items-center gap-2 text-[0.9375rem] font-bold text-accent" onClick={remove}>
                <Icon name="trash" size={17} /> Delete task
              </button>
            </div>
          </Section>
        )}
      </Page>

      <div class="nav-bar safe-bottom fixed inset-x-0 bottom-0 z-30 lg:left-56">
        <div class="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <button type="button" class="btn btn-quiet flex-1" onClick={back}>
            Cancel
          </button>
          <button type="button" class="btn btn-primary flex-[2]" onClick={() => void save()}>
            {isNew ? 'Add task' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
