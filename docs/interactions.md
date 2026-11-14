# Interaction hooks and timing

Buttons and keyboard keys accept optional `on_enter` and `on_exit` callbacks. They share one typed event API across automatic shortcuts, static shortcuts, pointer/touch input, native keyboard activation, hover and focus. Existing `on_close` callbacks retain their action behavior; omit `on_close` when the lifecycle callbacks own the behavior.

```svelte
<script lang="ts">
  import { Button, type InteractionEvent } from '@legitminh/keyflow';

  function entered(event: InteractionEvent) {
    if (event.kind === 'press') startPreview();
  }

  function exited(event: InteractionEvent) {
    if (event.kind !== 'press') return;
    stopPreview();
    if (!event.cancelled) saveHoldDuration(event.duration_ms);
  }
</script>

<Button on_enter={entered} on_exit={exited} on_close={save}>Save</Button>
```

This API is available on `Button`, `ButtonPositional`, `HoverButton`, `HoverButtonPositional`, `Interactable`, `InteractablePositional`, `StaticButton`, `StaticInteractable`, `KeyboardKeyDisplay` and `FlickKeyDisplay`. The callbacks are reactive: a mounted control uses the latest supplied callbacks without needing to register its route again.

## Event data

| Property | Meaning |
| --- | --- |
| `phase` | `enter` or `exit` |
| `kind` | `press`, `hover` or `focus` |
| `source` | `pointer`, `keyboard`, `virtual` or `programmatic` |
| `key`, `code` | Input key/physical code when supplied by the adapter; keyboard keys always provide their key |
| `started_at` | Monotonic start time in milliseconds (`performance.now()`) |
| `ended_at` | Monotonic end time, present on exit |
| `duration_ms` | Elapsed milliseconds; zero on enter |
| `cancelled` | Whether the interaction ended before normal completion |
| `reason` | Exit reason: `completed`, `cancelled`, `reset`, `disabled`, `unmounted`, `frame-change` or `unregistered` |
| `original_event` | Original DOM event when available; absent for imperative or virtual input |

Press, hover and focus are independent channels. A focused control can also be hovered and pressed; each channel gets its own pair of callbacks and its own duration. Filter `event.kind` to implement dwell behavior, hold behavior, or focus previews separately. `source: 'keyboard'` on focus describes the focus channel, including focus assigned by script or a pointer click; it does not infer the user's focus modality.

A press begins on pointer down, native Enter/Space down, or the down event that completes a routed shortcut. Automatic route prefixes do not start a button press. Static shortcuts stay pressed until every key held in that completed sequence has been released. Key repeat does not create another enter event. Normal pointer releases outside a control cancel; mapped flick releases outside the border complete the gesture, while unmapped directions cancel it.

`press_virtual_key()` remains an immediate down/up pair. Its routed button duration measures that pair; the on-screen key's pointer lifecycle measures the actual hold. Native accessibility clicks and `frame.trigger(token)` without a down/up input emit an instantaneous press pair. Native click behavior is preserved: Enter may activate `on_close` before release, while pointer clicks and Space usually activate after release. Use `on_exit` for behavior that must run specifically at release.

Resetting input, losing window focus, hiding the page, changing frames, unregistering or destroying a control ends its open sessions with `cancelled: true`. Changing a flick key's layout or adapter also cancels the gesture. Always clean up a preview or hold action on exit, including cancelled exits. Timing is independent of Keyflow's brief activation highlight.

## Keyboard-wide defaults and individual keys

`KeyboardDisplay`, `VirtualKeyboard` and `ActiveKeyboard` accept the same callbacks as defaults for their built-in keys. A key's own callback overrides the corresponding default, so keyboards can mix shared telemetry with special key behavior. `event.key` identifies the key.

```svelte
<VirtualKeyboard
  on_enter={(event) => previewKey(event.key, event.kind)}
  on_exit={(event) => recordKeyTime(event.key, event.kind, event.duration_ms)}
/>
```

Per-key callbacks are fields on `KeyboardKey` in a custom layout, or props on a directly rendered key component:

```svelte
<KeyboardKeyDisplay
  key="a"
  on_exit={(event) => {
    if (event.kind === 'press' && !event.cancelled) recordHold(event.duration_ms);
  }}
  onkey={myInputAdapter}
/>
```

Custom `keyDisplay` snippets own their markup and event wiring; pass your handlers into a key component or use the action below.

## Custom elements and gestures

Use the `interaction` Svelte action to add the lifecycle to your own native control. Supply `disabled` along with its DOM attribute so disabling an active control cancels immediately. The action observes events without preventing defaults, synthesizing DOM events, or invoking an action callback.

```svelte
<script lang="ts">
  import { interaction } from '@legitminh/keyflow';
  let disabled = $state(false);
</script>

<button {disabled} use:interaction={{
  disabled,
  on_enter: (event) => showPreview(event.kind),
  on_exit: (event) => hidePreview(event.kind, event.duration_ms)
}}>
  My control
</button>
```

For custom gestures, state machines, or non-DOM adapters, use the standalone controller:

```ts
import { create_interaction } from '@legitminh/keyflow';

const lifecycle = create_interaction({ on_enter: beginHold, on_exit: finishHold });
lifecycle.enter({ kind: 'press', source: 'programmatic', key: 'record' });
// Later:
lifecycle.exit('press');
// Or, when interrupted:
lifecycle.cancel('cancelled');
```

`enter()` and `exit()` are idempotent per channel. `has(kind = 'press')` reports whether a session is open; `cancel(reason)` closes all current channels. Pass a handler getter for reactive callbacks, and an optional `{ now: () => number }` second argument for a custom monotonic clock or deterministic tests.

Imperative automatic tokens accept `on_enter`/`on_exit` beside `on_close`. For static tokens, use `create_static_token(on_close, { on_enter, on_exit })`. `input_token_interaction(token)` returns the shared controller used by routing and the control's DOM action. A custom DOM/gesture adapter can pass that controller to `use:interaction`, then call `frame.trigger(token, false)` to invoke the action without synthesizing another lifecycle. Plain `frame.trigger(token)` emits a programmatic pair; an optional second details object supplies its source/key metadata.

Try `/interactions` in the demo to inspect live events and durations.
