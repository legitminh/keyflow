import { writePreference } from '../storage.js';

export interface Theme {
  name: string;
  name_to_color: Record<string, string>;
  /** Palette to use when following the corresponding system appearance. */
  colorScheme?: 'light' | 'dark';
}

export type ThemeId = number | 'system';

// Names retain the original site's toggle labels.
export const themes = $state<Theme[]>([
  {
    name: 'dark',
    colorScheme: 'light',
    name_to_color: {
      '--primary': 'hsl(0, 0%, 20%)',
      '--secondary': 'hsl(0, 0%, 10%)',
      '--tertiary': 'hsl(0, 0%, 50%)',
      '--background': 'hsl(0, 0%, 100%)'
    }
  },
  {
    name: 'light',
    colorScheme: 'dark',
    name_to_color: {
      '--primary': 'hsl(0, 0%, 80%)',
      '--secondary': 'hsl(0, 0%, 90%)',
      '--tertiary': 'hsl(0, 0%, 50%)',
      '--background': 'hsl(0, 0%, 0%)'
    }
  }
]);

export const state_theme = $state<{ theme_id: ThemeId }>({ theme_id: 0 });
let system_dark = $state(false);

export function set_theme_id(value: ThemeId) {
  if (value !== 'system' && (!Number.isInteger(value) || !themes[value]))
    throw new RangeError(`Theme ${value} does not exist`);
  state_theme.theme_id = value;
  if (value === 'system') system_dark = system_is_dark();
  writePreference('theme_id', String(value));
  apply_theme();
}

function system_is_dark() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply_theme() {
  if (typeof document !== 'undefined') {
    const theme = get_current_theme();
    for (const [key, color] of Object.entries(theme.name_to_color)) {
      document.documentElement.style.setProperty(key, color);
    }
    document.documentElement.style.colorScheme = theme.colorScheme
      ?? (state_theme.theme_id === 'system' ? (system_dark ? 'dark' : 'light') : '');
  }
}

/** Attach appearance tracking for the lifetime of a Keyflow application. */
export function initialize_theme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const appearance = window.matchMedia('(prefers-color-scheme: dark)');
  const follow_system = () => {
    system_dark = appearance.matches;
    if (state_theme.theme_id === 'system') apply_theme();
  };
  appearance.addEventListener('change', follow_system);
  return () => appearance.removeEventListener('change', follow_system);
}

/** Return the resolved palette, including when the selected preference is system. */
export function get_current_theme() {
  if (state_theme.theme_id === 'system') {
    const scheme = system_dark ? 'dark' : 'light';
    return themes.find((theme) => theme.colorScheme === scheme)
      ?? themes[scheme === 'dark' && themes.length > 1 ? 1 : 0];
  }
  return themes[state_theme.theme_id];
}
