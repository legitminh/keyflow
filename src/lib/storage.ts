let prefix = 'keyflow:';

export function setStoragePrefix(value: string) {
  prefix = value;
}

/**
 * Preferences (theme, grid size, scrolling mode, keypath visibility) persist across browser and installed-PWA
 * sessions in localStorage. Values saved by earlier versions in sessionStorage are read
 * once and moved to localStorage.
 */
export function readPreference(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(prefix + key);
    if (saved !== null) return saved;
  } catch {
    // Fall through to the legacy session value.
  }
  try {
    const legacy = window.sessionStorage.getItem(prefix + key);
    if (legacy !== null) writePreference(key, legacy);
    return legacy;
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(prefix + key, value);
  } catch {
    // Preferences still work when browser storage is unavailable.
  }
}
