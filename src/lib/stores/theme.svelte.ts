import { writePreference } from '../storage.js';

export interface Theme {
  name: string;
  name_to_color: Record<string, string>;
}

// Names retain the original site's toggle labels.
export const themes = $state<Theme[]>([
  {
    name: 'dark',
    name_to_color: {
      '--primary': 'hsl(0, 0%, 20%)',
      '--secondary': 'hsl(0, 0%, 10%)',
      '--tertiary': 'hsl(0, 0%, 50%)',
      '--background': 'hsl(0, 0%, 100%)'
    }
  },
  {
    name: 'light',
    name_to_color: {
      '--primary': 'hsl(0, 0%, 80%)',
      '--secondary': 'hsl(0, 0%, 90%)',
      '--tertiary': 'hsl(0, 0%, 50%)',
      '--background': 'hsl(0, 0%, 0%)'
    }
  }
]);

export const state_theme = $state({ theme_id: 0 });

export function set_theme_id(value: number) {
  if (!Number.isInteger(value) || !themes[value])
    throw new RangeError(`Theme ${value} does not exist`);
  state_theme.theme_id = value;
  writePreference('theme_id', String(value));
  if (typeof document !== 'undefined') {
    for (const [key, color] of Object.entries(themes[value].name_to_color)) {
      document.documentElement.style.setProperty(key, color);
    }
  }
}

export function get_current_theme() {
  return themes[state_theme.theme_id];
}
