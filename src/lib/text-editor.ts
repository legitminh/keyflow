import { writable } from 'svelte/store';
import { normalize_event_key } from './shortcuts.js';
import type { KeyInput } from './input-events.js';

type Snapshot = { value: string; start: number; end: number; direction: 'forward' | 'backward' | 'none' };
export type TextEditCommand = 'copy' | 'cut' | 'paste' | 'selectAll' | 'undo' | 'redo';
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const shifted: Record<string, string> = Object.fromEntries(
  Array.from('`1234567890-=[]\\;\',./').map((key, index) => [key, Array.from('~!@#$%^&*()_+{}|:"<>?')[index]])
);

/** Native textarea for OS input; this adapter edits its actual selection for virtual keys. */
export class TextareaEditor {
  readonly modifiers = writable({ shift: false, caps: false, control: false, meta: false, alt: false });
  private virtual = { shift: false, caps: false, control: false, meta: false, alt: false };
  private physical = { shift: false, control: false, meta: false, alt: false };
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private before: Snapshot | null = null;
  private last: Snapshot;
  private composing = false;
  private restoring = false;
  private column: number | null = null;
  private verticalFocus: number | null = null;
  private session = 0;

  constructor(readonly element: HTMLTextAreaElement, private options: {
    isActive?: () => boolean; onClipboardError?: (error: unknown) => void;
  } = {}) {
    this.last = this.read();
    element.addEventListener('beforeinput', this.beforeInput);
    element.addEventListener('input', this.input);
    element.addEventListener('compositionstart', this.compositionStart);
    element.addEventListener('compositionend', this.compositionEnd);
  }
  destroy() {
    this.element.removeEventListener('beforeinput', this.beforeInput);
    this.element.removeEventListener('input', this.input);
    this.element.removeEventListener('compositionstart', this.compositionStart);
    this.element.removeEventListener('compositionend', this.compositionEnd);
    this.resetModifiers();
  }
  resetModifiers() {
    this.session++;
    this.virtual = { shift: false, caps: false, control: false, meta: false, alt: false };
    this.physical = { shift: false, control: false, meta: false, alt: false };
    this.modifiers.set({ ...this.virtual });
  }
  private read(): Snapshot {
    const el = this.element;
    return { value: el.value, start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection };
  }
  private record(before: Snapshot) {
    if (before.value === this.element.value) return;
    this.past.push(before);
    if (this.past.length > 200) this.past.shift();
    this.future = [];
    this.column = null;
  }
  private beforeInput = (event: InputEvent) => {
    if (this.restoring) return;
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      this.command(event.inputType === 'historyUndo' ? 'undo' : 'redo');
    } else if (!this.composing) this.before = this.read();
  };
  private input = () => {
    if (!this.restoring && !this.composing) {
      this.record(this.before ?? this.last);
      this.before = null;
    }
    this.last = this.read();
  };
  private compositionStart = () => { this.before = this.read(); this.composing = true; };
  private compositionEnd = () => {
    this.composing = false;
    if (this.before) this.record(this.before);
    this.before = null;
    this.last = this.read();
  };
  private emit(inputType: string, data: string | null = null) {
    this.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data }));
  }
  insert(text: string, inputType = 'insertText', start = this.element.selectionStart, end = this.element.selectionEnd) {
    if (this.composing || this.element.disabled || this.element.readOnly) return;
    const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType, data: text || null });
    if (!this.element.dispatchEvent(event)) { this.before = null; return; }
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
    this.element.setRangeText(inserted, start, end, 'end');
    this.emit(inputType, inserted || null);
  }
  private restore(snapshot: Snapshot, inputType: string) {
    this.restoring = true;
    this.element.value = snapshot.value;
    this.element.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction);
    this.emit(inputType);
    this.restoring = false;
    this.last = this.read();
  }
  command(command: TextEditCommand) {
    if (this.options.isActive && !this.options.isActive()) return;
    if (this.element.readOnly && command !== 'copy' && command !== 'selectAll') return;
    if (command === 'selectAll') {
      this.element.setSelectionRange(0, this.element.value.length);
    } else if (command === 'undo' || command === 'redo') {
      const from = command === 'undo' ? this.past : this.future;
      const to = command === 'undo' ? this.future : this.past;
      const snapshot = from.pop();
      if (snapshot) { to.push(this.read()); this.restore(snapshot, command === 'undo' ? 'historyUndo' : 'historyRedo'); }
    } else void this.clipboard(command);
  }
  private async clipboard(command: 'copy' | 'cut' | 'paste') {
    const snapshot = this.read();
    const session = this.session;
    try {
      if (command === 'paste') {
        const text = await navigator.clipboard.readText();
        if (this.unchanged(snapshot, session)) this.insert(text, 'insertFromPaste');
      } else if (snapshot.start !== snapshot.end) {
        await navigator.clipboard.writeText(snapshot.value.slice(snapshot.start, snapshot.end));
        if (command === 'cut' && this.unchanged(snapshot, session)) this.insert('', 'deleteByCut');
      }
    } catch (error) { this.options.onClipboardError?.(error); }
  }
  private unchanged(snapshot: Snapshot, session: number) {
    const next = this.read();
    return session === this.session && (!this.options.isActive || this.options.isActive()) && next.value === snapshot.value &&
      next.start === snapshot.start && next.end === snapshot.end;
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
  /** Native input stays native, except Tab insertion and shared undo/redo. */
  physicalKey(type: 'keydown' | 'keyup', input: KeyInput): boolean {
    this.physical = { shift: !!input.shiftKey, control: !!input.ctrlKey, meta: !!input.metaKey, alt: !!input.altKey };
    this.publishModifiers();
    if (type !== 'keydown' || this.composing) return false;
    const key = normalize_event_key(input.key);
    if ((input.ctrlKey || input.metaKey) && (key === 'z' || key === 'y')) {
      this.command(key === 'y' || input.shiftKey ? 'redo' : 'undo');
      return true;
    }
    if (key === 'tab') { this.insert('\t'); return true; }
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
      const commands: Partial<Record<string, TextEditCommand>> = {
        a: 'selectAll', c: 'copy', v: 'paste', x: 'cut', z: shift ? 'redo' : 'undo', y: 'redo'
      };
      const action = command ? commands[key] : undefined;
      if (action) {
        this.command(action);
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
      else if (key === 'space' || Array.from(input.key).length === 1) {
        let text = key === 'space' ? ' ' : input.key;
        if (this.virtual.caps && /^[a-z]$/i.test(text)) text = shift ? text.toLowerCase() : text.toUpperCase();
        else if (shift) text = shifted[text] ?? text.toUpperCase();
        this.insert(text);
        this.virtual.shift = false;
      }
      this.virtual.control = false; this.virtual.meta = false; this.virtual.alt = false;
    }
    this.publishModifiers();
  }
  private publishModifiers() {
    this.modifiers.set({ ...this.virtual,
      shift: this.virtual.shift || this.physical.shift,
      control: this.virtual.control || this.physical.control,
      meta: this.virtual.meta || this.physical.meta,
      alt: this.virtual.alt || this.physical.alt
    });
  }
}
