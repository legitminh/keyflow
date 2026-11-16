import type { Shortcut } from './shortcuts.js';

/** Omitted directions keep their automatically assigned shortcuts. */
export interface ScrollKeys {
  down?: Shortcut;
  up?: Shortcut;
}
