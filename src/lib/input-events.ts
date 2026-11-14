import { held_key_interactions, cancel_key_interactions } from './stores/key-interactions.js';
import { input_token_interaction } from './interaction.js';
import { add_key_strokes, reset_key_strokes, take_input_token, peek_input_token } from './stores/input.js';
import { get_active_input_frame, get_input_platform, type InputFrameController } from './input-frames.js';
import { normalize_event_key, parse_shortcut } from './shortcuts.js';

export interface KeyInput {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  source?: 'physical' | 'virtual';
}
export interface VirtualKeyInput extends KeyInput {
  type: 'keydown' | 'keyup';
  source: 'virtual';
}
export type VirtualKeyHandler = (event: VirtualKeyInput) => void;

/** An input-owning frame may handle virtual input while leaving native text editing to the browser. */
export type FrameInputHandler = (type: 'keydown' | 'keyup', input: KeyInput) => boolean;
const frameHandlers = new WeakMap<InputFrameController, FrameInputHandler>();
export function set_input_frame_handler(frame: InputFrameController, handler: FrameInputHandler) {
  if (frameHandlers.has(frame)) throw new RangeError('InputFrame already has an input handler');
  frameHandlers.set(frame, handler);
  return () => { if (frameHandlers.get(frame) === handler) frameHandlers.delete(frame); };
}
export const has_input_frame_handler = () => frameHandlers.has(get_active_input_frame());

export function reset_input() {
  cancel_key_interactions();
  get_active_input_frame().static_input.reset();
  reset_key_strokes();
}

/** Returns whether a registered shortcut consumed this step. No DOM events are synthesized. */
export function dispatch_key_input(type: 'keydown' | 'keyup', input: KeyInput): boolean {
  const frame = get_active_input_frame();
  const handler = frameHandlers.get(frame);
  if (handler) return handler(type, input);
  const manager = frame.static_input;
  const event = { key: input.key, code: input.code ?? '', repeat: input.repeat ?? false,
    source: input.source === 'virtual' ? 'virtual' as const : 'keyboard' as const, original_event: typeof Event !== 'undefined' && input instanceof Event ? input : undefined };
  const identity = input.code || normalize_event_key(input.key);
  if (type === 'keydown') {
    if (manager.keydown(event)) {
      cancel_key_interactions();
      reset_key_strokes();
      return true;
    }
    if (input.repeat) return false;
    if (input.ctrlKey || input.metaKey || input.altKey || normalize_event_key(input.key) === 'escape') {
      cancel_key_interactions();
      reset_key_strokes();
      return false;
    }
    add_key_strokes(input.key);
    const token = peek_input_token(input.key);
    if (token && !held_key_interactions.has(identity)) {
      const controller = input_token_interaction(token);
      held_key_interactions.set(identity, controller);
      controller.enter(event);
    }
    return false;
  }
  const controller = held_key_interactions.get(identity);
  held_key_interactions.delete(identity);
  controller?.exit('press', 'completed', event.original_event);
  if (get_active_input_frame() !== frame) return false;
  if (manager.keyup(event)) return true;
  if (input.ctrlKey || input.metaKey || input.altKey) return false;
  const token = take_input_token(input.key);
  return token ? frame.trigger(token, false) : false;
}

/** Default virtual keyboard adapter. Feed events directly into the active frame. */
export const keyflow_key_handler: VirtualKeyHandler = (event) => {
  dispatch_key_input(event.type, event);
};

/** A virtual tap is an ordered down/up pair; portable names follow Keyflow's platform. */
export function press_virtual_key(key: string, handler: VirtualKeyHandler = keyflow_key_handler) {
  const normalized = parse_shortcut([key], get_input_platform())[0];
  // Preserve printable casing for text adapters; shortcut matching normalizes independently.
  const value = key.length === 1 ? key : normalized === 'space' ? ' ' : normalized;
  const event = { key: value, code: `Virtual:${normalized}`, repeat: false, source: 'virtual' as const };
  handler({ ...event, type: 'keydown' });
  handler({ ...event, type: 'keyup' });
}
