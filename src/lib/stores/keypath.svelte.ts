import { writePreference } from '../storage.js';

/**
 * Whether shortcut keypaths (the key labels in front of buttons) are displayed.
 * Hiding keypaths only changes presentation; keyboard shortcuts keep working.
 */
export const keypath_visibility = $state({
  visible: true,
  set(visible: boolean) {
    keypath_visibility.visible = visible;
    writePreference('keypath_visible', String(visible));
  },
  toggle() {
    keypath_visibility.set(!keypath_visibility.visible);
  }
});

/**
 * Recommended default: show keypaths on computers (a fine, hovering primary pointer, usually
 * with a keyboard) and hide them on touch-first devices such as phones and iPads.
 */
export function detect_keypath_visible(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
