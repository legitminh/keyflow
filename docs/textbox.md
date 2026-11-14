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

Omit `enterTrigger` to assign an automatic shortcut, like Button. `priority` controls that automatic token's order. Set `enterTrigger={null}` to disable the textbox's entry binding and use client controls instead. An explicit entry trigger reserves keys and must be prefix-free within its parent frame, like StaticButton. The exit trigger belongs only to the editing frame and may reuse the entry trigger. Prefer a named or modifier-based exit trigger: printable exit sequences intercept their matching characters before text insertion.

## Open from any client control

Bind the component instance with `bind:this`, then call `enter()` from your button's action. Use `showEntry={false}` to hide the built-in entry button and `enterTrigger={null}` to avoid registering a second entry shortcut. The textarea remains mounted and appears when entered. These two options are independent: a hidden entry button can still have a configured shortcut, and an entry button with a null trigger still works by click.

```svelte
<script lang="ts">
  import {
    Keyflow, TextBox, Button, ButtonPositional, StaticButton, Interactable,
    HoverButton, HoverButtonPositional, type TextBoxController, type Shortcut
  } from '@legitminh/keyflow';

  let editor = $state<TextBoxController>();
  let text = $state('');
  let enterTrigger = $state<Shortcut | null>(null);
  let exitTrigger = $state<Shortcut>('escape');
  const openEditor = () => { void editor?.enter(); };
</script>

<Keyflow>
  <Button priority={0} on_close={openEditor}>Edit notes</Button>
  <ButtonPositional on_close={openEditor}>Edit here</ButtonPositional>
  <StaticButton keys={['ctrl', 'k']} on_close={openEditor}>Edit by exact shortcut</StaticButton>
  <Interactable on_close={openEditor}>Your custom content</Interactable>
  <HoverButton priority={1} on_close={openEditor}>Hover to see shortcut</HoverButton>
  <HoverButtonPositional on_close={openEditor}>Hover positional opener</HoverButtonPositional>
  <button type="button" onclick={openEditor}>Native button</button>

  <TextBox bind:this={editor} bind:value={text} {enterTrigger} {exitTrigger}
    showEntry={false} label="Notes" />

  <button type="button" onclick={() => editor?.exit()}>Finish editing</button>
  <button type="button" onclick={() => {
    enterTrigger = 't';
    exitTrigger = ['ctrl', 'enter'];
  }}>Use T to enter and primary modifier + Enter to exit</button>
</Keyflow>
```

Use any of the opener variants above, or supply your own button. `StaticButton` / `StaticInteractable` provide an absolute, explicitly assigned key sequence. `ButtonPositional` / `InteractablePositional` register while visible; `Button` / `Interactable` persist offscreen. The hover variants follow the same registration rules as their regular button counterparts. Openers should belong to the textbox's parent InputFrame.

Both trigger props are reactive. Reassigning either replaces its binding and clears partial input for that binding's frame; the previous sequence stops working. `exitTrigger` can change during editing, and the exit hint updates with it. Set `enterTrigger` to `undefined` for automatic entry, `null` for external entry only, or a `Shortcut` for explicit entry. `showEntry` affects rendering only; it does not control shortcut registration.

| Instance method | Behavior |
| --- | --- |
| `await editor.enter()` | Enters when mounted, enabled, and the parent frame is active; resolves after editor focus and `onenter`. Repeated entry or entry from another active frame does nothing. |
| `await editor.exit()` | Exits when the textbox's editing frame is topmost, retains the value, and restores focus to the connected opener (or built-in button). Does nothing while a child frame is on top. |

These methods use the same editing lifecycle as the built-in triggers. They return `Promise<void>` and safely do nothing when their guards are not met. Wait for the component to mount before calling `enter()`; a client `onMount` can `await tick()` first. Keep state in `bind:value` if conditionally unmounting the component. Unmounting disposes its editing frame and removes any frames above it.

## Editing behavior

TextBox renders a normal textarea without an editing toolbar. Physical typing, mouse/touch selection, copy/paste/cut, printing, native undo/redo, Tab navigation, IME composition and OS emoji input keep their browser behavior. Only the configured exit binding is intercepted. Clicking elsewhere can move focus normally while the editing frame remains active until its exit trigger or application cleanup.

