import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize_slider_value as snap } from '../dist/slider.js';

test('slider clamps endpoints, snaps from min, and supports fractional steps without floating point tails', () => {
  assert.equal(snap(-20, 10, 20, 3), 10);
  assert.equal(snap(40, 10, 20, 3), 20);
  assert.equal(snap(15, 10, 20, 3), 16);
  assert.equal(snap(0.1 + 0.2, 0, 1, 0.1), 0.3);
  assert.equal(snap(-1.1, -5, 5, 0.5), -1);
  for (const args of [[NaN, 0, 1, 1], [1, 1, 1, 1], [1, 2, 1, 1], [1, 0, 2, 0], [1, 0, 2, -1], [1, 0, Infinity, 1]]) {
    assert.throws(() => snap(...args), RangeError);
  }
});
