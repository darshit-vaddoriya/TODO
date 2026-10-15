/**
 * Categories: group tasks (the old "lists"). Tasks with none live in the Inbox.
 * Shows how many open tasks each holds; tap one to see its tasks, rename or
 * delete it (its tasks go back to the Inbox, they aren't deleted).
 */
import { useState } from 'preact/hooks';
import { addProject, removeProject, renameProject } from '../../lib/projects';
import { toast } from '../../lib/toast';
import type { Project } from '../../lib/types';
import { go, useProjects, useTasks } from '../router';
import { Dialog, Empty, Header, Icon, Page, Section } from '../ui';

type Editing = { mode: 'new' } | { mode: 'rename'; project: Project } | { mode: 'delete'; project: Project } | null;

export function Categories() {
  const projects = useProjects();
  const tasks = useTasks();
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');

  const open = tasks.filter((t) => !t.done);
  const inboxCount = open.filter((t) => t.projectId === null).length;
  const countOf = (id: string) => open.filter((t) => t.projectId === id).length;

  const start = (e: Editing) => {
    setEditing(e);
    setName(e?.mode === 'rename' ? e.project.name : '');
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || !editing) return;
    if (editing.mode === 'new') await addProject(trimmed);
    else if (editing.mode === 'rename') await renameProject(editing.project.id, trimmed);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (editing?.mode !== 'delete') return;
    const { project } = editing;
    await removeProject(project.id);
    setEditing(null);
    toast(`“${project.name}” deleted · its tasks moved to Inbox`);
  };

  const row = (label: string, count: number, onOpen: () => void, actions?: Project) => (
    <div class="flex items-center gap-2 py-1">
      <button type="button" class="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen}>
        <span class="grid size-9 shrink-0 place-items-center rounded-[12px] bg-field text-teal">
          <Icon name={actions ? 'tag' : 'home'} size={18} />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{label}</span>
          <span class="block text-[0.8125rem] text-muted">
            {count} open {count === 1 ? 'task' : 'tasks'}
          </span>
        </span>
      </button>
      {actions && (
        <>
          <button type="button" class="grid size-10 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`Rename ${label}`} onClick={() => start({ mode: 'rename', project: actions })}>
            <Icon name="edit" size={18} />
          </button>
          <button type="button" class="grid size-10 shrink-0 place-items-center rounded-full text-muted active:bg-field" aria-label={`Delete ${label}`} onClick={() => start({ mode: 'delete', project: actions })}>
            <Icon name="trash" size={18} />
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <Header
        title="Categories"
        showBack
        actions={
          <button type="button" class="flex min-h-9 items-center gap-1 rounded-full bg-teal px-3.5 text-[0.875rem] font-bold text-on-teal" onClick={() => start({ mode: 'new' })}>
            <Icon name="plus" size={16} /> New
          </button>
        }
      />
      <Page>
        <Section>
          <div class="card ruled">
            {row('Inbox', inboxCount, () => go('/tasks/all?cat=none'))}
            {projects.map((p) => (
              <div key={p.id}>{row(p.name, countOf(p.id), () => go(`/tasks/all?cat=${p.id}`), p)}</div>
            ))}
          </div>
          {projects.length === 0 && (
            <div class="mt-3">
              <Empty title="No categories yet" body="Group your tasks — Work, Home, Errands… Everything unfiled lives in the Inbox.">
                <button type="button" class="btn btn-primary" onClick={() => start({ mode: 'new' })}>
                  New category
                </button>
              </Empty>
            </div>
          )}
        </Section>
      </Page>

      <Dialog open={editing?.mode === 'new' || editing?.mode === 'rename'} onClose={() => setEditing(null)} title={editing?.mode === 'rename' ? 'Rename category' : 'New category'}>
        <input class="field" placeholder="Category name" aria-label="Category name" maxLength={40} value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
        <div class="mt-4 flex gap-2">
          <button type="button" class="btn btn-quiet flex-1" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button type="button" class="btn btn-primary flex-1" onClick={() => void save()} disabled={!name.trim()}>
            {editing?.mode === 'rename' ? 'Rename' : 'Create'}
          </button>
        </div>
      </Dialog>

      <Dialog open={editing?.mode === 'delete'} onClose={() => setEditing(null)} title="Delete category?">
        <p class="text-muted">
          “{editing?.mode === 'delete' ? editing.project.name : ''}” will be removed. Its tasks aren’t deleted — they move to the Inbox.
        </p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn btn-quiet flex-1" onClick={() => setEditing(null)}>
            Keep
          </button>
          <button type="button" class="btn flex-1 bg-accent text-on-accent" onClick={() => void confirmDelete()}>
            Delete
          </button>
        </div>
      </Dialog>
    </>
  );
}
