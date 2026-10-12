/** Settings: theme, sound, notifications, install, and clear-all. */
import { useState } from 'preact/hooks';
import { destroyDatabase } from '../../lib/db';
import { permission, requestPermission } from '../../lib/notify';
import { applyTheme, clearPrefs, getPrefs, setPrefs, type Theme } from '../../lib/prefs';
import { canInstall, promptInstall } from '../../lib/pwa';
import { toast } from '../../lib/toast';
import { go, useData } from '../router';
import { Dialog, Header, Icon, Page, Section, Segmented, SettingRow, Switch } from '../ui';

const PERM_LABEL: Record<NotificationPermission, string> = {
  granted: 'On',
  denied: 'Blocked in browser',
  default: 'Not set',
};

export function Settings() {
  const reminders = useData();
  const [theme, setTheme] = useState<Theme>(getPrefs().theme);
  const [sound, setSound] = useState(getPrefs().sound);
  const [perm, setPerm] = useState(permission());
  const [confirmWipe, setConfirmWipe] = useState(false);

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
