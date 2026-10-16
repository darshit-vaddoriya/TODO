/**
 * Research-backed wellness reminders, offered as one-tap presets.
 *
 * The intervals below follow widely published health guidance, not personal
 * medical advice. Full sources and reasoning are in RESEARCH.md. Each `evidence`
 * line is the short version shown in the app.
 */
import type { Preset } from '@/domain/types';

export const PRESETS: Preset[] = [
  {
    id: 'water',
    title: 'Drink water',
    emoji: '💧',
    intervalMin: 120,
    startTime: '08:00',
    endTime: '22:00',
    // EFSA adequate intake: ~2.0 L/day (women), ~2.5 L/day (men) of total fluids.
    evidence: 'About 8 glasses across the day — roughly one every 2 hours while you’re awake.',
  },
  {
    id: 'eyes',
    title: 'Rest your eyes (20-20-20)',
    emoji: '👀',
    intervalMin: 20,
    startTime: '09:00',
    endTime: '21:00',
    // American Optometric Association / AAO digital eye-strain guidance.
    evidence: 'Every 20 min, look 20 feet away for 20 seconds to ease screen eye strain.',
  },
  {
    id: 'move',
    title: 'Stand up & move',
    emoji: '🧍',
    intervalMin: 30,
    startTime: '09:00',
    endTime: '18:00',
    // Breaking up prolonged sitting at least every 30 min (Diabetes Care 2016; WHO 2020).
    evidence: 'Break up sitting at least every 30 min — long sitting spells are a health risk on their own.',
  },
  {
    id: 'stretch',
    title: 'Stretch',
    emoji: '🤸',
    intervalMin: 60,
    startTime: '09:00',
    endTime: '18:00',
    evidence: 'A short hourly stretch keeps the neck, back and wrists loose at a desk.',
  },
  {
    id: 'posture',
    title: 'Posture check',
    emoji: '🪑',
    intervalMin: 45,
    startTime: '09:00',
    endTime: '18:00',
    evidence: 'Reset your shoulders and screen height every 45 min to avoid slouching strain.',
  },
  {
    id: 'breathe',
    title: 'Breathe & reset',
    emoji: '🫁',
    intervalMin: 90,
    startTime: '09:00',
    endTime: '21:00',
    // ~90-minute ultradian focus/rest cycles.
    evidence: 'Work in ~90-min focus blocks, then take a real break — it tracks the body’s natural rhythm.',
  },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
