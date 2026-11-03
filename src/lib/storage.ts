let prefix = 'keyflow:';

export function setStoragePrefix(value: string) {
  prefix = value;
}

export function readPreference(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(prefix + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string) {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(prefix + key, value);
  } catch {
    // Preferences still work when browser storage is unavailable.
  }
}
