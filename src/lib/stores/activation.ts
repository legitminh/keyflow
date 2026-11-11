import { readable, writable, type Writable } from 'svelte/store';

const idle = readable(false);
type Feedback = { active: Writable<boolean>; timer?: ReturnType<typeof setTimeout> };
const feedback = new WeakMap<object, Feedback>();

function state(token: object): Feedback {
  let value = feedback.get(token);
  if (!value) feedback.set(token, value = { active: writable(false) });
  return value;
}

/** Display feedback is independent of how a token was activated; it never enters keystrokes. */
export function input_token_activation(token?: object) {
  const active = token ? state(token).active : idle;
  return { subscribe: active.subscribe };
}

/** Keep fast taps visible even when down/up and the action occur in the same render turn. */
export function flash_input_token(token: object) {
  const value = state(token);
  clearTimeout(value.timer);
  value.active.set(true);
  value.timer = setTimeout(() => {
    value.active.set(false);
    value.timer = undefined;
  }, 180);
}
