import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { StaticInputManager, create_static_token } from '../dist/stores/static-input.js';
import { parse_shortcut, format_shortcut } from '../dist/shortcuts.js';
import * as input from '../dist/stores/input.js';

const event = (key, extra = {}) => ({ key, code: key, repeat: false, ...extra });
function fixture(keys, platform = 'windows') {
  const manager = new StaticInputManager();
  manager.configure(platform);
  let calls = 0;
  const token = create_static_token(() => calls++);
  const cleanup = manager.register(token, keys);
  const press = (key, extra) => {
    manager.keydown(event(key, extra));
    manager.keyup(event(key, extra));
  };
  return { manager, token, cleanup, press, calls: () => calls };
}

test('character strings, named-key arrays, portable symbols and labels stay lowercase', () => {
  assert.deepEqual(parse_shortcut('aB'), ['a', 'b']);
  assert.deepEqual(parse_shortcut('esc'), ['escape']);
  assert.deepEqual(parse_shortcut(['ctrl', 'k'], 'mac'), ['meta', 'k']);
  assert.deepEqual(parse_shortcut(['ctrl', 'k'], 'windows'), ['control', 'k']);
  assert.deepEqual(parse_shortcut(['control', 'k'], 'mac'), ['control', 'k']);
  assert.equal(format_shortcut('aB'), 'ab');
  assert.equal(format_shortcut(['ctrl', 'shift', 'K'], 'mac'), '⌘⇧k');
  assert.equal(format_shortcut(['ctrl', 'shift', 'K'], 'windows'), 'ctrl⇧k');
  assert.equal(format_shortcut(['command', 'k'], 'mac'), '⌘k');
  assert.equal(format_shortcut(['esc', 'a'], 'linux'), '⎋a');
  assert.equal(format_shortcut(['alt', 'arrowleft'], 'mac'), '⌥←');
  assert.equal(format_shortcut('F1'), 'f1');
  assert.deepEqual(parse_shortcut(['control', '+']), ['control', '+']);
  assert.deepEqual(parse_shortcut('a+b'), ['a', '+', 'b']); // + is an actual key, never a separator.
  for (const invalid of ['', [], ['ab'], ['bogus']]) {
    assert.throws(() => parse_shortcut(invalid), RangeError);
  }
});

test('ordered presses can be fully released between keys', () => {
  const f = fixture('abc');
  const description = get(f.token.description);
  f.press('a'); f.press('b');
  assert.equal(f.calls(), 0);
  f.manager.keydown(event('c'));
  assert.equal(get(f.manager.progress).complete, true);
  assert.equal(f.calls(), 0);
  f.manager.keyup(event('c'));
  assert.equal(f.calls(), 1);
  assert.equal(get(f.token.description), description);
  f.cleanup();
});

test('every key follows the same press-order and release rules, including modifiers and Escape', () => {
  for (const [key, flags] of [
    ['a', {}], ['Escape', {}], ['Shift', { shiftKey: true }],
    ['Control', { ctrlKey: true }], ['Meta', { metaKey: true }], ['Alt', { altKey: true }]
  ]) {
    const f = fixture([key, 'b']);
    f.manager.keydown(event(key, flags));
    f.manager.keydown(event('b', flags));
    f.manager.keyup(event(key));
    assert.equal(f.calls(), 0, `${key} release must not stand in for b release`);
    f.manager.keyup(event('b'));
    f.manager.keyup(event('b'));
    assert.equal(f.calls(), 1);
    f.press(key, flags); f.press('b');
    assert.equal(f.calls(), 2, `${key} may be released before b is pressed`);
    f.cleanup();
  }
});

test('input order matters, repeated keys are supported, and keyboard repeat does not advance', () => {
  const f = fixture('aab');
  f.press('b');
  f.manager.keydown(event('a'));
  assert.equal(f.manager.keydown(event('a', { repeat: true })), true);
  assert.equal(get(f.manager.progress).depth, 1);
  f.manager.keyup(event('a')); f.press('b');
  assert.equal(f.calls(), 0);
  f.press('a'); f.press('a'); f.press('b');
  assert.equal(f.calls(), 1);
  f.cleanup();
});

test('duplicates and prefixes throw atomically in either registration order for every key type', () => {
  for (const first of ['a', 'esc', 'shift', 'ctrl', 'command']) {
    for (const longerFirst of [false, true]) {
      const original = longerFirst ? [first, 'b'] : [first];
      const conflicting = longerFirst ? [first] : [first, 'b'];
      const f = fixture(original);
      const description = get(f.token.description);
      assert.throws(() => f.manager.register(create_static_token(() => {}), conflicting), /prefix/i);
      assert.throws(() => f.manager.register(create_static_token(() => {}), original), /Duplicate/);
      assert.equal(get(f.token.description), description);
      for (const key of parse_shortcut(original, 'windows')) f.press(key);
      assert.equal(f.calls(), 1, 'the original binding must remain usable after rejection');
      f.cleanup();
    }
  }
});

test('reverse sequences and shared nonterminal prefixes remain distinct', () => {
  const f = fixture('ab');
  let reversed = 0, sibling = 0;
  const a = f.manager.register(create_static_token(() => reversed++), 'ba');
  const b = f.manager.register(create_static_token(() => sibling++), 'ac');
  f.press('b'); f.press('a');
  assert.equal(reversed, 1);
  f.press('a'); f.press('c');
  assert.equal(sibling, 1);
  f.press('a'); f.press('b');
  assert.equal(f.calls(), 1);
  a(); b(); f.cleanup();
});

