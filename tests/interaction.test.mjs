import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { create_interaction } from '../dist/interaction.js';
import { create_input_frame, input_frame_manager, get_active_input_frame, root_input_frame } from '../dist/input-frames.js';
import { dispatch_key_input, reset_input, press_virtual_key } from '../dist/input-events.js';
import { create_static_token } from '../dist/stores/static-input.js';
import { map_key_route, set_available_keys } from '../dist/stores/input.js';

const frames = [];
const frame = () => { const f = create_input_frame(); frames.push(f); f.activate(); return f; };
const log = () => {
  const events = [];
  return { events, on_enter: (event) => events.push(event), on_exit: (event) => events.push(event) };
};
afterEach(() => { reset_input(); frames.splice(0).reverse().forEach((f) => f.dispose()); input_frame_manager.reset(); });

test('independent press/hover/focus sessions report exact monotonic durations and ignore repeats', () => {
  let time = 10;
  const handlers = log();
  const controller = create_interaction(handlers, { now: () => time });
  controller.enter({ kind: 'hover', source: 'pointer' });
  time = 20;
  controller.enter({ kind: 'focus', source: 'keyboard' });
  controller.enter({ source: 'pointer', key: 'a' });
  time = 60;
  controller.enter({ source: 'pointer', key: 'a' });
  controller.exit(); controller.exit();
  time = 90;
  controller.exit('hover'); controller.exit('focus');
  assert.deepEqual(handlers.events.filter((e) => e.phase === 'exit').map((e) => [e.kind, e.duration_ms, e.cancelled]), [
    ['press', 40, false], ['hover', 80, false], ['focus', 70, false]
  ]);
  assert.equal(handlers.events.length, 6);
});

test('live callbacks, isolated event snapshots and reentrant cancellation remain paired', () => {
  let time = 0;
  let handlers = log();
  const controller = create_interaction(() => handlers, { now: () => time });
  controller.enter();
  handlers.events[0].started_at = -100; // Consumer writes must not corrupt stored timing.
  const next = log();
  handlers = next;
  time = 42;
  controller.cancel('unmounted'); controller.cancel('unmounted');
  assert.equal(next.events.length, 1);
  assert.equal(next.events[0].duration_ms, 42);
  assert.equal(next.events[0].reason, 'unmounted');
  assert.equal(next.events[0].cancelled, true);
  const events = [];
  const reentrant = create_interaction({ on_enter() { reentrant.cancel(); }, on_exit: (e) => events.push(e) });
  reentrant.enter();
  assert.equal(events.length, 1);
  assert.equal(reentrant.has(), false);
});

test('automatic shortcuts enter at terminal keydown and exit once before the action', () => {
  set_available_keys(['a', 'b']);
  const f = frame(), handlers = log();
  const token = { priority: 0, ...handlers, on_close: () => handlers.events.push('action') };
  f.register(token);
  const key = get(map_key_route).get(token)[0];
  dispatch_key_input('keydown', { key, code: 'KeyA' });
  dispatch_key_input('keydown', { key, code: 'KeyA', repeat: true });
  assert.equal(handlers.events.length, 1);
  dispatch_key_input('keyup', { key, code: 'KeyA' });
  assert.deepEqual(handlers.events.map((e) => e.phase ?? e), ['enter', 'exit', 'action']);
  assert.equal(handlers.events[0].source, 'keyboard');
  assert.equal(handlers.events[1].cancelled, false);
});

test('static chord duration covers terminal down until all held keys release', () => {
  const f = frame(), handlers = log();
  const token = create_static_token(() => handlers.events.push('action'), handlers);
  f.static_input.register(token, ['control', 'k']);
  dispatch_key_input('keydown', { key: 'Control', code: 'ControlLeft' });
  assert.equal(handlers.events.length, 0);
  dispatch_key_input('keydown', { key: 'k', code: 'KeyK' });
  dispatch_key_input('keyup', { key: 'k', code: 'KeyK' });
  assert.equal(handlers.events.length, 1);
  dispatch_key_input('keyup', { key: 'Control', code: 'ControlLeft' });
  assert.deepEqual(handlers.events.map((e) => e.phase ?? e), ['enter', 'exit', 'action']);
});

