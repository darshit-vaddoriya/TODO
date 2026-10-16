/** General settings: you, appearance, date & time, tasks, install status, backup/restore, clear-all, version. */
import { useRef, useState } from 'preact/hooks';
import type { Priority } from '@/domain/types';
import { exportBackup, importBackup } from '@/data/backup';
import { destroyDatabase } from '@/data/db';
import { applyDensity, applyTheme, clearPrefs, getPrefs, setPrefs, type DateFormat, type Density, type Theme } from '@/data/prefs';
import { clearStatsCache } from '@/data/stats';
import { permission } from '@/services/notify';
import { installStatus, promptInstall } from '@/services/pwa';
import { toast } from '@/services/toast';
import { Dialog, Header, Icon, Page, Section, Segmented, SettingRow } from '@/ui/components';
import { useReminders } from '@/ui/hooks';
import { go } from '@/ui/router';
import { APP_VERSION } from '@/version';

const PERM_LABEL: Record<NotificationPermission, string> = {
  granted: 'On',
  denied: 'Blocked',
  default: 'Off',
};

export function Settings() {
  const reminders = useReminders();
  const [prefs, setLocal] = useState(getPrefs());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<typeof prefs>) => {
    setPrefs(patch);
    setLocal(getPrefs());
  };

  const changeTheme = (value: Theme) => {
    update({ theme: value });
    applyTheme(value);
  };

  const changeDensity = (value: Density) => {
    update({ density: value });
    applyDensity(value);
  };

  const wipe = async () => {
    await destroyDatabase();
    clearPrefs();
    clearStatsCache();
    toast('Everything deleted');
    location.href = '/';
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yaad-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded');
  };

  const onImportFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const count = await importBackup(JSON.parse(await file.text()));
      toast(count > 0 ? `Imported ${count} item${count === 1 ? '' : 's'}` : 'Nothing to import');
    } catch {
      toast('That isn’t a valid Yaad backup file.', { tone: 'warn' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const install = installStatus();

  return (
    <>
      <Header title="Settings" showBack />
      <Page>
        <Section title="You">
          <div class="card">
            <label class="block">
              <span class="section-label mb-1.5 block">Your name</span>
              <input
                class="field"
                placeholder="Add your name for a warmer greeting"
                value={prefs.name}
                maxLength={30}
                onInput={(e) => update({ name: e.currentTarget.value })}
                aria-label="Your name"
              />
            </label>
          </div>
        </Section>

        <Section title="Appearance">
          <div class="card space-y-3">
            <div>
              <span class="section-label mb-1.5 block">Theme</span>
              <Segmented
                label="Theme"
                value={prefs.theme}
                onChange={changeTheme}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </div>
            <div>
              <span class="section-label mb-1.5 block">Layout</span>
              <Segmented
                label="Layout density"
                value={prefs.density}
                onChange={changeDensity}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="Date & time">
          <div class="card space-y-3">
            <div>
              <span class="section-label mb-1.5 block">Date format</span>
              <Segmented<DateFormat>
                label="Date format"
                value={prefs.dateFormat}
                onChange={(v) => update({ dateFormat: v })}
                options={[
                  { value: 'mdy', label: 'MM/DD/YYYY' },
                  { value: 'dmy', label: 'DD/MM/YYYY' },
                  { value: 'ymd', label: 'YYYY-MM-DD' },
                ]}
              />
            </div>
            <div>
              <span class="section-label mb-1.5 block">Time format</span>
              <Segmented<string>
                label="Time format"
                value={prefs.time24 ? '24' : '12'}
                onChange={(v) => update({ time24: v === '24' })}
                options={[
                  { value: '12', label: '12-hour' },
                  { value: '24', label: '24-hour' },
                ]}
              />
            </div>
            <div>
              <span class="section-label mb-1.5 block">Week starts on</span>
              <Segmented<string>
                label="Week starts on"
                value={String(prefs.weekStart)}
                onChange={(v) => update({ weekStart: v === '0' ? 0 : 1 })}
                options={[
                  { value: '1', label: 'Monday' },
                  { value: '0', label: 'Sunday' },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="Tasks">
          <div class="card">
            <span class="section-label mb-1.5 block">Default priority for new tasks</span>
            <Segmented<Priority>
              label="Default priority"
              value={prefs.defaultPriority}
              onChange={(v) => update({ defaultPriority: v })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Med' },
                { value: 'high', label: 'High' },
              ]}
            />
          </div>
        </Section>

        <Section title="Tasks & reminders">
          <div class="card ruled">
            <SettingRow icon="tag" label="Categories" hint="Group tasks — Work, Home, Errands…" onClick={() => go('/categories')} />
            <SettingRow
              icon="bell"
              label="Reminder settings"
              hint="Notifications, snooze, quiet hours, daily summary"
              value={PERM_LABEL[permission()]}
              onClick={() => go('/settings/reminders')}
            />
          </div>
        </Section>

        <Section title="Backup">
          <div class="card">
            <SettingRow icon="download" label="Export backup" hint="Save reminders, tasks and categories to a JSON file on this device." onClick={exportData} />
            <div class="border-t border-rule">
              <SettingRow icon="upload" label="Restore from backup" hint="Import from a Yaad backup file." onClick={() => fileInput.current?.click()} />
            </div>
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" class="hidden" onChange={(e) => void onImportFile(e)} />
        </Section>

        <Section title="App">
          <div class="card">
            {install === 'installed' ? (
              <SettingRow icon="phone" label="Installed" hint="Yaad is running as an app on this device.">
                <Icon name="check" size={20} class="text-teal" />
              </SettingRow>
            ) : install === 'available' ? (
              <SettingRow
                icon="phone"
                label="Install Yaad"
                hint="Add to your home screen so it opens like an app and works offline."
                onClick={() => void promptInstall()}
              />
            ) : (
              <SettingRow icon="phone" label="Not installed" hint="Use your browser’s menu → “Install app” or “Add to Home Screen”.">
                <span class="shrink-0 text-[0.875rem] text-muted">Browser tab</span>
              </SettingRow>
            )}
          </div>
        </Section>

        <Section title="How reminders work">
          <div class="card space-y-3 text-[0.875rem] leading-snug text-muted">
            <p class="flex gap-2.5">
              <Icon name="clock" size={18} class="mt-0.5 shrink-0 text-teal" />
              <span>
                Reminders fire on time while Yaad is open — including as an installed app kept running in the background. When it’s closed, the web can’t wake
                itself at an exact minute; anything missed is shown when you reopen it. See Reminder settings for details.
              </span>
            </p>
            <p class="flex gap-2.5">
              <Icon name="shield" size={18} class="mt-0.5 shrink-0 text-teal" />
              <span>Everything is stored on this device only. No account, no servers, nothing sent anywhere.</span>
            </p>
          </div>
        </Section>

        <Section title="Data">
          <div class="card">
            <SettingRow
              icon="trash"
              label="Delete everything"
              hint={`${reminders.length} reminder${reminders.length === 1 ? '' : 's'} and settings on this device`}
              danger
              onClick={() => setConfirmWipe(true)}
            />
          </div>
        </Section>

        <p class="mt-8 text-center text-[0.8125rem] text-muted">Yaad · private, on-device reminders</p>
        <p class="mt-1 text-center text-[0.8125rem] text-muted">
          <button type="button" class="underline underline-offset-2" onClick={() => go('/presets')}>
            Browse wellness presets
          </button>
        </p>
        <p class="mt-1 text-center text-[0.75rem] text-muted">Version {APP_VERSION}</p>
      </Page>

      <Dialog open={confirmWipe} onClose={() => setConfirmWipe(false)} title="Delete everything?">
        <p class="text-muted">All reminders and settings on this device will be removed. This can’t be undone.</p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn btn-quiet flex-1" onClick={() => setConfirmWipe(false)}>
            Keep
          </button>
          <button type="button" class="btn flex-1 bg-accent text-on-accent" onClick={() => void wipe()}>
            Delete all
          </button>
        </div>
      </Dialog>
    </>
  );
}