test('portable modifier aliases resolve before trie lookup and conflict detection', () => {
  for (const platform of ['mac', 'windows', 'linux']) {
    const f = fixture(['ctrl', 'k'], platform);
    const key = platform === 'mac' ? 'Meta' : 'Control';
    const literal = platform === 'mac' ? 'command' : 'control';
    assert.throws(() => f.manager.register(create_static_token(() => {}), [literal, 'k']), /Duplicate/);
    f.press(key); f.press('k');
    assert.equal(f.calls(), 1);
    f.cleanup();
  }
});

test('modifier flags do not change the identity of regular or named keys', () => {
  const f = fixture('a');
  f.manager.keydown(event('Shift', { shiftKey: true })); // Not a registered step.
  assert.equal(f.manager.keydown(event('A', { code: 'KeyA', shiftKey: true })), true);
  f.manager.keyup(event('a', { code: 'KeyA', shiftKey: true }));
  assert.equal(f.calls(), 1);
  f.cleanup();
  const shift = fixture('shift');
  shift.press('Shift', { ctrlKey: true, shiftKey: true });
  assert.equal(shift.calls(), 1);
  shift.cleanup();
});

test('keyup uses physical identity even when the character changes after Shift is released', () => {
  const f = fixture(['shift', '?']);
  f.manager.keydown(event('Shift', { code: 'ShiftLeft' }));
  f.manager.keydown(event('?', { code: 'Slash' }));
  f.manager.keyup(event('Shift', { code: 'ShiftLeft' }));
  assert.equal(f.calls(), 0);
  f.manager.keyup(event('/', { code: 'Slash' }));
  assert.equal(f.calls(), 1);
  f.cleanup();
});

test('incomplete sequences have no timeout; terminal bindings activate immediately on release', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(['esc', 'a']);
  f.press('Escape'); t.mock.timers.tick(24 * 60 * 60 * 1000); f.press('a');
  assert.equal(f.calls(), 1);
  f.cleanup();
  const single = fixture('esc');
  single.press('Escape');
  assert.equal(single.calls(), 1);
  single.cleanup();
});

test('reset and unmount cancel pending input', () => {
  const f = fixture('ab');
  f.press('a'); f.manager.reset(); f.press('b');
  assert.equal(f.calls(), 0);
  f.manager.keydown(event('a'));
  f.manager.keydown(event('b'));
  f.cleanup();
  f.manager.keyup(event('a')); f.manager.keyup(event('b'));
  assert.equal(f.calls(), 0);
  assert.equal(get(f.manager.progress).depth, 0);
});

test('platform changes update labels; duplicate and prefix conflicts leave the previous platform intact', () => {
  const f = fixture(['ctrl', 'k']);
  f.manager.configure('mac');
  assert.equal(get(f.token.description).label, '⌘k');
  const cleanup = f.manager.register(create_static_token(() => {}), 'control');
  assert.throws(() => f.manager.configure('windows'), /prefix/i);
  f.press('Meta'); f.press('k');
  assert.equal(f.calls(), 1);
  cleanup(); f.cleanup();
});

test('static reservations survive alphabet changes, rejected prefixes and overlapping ownership', () => {
  input.set_available_keys(['a', 'b', 'c', 'd']);
  const manager = new StaticInputManager(input.reserve_input_keys);
  const a = manager.register(create_static_token(() => {}), 'ab');
  const b = manager.register(create_static_token(() => {}), 'bc');
  assert.deepEqual(get(input._available_keys), ['d']);
  assert.throws(() => manager.register(create_static_token(() => {}), 'b'), /prefix/i);
  assert.deepEqual(get(input._available_keys), ['d']);
  input.set_available_keys(['b', 'c', 'd', 'e']);
  assert.deepEqual(get(input._available_keys), ['d', 'e']);
  a();
  assert.deepEqual(get(input._available_keys), ['d', 'e']);
  b();
  assert.deepEqual(get(input._available_keys), ['b', 'c', 'd', 'e']);
});

test('dynamic automatic controls expand, shrink and reorder without disturbing fixed static bindings', () => {
  input.set_available_keys(['a', 'b', 'c', 'd']);
  const manager = new StaticInputManager(input.reserve_input_keys);
  let calls = 0;
  const fixed = create_static_token(() => calls++);
  const cleanup = manager.register(fixed, 'ab');
  const description = get(fixed.description);
  const tokens = Array.from({ length: 20 }, (_, priority) => ({ priority, on_close() {} }));
  tokens.slice(0, 2).forEach(input.add_input_token);
  assert.deepEqual(get(input.map_key_route).get(tokens[1]), ['d']);
  manager.keydown(event('a')); manager.keyup(event('a'));
  const progress = get(manager.progress).node;
  tokens.slice(2).forEach(input.add_input_token);
  const routes = [...get(input.map_key_route).values()];
  assert.equal(new Set(routes.map((route) => route.join(''))).size, 20);
  assert.ok(routes.every((route) => route.length === 5 && route.every((key) => key === 'c' || key === 'd')));
  input.update_list_input_token(tokens[19], -1);
  tokens.slice(0, 18).forEach(input.remove_input_token);
  assert.deepEqual(get(input.map_key_route).get(tokens[19]), ['c']);
  assert.equal(get(fixed.description), description);
  assert.equal(get(manager.progress).node, progress);
  manager.keydown(event('b')); manager.keyup(event('b'));
  assert.equal(calls, 1);
  input.add_key_strokes('c');
  assert.equal(input.take_input_action('c'), tokens[19].on_close);
  tokens.forEach(input.remove_input_token);
  cleanup();
  assert.deepEqual(get(input._available_keys), ['a', 'b', 'c', 'd']);
});
