import { normalize_event_key } from './shortcuts.js';
import type { KeyInput } from './input-events.js';
import type { MarkedRange, TextComposition } from './text-input-method.js';

type Snapshot = { value: string; start: number; end: number; direction: 'forward' | 'backward' | 'none' };
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const shifted: Record<string, string> = Object.fromEntries(
  Array.from('`1234567890-=[]\\;\',./').map((key, index) => [key, Array.from('~!@#$%^&*()_+{}|:"<>?')[index]])
);

/** Native textarea for OS input; this adapter edits its actual selection for virtual keys. */
export class TextareaEditor {
  private virtual = { shift: false, caps: false, control: false, meta: false, alt: false };
  private physical = { shift: false, control: false, meta: false, alt: false };
  private composing = false;
  private column: number | null = null;
  private verticalFocus: number | null = null;
  private mark: (MarkedRange & { original: string }) | null = null;
  private applying = false;
  /** Called when a client composition is lost to native typing or a caret move. */
  oncompositionlost: (() => void) | undefined;
  /** Called whenever the marked range changes, for rendering. */
  onmarkedchange: ((range: MarkedRange | null) => void) | undefined;

  constructor(readonly element: HTMLTextAreaElement) {
    element.addEventListener('input', this.input);
    element.addEventListener('compositionstart', this.compositionStart);
    element.addEventListener('compositionend', this.compositionEnd);
  }
  destroy() {
    this.element.removeEventListener('input', this.input);
    this.element.removeEventListener('compositionstart', this.compositionStart);
    this.element.removeEventListener('compositionend', this.compositionEnd);
    this.resetModifiers();
  }
  resetModifiers() {
    this.virtual = { shift: false, caps: false, control: false, meta: false, alt: false };
    this.physical = { shift: false, control: false, meta: false, alt: false };
    this.column = this.verticalFocus = null;
  }
  private read(): Snapshot {
    const el = this.element;
    return { value: el.value, start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection };
  }
  private input = () => {
    this.column = null;
    if (!this.applying && this.mark) this.loseComposition();
  };
  private compositionStart = () => { this.composing = true; };
  private compositionEnd = () => { this.composing = false; };
  private emit(inputType: string, data: string | null = null) {
    this.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data }));
  }
  insert(text: string, inputType = 'insertText', start = this.element.selectionStart, end = this.element.selectionEnd) {
    if (this.composing || this.element.disabled || this.element.readOnly) return;
    let inserted = text.replace(/\r\n?/g, '\n');
    if (this.element.maxLength >= 0) {
      const capacity = Math.max(0, this.element.maxLength - (this.element.value.length - (end - start)));
      let length = 0;
      for (const part of graphemes.segment(inserted)) {
        if (length + part.segment.length > capacity) break;
        length += part.segment.length;
      }
      inserted = inserted.slice(0, length);
    }
    if (!inserted && start === end) return;
    if (text && !inserted) return;
    this.element.focus({ preventScroll: true });
    this.element.setSelectionRange(start, end);
    // Native edit commands retain the browser's undo buffer. No physical shortcuts are intercepted.
    let emitted = false;
    let before: InputEvent | undefined;
    const markInput = () => { emitted = true; };
    const rememberBefore = (event: InputEvent) => { before = event; };
    this.element.addEventListener('input', markInput);
    this.element.addEventListener('beforeinput', rememberBefore);
    let edited = false;
    try { edited = document.execCommand(inserted ? 'insertText' : 'delete', false, inserted); }
    catch { /* Fall back to the standard textarea selection API. */ }
    finally {
      this.element.removeEventListener('input', markInput);
      this.element.removeEventListener('beforeinput', rememberBefore);
    }
    if (before?.defaultPrevented) return;
    if (!edited) {
      const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType, data: inserted || null });
      if (!this.element.dispatchEvent(event)) return;
      this.element.setRangeText(inserted, start, end, 'end');
    }
    if (!emitted) this.emit(inputType, inserted || null);
  }
  get marked(): MarkedRange | null { return this.mark ? { start: this.mark.start, end: this.mark.end } : null; }
  private setMark(mark: (MarkedRange & { original: string }) | null) {
    this.mark = mark;
    this.onmarkedchange?.(this.marked);
  }
  private loseComposition() {
    if (!this.mark) return;
    this.setMark(null);
    this.oncompositionlost?.();
  }
  /** Drop the mark when the caret left it (click, native arrows). Returns whether a mark remains. */
  checkComposition() {
    if (!this.mark) return false;
    const { start, end, value } = this.read();
    if (start !== end || start !== this.mark.end || value.length < this.mark.end) this.loseComposition();
    return !!this.mark;
  }
  private replace(text: string, start: number, end: number) {
    this.applying = true;
    try { this.insert(text, 'insertText', start, end); }
    finally { this.applying = false; }
  }
  /** The composition interface handed to a TextInputMethod. */
  readonly composition: TextComposition = this.createComposition();
  private createComposition(): TextComposition {
    const editor = this;
    return {
    get marked() { return editor.marked; },
    get value() { return editor.element.value; },
    get selectionStart() { return editor.element.selectionStart; },
    get selectionEnd() { return editor.element.selectionEnd; },
    setMarked: (text) => {
      if (!text) return editor.composition.cancel();
      const { start, end } = this.mark ?? this.read();
      const original = this.mark ? this.mark.original : this.element.value.slice(start, end);
      this.replace(text, start, end);
      this.setMark({ start, end: start + text.length, original });
    },
    commit: (text) => {
      const { start, end } = this.mark ?? this.read();
      this.setMark(null);
      this.replace(text, start, end);
    },
    finish: () => { this.setMark(null); },
    cancel: () => {
      if (!this.mark) return;
      const { start, end, original } = this.mark;
      this.setMark(null);
      this.replace(original, start, end);
    },
    insert: (text) => { this.setMark(null); this.replace(text, this.element.selectionStart, this.element.selectionEnd); },
    deleteBackward: () => {
      this.setMark(null);
      let { start, end } = this.read();
      if (start === end) start = this.step(start, -1);
      this.applying = true;
      try { this.insert('', 'deleteContentBackward', start, end); }
      finally { this.applying = false; }
    },
    moveCaret: (steps) => {
      this.setMark(null);
      let { start, end } = this.read();
      let position = steps < 0 ? start : end;
      if (start === end) for (let i = 0; i < Math.abs(steps); i++) position = this.step(position, steps < 0 ? -1 : 1);
      this.element.setSelectionRange(position, position);
    }
    };
  }
  private step(position: number, direction: -1 | 1, byWord = false) {
    const value = this.element.value;
    if (byWord) {
      const segments = [...words.segment(value)].filter((segment) => segment.isWordLike);
      if (direction < 0) return segments.reverse().find((segment) => segment.index < position)?.index ?? 0;
      const next = segments.find((segment) => segment.index + segment.segment.length > position);
      return next ? next.index + next.segment.length : value.length;
    }
    const boundaries = [...graphemes.segment(value)].map((segment) => segment.index);
    boundaries.push(value.length);
    return direction < 0 ? boundaries.reverse().find((index) => index < position) ?? 0
      : boundaries.find((index) => index > position) ?? value.length;
  }
  private move(key: string, extend: boolean, byWord: boolean, command: boolean) {
    const { value, start, end, direction } = this.read();
    const anchor = direction === 'backward' ? end : start;
    const focus = direction === 'backward' ? start : end;
    if (focus !== this.verticalFocus) this.column = null;
    let next = focus;
    if (key === 'arrowleft' || key === 'arrowright') {
      next = !extend && start !== end ? key === 'arrowleft' ? start : end
        : this.step(focus, key === 'arrowleft' ? -1 : 1, byWord);
      this.column = null;
    } else if (key === 'home' || key === 'end' || command) {
      const backwards = key === 'home' || key === 'arrowup';
      next = command ? backwards ? 0 : value.length
        : backwards ? (focus === 0 ? 0 : value.lastIndexOf('\n', focus - 1) + 1)
          : value.indexOf('\n', focus) < 0 ? value.length : value.indexOf('\n', focus);
      this.column = null;
    } else {
      const lineStart = focus === 0 ? 0 : value.lastIndexOf('\n', focus - 1) + 1;
      const lineEnd = value.indexOf('\n', focus) < 0 ? value.length : value.indexOf('\n', focus);
      this.column ??= [...graphemes.segment(value.slice(lineStart, focus))].length;
      const targetStart = key === 'arrowup'
        ? lineStart <= 1 ? 0 : value.lastIndexOf('\n', lineStart - 2) + 1
        : lineEnd === value.length ? value.length : lineEnd + 1;
      const targetEnd = value.indexOf('\n', targetStart) < 0 ? value.length : value.indexOf('\n', targetStart);
      const points = [...graphemes.segment(value.slice(targetStart, targetEnd))].map((segment) => segment.index);
      points.push(targetEnd - targetStart);
      next = targetStart + points[Math.min(this.column, points.length - 1)];
      if (key === 'arrowup' && lineStart === 0) next = 0;
      if (key === 'arrowdown' && lineEnd === value.length) next = value.length;
    }
    this.verticalFocus = this.column === null ? null : next;
    this.element.setSelectionRange(extend ? Math.min(anchor, next) : next, extend ? Math.max(anchor, next) : next,
      extend && next < anchor ? 'backward' : 'forward');
  }
  /** Observe held modifiers only; physical editing and browser commands keep their defaults. */
  physicalKey(_type: 'keydown' | 'keyup', input: KeyInput): boolean {
    this.physical = { shift: !!input.shiftKey, control: !!input.ctrlKey, meta: !!input.metaKey, alt: !!input.altKey };
    return false;
  }
  virtualKey(input: KeyInput) {
    if (this.composing) return;
    const key = normalize_event_key(input.key);
    if (Object.hasOwn(this.virtual, key)) {
      const modifier = key as keyof typeof this.virtual;
      this.virtual[modifier] = !this.virtual[modifier];
    } else if (key === 'capslock') this.virtual.caps = !this.virtual.caps;
    else {
      const shift = this.virtual.shift || this.physical.shift || !!input.shiftKey;
      const command = this.virtual.control || this.virtual.meta || this.physical.control || this.physical.meta || !!input.ctrlKey || !!input.metaKey;
      const alt = this.virtual.alt || this.physical.alt || !!input.altKey;
      if (command && key === 'a') {
        this.element.setSelectionRange(0, this.element.value.length);
      } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', 'end'].includes(key)) {
        this.move(key, shift, command || alt, command);
      } else if (key === 'backspace' || key === 'delete') {
        let { start, end } = this.read();
        if (start === end) {
          if (key === 'backspace') start = this.step(start, -1, command || alt);
          else end = this.step(end, 1, command || alt);
        }
        this.insert('', key === 'backspace' ? 'deleteContentBackward' : 'deleteContentForward', start, end);
      } else if (key === 'enter') this.insert('\n', 'insertLineBreak');
      else if (key === 'tab') this.insert('\t');
      else if (!command && (key === 'space' || Array.from(input.key).length === 1)) {
        let text = key === 'space' ? ' ' : input.key;
        if (this.virtual.caps && /^[a-z]$/i.test(text)) text = shift ? text.toLowerCase() : text.toUpperCase();
        else if (shift) text = shifted[text] ?? text.toUpperCase();
        this.insert(text);
        this.virtual.shift = false;
      }
      this.virtual.control = false; this.virtual.meta = false; this.virtual.alt = false;
    }
  }
}
