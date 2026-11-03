import { get } from 'svelte/store';
import { min_box } from './stores/layout.svelte.js';
import { lockstep_scrolling } from './stores/scroll.svelte.js';
import { themes, set_theme_id, type Theme } from './stores/theme.svelte.js';
import { readPreference, setStoragePrefix } from './storage.js';
import {
  _list_input_token,
  _list_key_strokes,
  _available_keys,
  add_key_strokes,
  reset_key_strokes,
  base_conversion_s_endian,
  set_available_keys
} from './stores/input.js';

export interface KeyflowOptions {
  /** Namespace for session preferences. Use an empty string for legacy site keys. */
  storagePrefix?: string;
  minBox?: number;
  themeId?: number;
  themes?: Theme[];
  keys?: string[];
  lockstep?: boolean;
}

/** Initialize one full-page Keyflow application. Returns listener cleanup. */
export function initializeKeyflow(options: KeyflowOptions = {}) {
  if (typeof window === 'undefined') return () => {};
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
    if (
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isEditing(event)
    )
      return;
    if (event.key === 'Escape') return reset_key_strokes();
    add_key_strokes(event.key);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isEditing(event))
      return;
    if (!get(_available_keys).includes(event.key.toLowerCase())) return;
    const strokes = get(_list_key_strokes);
    const tokens = get(_list_input_token);
    const base = get(_available_keys).length;
    if (!strokes.length || base ** strokes.length < tokens.length) return;
    const action = tokens[base_conversion_s_endian(strokes, base)]?.on_close;
    reset_key_strokes();
    action?.();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', reset_key_strokes);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', reset_key_strokes);
    reset_key_strokes();
  };
}
