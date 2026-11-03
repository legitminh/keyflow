import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPreference, writePreference, setStoragePrefix } from '../dist/storage.js';

test('storage works on the server and with blocked browser storage', () => {
  assert.equal(readPreference('theme_id'), null);
  assert.doesNotThrow(() => writePreference('theme_id', '0'));
  globalThis.window = {
    get sessionStorage() {
      throw new Error('Storage blocked');
    }
  };
  try {
    assert.equal(readPreference('theme_id'), null);
    assert.doesNotThrow(() => writePreference('theme_id', '1'));
  } finally {
    delete globalThis.window;
  }
});

test('preferences use the configured namespace', () => {
  const saved = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    }
  };
  try {
    setStoragePrefix('demo:');
    writePreference('theme_id', '1');
    assert.equal(saved.get('demo:theme_id'), '1');
    assert.equal(readPreference('theme_id'), '1');
  } finally {
    delete globalThis.window;
    setStoragePrefix('keyflow:');
  }
});
