/** Top level: load reminders + tasks, start the scheduler, route between screens. */
import { useEffect, useState } from 'preact/hooks';
import { isTaskTab } from '@/domain/task-view';
import { loadCategories } from '@/data/categories';
import { getPrefs } from '@/data/prefs';
import { loadAll } from '@/data/reminders';
import { initStats } from '@/data/stats';
import { completeTaskById, getTask, loadTasks, snoozeTask } from '@/data/tasks';
import { onPwaChange, pendingUpdate } from '@/services/pwa';
import { startBadge } from '@/services/badge';
import { startScheduler } from '@/services/scheduler';
import { toast } from '@/services/toast';
import { Icon, Toasts } from '@/ui/components';
import { Calendar } from '@/ui/features/calendar/Calendar';
import { Categories } from '@/ui/features/categories/Categories';
import { Home } from '@/ui/features/home/Home';
import { Presets } from '@/ui/features/reminders/Presets';
import { ReminderForm } from '@/ui/features/reminders/ReminderForm';
import { Report } from '@/ui/features/report/Report';
import { ReminderSettings } from '@/ui/features/settings/ReminderSettings';
import { Settings } from '@/ui/features/settings/Settings';
import { TaskEditor } from '@/ui/features/tasks/TaskEditor';
import { Tasks } from '@/ui/features/tasks/Tasks';
import { useRoute } from '@/ui/router';

/** Screens with their own bottom controls (a Save bar) hide the phone tab bar and Add button. */
const NO_NAV = new Set(['edit', 'task']);

/**
 * Handles a notification's Snooze / Done button. The service worker can't touch
 * task state (the recurrence and alert rules live in the app), so it opens
 * `#/act/<snooze|done>/<taskId>` and the app applies it, then returns home.
 */
function Act({ action, id }: { action?: string; id?: string }) {
  useEffect(() => {
    void (async () => {
      const task = id ? getTask(id) : undefined;
      if (!task) {
        toast('That task no longer exists.', { tone: 'warn' });
      } else if (action === 'snooze') {
        const min = getPrefs().snoozeMin;
        await snoozeTask(task.id, min);
        toast(`Snoozed “${task.title}” for ${min} min`);
      } else if (action === 'done') {
        await completeTaskById(task.id);
        toast(`Done: ${task.title}`);
      }
      location.replace('#/');
    })();
  }, []);
  return null;
}

function Screen({ route }: { route: string[] }) {
  const [first, second] = route;
  switch (first) {
    case 'tasks': {
      // #/tasks, #/tasks/<today|upcoming|all|overdue|done>, optionally ?cat=<id|none>
      const [view, query] = (second ?? '').split('?');
      return <Tasks view={isTaskTab(view) ? view : 'today'} cat={new URLSearchParams(query).get('cat') ?? undefined} />;
    }
    case 'calendar':
      return <Calendar />;
    case 'categories':
      return <Categories />;
    case 'report':
      return <Report />;
    case 'presets':
      return <Presets />;
    case 'task': {
      // #/task/new, #/task/new?date=YYYY-MM-DD, #/task/<id>
      const [taskId, query] = (second ?? 'new').split('?');
      return <TaskEditor key={`${taskId}?${query ?? ''}`} id={taskId} dateHint={new URLSearchParams(query).get('date') ?? undefined} />;
    }
    case 'act':
      return <Act action={second} id={route[2]} />;
    case 'edit':
      return <ReminderForm key={second ?? 'new'} id={second} />;
    case 'settings':
      return second === 'reminders' ? <ReminderSettings /> : <Settings />;
    default:
      return <Home />;
  }
}

interface NavItem {
  href: string;
  id: string;
  icon: string;
  label: string;
}

