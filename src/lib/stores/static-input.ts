import { writable, type Writable } from 'svelte/store';
import {
  detect_shortcut_platform, normalize_event_key, parse_shortcut, shortcut_key_label,
  type Shortcut, type ShortcutPlatform
} from '../shortcuts.js';
import { flash_input_token } from './activation.js';
import { reserve_input_keys } from './input.js';

export interface StaticShortcutDescription {
  label: string;
  labels: readonly string[];
  /** Cached trie path lets each visualizer check its prefix with one indexed lookup. */
  nodes: readonly object[];
}
export interface StaticInputToken {
  on_close(): void;
  description: Writable<StaticShortcutDescription>;
}
export const empty_static_description: StaticShortcutDescription = { label: '', labels: [], nodes: [] };
// Preserve token identity through Svelte $state and bind:myToken, like frame references.
class StaticToken implements StaticInputToken {
  description = writable(empty_static_description);
  constructor(public on_close: () => void) {}
}
export function create_static_token(on_close: () => void): StaticInputToken {
  return new StaticToken(on_close);
}

interface Node { children: Map<string, Node>; token?: StaticInputToken; depth: number }
const node = (depth: number): Node => ({ children: new Map(), depth });
type KeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'repeat'>;
export interface StaticProgress { node: object | null; depth: number; complete: boolean }
const idle: StaticProgress = { node: null, depth: 0, complete: false };

/** Ordered trie lookup: O(1) per event, plus O(n) store notifications to mounted displays. */
export class StaticInputManager {
  readonly progress = writable<StaticProgress>(idle);
  private root = node(0);
  private cursor = this.root;
  private bindings = new Map<StaticInputToken, Shortcut>();
  private pressed = new Map<string, string>();
  private platform: ShortcutPlatform = detect_shortcut_platform();

  constructor(private reserve: (owner: object, keys: readonly string[]) => void = () => {}) {}

  validate_platform(platform: ShortcutPlatform) {
    this.rebuild(this.bindings, platform, false);
  }

  clear() {
    for (const token of this.bindings.keys()) {
      this.reserve(token, []);
      token.description.set(empty_static_description);
    }
    this.bindings.clear();
    this.root = node(0);
    this.reset();
  }

  configure(platform: ShortcutPlatform) {
    this.rebuild(this.bindings, platform); // Validate collisions before changing live bindings.
    this.platform = platform;
  }

  register(token: StaticInputToken, shortcut: Shortcut): () => void {
    if (this.bindings.has(token)) throw new RangeError('Static token is already registered');
    const snapshot = typeof shortcut === 'string' ? shortcut : [...shortcut];
    const next = new Map(this.bindings).set(token, snapshot);
    this.rebuild(next, this.platform);
    this.bindings = next;
    return () => {
      if (!this.bindings.has(token)) return;
      const remaining = new Map(this.bindings);
      remaining.delete(token);
      this.rebuild(remaining, this.platform);
      this.bindings = remaining;
      this.reserve(token, []);
      token.description.set(empty_static_description);
    };
  }

  /** Registration/configuration work is linear in the total number of bound key presses. */
  private rebuild(bindings: Map<StaticInputToken, Shortcut>, platform: ShortcutPlatform, commit = true) {
    const root = node(0);
    const prepared = new Map<StaticInputToken, { keys: string[]; description: StaticShortcutDescription }>();
    for (const [token, shortcut] of bindings) {
      const keys = parse_shortcut(shortcut, platform);
      let cursor = root;
      const nodes: object[] = [];
      for (const key of keys) {
        if (cursor.token) throw new RangeError(`Static shortcut has an existing binding as a prefix: ${shortcut}`);
        let child = cursor.children.get(key);
        if (!child) cursor.children.set(key, child = node(cursor.depth + 1));
        cursor = child;
        nodes.push(cursor);
      }
      if (cursor.token) throw new RangeError(`Duplicate static shortcut: ${shortcut}`);
      if (cursor.children.size) throw new RangeError(`Static shortcut is a prefix of an existing binding: ${shortcut}`);
      cursor.token = token;
      const labels = keys.map((key) => shortcut_key_label(key, platform));
      prepared.set(token, { keys, description: { labels, label: labels.join(''), nodes } });
    }
    if (!commit) return;
    this.reset();
    this.root = root;
    this.cursor = root;
    for (const [token, { keys, description }] of prepared) {
      token.description.set(description);
      this.reserve(token, keys);
    }
  }

  reset = () => {
    this.pressed.clear();
    this.cursor = this.root;
    this.progress.set(idle);
  };

  private publish() {
    this.progress.set({ node: this.cursor, depth: this.cursor.depth, complete: !!this.cursor.token });
  }

  private finish() {
    const token = this.cursor.token;
    this.reset();
    if (token) {
      flash_input_token(token);
      token.on_close();
    }
  }

  keydown(event: KeyEvent): boolean {
    const key = normalize_event_key(event.key);
    const identity = event.code || key;
    if (event.repeat || this.pressed.has(identity)) return this.pressed.has(identity);
    let next = this.cursor.children.get(key);
    if (!next) {
      this.reset();
      next = this.root.children.get(key);
    }
    if (!next) return false;
    this.pressed.set(identity, key);
    this.cursor = next;
    this.publish();
    return true;
  }

  keyup(event: KeyEvent): boolean {
    const key = normalize_event_key(event.key);
    if (!this.pressed.delete(event.code || key)) return false;
    if (!this.pressed.size && this.cursor.token) this.finish();
    return true;
  }
}

export const static_input = new StaticInputManager(reserve_input_keys);