for (const mode of ['automatic', 'static']) {
  test(`${mode} reset, frame changes and unregistration cancel held sessions without activating`, () => {
    for (const reason of ['reset', 'frame-change', 'unregistered']) {
      const f = frame(), handlers = log();
      const token = mode === 'static' ? create_static_token(() => handlers.events.push('action'), handlers)
        : { priority: 0, ...handlers, on_close: () => handlers.events.push('action') };
      const remove = mode === 'static' ? f.static_input.register(token, 'q') : f.register(token);
      const key = mode === 'static' ? 'q' : get(map_key_route).get(token)[0];
      dispatch_key_input('keydown', { key });
      if (reason === 'reset') reset_input();
      else if (reason === 'frame-change') f.deactivate();
      else remove();
      dispatch_key_input('keyup', { key });
      assert.deepEqual(handlers.events.map((e) => e.phase), ['enter', 'exit']);
      assert.equal(handlers.events[1].cancelled, true);
      assert.equal(handlers.events[1].reason, reason);
      f.dispose();
    }
  });
}

test('virtual routing and direct triggers emit one pair with their source and preserve frame gates', () => {
  const f = frame(), handlers = log();
  const token = { priority: 0, ...handlers, on_close: () => handlers.events.push('action') };
  f.register(token);
  press_virtual_key(get(map_key_route).get(token)[0]);
  assert.equal(handlers.events[0].source, 'virtual');
  assert.equal(handlers.events.length, 3);
  handlers.events.length = 0;
  assert.equal(f.trigger(token), true);
  assert.equal(handlers.events[0].source, 'programmatic');
  assert.equal(handlers.events.length, 3);
  f.deactivate();
  handlers.events.length = 0;
  assert.equal(f.trigger(token), false);
  assert.equal(handlers.events.length, 0);
});

test('changing automatic routes cancels a held press instead of attributing release to a new control', () => {
  set_available_keys(['a', 'b']);
  const f = frame(), handlers = log();
  const token = { priority: 0, ...handlers, on_close: () => handlers.events.push('action') };
  f.register(token);
  const key = get(map_key_route).get(token)[0];
  dispatch_key_input('keydown', { key });
  f.register({ priority: -1, on_close: () => handlers.events.push('wrong-action') });
  dispatch_key_input('keyup', { key });
  assert.deepEqual(handlers.events.map((event) => event.phase), ['enter', 'exit']);
  assert.equal(handlers.events[1].cancelled, true);
});

test('cancelling overlapping channels pairs every live session exactly once', () => {
  const handlers = log();
  const controller = create_interaction(handlers);
  for (const kind of ['hover', 'focus', 'press']) controller.enter({ kind });
  controller.cancel('unmounted');
  controller.cancel('unmounted');
  assert.deepEqual(handlers.events.map((event) => [event.kind, event.phase]), [
    ['hover', 'enter'], ['focus', 'enter'], ['press', 'enter'],
    ['hover', 'exit'], ['focus', 'exit'], ['press', 'exit']
  ]);
});

test('an exit callback may choose another frame transition without the outer transition overwriting it', () => {
  const f = frame();
  const token = { priority: 0, on_close() {}, on_exit(event) {
    if (event.cancelled) input_frame_manager.reset();
  } };
  f.register(token);
  dispatch_key_input('keydown', { key: get(map_key_route).get(token)[0] });
  const next = create_input_frame();
  frames.push(next);
  next.activate();
  assert.equal(get_active_input_frame(), root_input_frame);
  assert.deepEqual(get(input_frame_manager.stack), [root_input_frame]);
});
