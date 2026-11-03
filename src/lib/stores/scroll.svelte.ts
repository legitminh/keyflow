import { writePreference } from '../storage.js';

export const lockstep_scrolling = $state({
  enabled: true,
  set(enabled: boolean) {
    lockstep_scrolling.enabled = enabled;
    writePreference('lockstep_scrolling', String(enabled));
  }
});
