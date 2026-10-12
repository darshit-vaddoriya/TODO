/** One-tap, research-backed wellness reminders. Sources are in RESEARCH.md. */
import { everyPhrase, formatClock } from '../../lib/format';
import { PRESETS } from '../../lib/presets';
import { requestPermission } from '../../lib/notify';
import { setPrefs } from '../../lib/prefs';
import { fromPreset, save, snapshot } from '../../lib/store';
import { toast } from '../../lib/toast';
import type { Preset } from '../../lib/types';
import { go, useData } from '../router';
import { Header, Icon, Page, Section } from '../ui';

function PresetCard({ preset, added }: { preset: Preset; added: boolean }) {
  const add = async () => {
    await save(fromPreset(preset));
    void requestPermission();
    setPrefs({ notifyAsked: true });
    toast(`${preset.emoji} ${preset.title} added`, { action: { label: 'View', run: () => go('/') } });
  };
  return (
    <div class="card flex items-start gap-3">
      <span class="grid size-11 shrink-0 place-items-center rounded-[14px] bg-field text-2xl" aria-hidden="true">
        {preset.emoji}
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-extrabold tracking-[-0.01em]">{preset.title}</p>
        <p class="text-[0.8125rem] font-semibold text-teal">
          {everyPhrase(preset.intervalMin)} · {formatClock(preset.startTime)}–{formatClock(preset.endTime)}
        </p>
        <p class="mt-1 text-[0.8125rem] leading-snug text-muted">{preset.evidence}</p>
      </div>
      <button
        type="button"
        class={`btn min-h-10 shrink-0 px-4 text-[0.875rem] ${added ? 'btn-quiet text-muted' : 'btn-primary'}`}
        onClick={() => void add()}
        disabled={added}
      >
        {added ? <Icon name="check" size={18} /> : 'Add'}
      </button>
    </div>
  );
}

export function Presets() {
  const reminders = useData();
  const have = new Set(snapshot().map((r) => r.title.toLowerCase()));

  return (
    <>
      <Header title="Wellness presets" sub="Backed by common health guidance" showBack />
      <Page>
        <Section>
          <div class="space-y-2.5">
            {PRESETS.map((p) => (
              <PresetCard key={p.id} preset={p} added={have.has(p.title.toLowerCase())} />
            ))}
          </div>
        </Section>
        <Section>
          <div class="card flex items-start gap-3 text-[0.8125rem] leading-snug text-muted">
            <Icon name="info" size={18} class="mt-0.5 shrink-0" />
            <p>
              Intervals follow widely published guidance (hydration, the 20-20-20 eye rule, breaking up long sitting). They’re general
              wellness nudges, not medical advice — adjust any of them after adding, and check with a clinician for your own needs.
            </p>
          </div>
        </Section>
        <Section>
          <button type="button" class="flex w-full items-center justify-center gap-2 text-[0.9375rem] font-bold text-teal" onClick={() => go('/edit')}>
            <Icon name="plus" size={18} /> Create your own instead
          </button>
        </Section>
        {reminders.length === 0 && <p class="mt-4 text-center text-[0.8125rem] text-muted">Tap Add on any card to get started.</p>}
      </Page>
    </>
  );
}
