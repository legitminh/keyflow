import { get, writable } from 'svelte/store';
import { insert_sorted } from '../utils/iterable.js';
import { key_presets } from '../key-presets.js';

export type InputToken = { priority: number; on_close(): void };

export const _map_key_route = writable<Map<InputToken, string[]>>(new Map());
export const _map_numeric_route = writable<Map<InputToken, number[]>>(new Map());
export const map_key_route = { subscribe: _map_key_route.subscribe };
export const map_numeric_route = { subscribe: _map_numeric_route.subscribe };
/** Cached positions for display colors; never scan the token list while rendering. */
export const map_input_index = writable<Map<InputToken, number>>(new Map());
export const _list_input_token = writable<InputToken[]>([]);
export const list_input_token = { subscribe: _list_input_token.subscribe };
export const _list_key_strokes = writable<number[]>([]);
export const list_key_strokes = { subscribe: _list_key_strokes.subscribe };
/** Effective alphabet, after static shortcuts reserve their constituent keys. */
export const _available_keys = writable<string[]>([...key_presets.default]);

let configuredKeys: readonly string[] = key_presets.default;
let keyIndices = new Map(configuredKeys.map((key, index) => [key, index]));
/** Registration scope; its bindings survive while another scope masks it. */
export interface InputFrameState {
  tokens: Set<InputToken>;
  ordered: InputToken[];
  reservations: Map<object, readonly string[]>;
}
export const create_input_frame_state = (): InputFrameState => ({ tokens: new Set(), ordered: [], reservations: new Map() });
export const root_input_state = create_input_frame_state();
let activeState = root_input_state;

export function select_input_frame_state(frame: InputFrameState) {
  activeState = frame;
  _list_input_token.set([...frame.ordered]);
  if (!refresh_reservations()) rebuild_routes();
}

function refresh_reservations() {
  reservedCounts.clear();
  for (const keys of activeState.reservations.values()) {
    for (const key of keys) reservedCounts.set(key, (reservedCounts.get(key) ?? 0) + 1);
  }
  return update_alphabet();
}
const reservedCounts = new Map<string, number>();
const compare = (a: InputToken, b: InputToken) => a.priority - b.priority;

/** O(n * route length), only when registration, ordering, or the alphabet changes. */
function rebuild_routes() {
  const tokens = get(_list_input_token);
  const keys = get(_available_keys);
  let length = keys.length >= 2 || keys.length === 1 && tokens.length === 1 ? 1 : 0;
  if (keys.length >= 2) {
    for (let capacity = keys.length; capacity < tokens.length; capacity *= keys.length) length++;
  }
  const numeric = new Map<InputToken, number[]>();
  const labels = new Map<InputToken, string[]>();
  const indices = new Map<InputToken, number>();
  tokens.forEach((token, index) => {
    indices.set(token, index);
    if (!length) return; // Insufficient alphabet: leave pointer activation available.
    let remainder = index;
    const route = Array.from({ length }, () => {
      const digit = remainder % keys.length;
      remainder = Math.floor(remainder / keys.length);
      return digit;
    });
    numeric.set(token, route);
    labels.set(token, route.map((digit) => keys[digit]));
  });
  map_input_index.set(indices);
  _map_numeric_route.set(numeric);
  _map_key_route.set(labels);
  reset_key_strokes();
}

function update_alphabet() {
  const next = configuredKeys.filter((key) => !reservedCounts.has(key));
  const previous = get(_available_keys);
  if (next.length === previous.length && next.every((key, index) => key === previous[index])) return false;
  keyIndices = new Map(next.map((key, index) => [key, index]));
  _available_keys.set(next);
  rebuild_routes();
  return true;
}

/** Internal, reference-counted reservations; shared static keys restore correctly. */
export function reserve_input_keys(owner: object, keys: readonly string[], frame = root_input_state) {
  const previous = frame.reservations.get(owner) ?? [];
  const next = [...new Set(keys.filter((key) => key.length === 1).map((key) => key.toLowerCase()))];
  if (next.length) frame.reservations.set(owner, next);
  else frame.reservations.delete(owner);
  if (frame !== activeState) return;
  for (const key of previous) {
    const count = reservedCounts.get(key)! - 1;
    if (count) reservedCounts.set(key, count);
    else reservedCounts.delete(key);
  }
  for (const key of next) reservedCounts.set(key, (reservedCounts.get(key) ?? 0) + 1);
  update_alphabet();
}

export const set_key_strokes = (value: number[]) => _list_key_strokes.set(value);
export const reset_key_strokes = () => set_key_strokes([]);
export const add_key_strokes = (value: string) => {
  const index = keyIndices.get(value.toLowerCase());
  if (index !== undefined) _list_key_strokes.update((previous) => [...previous, index]);
};

export const register_input_token = (token: InputToken, frame: InputFrameState) => {
  if (frame.tokens.has(token)) return;
  frame.tokens.add(token);
  const next = [...frame.ordered];
  insert_sorted(next, token, compare);
  frame.ordered = next;
  if (frame !== activeState) return;
  _list_input_token.set(next);
  rebuild_routes();
};

export const unregister_input_token = (token: InputToken, frame: InputFrameState) => {
  if (!frame.tokens.delete(token)) return;
  frame.ordered = frame.ordered.filter((item) => item !== token);
  if (frame !== activeState) return;
  _list_input_token.set(frame.ordered);
  rebuild_routes();
};

export const update_input_token = (token: InputToken, priority: number, frame: InputFrameState) => {
  token.priority = priority;
  const previous = frame.ordered;
  if (!frame.tokens.has(token)) return previous;
  const next = previous.filter((item) => item !== token);
  insert_sorted(next, token, compare);
  if (next.some((item, index) => item !== previous[index])) {
    frame.ordered = next;
    if (frame === activeState) {
      _list_input_token.set(next);
      rebuild_routes();
    }
  }
  return next;
};

export const base_conversion_s_endian = (digits: number[], base: number) => {
  let result = 0;
  let power = 1;
  for (const digit of digits) {
    result += digit * power;
    power *= base;
  }
  return result;
};

/** O(route length) lookup, independent of the number of controls. */
export function take_input_token(key: string): InputToken | undefined {
  if (!keyIndices.has(key.toLowerCase())) return;
  const strokes = get(_list_key_strokes);
  const tokens = get(_list_input_token);
  const base = keyIndices.size;
  if (!strokes.length || !base || (base === 1 && tokens.length !== 1)) return;
  if (base ** strokes.length < tokens.length) return;
  const token = tokens[base_conversion_s_endian(strokes, base)];
  reset_key_strokes();
  return token;
}

/** Compatibility helper for imperative callers that resolve actions themselves. */
export const take_input_action = (key: string) => take_input_token(key)?.on_close;

/** Change the configured alphabet; mounted static reservations still apply. */
export function set_available_keys(keys: readonly string[]) {
  const normalized = keys.map((key) => key.toLowerCase());
  if (normalized.length < 2 || normalized.some((key) => key.length !== 1) ||
      new Set(normalized).size !== normalized.length) {
    throw new RangeError('Provide at least two unique single-character shortcut keys');
  }
  configuredKeys = normalized;
  update_alphabet();
  reset_key_strokes();
}

// Legacy imperative helpers target the root frame. Components use their context scope.
export const add_input_token = (token: InputToken) => register_input_token(token, root_input_state);
export const remove_input_token = (token: InputToken) => unregister_input_token(token, root_input_state);
export const update_list_input_token = (token: InputToken, priority: number) => update_input_token(token, priority, root_input_state);
