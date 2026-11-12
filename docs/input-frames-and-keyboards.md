# Input frames and virtual keyboards

## Recommended migration: model substates as a frame stack

Create a frame for each interaction state: a page substate, dropdown, command palette, dialog, picker, or nested workflow. Register its tokens once and use **`input_frame_manager.push(frame)` / `pop()`** to move between states. These transitions replace manual deregistration and page-change bookkeeping. A frame is a reusable state referenced by an object; DOM nesting and visibility do not define the stack.

The flow is:

```text
Physical keys / virtual key taps / custom input adapters
  → discrete keydown and keyup signals (repeats filtered)
  → keystroke/sequence management
  → active InputFrame's bindings
  → matching automatic or static InputToken
  → token action: navigate, scroll, alert, toggle state, push/pop a frame, ...
```

Direct mouse/touch activation of an Interactable goes through its token and the same active-frame gate. The virtual keyboard knows only the key input space; it has no references to Interactables, tokens, frames, or effects. Switching frames changes what a key means without changing the keyboard.

`Keyflow` supplies the permanent root frame. Every `Button`, `Interactable`, `StaticButton`, and positional variant registers with its nearest InputFrame through Svelte context, or with the root when no enclosing frame exists. Masked controls remain registered and their direct-click buttons become disabled. Only the top frame can act.

### Example: page A–E → menu A–C → page A–E

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Keyflow, InputFrame, Button, VirtualKeyboard,
    create_input_frame, input_frame_manager
  } from '@legitminh/keyflow';

  const menu = create_input_frame({ name: 'menu' });
  const active = input_frame_manager.active;
  let count = $state(0);
  onDestroy(() => menu.dispose());
</script>

