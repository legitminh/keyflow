# Flick keys

Flick keys extend the existing virtual keyboard input path. A gesture selects one key translation; the existing `press_virtual_key` adapter emits its keydown/keyup pair, the active InputFrame resolves its token, and the token performs its action. No frame, token, or keystroke-management architecture changes are required.

## Use flick alpha

```svelte
<script lang="ts">
  import { VirtualKeyboard } from '@legitminh/keyflow';
</script>

<VirtualKeyboard variant="flick-alpha" />
```

`keyboard_layouts['flick-alpha']` is a 3×10 ortholinear grid with equal-width keys:

```text
q w e r t y u i o p
a s d f g h j k l ;
z x c v b n m , . ␣
```

Tapping enters the primary character (`␣` is Space). The only flick assignments are:

- Top-row up: 1–0, from Q through P.
- Every letter down: its uppercase character.
- B left/right: `[` / `]`; C left/right: `{` / `}`.
- Semicolon up: `:`; comma left/right: `<` / `>`.
- Space up/down/left/right: the corresponding arrow key.

All other directions are unbound and cancel. The period key has no flick assignments. Printable casing is preserved in virtual input events and text adapters, so down from A emits `A`; InputFrame shortcut matching remains case-insensitive. Directional hints preserve uppercase too.

The complete mapping is listed below. Built-ins are deeply frozen; copy a layout to customize it.

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
| <code>q</code> | <code>1</code> | <code>Q</code> | — | — |
| <code>w</code> | <code>2</code> | <code>W</code> | — | — |
| <code>e</code> | <code>3</code> | <code>E</code> | — | — |
| <code>r</code> | <code>4</code> | <code>R</code> | — | — |
| <code>t</code> | <code>5</code> | <code>T</code> | — | — |
| <code>y</code> | <code>6</code> | <code>Y</code> | — | — |
| <code>u</code> | <code>7</code> | <code>U</code> | — | — |
| <code>i</code> | <code>8</code> | <code>I</code> | — | — |
| <code>o</code> | <code>9</code> | <code>O</code> | — | — |
| <code>p</code> | <code>0</code> | <code>P</code> | — | — |
| <code>a</code> | — | <code>A</code> | — | — |
| <code>s</code> | — | <code>S</code> | — | — |
| <code>d</code> | — | <code>D</code> | — | — |
| <code>f</code> | — | <code>F</code> | — | — |
| <code>g</code> | — | <code>G</code> | — | — |
| <code>h</code> | — | <code>H</code> | — | — |
| <code>j</code> | — | <code>J</code> | — | — |
| <code>k</code> | — | <code>K</code> | — | — |
| <code>l</code> | — | <code>L</code> | — | — |
| <code>;</code> | <code>:</code> | — | — | — |
| <code>z</code> | — | <code>Z</code> | — | — |
| <code>x</code> | — | <code>X</code> | — | — |
| <code>c</code> | — | <code>C</code> | <code>{</code> | <code>}</code> |
| <code>v</code> | — | <code>V</code> | — | — |
| <code>b</code> | — | <code>B</code> | <code>[</code> | <code>]</code> |
| <code>n</code> | — | <code>N</code> | — | — |
| <code>m</code> | — | <code>M</code> | — | — |
| <code>,</code> | — | — | <code>&lt;</code> | <code>&gt;</code> |
| <code>.</code> | — | — | — | — |
| <code>space</code> | <code>arrowup</code> | <code>arrowdown</code> | <code>arrowleft</code> | <code>arrowright</code> |
