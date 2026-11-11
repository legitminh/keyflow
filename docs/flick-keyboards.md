# Flick keys

Flick keys extend the existing virtual keyboard input path. A gesture selects one key translation; the existing `press_virtual_key` adapter emits its keydown/keyup pair, the active InputFrame resolves its token, and the token performs its action. No frame, token, or keystroke-management architecture changes are required.

## Use flick alpha

```svelte
<script lang="ts">
  import { VirtualKeyboard } from '@legitminh/keyflow';
</script>

<VirtualKeyboard variant="flick-alpha" />
```

`keyboard_layouts['flick-alpha']` has the same three QWERTY letter rows as `alpha`. Tapping enters the letter. Directional hints show the other available inputs. This default covers the logical key identities of a US desktop keyboard: all letters, digits and punctuation, space, modifiers, editing/navigation keys, locks, and F1–F12. Numpad keys share their ordinary key values; physical left/right modifier or numpad locations are not distinct input identities in Keyflow. Letter matching remains case-insensitive. Shift and Caps Lock emit named sequence steps; they do not latch or change the displayed layout. Custom text/editor adapters can implement their own shift/case behavior.

Assignments follow these groups:

- Top-row up flicks enter 1–0; right flicks enter the corresponding shifted digit symbols; down flicks enter F1–F10.
- Home-row up/right flicks enter paired plain/shifted punctuation. Home/bottom down flicks provide F11/F12 and desktop navigation/control keys.
- Bottom-row up/right flicks provide the remaining punctuation plus space, Enter, Backspace, Delete, Escape, Tab and modifiers.
- Left flicks repeat frequent editing, navigation and modifier keys, including a cluster of Space gestures along the bottom row.

The full mapping is listed below. Built-ins are deeply frozen; copy a layout to change its assignments.

## Define a generalized flick key

```svelte
<script lang="ts">
  import { FlickKeyDisplay } from '@legitminh/keyflow';
</script>

<FlickKeyDisplay
  key="a"
  flick={{
    up: '1',
    down: { key: 'enter', label: 'Return' },
    left: 'backspace',
    right: '!'
  }}
/>
```

`key` is the tap translation. `flick` is a partial map of `up`, `down`, `left`, and `right` to a single key string or `{ key, label? }`. Strings are individual characters or supported named keys, not key sequences. Each translation may be chosen independently; labels only change its visual hint. `FlickKeyDisplay` accepts the usual key display props: `label`, `color`, `width`, `disabled`, `pressed`, `children`, `class`, and `onkey`. Children customize its center face. `onkey` replaces the default key handler exactly as with ordinary virtual keys.

The gesture rules are deterministic:

1. Primary-button mouse, touch, or pen down starts capture on that key. No input is emitted yet. Secondary mouse buttons and additional contacts on that same key are ignored.
2. Release within the original key rectangle (including its border) emits the tap translation. Going outside and returning inside before release is a tap.
3. Release beyond its top, bottom, left, or right border emits that direction's translation. There is no speed or timeout requirement. The original key owns the gesture even when released over a neighboring key.
4. Diagonal releases use the greatest border overrun divided by that axis's key size. Vertical wins exact ties.
5. An undefined direction cancels the gesture. It does not fall back to the center key.
6. Pointer cancellation, lost capture, window blur, disabling the key, replacing its key/mapping/adapter, or unmounting the source aborts the gesture without emitting input. The compatibility click after a pointer release is ignored, so a flick cannot also emit a tap.

Flick keys preserve pointer focus and use `touch-action: none` so dragging on a key selects a gesture instead of scrolling the page. Keep them in a stable container while dragging. Keyboard users can Tab to a key and press Enter/Space for its tap input, or Alt+ArrowUp/Down/Left/Right for a mapped flick. Screen readers receive descriptions of the mappings. Direction selection is highlighted while dragging. Override `--keyboard-flick-hint-size` to change the hint font size; the existing keyboard color/size variables still apply.

## Mix regular and flick keys

Set the optional `flick` field on any `KeyboardKey`. `KeyboardDisplay` automatically renders a FlickKeyDisplay for those keys; keys without that field use KeyboardKeyDisplay. This also works through VirtualKeyboard and ActiveKeyboard. A custom `keyDisplay` snippet takes precedence over both defaults.

```svelte
<script lang="ts">
  import { KeyboardDisplay, create_grid_keyboard, keyboard_layouts } from '@legitminh/keyflow';
  const mixed = create_grid_keyboard('my-keyboard', [
    { key: 'a', flick: { up: '1', down: 'escape' } },
    { key: 'b', color: '#c66b24' }, // ordinary tap key
    { key: 'space', label: 'Space', width: 2 }
  ], 3, 'My keyboard');

  const customAlpha = {
    ...keyboard_layouts['flick-alpha'],
    id: 'my-flick-alpha',
    rows: keyboard_layouts['flick-alpha'].rows.map(row => row.map(key =>
      key.key === 'q' ? { ...key, flick: { ...key.flick, up: '9' } } : key))
  };
</script>

<KeyboardDisplay layout={mixed} />
<KeyboardDisplay layout={customAlpha} />
```

