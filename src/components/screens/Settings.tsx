/** Settings: theme, pings, Do Not Disturb, backup/restore, install, clear-all, version. */
import { useRef, useState } from 'preact/hooks';
import { destroyDatabase } from '../../lib/db';
import { formatTimeOfDay, tomorrowAt, untilPhrase } from '../../lib/format';
import { permission, requestPermission } from '../../lib/notify';
import { applyTheme, clearPrefs, getPrefs, isPaused, pauseFor, pauseUntil, resume, setPrefs, type Theme } from '../../lib/prefs';
import { canInstall, promptInstall } from '../../lib/pwa';
import { exportBackup, importBackup } from '../../lib/store';
import { toast } from '../../lib/toast';
import { APP_VERSION } from '../../lib/version';
import { go, useData, useNow } from '../router';
import { Dialog, Header, Icon, Page, Section, Segmented, SettingRow, Switch } from '../ui';

const PERM_LABEL: Record<NotificationPermission, string> = {
  granted: 'On',
  denied: 'Blocked in browser',
  default: 'Not set',
};

export function Settings() {
  const reminders = useData();
  const now = useNow();
  const [theme, setTheme] = useState<Theme>(getPrefs().theme);
  const [sound, setSound] = useState(getPrefs().sound);
  const [perm, setPerm] = useState(permission());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [, setTick] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const dnd = isPaused(now);
  const refresh = () => setTick((n) => n + 1);

  const changeTheme = (value: Theme) => {
    setTheme(value);
    setPrefs({ theme: value });
    applyTheme(value);
  };

  const enableNotifications = async () => {
    const result = await requestPermission();
    setPerm(result);
    setPrefs({ notifyAsked: true });
    if (result === 'granted') toast('Notifications on.');
    else if (result === 'denied') toast('Blocked. Allow notifications in your browser settings.', { tone: 'warn' });
  };

  const wipe = async () => {
    await destroyDatabase();
    clearPrefs();
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
      toast(count > 0 ? `Imported ${count} reminder${count === 1 ? '' : 's'}` : 'Nothing to import');
    } catch {
      toast('That isn’t a valid Yaad backup file.', { tone: 'warn' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <>
      <Header title="Settings" showBack />
      <Page>
        <Section title="Appearance">
          <div class="card">
            <Segmented
              label="Theme"
              value={theme}
              onChange={changeTheme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </Section>

        <Section title="Pings">
          <div class="card">
            <SettingRow
              icon="bell"
              label="Notifications"
              hint={perm === 'denied' ? 'Allow them in your browser settings to turn on.' : 'System pings while Yaad is open.'}
              onClick={perm === 'granted' ? undefined : () => void enableNotifications()}
              value={perm === 'granted' ? PERM_LABEL.granted : undefined}
            >
              {perm === 'granted' ? <span class="shrink-0 text-[0.875rem] font-semibold text-teal">On</span> : undefined}
            </SettingRow>
            <div class="border-t border-rule">
              <SettingRow icon="volume" label="Sound" hint="A soft chime with each ping.">
                <Switch checked={sound} onChange={(on) => { setSound(on); setPrefs({ sound: on }); }} label="Ping sound" />
              </SettingRow>
            </div>
          </div>
        </Section>

        <Section title="Do Not Disturb">
          <div class="card">
            {dnd ? (
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-[12px] bg-field text-haldi">
                  <Icon name="pause" size={19} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">All reminders paused</span>
                  <span class="block text-[0.8125rem] text-muted">Resumes {formatTimeOfDay(new Date(getPrefs().pausedUntil))} · {untilPhrase(getPrefs().pausedUntil - now)}</span>
                </span>
                <button type="button" class="min-h-9 shrink-0 rounded-full bg-teal px-4 text-[0.875rem] font-bold text-on-teal" onClick={() => { resume(); refresh(); }}>
                  Resume
                </button>
              </div>
            ) : (
              <>
                <p class="section-label mb-2">Mute every reminder for a while.</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="chip" onClick={() => { pauseFor(60); refresh(); }}>1 hour</button>
                  <button type="button" class="chip" onClick={() => { pauseFor(180); refresh(); }}>3 hours</button>
                  <button type="button" class="chip" onClick={() => { pauseUntil(tomorrowAt(8)); refresh(); }}>Until tomorrow</button>
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="Backup">
          <div class="card">
            <SettingRow icon="download" label="Export backup" hint="Save all reminders to a JSON file on this device." onClick={exportData} />
            <div class="border-t border-rule">
              <SettingRow icon="upload" label="Restore from backup" hint="Import reminders from a Yaad backup file." onClick={() => fileInput.current?.click()} />
            </div>
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" class="hidden" onChange={(e) => void onImportFile(e)} />
        </Section>

        {canInstall() && (
          <Section title="App">
            <div class="card">
              <SettingRow icon="phone" label="Install Yaad" hint="Add to your home screen so it can keep running." onClick={() => void promptInstall()} />
            </div>
          </Section>
        )}

        <Section title="How reminders work">
          <div class="card space-y-3 text-[0.875rem] leading-snug text-muted">
            <p class="flex gap-2.5">
              <Icon name="clock" size={18} class="mt-0.5 shrink-0 text-teal" />
              <span>
                Reminders fire while Yaad is open — including as an installed app kept running in the background. The web can’t wake a
                fully-closed page at an exact minute, so keep it installed and open for pings to arrive on time.
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
