import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve_flick_direction, flick_translation_key } from '../dist/flick.js';
import { keyboard_layouts, create_grid_keyboard } from '../dist/keyboards.js';
import { parse_shortcut } from '../dist/shortcuts.js';

const bounds = { left: 100, right: 200, top: 100, bottom: 200 };
test('flicks use final release beyond the original border; inside and border are taps', () => {
  for (const [x, y, side] of [[150, 99, 'up'], [150, 201, 'down'], [99, 150, 'left'], [201, 150, 'right'],
    [150, 150, null], [100, 100, null], [200, 200, null]]) {
    assert.equal(resolve_flick_direction(bounds, x, y), side);
  }
});
test('diagonal flicks choose normalized overrun, with vertical ties', () => {
  assert.equal(resolve_flick_direction(bounds, 50, 80), 'left');
  assert.equal(resolve_flick_direction(bounds, 220, 250), 'down');
  assert.equal(resolve_flick_direction(bounds, 50, 50), 'up');
  assert.equal(resolve_flick_direction({ left: 0, right: 200, top: 0, bottom: 100 }, 240, -30), 'up');
});
test('flick alpha covers US printable key identities and standard desktop controls', () => {
  const layout = keyboard_layouts['flick-alpha'];
  assert.deepEqual(layout.rows.map((row) => row.length), [10, 9, 7]);
  const keys = new Set();
  for (const key of layout.rows.flat()) {
    keys.add(key.key);
    assert.ok(Object.isFrozen(key.flick));
    for (const translation of Object.values(key.flick)) {
      const value = flick_translation_key(translation);
      assert.equal(parse_shortcut([value]).length, 1);
      keys.add(value);
    }
  }
  for (const char of 'abcdefghijklmnopqrstuvwxyz0123456789`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/?') assert.ok(keys.has(char), `Missing ${char}`);
  for (const key of ['space', 'tab', 'enter', 'backspace', 'escape', 'shift', 'control', 'alt', 'meta',
    'capslock', 'insert', 'delete', 'home', 'end', 'pageup', 'pagedown', 'arrowleft', 'arrowright',
    'arrowup', 'arrowdown', 'printscreen', 'scrolllock', 'pause', 'numlock', 'contextmenu',
    ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)]) assert.ok(keys.has(key), `Missing ${key}`);
});
test('custom layouts mix ordinary and flick keys without sharing mutable translations', () => {
  const source = { key: 'a', flick: { up: { key: '1', label: 'One' } } };
  const layout = create_grid_keyboard('mixed', [source, 'b'], 2);
  assert.deepEqual(layout.rows[0][1], { key: 'b' });
  layout.rows[0][0].flick.up.label = 'Changed';
  assert.equal(source.flick.up.label, 'One');
});
