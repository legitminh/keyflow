# TextBox: an editing InputFrame

`TextBox` is a multiline text input that starts as a shortcut-enabled button. Clicking it or entering its configured trigger pushes a private editing frame. The native textarea then owns text input; lower-frame controls remain disabled. Escape exits by default. Clicking elsewhere does not exit, discard text, or reactivate the page.

```svelte
<script lang="ts">
  import { Keyflow, TextBox, VirtualKeyboard } from '@legitminh/keyflow';
  let text = $state('');
</script>

<Keyflow>
  <TextBox bind:value={text} label="Notes" enterTrigger="t" exitTrigger="esc"
    placeholder="Click or press T to edit" />
  <VirtualKeyboard variant="flick-alpha" />
</Keyflow>
```

Enter and exit triggers are independent. They use the existing `Shortcut` syntax: a character string, a named key such as `'esc'`/`'escape'`, or an ordered array such as `['ctrl', 'k']`. `ctrl` is the portable primary modifier. To enter with primary-modifier+K and exit with primary-modifier+Enter:

```svelte
<TextBox bind:value={text} label="Command notes"
  enterTrigger={['ctrl', 'k']} exitTrigger={['ctrl', 'enter']} />
```

Omit `enterTrigger` to assign an automatic shortcut, like Button. `priority` controls that automatic token's order. An explicit entry trigger reserves keys and must be prefix-free within its parent frame, like StaticButton. The exit trigger belongs only to the editing frame and may reuse the entry trigger. Prefer a named or modifier-based exit trigger: printable exit sequences intercept their matching characters before text insertion.

## Editing behavior

- Physical typing, mouse/touch selection, native clipboard shortcuts, IME composition and OS emoji input use an actual textarea. No simulated KeyboardEvents are used to type text.
- Virtual characters, flick translations, Backspace/Delete, Enter, Tab, arrows and Home/End edit that same textarea and its current selection. Enter inserts a newline; Tab inserts a tab character while editing.
- Virtual horizontal movement and deletion use Unicode grapheme boundaries, preserving emoji sequences and combining characters. Up/down retain the logical character column across newline-separated lines. `wrap="off"` is the default so physical and virtual vertical navigation refer to the same visible lines; `soft`/`hard` wrapping is available, with virtual up/down still following logical lines.
- Physical Shift works with virtual arrows/characters. The editor's Shift control and virtual Shift key toggle selection extension for arrows and uppercase/shifted symbols for the next character. Typing a character consumes virtual Shift; arrow movements retain it until toggled off. Virtual Caps Lock is supported where a layout provides it. Virtual Control/Meta/Alt apply to the next editing key, including word movement and standard select-all/copy/cut/paste/undo/redo commands.
- The editing toolbar offers Copy, Cut, Paste, Undo, Redo, Select all, Shift and Enter without taking away the textarea's selection. Clipboard buttons use the browser Clipboard API, subject to its normal permission/secure-context requirements. A failed operation reports a status message; native clipboard commands and the OS selection/paste UI remain available.
- Native and virtual changes share a bounded undo/redo history. Composition is grouped as an edit. Pending clipboard reads are ignored if the selection/content changes or the editing session ends before completion.
- Escape during IME composition is left to the OS/browser. The configured exit trigger resumes after composition. A frame-manager transition or component disable/unmount can also end the editing scope as part of application cleanup.

The value is retained when exiting and reopening. A child InputFrame can temporarily mask the editor—for example, to select a different keyboard. Popping the child restores editing focus and selection. TextBox owns and disposes its private frame; clients do not need to manage it manually.

## Props

| Prop | Meaning |
| --- | --- |
| `bind:value` | Edited string, initially empty. |
| `enterTrigger` | Optional explicit Shortcut; otherwise an automatic binding. |
| `exitTrigger` | Shortcut that ends editing; default `'escape'`. |
| `priority` | Automatic entry-binding priority; default `0`. |
| `label` | Accessible button/textarea label; default `'Text input'`. |
| `placeholder` | Empty button/textarea prompt; default `'Click to edit'`. |
| `rows` | Textarea height in rows; default `4`. |
| `disabled` | Disable entry and end an active editing session. |
| `wrap` | `'off'` (default), `'soft'`, or `'hard'`. |
| `onenter(frame)` | Called after entry and focus; receives the editing frame reference. |
| `onexit(value)` | Called when a mounted editing session ends. |
| `oninput(event)` | Native or virtual input notification; value binding stays synchronized. |
| `onclipboarderror(error)` | Optional notification for failed Clipboard API operations. |
| `class` and textarea attributes | Layout/style and native attributes such as `spellcheck`, `maxlength`, `readonly`, or `inputmode`. |

Set `inputmode="none"` when a client wants to suppress the device keyboard in favor of its custom keyboard. Leave native input enabled when users need the device's typing/emoji UI. TextBox does not open an OS emoji picker itself.

## Shared routing

The existing dispatcher now supports an input-owning frame handler. `set_input_frame_handler(frame, handler)` registers `(type, input) => boolean` and returns cleanup. While that frame is topmost, its handler owns the signals: returning false leaves native browser behavior available and does not fall through to automatic bindings. Other frames retain their usual token routing.

TextBox uses this narrow hook to check its exit binding before allowing native editing, and to adapt `source: 'virtual'` input into textarea edits. This keeps virtual keyboards independent of TextBox and avoids handling physical text twice. Custom keyboard `onkey` handlers must forward to `keyflow_key_handler(event)` if they want the active TextBox to receive input.

## Try the demo

Run `pnpm demo`. On `/` (also `/stack`), click **Keyboard text editor** or input T. Type physically, tap/flick the docked keyboard, select text with a mouse, or use the editor controls. Tap Escape to return. Expand the custom-trigger example to test primary-modifier+K entry and primary-modifier+Enter exit.

The flick-alpha Escape key replaces the former semicolon slot: tap Escape exits, left flick deletes backward, right flick inserts Tab, up flick types `~`, and down flick types a backtick. Space flicks move the caret in the corresponding direction. Use the editor's Enter control for a newline without adding another default flick mapping.
