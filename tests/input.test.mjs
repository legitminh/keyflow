import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import * as input from '../dist/stores/input.js';
import { key_presets } from '../dist/key-presets.js';

beforeEach(() => {
  for (const token of get(input.list_input_token)) input.remove_input_token(token);
  input.set_available_keys(['a', 's']);
});
const token = (priority) => ({ priority, on_close() {} });

test('shortcuts expand to distinct multi-key routes as visible controls grow', () => {
  const tokens = [token(0), token(1), token(2), token(3), token(4)];
  tokens.forEach(input.add_input_token);
  const routes = tokens.map((t) => get(input.map_numeric_route).get(t));
  assert.deepEqual(
    routes.map((r) => input.base_conversion_s_endian(r, 2)),
    [0, 1, 2, 3, 4]
  );
  assert.ok(routes.every((r) => r.length === 3));
});

test('removing hidden controls shrinks routes and priority changes reorder them', () => {
  const a = token(0),
    b = token(1),
    c = token(2);
  [a, b, c].forEach(input.add_input_token);
  input.remove_input_token(c);
  assert.equal(get(input.map_key_route).get(b).join(''), 's');
  input.update_list_input_token(b, -1);
  assert.equal(get(input.map_key_route).get(b).join(''), 'a');
  assert.equal(get(input.map_key_route).has(c), false);
});

test('duplicate registration is harmless and removal is idempotent', () => {
  const a = token(0);
  input.add_input_token(a);
  input.add_input_token(a);
  assert.equal(get(input.list_input_token).length, 1);
  input.remove_input_token(a);
  input.remove_input_token(a);
  assert.equal(get(input.list_input_token).length, 0);
});

test('shortcut alphabet validates configuration and resets partial input', () => {
  for (const keys of [[], ['a'], ['a', 'A'], ['a', 'Enter']]) {
    assert.throws(() => input.set_available_keys(keys), RangeError);
  }
  input.add_key_strokes('A');
  assert.deepEqual(get(input.list_key_strokes), [0]);
  input.set_available_keys(['Q', 'W']);
  assert.deepEqual(get(input._available_keys), ['q', 'w']);
  assert.deepEqual(get(input.list_key_strokes), []);
});

test('presets assign unique routes and expand beyond each alphabet capacity', () => {
  const expected = {
    default: '1234qwerasdfzxcv',
    letters: 'abcdefghijklmnopqrstuvwxyz',
    alphanumeric: 'abcdefghijklmnopqrstuvwxyz0123456789',
    numeric: '0123456789'
  };
  for (const [name, keys] of Object.entries(key_presets)) {
    for (const t of get(input.list_input_token)) input.remove_input_token(t);
    input.set_available_keys(keys);
    assert.equal(keys.join(''), expected[name]);
    const tokens = Array.from({ length: keys.length }, (_, i) => token(i));
    tokens.forEach(input.add_input_token);
    assert.deepEqual(tokens.map((t) => get(input.map_key_route).get(t).join('')), [...keys]);

    input.add_key_strokes(keys[0].toUpperCase());
    assert.deepEqual(get(input.list_key_strokes), [0]);
    const extra = token(keys.length);
    input.add_input_token(extra);
    const routes = [...tokens, extra].map((t) => get(input.map_key_route).get(t));
    assert.ok(routes.every((route) => route.length === 2));
    assert.equal(new Set(routes.map((route) => route.join(''))).size, keys.length + 1);
    assert.ok(routes.flat().every((key) => keys.includes(key)));
  }
});

test('switching presets recalculates existing routes and clears partial input', () => {
  const tokens = [token(0), token(1)];
  tokens.forEach(input.add_input_token);
  input.add_key_strokes('a');
  input.set_available_keys(key_presets.numeric);
  assert.deepEqual(get(input.list_key_strokes), []);
  assert.deepEqual(tokens.map((t) => get(input.map_key_route).get(t)), [['0'], ['1']]);
});
