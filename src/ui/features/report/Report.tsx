/** Report: today's activity, a 7-day trend, per-reminder counts, and export. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { localDate } from '@/domain/dates';
import { dayProgress } from '@/domain/task-view';
import { snapshot } from '@/data/reminders';
import { recentDays } from '@/data/stats';
import { toast } from '@/services/toast';
import { Empty, Header, Icon, Page, Section } from '@/ui/components';
import { useReminders, useTasks } from '@/ui/hooks';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** One vertical bar; height set via the style property so the CSP can forbid inline styles. */
function Bar({ ratio, label }: { ratio: number; label: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (el.current) el.current.style.height = `${Math.round(Math.max(0.04, Math.min(1, ratio)) * 100)}%`;
  }, [ratio]);
  return (
    <span class="flex h-20 w-full items-end" role="img" aria-label={label}>
      <span ref={el} class="block w-full rounded-t-md bg-brand transition-[height] duration-500" />
    </span>
  );
}

export function Report() {
  const reminders = useReminders();
  const tasks = useTasks();
  const [week, setWeek] = useState<{ date: string; reminders: number; tasks: number }[]>([]);

  useEffect(() => {
    void recentDays(7).then(setWeek);
  }, [reminders, tasks]);

  const remindersToday = reminders.reduce((n, r) => n + (r.firedTodayDate === week.at(-1)?.date ? r.firedToday : 0), 0);
  const progress = dayProgress(tasks, localDate());
  const tasksDone = progress.done;
  const maxBar = Math.max(1, ...week.map((d) => d.reminders));
  const weekTotal = week.reduce((n, d) => n + d.reminders, 0);

  const exportReport = () => {
    const lines = [
      `Yaad — activity report (${new Date().toLocaleDateString()})`,
      '',
      `Today: ${remindersToday} reminder completions, ${tasksDone}/${progress.total} tasks done`,
      `Last 7 days: ${weekTotal} reminder completions`,
      '',
      'Daily:',
      ...week.map((d) => `  ${d.date}: ${d.reminders} reminders, ${d.tasks} tasks`),
      '',
      'Reminders:',
      ...snapshot().map((r) => `  ${r.emoji} ${r.title} — ${r.firedToday} today · every ${r.intervalMin}m`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yaad-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Report downloaded');
  };

  const nothing = reminders.length === 0 && tasks.length === 0;

  return (
    <>
      <Header
        title="Report"
        actions={
          <button type="button" class="grid size-11 place-items-center rounded-full active:bg-field" aria-label="Export report" onClick={exportReport}>
            <Icon name="download" size={21} />
          </button>
        }
      />
      <Page>
        {nothing ? (
          <Section>
            <Empty title="Nothing to report yet" body="Add reminders and tasks — your activity will show up here." />
          </Section>
        ) : (
          <>
            <Section title="Today">
              <div class="grid grid-cols-2 gap-2.5">
                <div class="card">
                  <p class="display text-[2rem] text-brand tnum">{remindersToday}</p>
                  <p class="text-[0.8125rem] font-semibold text-muted">reminder completions</p>
                </div>
                <div class="card">
                  <p class="display text-[2rem] tnum">
                    {tasksDone}
                    <span class="text-muted text-[1.25rem]">/{progress.total}</span>
                  </p>
                  <p class="text-[0.8125rem] font-semibold text-muted">tasks done</p>
                </div>
              </div>
            </Section>

            <Section title="Last 7 days" action={<span class="text-[0.8125rem] font-semibold text-muted">{weekTotal} total</span>}>
              <div class="card">
                <div class="flex items-end gap-2">
                  {week.map((d) => (
                    <div class="flex min-w-0 flex-1 flex-col items-center gap-1.5" key={d.date}>
                      <Bar ratio={d.reminders / maxBar} label={`${d.date}: ${d.reminders} completions`} />
                      <span class="text-[0.75rem] tnum font-semibold">{d.reminders}</span>
                      <span class="text-[0.6875rem] text-muted">{DOW[new Date(d.date + 'T00:00').getDay()]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {reminders.length > 0 && (
              <Section title="By reminder (today)">
                <div class="card ruled">
                  {reminders.map((r) => (
                    <div class="flex items-center gap-3 py-2 first:pt-0 last:pb-0" key={r.id}>
                      <span class="grid size-8 shrink-0 place-items-center rounded-[10px] bg-field text-lg" aria-hidden="true">
                        {r.emoji}
                      </span>
                      <span class="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
                      <span class="shrink-0 tnum font-bold text-brand">{r.firedToday}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section>
              <button type="button" class="btn btn-quiet w-full" onClick={exportReport}>
                <Icon name="download" size={18} /> Export report (.txt)
              </button>
            </Section>
          </>
        )}
      </Page>
    </>
  );
}
