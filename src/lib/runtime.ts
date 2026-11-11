import { min_box } from './stores/layout.svelte.js';
import { lockstep_scrolling } from './stores/scroll.svelte.js';
import { themes, set_theme_id, type Theme } from './stores/theme.svelte.js';
import { readPreference, setStoragePrefix } from './storage.js';
import { dispatch_key_input, reset_input } from './input-events.js';
import { set_available_keys } from './stores/input.js';
import { configure_input_frames } from './input-frames.js';
import { detect_shortcut_platform, type ShortcutPlatform } from './shortcuts.js';

export interface KeyflowOptions {
  /** Namespace for session preferences. Use an empty string for legacy site keys. */
  storagePrefix?: string;
  minBox?: number;
  themeId?: number;
  themes?: Theme[];
  /** Ordered shortcut alphabet. Accepts key_presets or a custom array. */
  keys?: readonly string[];
  /** Auto-detected by default; also controls the portable Ctrl/Mod mapping and labels. */
  platform?: ShortcutPlatform | 'auto';
  lockstep?: boolean;
}

/** Initialize one full-page Keyflow application. Returns listener cleanup. */
export function initializeKeyflow(options: KeyflowOptions = {}) {
  if (typeof window === 'undefined') return () => {};
  configure_input_frames(options.platform && options.platform !== 'auto' ? options.platform : detect_shortcut_platform());
  setStoragePrefix(options.storagePrefix ?? 'keyflow:');
  if (options.themes) {
    if (!options.themes.length) throw new RangeError('At least one theme is required');
    themes.splice(0, themes.length, ...options.themes);
  }
  if (options.keys) set_available_keys(options.keys);
  const savedSize = Number(readPreference('min_box'));
  min_box.set(Number.isFinite(savedSize) && savedSize > 0 ? savedSize : (options.minBox ?? 48));
  const savedTheme = readPreference('theme_id');
  const themeId = savedTheme === null ? (options.themeId ?? 0) : Number(savedTheme);
  set_theme_id(Number.isInteger(themeId) && themes[themeId] ? themeId : 0);
  const savedScroll = readPreference('lockstep_scrolling');
  lockstep_scrolling.set(
    savedScroll === null ? (options.lockstep ?? true) : savedScroll !== 'false'
  );

  const isEditing = (event: KeyboardEvent) =>
    event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      );
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || isEditing(event)) return reset_input();
    if (dispatch_key_input('keydown', event)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || isEditing(event)) return reset_input();
    if (dispatch_key_input('keyup', event)) event.preventDefault();
  };
  const onVisibilityChange = () => { if (document.hidden) reset_input(); };
  window.addEventListener('compositionstart', reset_input);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', reset_input);
  window.addEventListener('focusin', reset_input);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    window.removeEventListener('compositionstart', reset_input);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', reset_input);
    window.removeEventListener('focusin', reset_input);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reset_input();
  };
}
