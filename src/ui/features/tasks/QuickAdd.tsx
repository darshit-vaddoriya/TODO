import { useMemo, useState } from 'preact/hooks';
import { localDate } from '@/domain/dates';
import { parseQuickAdd } from '@/domain/quick-parse';
import { repeatLabel } from '@/domain/task-model';
import type { TaskTab } from '@/domain/task-view';
import { formatClock, friendlyDate } from '@/data/display';
import { getPrefs } from '@/data/prefs';
import { addTask } from '@/data/tasks';
import { Icon } from '@/ui/components';

/** A line of plain language → a task; shows what it understood as you type. */
export function QuickAdd({ tab, categoryId }: { tab: TaskTab; categoryId: string | null }) {
  const [text, setText] = useState('');
  const today = localDate();
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  const dueDate = parsed.dueDate ?? (tab === 'today' ? today : null);
  const priority = parsed.priority !== 'none' ? parsed.priority : getPrefs().defaultPriority;
  const repeat = repeatLabel(parsed.repeat);

  const add = async () => {
    if (!parsed.title) return;
    await addTask({
      title: parsed.title,
      dueDate,
      dueTime: parsed.dueTime,
      priority,
      tags: parsed.tags,
      repeat: parsed.repeat,
      categoryId: categoryId,
      // A time you typed is a time you want to be told about.
      reminderOffsets: parsed.dueTime ? [0] : [],
    });
    setText('');
  };

  const chips = [
    dueDate && `${friendlyDate(dueDate, today)}${parsed.dueTime ? `, ${formatClock(parsed.dueTime)}` : ''}`,
    repeat,
    parsed.priority !== 'none' && `${parsed.priority} priority`,
    ...parsed.tags.map((t) => `#${t}`),
  ].filter(Boolean) as string[];

  return (
    <div>
      <div class="flex items-center gap-2">
        <input
          id="quick-add"
          class="field flex-1 !bg-surface shadow-[var(--lift)]"
          placeholder="Add a task… e.g. Call mom 6pm"
          aria-label="Quick add task"
          value={text}
          maxLength={160}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button type="button" class="btn btn-primary !min-h-[52px] shrink-0 px-4" onClick={() => void add()} disabled={!parsed.title} aria-label="Add task">
          <Icon name="plus" size={22} />
        </button>
      </div>
      {text.trim() && chips.length > 0 && (
        <p class="mt-2 flex flex-wrap gap-1.5 px-1" aria-live="polite">
          {chips.map((c) => (
            <span key={c} class="rounded-full bg-surface px-2.5 py-1 text-[0.75rem] font-semibold text-teal shadow-[var(--lift)]">
              {c}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