Virtual characters, flick translations, Backspace/Delete, Enter, Tab, arrows and Home/End adapt to the textarea's existing selection. Virtual Enter inserts a newline; virtual Tab inserts a tab. Physical Tab retains ordinary focus navigation. Native clipboard and browser commands, including Cmd/Ctrl+C, V, X, P and Z, are never replaced by library clipboard or history handlers.

Virtual horizontal movement and deletion use Unicode grapheme boundaries, preserving emoji sequences and combining characters. Virtual up/down preserve the logical character column across newline-separated lines. The textarea defaults to normal `wrap="soft"`; virtual vertical movement follows logical lines, while physical arrows use native visual-line behavior. `wrap="off"` is available when a client wants unwrapped lines.

Physical Shift works with virtual arrows and characters. Where a keyboard layout provides Shift/Caps Lock, virtual modifiers affect selection and character case. There are no additional Shift, Enter, clipboard, or history buttons attached to TextBox. Use your physical keyboard or choose an appropriate virtual layout for those keys.

Virtual text insertion uses the browser's native edit command where supported to preserve native undo history, with a textarea selection-API fallback. Physical undo/redo is always left to the browser. TextBox does not access the Clipboard API or request clipboard permissions. Its virtual adapter never synthesizes trusted browser/OS shortcuts.

The value is retained when exiting and reopening. A child InputFrame can temporarily mask the editor—for example, to select a different keyboard. Popping the child restores editing focus and selection. TextBox owns and disposes its private frame; clients do not manage it manually. Escape during composition remains available to the OS/browser, and the configured exit trigger resumes after composition.

## Props

| Prop | Meaning |
| --- | --- |
| `bind:value` | Edited string, initially empty. |
| `enterTrigger` | Reactive Shortcut; `undefined` (default) assigns an automatic binding; `null` disables entry binding. |
| `exitTrigger` | Reactive Shortcut that ends editing; default `'escape'`. |
| `showEntry` | Show the built-in preview/entry button; default `true`. Set `false` for custom openers. |
| `priority` | Automatic entry-binding priority; default `0`. |
| `label` | Accessible button/textarea label; default `'Text input'`. |
| `placeholder` | Empty button/textarea prompt; default `'Click to edit'`. |
| `rows` | Textarea height in rows; default `4`. |
| `disabled` | Disable entry and end an active editing session. |
| `wrap` | `'soft'` (default), `'off'`, or `'hard'`. |
| `onenter(frame)` | Called after entry and focus; receives the editing frame reference. |
| `onexit(value)` | Called when a mounted editing session ends. |
| `oninput(event)` | Native or virtual input notification; value binding stays synchronized. |
| `class` and textarea attributes | Layout/style and native attributes such as `spellcheck`, `maxlength`, `readonly`, or `inputmode`. |

Set `inputmode="none"` when a client wants to suppress the device keyboard in favor of its custom keyboard. Leave native input enabled when users need the device's typing/emoji UI. TextBox does not open an OS emoji picker itself.

## Shared routing

The existing dispatcher now supports an input-owning frame handler. `set_input_frame_handler(frame, handler)` registers `(type, input) => boolean` and returns cleanup. While that frame is topmost, its handler owns the signals: returning false leaves native browser behavior available and does not fall through to automatic bindings. Other frames retain their usual token routing.

TextBox uses this narrow hook to check its exit binding before allowing native editing, and to adapt `source: 'virtual'` input into textarea edits. This keeps virtual keyboards independent of TextBox and avoids handling physical text twice. Custom keyboard `onkey` handlers must forward to `keyflow_key_handler(event)` if they want the active TextBox to receive input.

## Try the demo

Run `pnpm demo`. On `/` (also `/stack`), click **Keyboard text editor** or input T. Type physically, tap/flick the docked keyboard, select text with a mouse, and use native clipboard/browser shortcuts. Tap Escape to return. Expand the custom-trigger example to test primary-modifier+K entry and primary-modifier+Enter exit.

Visit `/controls` for client-supplied openers, hover overlays, and live entry/exit binding selectors. It also demonstrates API exit, disabled editors, and a child frame that temporarily masks editing.

The flick-alpha Escape key replaces the former semicolon slot: tap Escape exits, left flick deletes backward, right flick inserts Tab, up flick types `~`, and down flick types a backtick. Space flicks move the caret in the corresponding direction. For a virtual Enter key, choose a layout such as 60%; physical Enter works normally in every layout.
