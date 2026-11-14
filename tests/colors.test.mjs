import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distribute_color, f, color_hue, key_color_index, key_color_hue, shortcut_color_hue, special_key_color_indices } from '../dist/colors.js';
import { StaticInputManager, create_static_token } from '../dist/stores/static-input.js';
import { get } from 'svelte/store';

test('standard distribution follows binary subdivision for all 256 unique buckets', () => {
  assert.equal(f, distribute_color);
  assert.deepEqual(Array.from({ length: 24 }, (_, i) => f(256, 32, i)), [
    0, 32, 64, 96, 128, 160, 192, 224,
    16, 48, 80, 112, 144, 176, 208, 240,
    8, 40, 72, 104, 136, 168, 200, 232
  ]);
});

test('every supported small bucket count/gap produces a complete permutation with the promised absolute gap', () => {
  for (let b = 1; b <= 300; b++) {
    for (let h = 0; h <= Math.floor(b / 2); h++) {
      const colors = Array.from({ length: b }, (_, i) => f(b, h, i));
      assert.equal(new Set(colors).size, b, `b=${b}, h=${h}`);
      assert.ok(colors.every((x, i) => x >= 0 && x < b && Number.isInteger(x) &&
        (i === 0 || Math.abs(x - colors[i - 1]) >= h)), `b=${b}, h=${h}`);
    }
  }
});

test('invalid parameters reject; out-of-range indices never wrap or clamp to another color', () => {
  for (const args of [[0, 0], [3.5, 1], [64, 33], [256, -1], [256, 1.5], [Infinity, 32]]) {
    assert.throws(() => f(...args, 0), RangeError);
  }
  for (const index of [-1, 256, 300, 1.5, NaN, Infinity, undefined]) {
    assert.equal(f(256, 32, index), undefined);
    assert.equal(color_hue(index), undefined);
  }
});

test('key space normalizes aliases, cases, named keys and platform bindings with distinct reserved slots', () => {
  assert.equal(key_color_index('A'), 97);
  assert.equal(key_color_index('é'), 233);
  assert.equal(key_color_hue('esc'), key_color_hue('Escape'));
  assert.equal(key_color_hue(' '), key_color_hue('space'));
  assert.equal(key_color_index('ArrowLeft'), 28);
  assert.equal(key_color_index('F24'), 151);
  assert.equal(new Set(Object.values(special_key_color_indices)).size, Object.keys(special_key_color_indices).length);
  assert.equal(shortcut_color_hue(['ctrl'], undefined, 'mac'), key_color_hue('meta'));
  assert.equal(shortcut_color_hue(['ctrl'], undefined, 'windows'), key_color_hue('control'));
  for (const key of ['界', '😀', 'unknown', '\u0080', '\u001b', '']) assert.equal(key_color_hue(key), undefined);
  assert.equal(shortcut_color_hue('ab', 1), color_hue(1));
  assert.equal(shortcut_color_hue('ab', 256), undefined);
  assert.equal(shortcut_color_hue('ab'), undefined);
});

test('static multi-key ordinals are sequential and independent of single keys, with rejected bindings leaving colors intact', () => {
  const manager = new StaticInputManager();
  const single = create_static_token(), first = create_static_token(), second = create_static_token();
  manager.register(single, 'escape');
  const remove = manager.register(first, 'ab');
  manager.register(second, 'cd');
  assert.deepEqual(get(first.description).keys, ['a', 'b']);
  assert.equal(get(first.description).color_index, 0);
  assert.equal(get(second.description).color_index, 1);
  assert.throws(() => manager.register(create_static_token(), 'c'), RangeError);
  assert.equal(get(second.description).color_index, 1);
  remove();
  assert.equal(get(second.description).color_index, 0);
  manager.clear();
});
