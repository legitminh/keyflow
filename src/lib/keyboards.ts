import { get, writable } from 'svelte/store';
import type { FlickBindings } from './flick.js';

/** A key describes input space only; it never contains an InputToken or action binding. */
export interface KeyboardKey {
  key: string;
  label?: string;
  color?: string;
  /** Relative width in row-based layouts. */
  width?: number;
  disabled?: boolean;
  /** Directional release translations; omit for a regular tap key. */
  flick?: FlickBindings;
}
export interface KeyboardLayout {
  id: string;
  label: string;
  rows: readonly (readonly KeyboardKey[])[];
}
const row = (keys: string): KeyboardKey[] => Array.from(keys, (key) => ({ key }));
const namedLabels: Record<string, string> = { contextmenu: '☰', control: '⌃', alt: '⌥' };
const named = (key: string, width = 1): KeyboardKey => ({ key, width, ...(namedLabels[key] ? { label: namedLabels[key] } : {}) });
const alpha = [row('qwertyuiop'), row('asdfghjkl'), row('zxcvbnm')];
const sixty = [
  [named('escape'), ...row('1234567890-='), named('backspace', 2)],
  [named('tab', 1.5), ...row('qwertyuiop[]'), named('\\', 1.5)],
  [named('capslock', 1.75), ...row("asdfghjkl;'"), named('enter', 2.25)],
  [named('shift', 2.25), ...row('zxcvbnm,./'), named('shift', 2.75)],
  [named('control', 1.25), named('meta', 1.25), named('alt', 1.25), named('space', 6.25), named('alt', 1.25), named('meta', 1.25), named('contextmenu', 1.25), named('control', 1.25)]
];

// Simple 3×10 ortholinear preset. Unspecified directions intentionally stay unbound.
const flickRows = [Array.from('qwertyuiop'), [...Array.from('asdfghjkl'), 'escape'], [...Array.from('zxcvbnm,.'), 'space']];
const flickAlpha: KeyboardKey[][] = flickRows.map((keys, rowIndex) => keys.map((key, column) => {
  const flick: Partial<Record<'up' | 'down' | 'left' | 'right', string>> = {};
  if (/^[a-z]$/.test(key)) flick.down = key.toUpperCase();
  if (rowIndex === 0) flick.up = String((column + 1) % 10);
  if (key === 'b') { flick.left = '['; flick.right = ']'; }
  if (key === 'c') { flick.left = '{'; flick.right = '}'; }
  if (key === 'escape') {
    flick.up = '~'; flick.down = '`'; flick.left = 'backspace'; flick.right = 'tab';
  }
  if (key === ',') { flick.left = '<'; flick.right = '>'; }
  if (key === 'space') {
    flick.up = 'arrowup'; flick.down = 'arrowdown';
    flick.left = 'arrowleft'; flick.right = 'arrowright';
  }
  return { key, flick };
}));

function copy_key(key: KeyboardKey): KeyboardKey {
  return { ...key, ...(key.flick ? { flick: Object.fromEntries(Object.entries(key.flick).filter(([, value]) => value !== undefined).map(([side, value]) =>
    [side, typeof value === 'string' ? value : { ...value }])) } : {}) };
}

export function create_grid_keyboard(id: string, keys: readonly (string | KeyboardKey)[], columns: number, label = id): KeyboardLayout {
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError('Keyboard columns must be a positive integer');
  const rows: KeyboardKey[][] = [];
  keys.forEach((key, index) => {
    if (index % columns === 0) rows.push([]);
    rows[rows.length - 1].push(typeof key === 'string' ? { key } : copy_key(key));
  });
  return { id, label, rows };
}
function freeze_layout(layout: KeyboardLayout): KeyboardLayout {
  layout.rows.forEach((keys) => {
    keys.forEach((key) => {
      if (key.flick) { Object.values(key.flick).forEach(Object.freeze); Object.freeze(key.flick); }
      Object.freeze(key);
    });
    Object.freeze(keys);
  });
  Object.freeze(layout.rows);
  return Object.freeze(layout);
}
export const keyboard_layouts = Object.freeze({
  'flick-alpha': freeze_layout({ id: 'flick-alpha', label: 'Flick alpha keyboard', rows: flickAlpha }),
  alpha: freeze_layout({ id: 'alpha', label: 'Alphabet', rows: alpha }),
  alphanumeric: freeze_layout({ id: 'alphanumeric', label: 'Alphanumeric', rows: [row('1234567890'), ...alpha.map((keys) => keys.map((key) => ({ ...key })))] }),
  '60%': freeze_layout({ id: '60%', label: '60% keyboard', rows: sixty }),
  ortholinear: freeze_layout(create_grid_keyboard('ortholinear', [
    'escape', ...Array.from('1234567890'), 'backspace',
    'tab', ...Array.from('qwertyuiop'), '\\',
    'control', ...Array.from('asdfghjkl'), ';', 'enter',
    'shift', ...Array.from('zxcvbnm,./'), 'space'
  ], 12, 'Ortholinear keyboard')),
  grid16: freeze_layout(create_grid_keyboard('grid16', Array.from('1234qwerasdfzxcv'), 4, '16-key keyboard')),
  grid32: freeze_layout(create_grid_keyboard('grid32', Array.from('12345678qwertyuiasdfghjkzxcvbnm,'), 8, '32-key keyboard'))
});

/** Create one registry per project/request. Selecting null hides the keyboard. */
export function create_keyboard_store(initial: readonly KeyboardLayout[] = [], activeId: string | null = null) {
  const entries = new Map<string, KeyboardLayout>();
  const layouts = writable<readonly KeyboardLayout[]>([]);
  const active = writable<KeyboardLayout | null>(null);
  const publish = () => layouts.set([...entries.values()]);
  const store = {
    keyboards: { subscribe: layouts.subscribe },
    active: { subscribe: active.subscribe },
    add(layout: KeyboardLayout) {
      if (!layout.id || entries.has(layout.id)) throw new RangeError(`Duplicate or empty keyboard id: ${layout.id}`);
      entries.set(layout.id, layout);
      publish();
    },
    update(layout: KeyboardLayout) {
      if (!entries.has(layout.id)) throw new RangeError(`Unknown keyboard: ${layout.id}`);
      entries.set(layout.id, layout);
      publish();
      if (get(active)?.id === layout.id) active.set(layout);
    },
    remove(id: string) {
      if (!entries.delete(id)) return;
      if (get(active)?.id === id) active.set(null);
      publish();
    },
    select(id: string | null) {
      if (id !== null && !entries.has(id)) throw new RangeError(`Unknown keyboard: ${id}`);
      active.set(id === null ? null : entries.get(id)!);
    }
  };
  initial.forEach((layout) => store.add(layout));
  store.select(activeId);
  return store;
}
export type KeyboardStore = ReturnType<typeof create_keyboard_store>;
