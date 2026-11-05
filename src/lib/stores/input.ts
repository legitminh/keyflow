import { writable } from 'svelte/store';

import { get } from 'svelte/store';
import { insert_sorted } from '../utils/iterable.js';
import { key_presets } from '../key-presets.js';

// below: list of key routes for each input token, where each key route is a list of keys that can be pressed to activate the input token
export const _map_key_route = writable<Map<InputToken, string[]>>(new Map());

export const _map_numeric_route = writable<Map<InputToken, number[]>>(new Map());

export const map_key_route = {
  subscribe: _map_key_route.subscribe
};

export const map_numeric_route = {
  subscribe: _map_numeric_route.subscribe
};

const get_numeric_route = (value: InputToken | null) => {
  if (value === null) {
    return [-1];
  }
  const numeric_index = get(_list_input_token).findIndex((token) => token === value);
  if (numeric_index === -1) {
    return [-1];
  } //non-viable input token
  const numeric_route = base_diffusion_s_endian(numeric_index, get(_available_keys).length);

  return numeric_route;
};

const get_key_route = (value: InputToken | null) => {
  const numeric_route = get_numeric_route(value);
  const key_route = Array.from(numeric_route, (v) => get(_available_keys)[v]);

  return key_route;
};

const update_map_key_route = () => {
  const keyRoutes = new Map<InputToken, string[]>();
  for (const token of get(_list_input_token)) {
    keyRoutes.set(token, get_key_route(token));
  }
  _map_key_route.set(keyRoutes);
};

const update_map_numeric_route = () => {
  const numericRoutes = new Map<InputToken, number[]>();
  for (const token of get(_list_input_token)) {
    numericRoutes.set(token, get_numeric_route(token));
  }
  _map_numeric_route.set(numericRoutes);
};

export type InputToken = {
  // token is binary component of input space that can be on or off over the timeline
  priority: number;
  on_close(): void; // action trigger when token is deactivated
};

export const _available_keys = writable<string[]>([...key_presets.default]);

const compare_input_token = (a: InputToken, b: InputToken) => a.priority - b.priority;

export const _list_key_strokes = writable<number[]>([]);

export const list_key_strokes = {
  subscribe: _list_key_strokes.subscribe
};

export const set_key_strokes = (value: number[]) => {
  _list_key_strokes.set(value);
  update_map_key_route();
  update_map_numeric_route();
};

export const add_key_strokes = (value: string) => {
  const index_value = get(_available_keys).findIndex((v) => v === value.toLowerCase());
  if (index_value != -1) {
    _list_key_strokes.update((prev: number[]) => [...prev, index_value]);
  }
  update_map_key_route();
  update_map_numeric_route();
};

export const reset_key_strokes = () => {
  set_key_strokes([]);
  update_map_key_route();
  update_map_numeric_route();
};

export const _list_input_token = writable<InputToken[]>([]);

export const list_input_token = {
  subscribe: _list_input_token.subscribe
};

export const add_input_token = (value: InputToken) => {
  if (get(_list_input_token).findIndex((v) => v === value) !== -1) {
    return; //if already exist
  }
  _list_input_token.update((prev) => {
    const next = [...prev];
    insert_sorted<InputToken>(next, value, compare_input_token);
    return next;
  });
  update_map_key_route();
  update_map_numeric_route();
};

export const update_list_input_token = (value: InputToken, new_priority: number) => {
  let nextList: InputToken[] = [];

  _list_input_token.update((prev) => {
    const next = [...prev];
    const index = next.indexOf(value);
    if (index === -1) {
      nextList = prev;
      return prev;
    }

    value.priority = new_priority;
    // insert_sorted<InputToken>(next, value, compare_input_token);
    next.sort(compare_input_token);
    nextList = next;
    return next;
  });

  update_map_key_route();
  update_map_numeric_route();
  return nextList;
};

export const remove_input_token = (value: InputToken) => {
  _list_input_token.update((prev) => prev.filter((t) => t !== value));
  update_map_key_route();
  update_map_numeric_route();
};

export const base_conversion_s_endian = (initial: number[], base: number) => {
  let result = 0;
  for (let i = 0; i < initial.length; i++) {
    result += initial[i] * base ** i;
  }
  return result;
};

const get_num_key_strokes = (list_input_token: InputToken[], available_keys: string[]) => {
  return Math.max(
    1,
    Math.ceil(Math.log(Math.max(1, list_input_token.length)) / Math.log(available_keys.length))
  );
};

const num_key_strokes_needed = () => {
  return get_num_key_strokes(get(_list_input_token), get(_available_keys));
};

const base_diffusion_s_endian = (initial: number, base: number) => {
  const result: number[] = [];
  while (initial > 0) {
    result.push(initial % base);
    initial = Math.floor(initial / base);
  }
  while (result.length < num_key_strokes_needed()) {
    result.push(0);
  }
  return result;
};

/** Change the shortcut alphabet and recalculate every displayed route. */
export function set_available_keys(keys: readonly string[]) {
  const normalized = keys.map((key) => key.toLowerCase());
  if (
    normalized.length < 2 ||
    normalized.some((key) => key.length !== 1) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new RangeError('Provide at least two unique single-character shortcut keys');
  }
  _available_keys.set(normalized);
  reset_key_strokes();
}
