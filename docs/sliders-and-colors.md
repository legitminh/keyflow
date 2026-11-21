# Sliders and shared key colors

Run `pnpm demo` and visit `/sliders` to try every preset, custom controls, and the color space.

## Slider presets

```svelte
<script lang="ts">
  import {
    HorizontalHoverSlider, VerticalHoverSlider,
    HorizontalPositionalSlider, VerticalPositionalSlider,
    HorizontalSlider, VerticalSlider
  } from '@legitminh/keyflow';
  let volume = $state(50);
  let balance = $state(0);
</script>

<HorizontalHoverSlider bind:value={volume} label="Volume" min={0} max={100} step={1} />
<VerticalPositionalSlider bind:value={balance} label="Balance" min={-1} max={1} step={0.1} />
```

All presets compose `SliderCore` with existing button components. Drag or tap the line with a mouse, pen, or touch contact. Values increase rightward or upward. Holding a control or its routed shortcut moves one step immediately and then moves continuously; releasing stops immediately. An ordinary tap moves one step. Motion uses elapsed animation time rather than operating-system key repeat. Fractional steps accumulate even when each animation frame covers less than one step.

| Component | Controls | Default shortcuts |
| --- | --- | --- |
| `HorizontalHoverSlider` | `HoverButton` | Left decreases, Right increases |
| `VerticalHoverSlider` | `HoverButton` | Down decreases, Up increases |
| `HorizontalPositionalSlider` | `ButtonPositional` | Automatically assigned while each control is visible |
| `VerticalPositionalSlider` | `ButtonPositional` | Automatically assigned while each control is visible |
| `HorizontalSlider` | `Button` | Automatically assigned by page position; stay registered offscreen |
| `VerticalSlider` | `Button` | Automatically assigned by page position; stay registered offscreen |

Hover controls show their shortcut on mouse hover or keyboard focus. Their static shortcuts remain registered offscreen. Override the hover presets with `decreaseKeys` / `increaseKeys`, accepting the same `Shortcut` format as `StaticButton`:

```svelte
<HorizontalHoverSlider bind:value={volume} label="Volume"
  decreaseKeys="j" increaseKeys="k" speed={25} />
```

Static bindings must remain unique and prefix-free in their frame. Two horizontal hover sliders cannot both own Left/Right in the same frame: give them different bindings, put them in separate active frames, or use positional controls. For multi-key controls, holding starts at the terminal keydown and ends when the existing shortcut lifecycle releases the participating keys. Rebinding, unregistering, or masking a control cancels its hold.

### Shared props

| Prop | Default | Meaning |
| --- | --- | --- |
| `value` | `0` | Bindable number; clamped and snapped to `step` |
| `min`, `max` | `0`, `100` | Finite bounds, with `max > min` |
| `step` | `1` | Positive finite step, anchored to `min`; fractional steps work |
| `speed` | `(max - min) / 2` | Finite, nonnegative units per second while held |
| `label` | `"Slider"` | Accessible slider and group name; use a descriptive name |
| `valueText` | — | Optional `(value) => string` for `aria-valuetext` |
| `disabled` | `false` | Disables dragging, controls, and controller writes |
| `onchange` | — | `(value: number) => void` after a value changes through the core, including normalization |
| `class` | `""` | Class applied to the core track container |
| `decreaseLabel`, `increaseLabel` | `Decrease ${label}`, `Increase ${label}` | Accessible control names |
| `controls` | — | `Snippet<[SliderController]>` replacing the preset controls |

The exact `min` and `max` remain reachable even when the range is not divisible by `step`. Changes from an already-valid external `bind:value` assignment do not emit `onchange`. Invalid ranges, steps, values, and speeds throw `RangeError`.

Presets and the core follow their nearest `InputFrame`. An inactive frame disables them. Held motion and dragging stop on disabled state, frame changes, window blur, hidden pages, configuration changes, or unmount. Opposite held directions cancel each other; releasing one resumes the other. Positional button unregistration also stops the associated direction.

Style with inherited CSS properties: `--slider-length` (default `12rem`), `--slider-hit-size` (`2rem`), `--slider-thumb-size` (`1rem`), `--slider-track-size` (`2px`), and `--slider-color` (`currentColor`). Component styles are included without requiring the global Keyflow stylesheet.

## Compose your own controls

`SliderCore` is only the dot and line, pointer interaction, value management, and a controller. It registers no shortcuts and installs no arrow-key handler. Supply keyboard controls using the existing interactables and their press callbacks. It exposes slider semantics and a focusable target; a complete keyboard interface comes from your controls or a preset.

```svelte
<script lang="ts">
  import { SliderCore, Interactable, StaticButton, type SliderController } from '@legitminh/keyflow';
  let value = $state(0.5);
  let slider = $state<SliderController>();
</script>

<Interactable on_pressed_down={() => slider?.start(-1)} on_pressed_up={() => slider?.stop(-1)}>
  Quieter
</Interactable>
<SliderCore bind:this={slider} bind:value min={0} max={1} step={0.01}
  speed={0.2} label="Volume" valueText={(v) => `${Math.round(v * 100)} percent`} />
<StaticButton keys="k" on_pressed_down={() => slider?.start(1)} on_pressed_up={() => slider?.stop(1)}>
  Louder
</StaticButton>
```

