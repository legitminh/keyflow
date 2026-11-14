# Press and cursor callbacks

Every button/interactable variant and keyboard key supports four independent callbacks:

| Callback | When it runs |
| --- | --- |
| `on_pressed_down(event)` | A pointer/touch press or keyboard activation begins. |
| `on_pressed_up(event)` | That press is released or cancelled. |
| `on_cursor_enter(event)` | A mouse/pen cursor or touch contact enters the control. |
| `on_cursor_exit(event)` | That cursor/contact leaves, lifts, or is cancelled. |

```svelte
<script lang="ts">
  import { Button } from '@legitminh/keyflow';
</script>

<Button
  on_pressed_down={() => startPreview()}
  on_pressed_up={(event) => {
    stopPreview();
    if (!event.cancelled) recordHold(event.duration_ms);
  }}
  on_cursor_enter={() => showHint()}
  on_cursor_exit={(event) => hideHint(event.duration_ms)}
  on_close={save}
>Save</Button>
```

`on_close` retains the existing activation behavior. Omit it when your press/cursor callbacks own the behavior. `disabled` disables the control and unregisters its shortcut. Callback props remain live without re-registering a route.

The API is shared by `Button`, `ButtonPositional`, `HoverButton`, `HoverButtonPositional`, `Interactable`, `InteractablePositional`, `StaticButton`, `StaticInteractable`, `KeyboardKeyDisplay` and `FlickKeyDisplay`. SubKeyframe triggers and list items accept the same callbacks.

## Mouse, touch and focus

Mouse/pen cursor events follow pointer enter/leave. Touch cursor entry starts at contact, movement can exit one control and enter another, and lifting ends the cursor session. Hit testing handles touch's implicit pointer capture, including captured flick gestures. Multiple contacts over one control share a cursor session: first contact enters, last contact leaves. The press still belongs to the control where it began; dragging over a neighbor does not press that neighbor.

Press and cursor callbacks are independent. Leaving a control while holding it ends the cursor session while the press remains open until release or cancellation. Releasing an ordinary control outside its bounds cancels the press. A mapped flick can complete outside its original key; an unmapped direction cancels it.

Native keyboard focus does **not** invoke cursor callbacks. Enter/Space activation invokes press callbacks. Native focus/blur semantics remain available through the DOM, and through the deprecated generic callbacks described below.

## Event data and timing

| Property | Meaning |
| --- | --- |
| `phase` | `enter` for down/cursor entry, `exit` for up/cursor exit. |
| `kind` | `press` or `cursor` for the four callbacks; legacy generic callbacks can also observe `focus`. |
| `source` | `pointer`, `keyboard`, `virtual` or `programmatic`. |
| `pointer_type`, `pointer_id` | Pointer metadata when available (`mouse`, `touch`, `pen`). The ID identifies the initiating contact. |
| `key`, `code` | Input key/physical code when supplied by the adapter. Keyboard keys provide their key. |
| `started_at` | Monotonic start timestamp in milliseconds (`performance.now()`). |
| `ended_at` | Monotonic end timestamp, present on up/exit. |
| `duration_ms` | Elapsed milliseconds; zero on down/entry. |
| `cancelled` | True if the session ended before normal completion. |
| `reason` | `completed`, `cancelled`, `reset`, `disabled`, `unmounted`, `frame-change` or `unregistered`. |
| `original_event` | Original DOM event when available. Absent for imperative/virtual input. |

Automatic shortcuts start a press when a down event completes the button's route. Prefix keys do not start the button press. Static shortcuts remain pressed until all held keys in the completed sequence have been released. Repeats never add down callbacks.

`press_virtual_key()` emits an immediate down/up pair. A routed button's duration measures that pair; the on-screen key's pointer callbacks measure its actual hold. Native accessibility clicks and `frame.trigger(token)` without down/up input emit instantaneous press pairs. Native activation behavior is preserved: Enter can invoke `on_close` before release; pointer clicks and Space usually invoke it after release. Use `on_pressed_up` when behavior must run at release.

Resetting input, losing window focus, hiding the page, changing frames, unregistering, disabling or destroying a control cancels its open sessions. The up/exit callbacks still run for cleanup; check `cancelled` before committing a hold action. Changing a flick layout or adapter also cancels its gesture. Timing is independent of the brief activation highlight.

## Shared keyboard defaults and individual keys

`KeyboardDisplay`, `VirtualKeyboard` and `ActiveKeyboard` accept the same four callbacks as defaults for built-in keys. A key's corresponding callback overrides that default. Each event includes `key`.

```svelte
<VirtualKeyboard
  on_pressed_down={(event) => previewKey(event.key)}
  on_pressed_up={(event) => recordKeyHold(event.key, event.duration_ms)}
  on_cursor_enter={(event) => highlightKey(event.key)}
  on_cursor_exit={(event) => clearHighlight(event.key)}
/>
```

Set callbacks on individual `KeyboardKey` objects in a custom layout or directly on `KeyboardKeyDisplay` / `FlickKeyDisplay`. Custom `keyDisplay` snippets own their markup; pass the callbacks into a key component or use the action below.

## Custom elements, gestures and adapters

```svelte
<script lang="ts">
  import { interaction } from '@legitminh/keyflow';
  let disabled = $state(false);
</script>

<button {disabled} use:interaction={{
  disabled,
  on_pressed_down: startHold,
  on_pressed_up: finishHold,
  on_cursor_enter: showPreview,
  on_cursor_exit: hidePreview
}}>My control</button>
```

The `interaction` action observes events without preventing defaults or invoking an action callback. Pass its `disabled` option with the DOM attribute to cancel immediately when disabling. A custom gesture can set `press: false` to own its press channel, or `press: 'keyboard'` to retain native Enter/Space press handling while owning pointer presses. Cursor handling remains enabled.

For custom gestures, state machines and non-DOM adapters:

```ts
import { create_interaction } from '@legitminh/keyflow';

const lifecycle = create_interaction({
  on_pressed_down: beginHold,
  on_pressed_up: finishHold,
  on_cursor_enter: showPreview,
  on_cursor_exit: hidePreview
});
lifecycle.enter({ kind: 'press', source: 'programmatic', key: 'record' });
// Later:
lifecycle.exit('press');
// Or, when interrupted:
lifecycle.cancel('cancelled');
```

Use `kind: 'cursor'` for a custom cursor/contact adapter. `enter()` and `exit()` are idempotent per channel; `has(kind = 'press')` reports an open session; `cancel(reason)` closes current channels. A handler getter keeps callbacks live. An optional `{ now: () => number }` second argument supplies a monotonic clock for deterministic tests.

Automatic tokens accept the four callbacks beside `on_close`. Static tokens use `create_static_token(on_close, callbacks)`. `input_token_interaction(token)` returns the shared controller used by routing and the DOM action. A custom adapter can pass it to `use:interaction`, then call `frame.trigger(token, false)` to invoke the action without another lifecycle. Plain `frame.trigger(token)` emits a programmatic pair; an optional details object supplies source/key metadata.

## Migrating from v0.5

Replace `on_enter`/`on_exit` callbacks that inspect `kind` with the four named callbacks. Built-in pointer events now use `kind: 'cursor'` instead of `'hover'`. The standalone controller still accepts legacy `'hover'` sessions.

`on_enter` and `on_exit` remain deprecated fallbacks for phases without a specific callback. A named callback takes precedence; it does not also invoke the generic fallback. Generic callbacks can still observe native `focus` sessions. Keyboard focus is deliberately separate from cursor contact.

Try `/interactions` in the demo to inspect the events and durations.