Register a custom layout with the same `create_keyboard_store().add(layout)` API as other keyboards. KeyboardKey's optional `flick` field is the only layout-model addition. A custom renderer can use `resolve_flick_direction(bounds, clientX, clientY)` and `flick_translation_key(translation)` with its own gesture UI.

## Tablet demo

Run `pnpm demo`. The default `/` page (also `/stack`) starts with flick alpha. Its stable keyboard dock occupies the bottom `50dvh`; the top half scrolls independently. Tap **Choose keyboard** or input E to push the keyboard-selection InputFrame. Choose any of the seven built-in types, or the mixed regular/flick sample; selecting it updates the keyboard and pops back to the page. A/Back closes the menu. Keycaps remain available while the menu masks the page's action controls.

Enable **Text playground** to inspect actual emitted characters and named keys without invoking page shortcuts. The toolbar switches back to shortcut mode before opening the menu. `/frames` retains additional customization/store examples with the same half-screen dock; `/flow` retains the original scrolling demo.

The dock styling belongs to the demo, so library clients can choose their own placement. The essential layout is a content area with `height: 50dvh; overflow: auto` plus a persistent keyboard container with `position: fixed; inset: auto 0 0; height: 50dvh`. Give KeyboardDisplay `height: 100%`, its rows `flex: 1; min-height: 0`, and set `--keyboard-key-height: 0px` so keys fill the available rows. Reserve any safe-area padding in the dock's box sizing.

## Default mapping

| Tap | Up | Down | Left | Right |
| --- | --- | --- | --- | --- |
| <code>q</code> | <code>1</code> | <code>f1</code> | <code>escape</code> | <code>!</code> |
| <code>w</code> | <code>2</code> | <code>f2</code> | <code>tab</code> | <code>@</code> |
| <code>e</code> | <code>3</code> | <code>f3</code> | <code>capslock</code> | <code>#</code> |
| <code>r</code> | <code>4</code> | <code>f4</code> | <code>insert</code> | <code>$</code> |
| <code>t</code> | <code>5</code> | <code>f5</code> | <code>home</code> | <code>%</code> |
| <code>y</code> | <code>6</code> | <code>f6</code> | <code>pageup</code> | <code>^</code> |
| <code>u</code> | <code>7</code> | <code>f7</code> | <code>pagedown</code> | <code>&amp;</code> |
| <code>i</code> | <code>8</code> | <code>f8</code> | <code>end</code> | <code>*</code> |
| <code>o</code> | <code>9</code> | <code>f9</code> | <code>delete</code> | <code>(</code> |
| <code>p</code> | <code>0</code> | <code>f10</code> | <code>backspace</code> | <code>)</code> |
| <code>a</code> | <code>-</code> | <code>f11</code> | <code>shift</code> | <code>_</code> |
| <code>s</code> | <code>=</code> | <code>f12</code> | <code>control</code> | <code>+</code> |
| <code>d</code> | <code>[</code> | <code>capslock</code> | <code>alt</code> | <code>{</code> |
| <code>f</code> | <code>]</code> | <code>contextmenu</code> | <code>meta</code> | <code>}</code> |
| <code>g</code> | <code>\</code> | <code>insert</code> | <code>enter</code> | <code>&#124;</code> |
| <code>h</code> | <code>;</code> | <code>home</code> | <code>backspace</code> | <code>:</code> |
| <code>j</code> | <code>'</code> | <code>pageup</code> | <code>delete</code> | <code>"</code> |
| <code>k</code> | <code>,</code> | <code>arrowup</code> | <code>pageup</code> | <code>&lt;</code> |
| <code>l</code> | <code>.</code> | <code>end</code> | <code>pagedown</code> | <code>&gt;</code> |
| <code>z</code> | <code>/</code> | <code>printscreen</code> | <code>space</code> | <code>?</code> |
| <code>x</code> | <code>`</code> | <code>scrolllock</code> | <code>space</code> | <code>~</code> |
| <code>c</code> | <code>space</code> | <code>pause</code> | <code>space</code> | <code>tab</code> |
| <code>v</code> | <code>enter</code> | <code>numlock</code> | <code>space</code> | <code>shift</code> |
| <code>b</code> | <code>backspace</code> | <code>arrowleft</code> | <code>enter</code> | <code>control</code> |
| <code>n</code> | <code>delete</code> | <code>arrowdown</code> | <code>backspace</code> | <code>alt</code> |
| <code>m</code> | <code>escape</code> | <code>arrowright</code> | <code>delete</code> | <code>meta</code> |
