export type Shortcut = string | readonly string[];
export type ShortcutPlatform = 'mac' | 'windows' | 'linux';

/** Labels follow the special-key symbols used by discrete. */
export const key_symbols: Readonly<Record<string, string>> = Object.freeze({
  escape: '⎋', shift: '⇧', tab: '⇥', enter: '⏎', backspace: '⌫', delete: '⌦',
  arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓',
  space: '␣', home: '↖', end: '↘', pageup: '⇞', pagedown: '⇟', capslock: '⇪'
});

export function detect_shortcut_platform(): ShortcutPlatform {
  if (typeof navigator === 'undefined') return 'windows';
  const platform = `${navigator.platform} ${navigator.userAgent}`;
  if (/Mac|iPhone|iPad|iPod/i.test(platform)) return 'mac';
  return /Linux|Android/i.test(platform) ? 'linux' : 'windows';
}

const aliases: Record<string, string> = {
  esc: 'escape', '⎋': 'escape', return: 'enter', '⏎': 'enter',
  spacebar: 'space', ' ': 'space', '␣': 'space', plus: '+',
  command: 'meta', cmd: 'meta', '⌘': 'meta', win: 'meta', windows: 'meta',
  option: 'alt', opt: 'alt', '⌥': 'alt', '⇧': 'shift', '⌃': 'control',
  left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
  '⇥': 'tab', '⌫': 'backspace', '⌦': 'delete'
};
const namedKeys = new Set([
  ...Object.keys(key_symbols), 'control', 'meta', 'alt', 'insert', 'pause',
  'printscreen', 'scrolllock', 'numlock', 'contextmenu',
  ...Array.from({ length: 24 }, (_, index) => `f${index + 1}`)
]);

/** Normalize actual KeyboardEvent.key values without remapping physical Control. */
export function normalize_event_key(key: string): string {
  const lower = key.toLowerCase();
  return aliases[lower] ?? lower;
}

/** Strings are character sequences (or one named key); arrays specify named-key sequences. */
export function parse_shortcut(shortcut: Shortcut, platform = detect_shortcut_platform()): string[] {
  const isNamed = (key: string) => namedKeys.has(normalize_event_key(key)) || ['ctrl', 'mod', 'primary'].includes(key);
  const parts = typeof shortcut === 'string'
    ? isNamed(shortcut.toLowerCase()) ? [shortcut] : Array.from(shortcut)
    : [...shortcut];
  if (!parts.length) throw new RangeError('A static shortcut needs at least one key');
  return parts.map((part) => {
    const lower = part === ' ' ? 'space' : part.trim().toLowerCase();
    const key = ['ctrl', 'mod', 'primary'].includes(lower)
      ? platform === 'mac' ? 'meta' : 'control'
      : normalize_event_key(lower);
    if (!key || (key.length !== 1 && !namedKeys.has(key))) {
      throw new RangeError(`Unknown shortcut key: ${part}. Array entries must be single characters or named keys.`);
    }
    return key;
  });
}

export function shortcut_key_label(key: string, platform: ShortcutPlatform): string {
  if (key === 'control') return platform === 'mac' ? '⌃' : 'ctrl';
  if (key === 'meta') return platform === 'mac' ? '⌘' : platform === 'windows' ? '⊞' : 'meta';
  if (key === 'alt') return platform === 'mac' ? '⌥' : 'alt';
  return key_symbols[key] ?? key;
}

export function format_shortcut(shortcut: Shortcut, platform = detect_shortcut_platform()): string {
  return parse_shortcut(shortcut, platform).map((key) => shortcut_key_label(key, platform)).join('');
}
