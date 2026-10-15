/** Top level: load reminders + tasks, start the scheduler, route between screens. */
import { useEffect, useState } from 'preact/hooks';
import { onPwaChange, pendingUpdate } from '../lib/pwa';
import { startScheduler } from '../lib/scheduler';
import { initStats } from '../lib/stats';
import { loadProjects } from '../lib/projects';
import { loadAll } from '../lib/store';
import { loadTasks } from '../lib/tasks';
import { toast } from '../lib/toast';
import { useRoute } from './router';
import { Home } from './screens/Home';
import { Presets } from './screens/Presets';
import { ReminderForm } from './screens/ReminderForm';
import { Report } from './screens/Report';
import { ReminderSettings } from './screens/ReminderSettings';
import { Settings } from './screens/Settings';
import { Tasks } from './screens/Tasks';
import { Icon, Toasts } from './ui';

/** Screens with their own big bottom controls hide the tab bar. */
const NO_NAV = new Set(['edit']);

function Screen({ route }: { route: string[] }) {
  const [first, second] = route;
  switch (first) {
    case 'tasks':
      return <Tasks />;
    case 'report':
      return <Report />;
    case 'presets':
      return <Presets />;
    case 'edit':
      return <ReminderForm key={second ?? 'new'} id={second} />;
    case 'settings':
      return second === 'reminders' ? <ReminderSettings /> : <Settings />;
    default:
      return <Home />;
  }
}

/** Bottom tab bar: Reminders · Tasks · [+] · Report · Presets. */
function BottomNav({ current }: { current: string }) {
  const tab = (href: string, id: string, icon: string, label: string) => {
    const active = current === id;
    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        class={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors ${active ? 'text-ink' : 'text-muted'}`}
      >
        <span class={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? 'bg-field' : ''}`}>
          <Icon name={icon} size={21} />
        </span>
        <span class="max-w-full truncate px-1 leading-none">{label}</span>
      </a>
    );
  };
  // The centre Add button adds a task on the Tasks screen, otherwise a reminder.
  const addHref = current === 'tasks' ? '#/tasks' : '#/edit';
  return (
    <nav aria-label="Main" class="nav-bar fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <div class="mx-auto flex max-w-md items-center px-1 pt-1.5 pb-1.5">
        {tab('#/', 'home', 'home', 'Reminders')}
        {tab('#/tasks', 'tasks', 'list', 'Tasks')}
        <a href={addHref} class="flex shrink-0 justify-center px-2" aria-label="New reminder">
          <span class="grid size-12 place-items-center rounded-2xl bg-teal text-on-teal">
            <Icon name="plus" size={26} />
          </span>
        </a>
        {tab('#/report', 'report', 'chart', 'Report')}
        {tab('#/presets', 'presets', 'sparkles', 'Presets')}
      </div>
    </nav>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const route = useRoute();

  useEffect(() => {
    void Promise.all([loadAll(), loadTasks(), loadProjects(), initStats()]).then(() => {
      setReady(true);
      startScheduler();
    });
    const offPwa = onPwaChange(() => {
      const reload = pendingUpdate();
      if (reload) toast('New version available', { duration: 0, action: { label: 'Reload', run: reload } });
    });
    return () => offPwa();
  }, []);

  if (!ready) return null;

  return (
    <>
      <Screen route={route} />
      {!NO_NAV.has(route[0]) && <BottomNav current={route[0] ?? 'home'} />}
      <Toasts />
    </>
  );
}
