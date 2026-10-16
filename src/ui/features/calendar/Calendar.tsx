/**
 * Calendar: a month grid (week start follows the setting) with a dot per task,
 * repeating tasks projected forward, and a day panel to complete tasks or add
 * one on that date.
 */
import { useMemo, useState } from 'preact/hooks';
import { itemsByDay, monthGrid, shiftMonth, weekdayOrder, type CalendarItem } from '@/domain/calendar';
import { localDate } from '@/domain/dates';
import { repeatLabel } from '@/domain/task-model';
import { isUrgent } from '@/domain/task-view';
import { formatClock, friendlyDate } from '@/data/display';
import { getPrefs } from '@/data/prefs';
import { Checkbox, Header, Icon, Page, Section } from '@/ui/components';
import { completeWithUndo, setDoneWithUndo } from '@/ui/shared/taskActions';
import { useTasks } from '@/ui/hooks';
import { go } from '@/ui/router';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function longDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(y, m - 1, d));
}

export function Calendar() {
  const tasks = useTasks();
  const today = localDate();
  const [ty, tm] = today.split('-').map(Number);
  const [cursor, setCursor] = useState({ year: ty, month: tm });
  const [selected, setSelected] = useState(today);
  const weekStart = getPrefs().weekStart;

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month, weekStart), [cursor, weekStart]);
  const byDay = useMemo(() => itemsByDay(tasks, grid[0], grid[41]), [tasks, grid]);
  const dayItems = byDay.get(selected) ?? [];

  const go_ = (delta: number) => {
    const next = shiftMonth(cursor.year, cursor.month, delta);
    setCursor(next);
    // Keep the selection inside the visible month so the panel never points at nothing.
    setSelected(`${next.year}-${String(next.month).padStart(2, '0')}-01`);
  };
  const jumpToday = () => {
    setCursor({ year: ty, month: tm });
    setSelected(today);
  };

  // A daily task would put a dot on every single day; its projected days stay out of the grid
  // (they still show in the day panel).
  const dotItems = (items: CalendarItem[]) => items.filter((it) => !(it.projected && it.task.repeat.kind === 'daily'));

  /** One mark per task on a day. Colour says the state; a hollow ring is a future repeat, so state never rests on colour alone. */
  const markClass = (item: CalendarItem) => {
    if (item.projected) return 'border-[1.5px] border-brand bg-transparent';
    if (item.done) return 'bg-positive';
    if (isUrgent(item.task, today)) return 'bg-accent';
    return 'bg-brand';
  };

  const openCount = dayItems.filter((it) => !it.done && !it.projected).length;
  const doneCount = dayItems.filter((it) => it.done).length;

  return (
    <>
      <Header
        title="Calendar"
        actions={
          <>
            <button type="button" class="min-h-9 rounded-full bg-field px-3.5 text-[0.8125rem] font-bold" onClick={jumpToday}>
              Today
            </button>
            <a href="#/settings" class="grid size-11 place-items-center rounded-full active:bg-field" aria-label="Settings">
              <Icon name="settings" size={22} />
            </a>
          </>
        }
      />
      <Page>
        <div class="card">
          <div class="mb-2 flex items-center">
            <button type="button" class="grid size-10 place-items-center rounded-full active:bg-field" aria-label="Previous month" onClick={() => go_(-1)}>
              <Icon name="back" size={20} />
            </button>
            <h2 class="flex-1 text-center font-extrabold tracking-[-0.01em]" aria-live="polite">
              {monthTitle(cursor.year, cursor.month)}
            </h2>
            <button type="button" class="grid size-10 place-items-center rounded-full active:bg-field" aria-label="Next month" onClick={() => go_(1)}>
              <Icon name="back" size={20} class="rotate-180" />
            </button>
          </div>

          <div class="grid grid-cols-7 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted" aria-hidden="true">
            {weekdayOrder(weekStart).map((d) => (
              <span key={d} class="py-1">
                {DAY_NAMES[d]}
              </span>
            ))}
          </div>
          <div class="grid grid-cols-7" role="grid" aria-label={monthTitle(cursor.year, cursor.month)}>
            {grid.map((date) => {
              const inMonth = date.slice(0, 7) === `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
              const items = byDay.get(date) ?? [];
              const shown = dotItems(items);
              const isToday = date === today;
              const isSel = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${longDay(date)}, ${items.length === 0 ? 'no tasks' : `${items.length} ${items.length === 1 ? 'task' : 'tasks'}`}`}
                  class="flex h-[3.75rem] w-full flex-col items-center gap-1 border-t border-rule pt-1.5"
                  onClick={() => setSelected(date)}
                >
                  <span
                    class={`tnum grid size-8 place-items-center rounded-full text-[0.9375rem] leading-none ${
                      isSel
                        ? 'bg-brand font-extrabold text-on-brand'
                        : isToday
                          ? 'font-extrabold text-brand ring-2 ring-brand'
                          : inMonth
                            ? 'font-semibold'
                            : 'font-semibold text-muted opacity-60'
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  <span class={`flex h-2 items-center gap-1 ${inMonth ? '' : 'opacity-50'}`} aria-hidden="true">
                    {shown.slice(0, 3).map((it, i) => (
                      <span key={i} class={`size-2 rounded-full ${markClass(it)}`} />
                    ))}
                    {shown.length > 3 && <span class="text-[0.625rem] font-extrabold leading-none text-muted">+{shown.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <ul
            class="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-rule pt-2.5 text-[0.75rem] font-semibold text-muted"
            aria-label="Legend"
          >
            <li class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-brand" aria-hidden="true" /> Open
            </li>
            <li class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-accent" aria-hidden="true" /> Overdue
            </li>
            <li class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-positive" aria-hidden="true" /> Done
            </li>
            <li class="flex items-center gap-1.5">
              <span class="size-2 rounded-full border-[1.5px] border-brand" aria-hidden="true" /> Repeats
            </li>
          </ul>
        </div>

        <Section
          title={`${longDay(selected)}${selected === today ? ' · Today' : ''}`}
          action={
            <button type="button" class="flex items-center gap-1 text-[0.875rem] font-bold text-brand" onClick={() => go(`/task/new?date=${selected}`)}>
              <Icon name="plus" size={15} /> Add task
            </button>
          }
        >
          {dayItems.length === 0 ? (
            <div class="card py-6 text-center text-muted">Nothing on {friendlyDate(selected, today) === 'Today' ? 'today' : 'this day'}.</div>
          ) : (
            <div class="space-y-2">
              <p class="px-1 text-[0.8125rem] font-semibold text-muted">
                {openCount} to do{doneCount > 0 && ` · ${doneCount} done`}
              </p>
              {dayItems.map((it) => (
                <div key={`${it.task.id}:${it.date}`} class="card flex items-center gap-3 !py-2">
                  {it.projected ? (
                    <span class="grid size-7 shrink-0 place-items-center text-brand" title="Upcoming repeat">
                      <Icon name="repeat" size={17} />
                    </span>
                  ) : (
                    <Checkbox
                      checked={it.done}
                      label={`${it.done ? 'Re-open' : 'Complete'} ${it.task.title}`}
                      onChange={() => void (it.done ? setDoneWithUndo(it.task, false) : completeWithUndo(it.task))}
                    />
                  )}
                  <button type="button" class="min-w-0 flex-1 text-left" onClick={() => go(`/task/${it.task.id}`)}>
                    <span class={`block truncate font-semibold ${it.done ? 'text-muted line-through' : ''}`}>{it.task.title}</span>
                    <span class="text-[0.75rem] font-semibold text-muted">
                      {it.task.dueTime ? formatClock(it.task.dueTime) : 'Any time'}
                      {repeatLabel(it.task.repeat) && ` · ${repeatLabel(it.task.repeat)}`}
                      {it.projected && ' · upcoming'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </Page>
    </>
  );
}
