import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPreference, writePreference, setStoragePrefix } from '../dist/storage.js';

const memoryStorage = (saved = new Map()) => ({
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value)
});

test('storage works on the server and with blocked browser storage', () => {
  assert.equal(readPreference('theme_id'), null);
  assert.doesNotThrow(() => writePreference('theme_id', '0'));
  globalThis.window = {
    get localStorage() {
      throw new Error('Storage blocked');
    },
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

test('preferences persist in localStorage under the configured namespace', () => {
  const saved = new Map();
  const session = new Map();
  globalThis.window = { localStorage: memoryStorage(saved), sessionStorage: memoryStorage(session) };
  try {
    setStoragePrefix('demo:');
    writePreference('theme_id', '1');
    assert.equal(saved.get('demo:theme_id'), '1');
    assert.equal(session.size, 0);
    assert.equal(readPreference('theme_id'), '1');
  } finally {
    delete globalThis.window;
    setStoragePrefix('keyflow:');
  }
});

test('session values from earlier versions move to localStorage', () => {
  const saved = new Map();
  const session = new Map([['keyflow:min_box', '36']]);
  globalThis.window = { localStorage: memoryStorage(saved), sessionStorage: memoryStorage(session) };
  try {
    assert.equal(readPreference('min_box'), '36');
    assert.equal(saved.get('keyflow:min_box'), '36');
    session.set('keyflow:min_box', '20');
    assert.equal(readPreference('min_box'), '36');
  } finally {
    delete globalThis.window;
  }
});