<Keyflow options={{ keys: ['a', 'b', 'c', 'd', 'e'] }}>
  {#each ['A', 'B', 'C', 'D'] as label, priority}
    <Button {priority} on_close={() => count++}>Page {label}</Button>
  {/each}
  <Button priority={4} on_close={() => input_frame_manager.push(menu)}>Open menu</Button>
  <p>Page actions: {count}</p>

  <!-- Keep the bindings mounted; control presentation separately. -->
  <InputFrame frame={menu}>
    <section hidden={$active !== menu} aria-label="Menu">
      <Button priority={0} on_close={() => input_frame_manager.pop()}>Return to page</Button>
      <Button priority={1} on_close={() => alert('menu B')}>Menu B</Button>
      <Button priority={2} on_close={() => alert('menu C')}>Menu C</Button>
    </section>
  </InputFrame>

  <VirtualKeyboard variant="alpha" />
</Keyflow>
```

The root assigns `a,b,c,d,e`. Hardware E, a virtual E tap, or clicking Open menu pushes `menu`, which assigns its own `a,b,c`. All five page controls lose key and direct-click activation. Menu A pops the stack, restores the page controls, and hides the menu. That return signal is consumed once; it does not also activate page A. Reopening the menu reuses the same frame and its local state. Any token action can push another frame to make an arbitrarily deep stack.

### Manager API

`input_frame_manager.active` (also exported as `active_input_frame`) is a read-only Svelte store containing the top frame. `input_frame_manager.stack` is a read-only store of frame references, starting with the root. `get_active_input_frame()` reads the active frame imperatively.

| Method | Behavior |
| --- | --- |
| `push(frame)` | Push a new reference and mask every lower frame. Pushing the current top is harmless. Pushing a reference already lower in the stack throws; use `go_to` to return to it. |
| `pop()` | Remove and return the top frame, exposing the previous frame. At root, return `null`. |
| `go_to(frame)` | Unwind to an existing reference, or push it if absent. `go_to(input_frame_manager.root)` returns to the page. |
| `replace(frame)` | Replace the current substate with a new reference. At root, push it while retaining the permanent root. An existing lower reference throws. |
| `reset()` | Return to root, preserving all frame bindings for reuse. |

Popping, replacing, resetting, and unwinding do not dispose frames. References remain reusable until `dispose()`. Disposing a stacked frame removes it **and everything above it**, so a removed page/substate cannot leave its dependent menu active. Frames above it are popped and remain reusable. The root cannot be popped or disposed. Disposed or foreign references are rejected before any transition changes the live stack.

### Svelte component and lifetime

`create_input_frame({ name? })` creates an inactive controller. `<InputFrame frame={reference}>` sets the binding context for its children without activating it. Many pre-created states can coexist on a page, including sibling components and menus rendered through portals. Each component's binding frame is fixed at creation. Pass a stable `frame` prop; remount the component to change that context.

The component emits no wrapper DOM and does not hide its children. Use the active/stack stores to show the appropriate menu or substate, as in the example. No frame activation depends on DOM visibility. `ButtonPositional` / `InteractablePositional` still support viewport-based registration within a frame; persistent `Button` / `Interactable` are recommended for substate controls.

The caller owns an explicitly supplied frame: call `dispose()` when the owning page/component is destroyed. Alternatively, omit `frame` and obtain an automatically owned controller with `bind:controller`:

```svelte
<script lang="ts">
  import { InputFrame, Button, input_frame_manager, type InputFrameController } from '@legitminh/keyflow';
  let menu = $state<InputFrameController>();
</script>

<Button on_close={() => { if (menu) input_frame_manager.push(menu); }}>Open menu</Button>
<InputFrame name="menu" bind:controller={menu}>
  <!-- Registered while mounted; disabled until this frame is on top. -->
  <Button on_close={() => input_frame_manager.pop()}>Back</Button>
</InputFrame>
```

An owned controller is disposed when its InputFrame component unmounts. Frame references retain identity when used in Svelte `$state` or bindings. `name` is an optional initial diagnostic label.

The optional `active` prop supports declarative integrations: `active={true}` pushes the frame; `active={false}` removes it and all frames above it. It defaults to **undefined**, leaving transitions to the manager. Do not combine manager-controlled transitions with an `active` prop on the same component. For an immediately active conditional scope, write `{#if open}<InputFrame active>…</InputFrame>{/if}`. For nested states, the manager's explicit push order determines precedence; Svelte tree ancestry does not alter it.

### Routing and interactivity guarantees

- Only the top frame receives key input. Unmatched keys do **not** fall through to lower states; an empty top frame masks everything below it.
- Keyflow Interactables/Buttons in lower frames are disabled for direct mouse, touch, and native keyboard activation. A synchronous callback guard also prevents stale/synthetic clicks from bypassing the current-frame check.
- Every top-frame change cancels pending automatic/static sequences and tracked static key holds. A sequence cannot resume halfway through after a frame is restored.
- Static duplicates and prefix conflicts are checked within one frame. Different states may reuse the same key or Escape. Static reservations affect only their frame's automatic alphabet.
- `map_key_route`, `map_numeric_route`, and `list_input_token` describe the active frame. Masked shortcut labels disappear. Restoring a frame preserves its routes when its bindings/alphabet have not changed, including equal-priority ordering.
- Frame transitions do not change the selected virtual keyboard. Configure its input keys to cover the states users can enter.
- InputFrame does not automatically hide arbitrary DOM, trap focus, or supply dialog semantics. Plain HTML buttons outside Keyflow Interactables retain their own handlers; use Interactable or a frame-gated custom token handler for controls that must follow frame state. Virtual keyboard keys remain available independently of the current action frame.

Automatic and static button displays use the same highlight for physical keys, virtual keys, direct clicks and touch taps. A brief activation pulse keeps fast down/up pairs visible; direct pointer presses highlight while held. This feedback does not modify shortcut progress or invoke actions a second time.

### Custom tokens and input adapters

`get_input_frame()` reads the nearest frame during Svelte component initialization. Register a custom InputToken once, clean it up on unmount, and use `frame.trigger(token)` for direct gestures so inactive frames cannot invoke it:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { get_input_frame, active_input_frame, type InputToken } from '@legitminh/keyflow';
  const frame = get_input_frame();
  const token: InputToken = { priority: 0, on_close: () => console.log('effect') };
  onMount(() => frame.register(token));
</script>

<button disabled={$active_input_frame !== frame} onclick={() => frame.trigger(token)}>Activate</button>
```

`frame.register(token)` returns cleanup; `frame.update(token, priority)` updates ordering even while masked. For explicit key sequences use `frame.static_input.register(create_static_token(callback), shortcut)`, which also returns cleanup. `frame.trigger(token)` returns false when masked, otherwise invokes the action and returns true. Calling a raw action callback directly is an application-level invocation and bypasses routing.

`frame.activate()` aliases `push(frame)`. `frame.deactivate()` removes it and every frame above it while preserving registrations. Prefer the manager for explicit navigation, and reserve `dispose()` for final cleanup.

Hardware events are filtered for form editing and composition, then enter the shared `dispatch_key_input` path. Virtual taps use `press_virtual_key`, which emits one down/up pair. Static sequences resolve on release of participating keys; automatic routes resolve on release after enough strokes. The resolved token invokes the action, which may synchronously change the active frame. Repeat events do not advance sequences. Custom input devices can use the same dispatcher; see the adapters below.

One Keyflow application per page remains the supported model. These frames are states within that application. Existing clients with one root still bind to it; migrate temporary UIs by creating persistent frame references and moving their open/back actions to manager pushes/pops instead of removing/re-adding page registrations.

## Virtual keyboard: input space

The keyboard represents **keys**, independent of the current frame, its InputTokens, or the number of Interactables. It never registers an action or allocates shortcuts. Pressing a displayed key sends input through the same dispatcher used by hardware; the active frame resolves that input to an automatic or static token. Ordinary native HTML buttons continue to use their own click handlers; Keyflow `Button` and `Interactable` participate in shortcut routing.

```svelte
<script lang="ts">
  import { Keyflow, Button, VirtualKeyboard } from '@legitminh/keyflow';
</script>

<Keyflow options={{ keys: ['a', 's', 'd', 'f'] }}>
  <Button on_close={() => console.log('activated')}>An action</Button>
  <VirtualKeyboard variant="grid16">
    {#snippet toolbar()}<span>Tap a key to enter a shortcut</span>{/snippet}
  </VirtualKeyboard>
</Keyflow>
```

Place the keyboard outside a camera's scrolling world if it should stay visible; it can be a sibling of `Document`. Use your app's layout to reserve space or dock it. All styling needed by the keyboard lives in its components; the global `styles.css` is optional for standalone keyboard use.

### Layouts

All layouts render text keycaps (bracketed character/symbol labels) with deterministic per-key colors. Override labels to use strictly ASCII text where desired.

| `variant` / `keyboard_layouts` key | Shape |
| --- | --- |
| `flick-alpha` | 3×10 ortholinear letters/punctuation/space, uppercase-down and numbers-up; [full guide](flick-keyboards.md) |
| `alpha` (component default) | QWERTY letters only, 26 keys |
| `alphanumeric` | Number row and QWERTY letters, 36 keys |
| `'60%'` | 61-key layout, named keys and variable-width keycaps |
| `ortholinear` | 4 rows × 12 equal-width keys |
| `grid16` | 4 × 4, `1234qwerasdfzxcv` (the default shortcut alphabet) |
| `grid32` | 4 × 8, `12345678qwertyuiasdfghjkzxcvbnm,` |

**Layout and shortcut alphabet are separate choices.** Selecting a keyboard never calls `set_available_keys()`. Choose an alphabet reachable on your selected layout; include keys needed by static bindings as well. Alpha-only layouts cannot enter numeric or named-key bindings. For a grid32 automatic alphabet, pass `keyboard_layouts.grid32.rows.flat().map(key => key.key)` as `options.keys`. Named keys cannot be part of the automatic single-character alphabet, but can be static sequence steps.

Virtual taps emit a complete keydown/keyup pair. Modifiers are ordinary sequence steps, matching Keyflow static shortcuts: tap Control, then K to enter `['control', 'k']`. A modifier keycap does not latch or transform later letters. `ctrl` / `mod` / `primary` names resolve using Keyflow's configured platform; `control` is always literal Control. The built-in 60% caps-lock and shift keycaps emit their named keys; they do not change the layout. Implement alternative shift/latch behavior with a custom handler and layout if needed.

Mouse, touch, Enter, and Space can activate the native keycap buttons. Pointer presses preserve focus, so tapping keys does not reset a partial sequence by focusing each keycap. The default adapter deliberately routes virtual input to Keyflow even if a text field is focused. Hardware input in text fields retains normal typing behavior. Virtual input does not create trusted DOM KeyboardEvents, type into native fields, open OS keyboards, or invoke browser shortcuts.

### Customize key behavior

Set `onkey` to replace the default adapter. The handler receives `{ type: 'keydown' | 'keyup', key, code, repeat: false, source: 'virtual' }` for each tap. `key` preserves printable character casing (for example `A`); named aliases are normalized and space is `' '`; `code` is a stable virtual identity, not a physical KeyboardEvent.code. The component does not inspect the event's consumer.

Default helpers are exported for custom displays:

```ts
import {
  press_virtual_key, keyflow_key_handler, dispatch_key_input, reset_input,
  type VirtualKeyInput
} from '@legitminh/keyflow';

press_virtual_key('a'); // default: route a down/up pair to the active frame
press_virtual_key('ctrl'); // portable primary modifier, as one sequence step

function logAndRoute(event: VirtualKeyInput) {
  console.log(event);
  keyflow_key_handler(event);
}

// Integrations that implement actual press/release gestures can use:
dispatch_key_input('keydown', { key: 'a', code: 'custom-a' });
dispatch_key_input('keyup', { key: 'a', code: 'custom-a' });
// Call reset_input() if the gesture is cancelled.
```

A minimal controlled text adapter, suitable for an app-owned text surface:

```svelte
<script lang="ts">
  import { VirtualKeyboard, type VirtualKeyInput } from '@legitminh/keyflow';
  let text = $state('');
  function textInput(event: VirtualKeyInput) {
    if (event.type !== 'keyup') return;
    if (event.key === 'backspace') text = text.slice(0, -1);
    else if (event.key === 'enter') text += '\n';
    else if (event.key.length === 1) text += event.key;
  }
</script>

<pre>{text}</pre>
<VirtualKeyboard variant="60%" onkey={textInput} />
```

This example handles plain characters; adapt it to your editor's selection, Unicode editing, and composition model. It replaces Keyflow routing for those keys. Call `keyflow_key_handler(event)` explicitly if you want to forward selected keys to shortcuts.

### Build custom keyboards

`KeyboardLayout` has `{ id, label, rows }`. Each `KeyboardKey` has `{ key, label?, color?, width?, disabled?, flick? }`; `width` is relative flex width within its row. Repeated named keys (such as left/right Shift) are allowed. Layouts and colors do not encode action bindings. Supplying `flick` selects the new FlickKeyDisplay; its directional translations feed the same key handler, and it can be freely mixed with regular keys. See the [flick guide](flick-keyboards.md) for gesture rules, customization and the full default mapping.

`create_grid_keyboard(id, keys, columns, label?)` accepts strings or KeyboardKey objects and builds rows, including a partial last row. Built-in layouts are frozen; create a new layout to customize them.

```svelte
<script lang="ts">
  import { KeyboardDisplay, KeyboardKeyDisplay, create_grid_keyboard } from '@legitminh/keyflow';
  const arrows = create_grid_keyboard('arrows', [
    { key: 'arrowleft', label: 'Left', color: '#ffb347' },
    { key: 'arrowdown', label: 'Down' },
    { key: 'arrowup', label: 'Up' },
    { key: 'arrowright', label: 'Right' }
  ], 2, 'Navigation keys');
</script>

<KeyboardDisplay layout={arrows} colors={{ arrowup: '#7bdff2' }}>
  {#snippet toolbar()}<span>Navigation</span>{/snippet}
</KeyboardDisplay>

<!-- Or compose arbitrary geometry using children and standalone key displays. -->
<KeyboardDisplay>
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem">
    <KeyboardKeyDisplay key="a" label="A" color="#ffb347" />
    <KeyboardKeyDisplay key="b" label="B" />
  </div>
</KeyboardDisplay>
```

`KeyboardDisplay` accepts `layout`, `toolbar` (snippet), `children`, `onkey`, `colors` (key-to-CSS-color map), `class`, and `keyDisplay` (a snippet receiving one KeyboardKey). A custom `keyDisplay` owns its event adapter and markup; pass `onkey` to any KeyboardKeyDisplay it renders. Children in a custom composition likewise own their adapters.

`KeyboardKeyDisplay` accepts the KeyboardKey fields plus `onkey`, `pressed`, `children`, and `class`. `pressed` is optional external visual state; the default keyboard does not observe hardware keys or bind pressed-state stores. Use children for a custom key face. Key meaning remains available through its accessible label.

Override inherited CSS properties: `--keyboard-background`, `--keyboard-key-background`, `--keyboard-pressed-color`, `--keyboard-font`, `--keyboard-font-size`, `--keyboard-key-height`, `--keyboard-key-radius`, `--keyboard-gap`, and `--keyboard-padding`. Per-key colors override deterministic defaults; labels and outlines carry meaning alongside color.

## Manage keyboards in a project

Create a store once in your project root. It starts with no active keyboard unless you supply an initial ID. The store is independent from InputFrames; switching input scopes never changes the user's selected keyboard.

```svelte
<script lang="ts">
  import { ActiveKeyboard, create_keyboard_store, keyboard_layouts } from '@legitminh/keyflow';
  const keyboards = create_keyboard_store([
    keyboard_layouts.alpha, keyboard_layouts.grid16, keyboard_layouts['60%']
  ]); // optional second argument: initial active ID, e.g. 'grid16'
  const available = keyboards.keyboards;
  const active = keyboards.active;
</script>

<label>Keyboard
  <select value={$active?.id ?? ''}
    onchange={(event) => keyboards.select(event.currentTarget.value || null)}>
    <option value="">None</option>
    {#each $available as layout}<option value={layout.id}>{layout.label}</option>{/each}
  </select>
</label>
<ActiveKeyboard store={keyboards}>
  {#snippet toolbar()}<button onclick={() => keyboards.select(null)}>Hide keyboard</button>{/snippet}
</ActiveKeyboard>
```

`keyboards` and `active` are read-only stores. `add(layout)` rejects duplicate/empty IDs; `update(layout)` replaces an existing layout and refreshes it if selected; `remove(id)` removes it and clears selection if active; `select(id | null)` changes selection. Selecting or updating an unknown ID throws RangeError; removing a missing ID is harmless. `ActiveKeyboard` renders nothing for `null`, and forwards `toolbar`, `onkey`, `colors`, and `class` to KeyboardDisplay. It does not persist selection automatically; save the selected ID in your project's preference store if desired.

Run `pnpm demo` and open `/` (also `/stack`) for a keyboard-selection InputFrame menu and a persistent lower-half dock with all seven built-in layouts plus a mixed regular/flick example. E opens the menu, A returns, and selecting a keyboard pops back to the page. `/frames` covers more customization, nullable selection and text adapters; `/flow` retains the original scrolling demo.
