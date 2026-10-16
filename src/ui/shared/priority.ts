/** How a task priority is shown: flag colour and screen-reader label. */
import type { Priority } from '@/domain/types';

export const PRIORITY_COLOR: Record<Priority, string> = { none: '', low: 'text-info', medium: 'text-haldi', high: 'text-accent' };
export const PRIORITY_LABEL: Record<Priority, string> = { none: 'No priority', low: 'Low priority', medium: 'Medium priority', high: 'High priority' };
