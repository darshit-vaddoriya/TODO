/**
 * The two sheets behind the toolbar icons. The filter sheet holds everything that
 * narrows the list — which view, category, priority and tag — as icon rows rather
 * than a strip of chips; the sort sheet picks the order.
 */
import type { ComponentChildren } from 'preact';
import { activeFilterCount, TASK_TABS, type SortKey, type TaskFilter, type TaskTab } from '@/domain/task-view';
import type { Category, Priority } from '@/domain/types';
import { Icon, Sheet } from '@/ui/components';
import { PRIORITY_COLOR } from '@/ui/shared/priority';

// --- Building blocks ---------------------------------------------------------------

function Group({ title, action, children }: { title: string; action?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="mt-5 first:mt-1">
      <div class="mb-1.5 flex items-center justify-between px-1">
        <h3 class="section-label uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One selectable row: leading icon tile, label, optional detail, and a check when chosen. */
function OptionRow({
  icon,
  label,
  detail,
  detailClass = 'text-muted',
  selected,
  onSelect,
}: {
  icon: string;
  label: string;
  detail?: string | number;
  detailClass?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} class="flex min-h-12 w-full items-center gap-3 py-1.5 text-left" onClick={onSelect}>
      <span class={`grid size-9 shrink-0 place-items-center rounded-[12px] ${selected ? 'bg-teal text-on-teal' : 'bg-field text-muted'}`}>
        <Icon name={icon} size={18} />
      </span>
      <span class="min-w-0 flex-1 truncate font-semibold">{label}</span>
      {detail !== undefined && <span class={`tnum text-[0.875rem] font-semibold ${detailClass}`}>{detail}</span>}
      <span class={`grid size-6 shrink-0 place-items-center ${selected ? 'text-teal' : 'text-transparent'}`}>
        <Icon name="check" size={18} />
      </span>
    </button>
  );
}

const VIEW_ICON: Record<TaskTab, string> = { today: 'calendar', upcoming: 'clock', all: 'list', overdue: 'alert', done: 'check-circle' };

const PRIORITY_TILES: { value: Priority | null; label: string; icon: string }[] = [
  { value: null, label: 'Any', icon: 'list' },
  { value: 'high', label: 'High', icon: 'flag' },
  { value: 'medium', label: 'Medium', icon: 'flag' },
  { value: 'low', label: 'Low', icon: 'flag' },
];

// --- Filter sheet ------------------------------------------------------------------

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  view: TaskTab;
  onViewChange: (view: TaskTab) => void;
  /** Open-task counts per view, and how many were completed today (shown beside "Completed"). */
  counts: Record<Exclude<TaskTab, 'done'>, number>;
  completedToday: number;
  filter: TaskFilter;
  onFilterChange: (patch: Partial<TaskFilter>) => void;
  onReset: () => void;
  categories: Category[];
  /** Open tasks per category id; `null` is the Inbox. */
  categoryCount: (id: string | null) => number;
  tags: string[];
  /** How many tasks the current view + filters show, for the confirm button. */
  resultCount: number;
  onManageCategories: () => void;
}

