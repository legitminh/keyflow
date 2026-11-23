import type { KeyInput } from './input-events.js';

/** The marked (uncommitted) range of an input method, in UTF-16 offsets of the textarea value. */
export interface MarkedRange { start: number; end: number }

/**
 * Edits an input method may apply to its TextBox. Marked text is shown underlined until it is
 * committed or cancelled; every edit goes through the textarea's native edit path, so it stays in
 * the browser's undo history.
 */
export interface TextComposition {
  /** Current marked range, or null when nothing is being composed. */
  readonly marked: MarkedRange | null;
  /** Current value and selection, for context-aware methods. */
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  /** Replace the marked range (or the selection, when none) with `text` and mark it. Empty text cancels. */
  setMarked(text: string): void;
  /** Replace the marked range (or the selection) with `text` and end composition. */
  commit(text: string): void;
  /** Keep the marked text as typed and end composition. */
  finish(): void;
  /** Restore what the marked range replaced and end composition. */
  cancel(): void;
  /** Insert text at the selection, finishing any composition first. */
  insert(text: string): void;
  /** Delete one grapheme (or the selection) backward, finishing any composition first. */
  deleteBackward(): void;
  /** Move the caret by graphemes, finishing any composition first. */
  moveCaret(steps: number): void;
}

/**
 * A client text input method for TextBox (for example an IME or a phonetic keyboard). It receives
 * every physical and virtual key signal of the editing frame after the exit binding is checked.
 * Return true to consume the signal (physical defaults are prevented); false keeps TextBox's
 * ordinary physical/virtual editing.
 */
export interface TextInputMethod {
  key(type: 'keydown' | 'keyup', input: KeyInput, composition: TextComposition): boolean;
  /** Called when composition is lost outside the method: caret moved, native typing, exit, or blur. */
  reset?(): void;
}