| Controller method | Behavior |
| --- | --- |
| `set(value)` | Set an absolute value, snapping and clamping it |
| `shift(steps)` | Move a signed number of steps |
| `start(-1 \| 1)` | Step immediately and continue while held; repeated starts of the same direction are ignored |
| `stop(-1 \| 1)` | Stop one direction, including cancelled releases |
| `stop()` | Stop all held motion |

Use `on_pressed_up` for both ordinary and cancelled releases. These controls use `on_pressed_down` for their initial step; adding `on_close={() => slider.shift(...)}` would step again on release. If you want discrete controls, use only `on_close={() => slider.shift(...)}` instead.

You can also replace the controls of a preset with a snippet:

```svelte
<HorizontalPositionalSlider bind:value label="Progress">
  {#snippet controls(slider)}
    <StaticButton keys="j" on_pressed_down={() => slider.start(-1)} on_pressed_up={() => slider.stop(-1)}>
      Rewind
    </StaticButton>
    <StaticButton keys="k" on_pressed_down={() => slider.start(1)} on_pressed_up={() => slider.stop(1)}>
      Advance
    </StaticButton>
  {/snippet}
</HorizontalPositionalSlider>
```

`HoverButton` itself now accepts optional `keys`. When supplied, it composes `StaticInteractable` and `StaticButtonDisplay` with a hover/focus overlay. Omitting `keys` preserves its automatic shortcut and priority behavior. `StaticButtonDisplay` also accepts `overlay` for custom compositions.

## Color distributor API

```ts
import { f, distribute_color, color_hue, key_color_index, key_color_hue, shortcut_color_hue } from '@legitminh/keyflow';

f(256, 32, 0); // 0
f(256, 32, 1); // 32
f(256, 32, 8); // 16
distribute_color(256, 32, 256); // undefined: no color beyond the space
const hue = key_color_hue('a'); // CSS degrees
const color = hue === undefined ? undefined : `hsl(${hue} 100% 50%)`;
```

`f(b, h, i)` and `distribute_color(b, h, i)` are the same pure function. They return an integer bucket in `[0, b)` for integer indices in `[0, b)`. All `b` outputs are unique; absolute differences between consecutive outputs are at least `h`. This is an absolute bucket difference, as in the supplied specification, rather than a distance around the circular wrap. `b` must be a positive safe integer and `h` a nonnegative safe integer no larger than `floor(b / 2)` for `b > 1`. Impossible gaps and invalid parameters throw `RangeError`. Out-of-range or noninteger indices return `undefined`, without wrapping or highlighting.

For the default `(256, 32)`, the sequence exactly follows binary subdivision: eight jumps of 32 at offsets `0`, `16`, `8`, `24`, `4`, and so on. Each query computes the bit-reversed cycle offset without an intermediate array. When the next power of two does not divide `b`, or there are fewer than three jumps, a descending-half interleave preserves uniqueness and the minimum gap. The unmodified subdivision formula would omit buckets or violate the gap in those cases; for example `(64, 32)` would otherwise include the adjacent pair `32, 16`.

`color_hue(index)` converts `f(256, 32, index)` to CSS HSL degrees by multiplying by `360 / 256`. There are 256 buckets; CSS hue itself uses a 360-degree turn.

### Key space and button ordering

Single-key automatic and static buttons and both ordinary and flick virtual keys share the same mapping. Colors stay attached to the key when other controls register or the automatic alphabet changes. Letter case and key aliases normalize before indexing.

`key_color_index(key)` returns the slot; `key_color_hue(key)` returns its CSS hue. Printable characters use their lowercase Unicode code point within ASCII `33–126` or Latin-1 `160–255`. Unsupported characters such as emoji and characters above byte 255 have no color. Control-code slots are reserved for named keys:

| Named keys | Indices |
| --- | --- |
| Home, End, PageUp, PageDown, Insert | 2, 3, 4, 5, 6 |
| Backspace, Tab, Enter | 8, 9, 13 |
| Shift, Control, Alt, Meta, CapsLock | 16, 17, 18, 19, 20 |
| Escape | 27 |
| Left, Right, Up, Down | 28, 29, 30, 31 |
| Space, Delete | 32, 127 |
| F1–F24 | 128–151 |
| Pause, PrintScreen, ScrollLock, NumLock, ContextMenu | 152–156 |

`special_key_color_indices` exports the frozen named-key mapping. For portable `ctrl` / `mod` aliases, use `shortcut_color_hue(shortcut, index?, platform?)`, which resolves them using the shortcut platform (`'mac'`, `'windows'`, or `'linux'`). Actual event key names such as `Control` identify the literal physical modifier.

Multi-key automatic buttons use their zero-based position in the ordered automatic token list. Multi-key static buttons use their zero-based registration order among multi-key static bindings in the frame; single-key static bindings do not consume those positions. Static descriptions cache normalized `keys` and `color_index` for custom displays. Indices `256` and above receive no color. Automatic and static ordinals are separate spaces, so the same ordinal can have the same color. Buttons without an assigned route also have no highlight color.

`shortcut_color_hue(shortcut, index?, platform?)` implements this rule for custom applications: a single key uses its shared key index; a multi-key route uses the supplied sequential index. It returns `undefined` when no valid index exists. Keep this result absent in your styles to preserve the no-color behavior. Virtual key components still accept an explicit `color` override.