export function FilterSheet(p: FilterSheetProps) {
  const filterCount = activeFilterCount(p.filter);
  return (
    <Sheet
      open={p.open}
      onClose={p.onClose}
      title="Filter tasks"
      footer={
        <div class="flex gap-3">
          <button type="button" class="btn btn-quiet flex-1" onClick={p.onReset} disabled={filterCount === 0}>
            Reset
          </button>
          <button type="button" class="btn btn-primary flex-[2]" onClick={p.onClose}>
            Show {p.resultCount} {p.resultCount === 1 ? 'task' : 'tasks'}
          </button>
        </div>
      }
    >
      <Group title="Show">
        <div role="radiogroup" aria-label="Show" class="ruled">
          {TASK_TABS.map((t) => (
            <OptionRow
              key={t.id}
              icon={VIEW_ICON[t.id]}
              label={t.label}
              selected={p.view === t.id}
              onSelect={() => p.onViewChange(t.id)}
              detail={t.id === 'done' ? `${p.completedToday} today` : p.counts[t.id]}
              detailClass={t.id === 'overdue' && p.counts.overdue > 0 ? 'text-accent' : 'text-muted'}
            />
          ))}
        </div>
      </Group>

      <Group
        title="Category"
        action={
          <button type="button" class="text-[0.8125rem] font-bold text-teal" onClick={p.onManageCategories}>
            Manage
          </button>
        }
      >
        <div role="radiogroup" aria-label="Category" class="ruled">
          <OptionRow icon="folder" label="All categories" selected={p.filter.category === 'all'} onSelect={() => p.onFilterChange({ category: 'all' })} />
          <OptionRow
            icon="inbox"
            label="Inbox"
            detail={p.categoryCount(null)}
            selected={p.filter.category === 'none'}
            onSelect={() => p.onFilterChange({ category: 'none' })}
          />
          {p.categories.map((c) => (
            <OptionRow
              key={c.id}
              icon="tag"
              label={c.name}
              detail={p.categoryCount(c.id)}
              selected={p.filter.category === c.id}
              onSelect={() => p.onFilterChange({ category: c.id })}
            />
          ))}
        </div>
      </Group>

      <Group title="Priority">
        <div role="radiogroup" aria-label="Priority" class="grid grid-cols-4 gap-2">
          {PRIORITY_TILES.map((t) => {
            const selected = p.filter.priority === t.value;
            return (
              <button
                key={t.label}
                type="button"
                role="radio"
                aria-checked={selected}
                class={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl text-[0.8125rem] font-bold ${selected ? 'bg-teal text-on-teal' : 'bg-field'}`}
                onClick={() => p.onFilterChange({ priority: t.value })}
              >
                <Icon name={t.icon} size={20} class={selected || !t.value ? '' : PRIORITY_COLOR[t.value]} />
                {t.label}
              </button>
            );
          })}
        </div>
      </Group>

      {p.tags.length > 0 && (
        <Group title="Tag">
          <div role="radiogroup" aria-label="Tag" class="ruled">
            <OptionRow icon="tag" label="All tags" selected={p.filter.tag === null} onSelect={() => p.onFilterChange({ tag: null })} />
            {p.tags.map((t) => (
              <OptionRow
                key={t}
                icon="tag"
                label={`#${t}`}
                selected={p.filter.tag === t}
                onSelect={() => p.onFilterChange({ tag: p.filter.tag === t ? null : t })}
              />
            ))}
          </div>
        </Group>
      )}
    </Sheet>
  );
}

// --- Sort sheet --------------------------------------------------------------------

const SORT_ROWS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'manual', label: 'Manual order', icon: 'grip' },
  { key: 'due', label: 'Due date', icon: 'calendar' },
  { key: 'priority', label: 'Priority', icon: 'flag' },
  { key: 'created', label: 'Newest first', icon: 'clock' },
  { key: 'alpha', label: 'A to Z', icon: 'sort' },
];

export function SortSheet({
  open,
  onClose,
  sort,
  isDefault,
  onSelect,
  onUseDefault,
}: {
  open: boolean;
  onClose: () => void;
  sort: SortKey;
  /** True when the order is the view's own default (Manual for All, Due date for the rest). */
  isDefault: boolean;
  onSelect: (key: SortKey) => void;
  onUseDefault: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Sort tasks">
      <div role="radiogroup" aria-label="Sort by" class="ruled">
        {SORT_ROWS.map((r) => (
          <OptionRow
            key={r.key}
            icon={r.icon}
            label={r.label}
            selected={sort === r.key}
            onSelect={() => {
              onSelect(r.key);
              onClose();
            }}
          />
        ))}
      </div>
      {!isDefault && (
        <button
          type="button"
          class="mt-3 text-[0.875rem] font-bold text-teal"
          onClick={() => {
            onUseDefault();
            onClose();
          }}
        >
          Back to the default order
        </button>
      )}
    </Sheet>
  );
}
