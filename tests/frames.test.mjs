import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import {
  create_input_frame, root_input_frame, active_input_frame, configure_input_frames, input_frame_manager
} from '../dist/input-frames.js';
import { create_static_token } from '../dist/stores/static-input.js';
import { map_key_route, list_key_strokes, set_available_keys, _available_keys } from '../dist/stores/input.js';
import { dispatch_key_input, press_virtual_key } from '../dist/input-events.js';

const frames = [];
const cleanups = [];
const frame = (options) => { const f = create_input_frame(options); frames.push(f); return f; };
const token = (action = () => {}) => ({ priority: 0, on_close: action });
afterEach(() => {
  frames.splice(0).reverse().forEach((f) => f.dispose());
  cleanups.splice(0).forEach((f) => f());
  configure_input_frames('windows');
});

test('top frame masks automatic tokens and restores the root without reregistering', () => {
  set_available_keys(['a', 's']);
  let rootCalls = 0, childCalls = 0;
  const root = token(() => rootCalls++), child = token(() => childCalls++);
  cleanups.push(root_input_frame.register(root));
  const menu = frame();
  menu.register(child);
  assert.deepEqual(get(map_key_route).get(root), ['a']);
  menu.activate();
  assert.equal(get(active_input_frame), menu);
  assert.equal(get(map_key_route).has(root), false);
  press_virtual_key('a');
  assert.deepEqual([rootCalls, childCalls], [0, 1]);
  menu.deactivate();
  assert.deepEqual(get(map_key_route).get(root), ['a']);
  press_virtual_key('a');
  assert.deepEqual([rootCalls, childCalls], [1, 1]);
});

test('empty frames mask everything, including static bindings; no fallback', () => {
  let calls = 0;
  cleanups.push(root_input_frame.static_input.register(create_static_token(() => calls++), 'q'));
  const empty = frame();
  empty.activate();
  press_virtual_key('q');
  assert.equal(calls, 0);
  assert.equal(get(map_key_route).size, 0);
  empty.dispose();
  press_virtual_key('q');
  assert.equal(calls, 1);
});

test('static conflicts and reservations belong only to their own frame', () => {
  set_available_keys(['a', 's', 'd']);
  cleanups.push(root_input_frame.static_input.register(create_static_token(() => {}), 'a'));
  const menu = frame();
  let calls = 0;
  menu.static_input.register(create_static_token(() => calls++), 'as');
  assert.throws(() => menu.static_input.register(create_static_token(() => {}), 'a'), /prefix/i);
  assert.deepEqual(get(_available_keys), ['s', 'd']);
  menu.activate();
  assert.deepEqual(get(_available_keys), ['d']);
  press_virtual_key('a'); press_virtual_key('s');
  assert.equal(calls, 1);
  menu.deactivate();
  assert.deepEqual(get(_available_keys), ['s', 'd']);
});

test('frame changes cancel automatic/static partial sequences and held releases', () => {
  set_available_keys(['a', 's']);
  let calls = 0;
  [0, 1, 2].forEach((priority) => cleanups.push(root_input_frame.register({ priority, on_close: () => calls++ })));
  cleanups.push(root_input_frame.static_input.register(create_static_token(() => calls++), 'qw'));
  const menu = frame();
  press_virtual_key('a');
  assert.deepEqual(get(list_key_strokes), [0]);
  menu.activate(); menu.deactivate();
  assert.deepEqual(get(list_key_strokes), []);
  press_virtual_key('s');
  assert.equal(calls, 0);
  press_virtual_key('q');
  menu.activate(); menu.deactivate();
  press_virtual_key('w');
  assert.equal(calls, 0);
  dispatch_key_input('keydown', { key: 'q' });
  dispatch_key_input('keydown', { key: 'w' });
  menu.activate(); menu.deactivate();
  dispatch_key_input('keyup', { key: 'w' });
  dispatch_key_input('keyup', { key: 'q' });
  assert.equal(calls, 0);
});

test('frame references form a stack independently of component nesting', () => {
  const first = frame({ name: 'first' }), second = frame({ name: 'second' });
  input_frame_manager.push(first);
  input_frame_manager.push(second);
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame, first, second]);
  assert.equal(get(active_input_frame), second);
  assert.equal(input_frame_manager.pop(), second);
  assert.equal(get(active_input_frame), first);
  input_frame_manager.push(second);
  first.dispose(); // Unwind dependent substates when a lower state is disposed.
  assert.equal(get(active_input_frame), root_input_frame);
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame]);
  assert.throws(() => first.activate(), /disposed/);
});

test('latest sibling wins and hidden updates are reflected when restored', () => {
  set_available_keys(['a', 's']);
  const first = frame(), second = frame();
  const a = token(), b = token();
  first.register(a);
  const remove = first.register(b);
  first.activate(); second.activate();
  first.update(b, -1);
  assert.equal(get(active_input_frame), second);
  second.deactivate();
  assert.deepEqual(get(map_key_route).get(b), ['a']);
  second.activate(); remove(); second.dispose();
  assert.deepEqual(get(map_key_route).get(a), ['a']);
  assert.equal(get(map_key_route).has(b), false);
});

test('platform configuration is atomic across frames, including masked frames', () => {
  configure_input_frames('mac');
  const first = frame(), second = frame();
  const description = create_static_token(() => {});
  first.static_input.register(description, ['ctrl', 'k']);
  second.static_input.register(create_static_token(() => {}), ['ctrl', 'x']);
  second.static_input.register(create_static_token(() => {}), ['control', 'x']);
  assert.throws(() => configure_input_frames('windows'), /Duplicate/);
  assert.equal(get(description.description).label, '⌘k');
});

