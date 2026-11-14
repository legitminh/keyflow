import { input_token_interaction, type InteractionHandlers, type InteractionDetails } from './interaction.js';
import { cancel_key_interactions } from './stores/key-interactions.js';
import { get, writable } from 'svelte/store';
import {
  create_input_frame_state, root_input_state, select_input_frame_state,
  reserve_input_keys, register_input_token, unregister_input_token, update_input_token,
  type InputFrameState, type InputToken
} from './stores/input.js';
import { flash_input_token } from './stores/activation.js';
import { StaticInputManager, static_input } from './stores/static-input.js';
import { detect_shortcut_platform, type ShortcutPlatform } from './shortcuts.js';

type ActionToken = Pick<InputToken, 'on_close'> & InteractionHandlers;

/** A persistent set of bindings. Stack membership, DOM nesting, and visibility are separate. */
export interface InputFrameController {
  readonly name: string;
  readonly input: InputFrameState;
  readonly static_input: StaticInputManager;
  /** Alias for input_frame_manager.push(this). */
  activate(): void;
  /** Remove this frame and every frame above it from the stack. Bindings are retained. */
  deactivate(): void;
  dispose(): void;
  register(token: InputToken): () => void;
  update(token: InputToken, priority: number): void;
  /** Direct activation emits an instantaneous press. Pass false when a DOM/gesture adapter owns its lifecycle. */
  trigger(token: ActionToken, interaction?: InteractionDetails | false): boolean;
}
let platform: ShortcutPlatform = detect_shortcut_platform();
const frames = new Set<InputFrameController>();
const platformStore = writable(platform);
export const input_platform = { subscribe: platformStore.subscribe };
export const get_input_platform = () => platform;

// Class instances retain identity when stored in Svelte $state or passed through bindings.
class Frame implements InputFrameController {
  constructor(
    readonly name: string,
    readonly input: InputFrameState,
    readonly static_input: StaticInputManager,
    private readonly isRoot = false
  ) {}
  activate() {
    if (this.isRoot) input_frame_manager.reset();
    else input_frame_manager.push(this);
  }
  deactivate() { if (!this.isRoot) remove(this); }
  dispose() {
    if (this.isRoot) return;
    remove(this);
    this.static_input.clear();
    for (const token of this.input.tokens) input_token_interaction(token).cancel('unregistered');
    this.input.tokens.clear();
    this.input.ordered = [];
    this.input.reservations.clear();
    frames.delete(this);
  }
  register(token: InputToken) {
    validate(this);
    register_input_token(token, this.input);
    return () => unregister_input_token(token, this.input);
  }
  update(token: InputToken, priority: number) {
    validate(this);
    update_input_token(token, priority, this.input);
  }
  trigger(token: ActionToken, interaction?: InteractionDetails | false) { return trigger(this, token, interaction); }
}

export const root_input_frame: InputFrameController = new Frame('root', root_input_state, static_input, true);
let stack: InputFrameController[] = [root_input_frame];
const stackStore = writable<readonly InputFrameController[]>(Object.freeze([...stack]));
const active = writable(root_input_frame);
export const active_input_frame = { subscribe: active.subscribe };
export const get_active_input_frame = () => get(active);

function trigger(frame: InputFrameController, token: ActionToken, details: InteractionDetails | false = {}): boolean {
  if (get(active) !== frame) return false;
  const lifecycle = input_token_interaction(token);
  if (details !== false && !lifecycle.has('press')) {
    lifecycle.enter({ ...details, kind: 'press' });
    lifecycle.exit('press');
    if (get(active) !== frame) return false;
  }
  flash_input_token(token);
  token.on_close();
  return true;
}

let transitionRevision = 0;
function transition(nextStack: InputFrameController[]) {
  const revision = ++transitionRevision;
  const previous = get(active);
  const next = nextStack[nextStack.length - 1];
  stack = nextStack;
  if (next !== previous) {
    // Clear before publishing: the transition key cannot finish a route in the new frame.
    cancel_key_interactions('frame-change');
    if (revision !== transitionRevision) return;
    for (const token of previous.input.tokens) {
      input_token_interaction(token).cancel('frame-change');
      if (revision !== transitionRevision) return;
    }
    previous.static_input.reset('frame-change');
    if (revision !== transitionRevision) return;
    next.static_input.reset();
    if (revision !== transitionRevision) return;
    select_input_frame_state(next.input);
    if (revision !== transitionRevision) return;
    active.set(next);
    if (revision !== transitionRevision) return;
  }
  stackStore.set(Object.freeze([...stack]));
}

function validate(frame: InputFrameController) {
  if (frame !== root_input_frame && !frames.has(frame)) {
    throw new RangeError('InputFrame is disposed or does not belong to this manager');
  }
}
function remove(frame: InputFrameController) {
  const index = stack.indexOf(frame);
  if (index > 0) transition(stack.slice(0, index));
}

/** One stack per Keyflow application. Frame references are independent of the component tree. */
export const input_frame_manager = {
  root: root_input_frame,
  active: active_input_frame,
  /** Read-only snapshot, including the root at index zero. */
  stack: { subscribe: stackStore.subscribe },
  push(frame: InputFrameController) {
    validate(frame);
    if (get(active) === frame) return;
    if (stack.includes(frame)) throw new RangeError('InputFrame is already in the stack; use go_to() to return to it');
    transition([...stack, frame]);
  },
  /** Root cannot be popped. Popping preserves the removed frame's bindings for reuse. */
  pop(): InputFrameController | null {
    if (stack.length === 1) return null;
    const popped = stack[stack.length - 1];
    transition(stack.slice(0, -1));
    return popped;
  },
  /** Return to an existing frame, or push a frame that is not yet in the stack. */
  go_to(frame: InputFrameController) {
    validate(frame);
    const index = stack.indexOf(frame);
    transition(index < 0 ? [...stack, frame] : stack.slice(0, index + 1));
  },
  /** Replace the top substate. The root remains the permanent base. */
  replace(frame: InputFrameController) {
    validate(frame);
    if (get(active) === frame) return;
    if (stack.includes(frame)) throw new RangeError('InputFrame is already in the stack; use go_to() to return to it');
    transition([...stack.slice(0, Math.max(1, stack.length - 1)), frame]);
  },
  /** Return to the root; no frame is disposed. */
  reset() { transition([root_input_frame]); }
};

export function configure_input_frames(next: ShortcutPlatform) {
  // Validate every frame first, so platform collisions cannot leave mixed platforms.
  for (const frame of [root_input_frame, ...frames]) frame.static_input.validate_platform(next);
  for (const frame of [root_input_frame, ...frames]) frame.static_input.configure(next);
  platform = next;
  platformStore.set(next);
}

export function create_input_frame(options: { name?: string } = {}): InputFrameController {
  const input = create_input_frame_state();
  const manager = new StaticInputManager((owner, keys) => reserve_input_keys(owner, keys, input));
  manager.configure(platform);
  const frame = new Frame(options.name ?? 'input-frame', input, manager);
  frames.add(frame);
  return frame;
}
