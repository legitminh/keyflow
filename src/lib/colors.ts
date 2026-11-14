import { normalize_event_key, parse_shortcut, type Shortcut, type ShortcutPlatform } from './shortcuts.js';

/** A permutation of [0, b), with absolute adjacent differences >= h. Undefined outside the sequence. */
export function distribute_color(b: number, h: number, i: number): number | undefined {
  if (!Number.isSafeInteger(b) || b < 1 || !Number.isSafeInteger(h) || h < 0 ||
      (b > 1 && h > Math.floor(b / 2))) {
    throw new RangeError('Use a positive integer bucket count and an integer gap between 0 and floor(b / 2)');
  }
  if (!Number.isSafeInteger(i) || i < 0 || i >= b) return undefined;
  const p = 2 ** Math.ceil(Math.log2(Math.max(1, h)));
  const jumps = b / p;
  if (Number.isInteger(jumps) && jumps >= 3) {
    let cycle = Math.floor(i / jumps);
    let offset = 0;
    for (let weight = p / 2; weight >= 1; weight /= 2) {
      offset += (cycle % 2) * weight;
      cycle = Math.floor(cycle / 2);
    }
    return offset + (i % jumps) * p;
  }
  // The subdivision formula can leave buckets out when p does not divide b,
  // and can violate h with fewer than three jumps. Interleave descending halves
  // in these cases: every gap is at least floor(b / 2), with no repeats.
  return i % 2 === 0 ? Math.ceil(b / 2) - 1 - Math.floor(i / 2) : b - 1 - Math.floor(i / 2);
}

/** Mathematical f[b,h,i], also exported under a descriptive name. */
export const f = distribute_color;

/** Stable byte slots for named keys; printable characters use their lowercase code point. */
export const special_key_color_indices: Readonly<Record<string, number>> = Object.freeze({
  home: 2, end: 3, pageup: 4, pagedown: 5, insert: 6, backspace: 8, tab: 9,
  enter: 13, shift: 16, control: 17, alt: 18, meta: 19, capslock: 20,
  escape: 27, arrowleft: 28, arrowright: 29, arrowup: 30, arrowdown: 31,
  space: 32, delete: 127,
  ...Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`f${index + 1}`, 128 + index])),
  pause: 152, printscreen: 153, scrolllock: 154, numlock: 155, contextmenu: 156
});

export function key_color_index(key: string): number | undefined {
  const normalized = normalize_event_key(key);
  if (Object.hasOwn(special_key_color_indices, normalized)) return special_key_color_indices[normalized];
  const characters = Array.from(normalized);
  const code = characters.length === 1 ? normalized.codePointAt(0)! : -1;
  // Control-code slots are reserved for named keys.
  return code >= 33 && code <= 126 || code >= 160 && code <= 255 ? code : undefined;
}

/** Hue in CSS degrees, using f(256, 32, index). Missing/out-of-range indices have no color. */
export function color_hue(index: number | undefined): number | undefined {
  if (index === undefined) return undefined;
  const bucket = distribute_color(256, 32, index);
  return bucket === undefined ? undefined : bucket * 360 / 256;
}

export const key_color_hue = (key: string) => color_hue(key_color_index(key));

/** Single keys use the shared key space; multi-key routes use the supplied zero-based ordinal. */
export function shortcut_color_hue(shortcut: Shortcut, index?: number, platform?: ShortcutPlatform): number | undefined {
  const keys = parse_shortcut(shortcut, platform);
  return keys.length === 1 ? key_color_hue(keys[0]) : color_hue(index);
}