/** Phone: four tabs. Desktop: the same plus the secondary screens, as a left rail. */
const TABS: NavItem[] = [
  { href: '#/', id: 'home', icon: 'home', label: 'Home' },
  { href: '#/tasks', id: 'tasks', icon: 'list', label: 'Tasks' },
  { href: '#/calendar', id: 'calendar', icon: 'calendar', label: 'Calendar' },
  { href: '#/report', id: 'report', icon: 'chart', label: 'Report' },
];
const RAIL_EXTRA: NavItem[] = [
  { href: '#/categories', id: 'categories', icon: 'tag', label: 'Categories' },
  { href: '#/presets', id: 'presets', icon: 'sparkles', label: 'Presets' },
  { href: '#/settings', id: 'settings', icon: 'settings', label: 'Settings' },
];

/** The screen a route belongs to for highlighting the nav (the edit screens map to their tab). */
function activeTab(first: string | undefined): string {
  if (!first || first === 'edit') return 'home';
  if (first === 'task') return 'tasks';
  return first;
}

/** Bottom tab bar (phone) and a left rail (desktop), plus the floating Add Task button. */
function Nav({ current, bar }: { current: string; bar: boolean }) {
  const active = activeTab(current);
  const tab = (t: NavItem) => (
    <a
      key={t.id}
      href={t.href}
      aria-current={active === t.id ? 'page' : undefined}
      class={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors ${active === t.id ? 'text-ink' : 'text-muted'}`}
    >
      <span class={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active === t.id ? 'bg-field' : ''}`}>
        <Icon name={t.icon} size={21} />
      </span>
      <span class="max-w-full truncate px-1 leading-none">{t.label}</span>
    </a>
  );
  const railLink = (t: NavItem) => (
    <a
      key={t.id}
      href={t.href}
      aria-current={active === t.id ? 'page' : undefined}
      class={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-bold transition-colors ${active === t.id ? 'bg-field text-ink' : 'text-muted hover:bg-field/60'}`}
    >
      <Icon name={t.icon} size={20} />
      {t.label}
    </a>
  );
  // The floating Add Task button belongs on the task screens; elsewhere it would cover controls.
  const showFab = bar && ['home', 'tasks', 'calendar'].includes(active);
  return (
    <>
      {bar && (
        <nav aria-label="Main" class="nav-bar fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div class="mx-auto flex max-w-md items-center px-1 pt-1.5 pb-1.5">{TABS.map(tab)}</div>
        </nav>
      )}
      <aside aria-label="Main" class="nav-bar fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-1 border-r border-rule p-3 lg:flex">
        <p class="display px-3 pb-3 pt-2 text-[1.5rem]">Yaad</p>
        {[...TABS, ...RAIL_EXTRA].map(railLink)}
        <a href="#/task/new" class="btn btn-primary mt-auto">
          <Icon name="plus" size={18} /> Add task
        </a>
      </aside>
      {showFab && (
        <a
          href="#/task/new"
          aria-label="Add task"
          class="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-2xl bg-teal text-on-teal shadow-lg active:scale-95 lg:hidden"
        >
          <Icon name="plus" size={28} />
        </a>
      )}
    </>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const route = useRoute();

  useEffect(() => {
    void Promise.all([loadAll(), loadTasks(), loadCategories(), initStats()]).then(() => {
      setReady(true);
      startScheduler();
      startBadge();
    });
    const offPwa = onPwaChange(() => {
      const reload = pendingUpdate();
      if (reload) toast('New version available', { duration: 0, action: { label: 'Reload', run: reload } });
    });
    return () => offPwa();
  }, []);

  if (!ready) {
    return (
      <div class="splash" role="status" aria-label="Loading Yaad">
        <img src="/favicon.svg" alt="" width="64" height="64" />
        <p>Yaad</p>
      </div>
    );
  }

  return (
    <>
      <div class="lg:pl-56">
        <Screen route={route} />
      </div>
      <Nav current={route[0] ?? 'home'} bar={!NO_NAV.has(route[0])} />
      <Toasts />
    </>
  );
}
