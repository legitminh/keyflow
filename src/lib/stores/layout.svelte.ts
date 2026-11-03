import { writePreference } from '../storage.js';

export const min_box = $state({
  value: 48,
  set(value: number) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('Grid size must be positive');
    min_box.value = value;
    writePreference('min_box', String(value));
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--min-box', `${value}px`);
    }
  }
});