test('virtual input and hardware dispatch share ordered static and automatic routes', () => {
  configure_input_frames('mac');
  let staticCalls = 0, autoCalls = 0;
  const menu = frame();
  menu.static_input.register(create_static_token(() => staticCalls++), ['ctrl', 'k']);
  menu.register(token(() => autoCalls++));
  menu.activate();
  press_virtual_key('ctrl');
  dispatch_key_input('keydown', { key: 'k', code: 'KeyK' });
  dispatch_key_input('keyup', { key: 'k', code: 'KeyK' });
  assert.equal(staticCalls, 1);
  const route = get(map_key_route).values().next().value;
  route.forEach((key) => press_virtual_key(key));
  assert.equal(autoCalls, 1);
});

test('custom virtual handlers receive key input and can replace default routing', () => {
  const events = [];
  press_virtual_key('space', (event) => events.push(event));
  assert.deepEqual(events.map(({ type, key, source }) => ({ type, key, source })), [
    { type: 'keydown', key: ' ', source: 'virtual' },
    { type: 'keyup', key: ' ', source: 'virtual' }
  ]);
});

test('equal-priority routes stay stable after masking and restoration', () => {
  set_available_keys(['a', 's']);
  const first = token(), second = token();
  cleanups.push(root_input_frame.register(first), root_input_frame.register(second));
  const before = [...get(map_key_route).entries()];
  const menu = frame();
  menu.activate(); menu.deactivate();
  assert.deepEqual([...get(map_key_route).entries()], before);
});

test('A-E page enters A-C menu on E, and menu A returns without replaying the same signal', () => {
  set_available_keys(['a', 'b', 'c', 'd', 'e']);
  let pageCalls = 0, menuCalls = 0;
  const menu = frame();
  const pageTokens = Array.from({ length: 5 }, (_, priority) => ({
    priority, on_close: priority === 4 ? () => input_frame_manager.push(menu) : () => pageCalls++
  }));
  pageTokens.forEach((token) => cleanups.push(root_input_frame.register(token)));
  const menuTokens = Array.from({ length: 3 }, (_, priority) => ({
    priority, on_close: priority === 0 ? () => input_frame_manager.pop() : () => menuCalls++
  }));
  menuTokens.forEach((token) => menu.register(token));
  assert.deepEqual(pageTokens.map((token) => get(map_key_route).get(token)), [['a'], ['b'], ['c'], ['d'], ['e']]);
  const physical = (key) => {
    dispatch_key_input('keydown', { key, code: `Key${key.toUpperCase()}` });
    dispatch_key_input('keyup', { key, code: `Key${key.toUpperCase()}` });
  };
  for (const press of [physical, press_virtual_key]) {
    press('a');
    const before = pageCalls;
    press('e');
    assert.equal(get(active_input_frame), menu);
    assert.equal(root_input_frame.trigger(pageTokens[0]), false);
    press('d'); // No matching menu binding; must not fall through to page D.
    assert.equal(pageCalls, before);
    press('b');
    assert.deepEqual(menuTokens.map((token) => get(map_key_route).get(token)), [['a'], ['b'], ['c']]);
    press('a');
    assert.equal(get(active_input_frame), root_input_frame);
    assert.equal(pageCalls, before, 'the return signal must not activate root A');
    assert.equal(menu.trigger(menuTokens[1]), false);
  }
  assert.equal(menuCalls, 2);
});

test('manager supports reference transitions, replace, reset, reuse, and permanent root', () => {
  const a = frame(), b = frame(), c = frame();
  assert.equal(input_frame_manager.pop(), null);
  input_frame_manager.push(a);
  input_frame_manager.push(a); // Same-top push is idempotent.
  input_frame_manager.push(b);
  assert.throws(() => input_frame_manager.push(a), /already/);
  input_frame_manager.go_to(a);
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame, a]);
  input_frame_manager.replace(c);
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame, c]);
  assert.throws(() => input_frame_manager.replace(root_input_frame), /already/);
  input_frame_manager.go_to(b); // A new reference pushes.
  input_frame_manager.go_to(root_input_frame); // Existing reference unwinds.
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame]);
  input_frame_manager.replace(a); // Replacing at root pushes, keeping the root.
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame, a]);
  input_frame_manager.reset();
  assert.equal(get(active_input_frame), root_input_frame);
  input_frame_manager.push(b); // Reset retains frames for later use.
  assert.equal(get(active_input_frame), b);
  b.dispose();
  assert.throws(() => input_frame_manager.push(b), /disposed/);
  assert.throws(() => input_frame_manager.go_to(b), /disposed/);
  assert.throws(() => input_frame_manager.replace(b), /disposed/);
});

test('an input-owning frame receives device signals without leaking into automatic bindings', async () => {
  const { set_input_frame_handler } = await import('../dist/input-events.js');
  let calls = 0;
  const owner = frame();
  owner.register(token(() => calls++));
  const received = [];
  const cleanup = set_input_frame_handler(owner, (type, event) => {
    received.push([type, event.key, event.source]);
    return false; // Leave native default editing intact, without falling through to tokens.
  });
  owner.activate();
  press_virtual_key('a');
  assert.equal(calls, 0);
  assert.deepEqual(received, [['keydown', 'a', 'virtual'], ['keyup', 'a', 'virtual']]);
  assert.throws(() => set_input_frame_handler(owner, () => true), /already/);
  cleanup(); cleanup();
  const route = get(map_key_route).values().next().value;
  route.forEach((key) => press_virtual_key(key));
  assert.equal(calls, 1);
});
