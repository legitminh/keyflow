# Keyflow

A reusable interaction system extracted from minh.website: keyboard-routed buttons, translucent shortcut labels, color-flood transitions, persistent themes and grid zoom, and lockstep page scrolling.

Built for **Svelte 5**, with no SvelteKit or site-content dependency. Mount one `Keyflow` root and one `Document` per page. State and preferences are shared across that application; independent embedded instances are not supported. The optional stylesheet sets document-wide typography, colors, and overflow for this full-page user flow.

## Input frames and virtual keyboards

**Recommended client approach:** create reusable InputFrame references for each page substate, dropdown, dialog, or picker, and navigate with `input_frame_manager.push(frame)` / `pop()`. `Keyflow` supplies the permanent root. Every Interactable registers to its frame; only the stack's top frame can respond to keys or direct clicks. Popping restores the previous bindings without manual deregistration. Stack order is independent of DOM nesting.

```svelte
<Button on_close={() => input_frame_manager.push(menuFrame)}>Open menu</Button>
<InputFrame frame={menuFrame}>
  <Button on_close={() => input_frame_manager.pop()}>Back</Button>
</InputFrame>
```

Physical and virtual keys share one path: discrete key signals → keystroke management → active frame bindings → InputToken → action. An action can push another state, return to the previous one, or perform any client effect.

The new `VirtualKeyboard` provides color-coded text keycaps in flick-alpha, alpha, alphanumeric, 60%, ortholinear, 4×4, and 4×8 layouts, with an optional toolbar. Touch and mouse input follow the same shortcut path as hardware. The default flick-alpha preset uses a simple 3×10 ortholinear grid with number-up and uppercase-down gestures. `FlickKeyDisplay` translates releases beyond each edge into independently configurable keys; layouts can mix flick and regular keys. `KeyboardDisplay` and `KeyboardKeyDisplay` support custom geometry and key behavior; `create_keyboard_store` and `ActiveKeyboard` manage a project's layouts and nullable active selection.

Read the [migration guide and complete API examples](docs/input-frames-and-keyboards.md) before updating a client. The default demo (`/`, also `/stack`) starts with flick alpha in a persistent lower-half keyboard dock; E/Choose keyboard opens the frame menu for all seven layouts plus a mixed example. See the [flick guide and complete mapping](docs/flick-keyboards.md), or `/frames` for more customization examples. The [implementation plan](docs/implementation-plan.md) records the scope and validation strategy.

`TextBox` adds an input-owning editing frame with reactive entry/exit shortcuts, native textarea selection/IME/emoji support, and shared physical/virtual editing. Bind its instance and call `enter()` / `exit()` from any client button; `enterTrigger={null}` and `showEntry={false}` let your controls own entry. In the demo, click **Keyboard text editor** or press T, then exit with Escape. See the [TextBox guide](docs/textbox.md) for the typed API and complete client examples, or visit `/controls` for custom openers and hover buttons.

## Add to your project
```sh
pnpm add https://github.com/legitminh/keyflow/releases/download/v0.6.0/legitminh-keyflow-0.6.0.tgz

pnpm check
pnpm build
```

## Try it

Use Node 24 and pnpm 9:

```sh
pnpm install --frozen-lockfile
pnpm demo
```

The standalone Vite demo is in `examples/demo`. The default `/` (also `/stack`) provides tablet-sized flick keys and a keyboard-selection frame menu above a persistent half-screen dock. `/frames` adds keyboard customization examples. `/flow` retains shortcut controls, text input, themes, zoom, native scrolling, and anchor navigation.

## Develop alongside Notework

For rapid iteration, run `pnpm dev:package` in this repository and link Keyflow into your local Notework checkout once. Package output then rebuilds as you edit; no release or version bump is needed. Notework already supports Git-commit updates with `pnpm update:keyflow` for shared builds. See the [local development workflow](docs/development.md) for the exact commands and how to switch back to a pinned dependency.

## Use in another website

Install the archive from GitHub Releases using the command above; the package is not published to npm. To build an installable archive locally:

```sh
pnpm build
pnpm pack
```

Copy `legitminh-keyflow-0.6.0.tgz` into the consuming project's `vendor/` directory, then install it:

```sh
pnpm add ./vendor/legitminh-keyflow-0.6.0.tgz
```

Commit that archive and the consumer's lockfile so a clean checkout needs neither this source repository nor private registry access.

```svelte
<script lang="ts">
  import {
    Keyflow,
    Document,
    LineText,
    ButtonPositional,
    ThemeToggle,
    Link
  } from '@legitminh/keyflow';
  import '@legitminh/keyflow/styles.css';

  let count = $state(0);
</script>

<Keyflow>
  <Document>
    <LineText><h1>My project</h1></LineText>
    <LineText>
      <ButtonPositional on_close={() => count++}>count: {count}</ButtonPositional>
    </LineText>
    <LineText><ThemeToggle /></LineText>
    <LineText><Link href="/about">about</Link></LineText>
  </Document>
</Keyflow>
```

Within each input frame, choose registration and ordering independently:

| Component | Priority | Shortcut active offscreen? |
| --- | --- | --- |
| `Button` / `Interactable`, omit `priority` | Automatic positional ordering | Yes |
| `Button` / `Interactable`, set `priority` | Explicit numeric ordering (lower first) | Yes |
| `ButtonPositional` / `InteractablePositional` | Automatic positional ordering | No |
| `HoverButton`, omit `priority` | Automatic positional ordering | Yes |
| `HoverButton`, set `priority` | Explicit numeric ordering (lower first) | Yes |
| `HoverButtonPositional` | Automatic positional ordering | No |

For **persistent positional** controls, use `Button` or `Interactable` without a `priority` prop. Their shortcuts remain registered while offscreen and are removed when the component unmounts. `Button` displays the assigned shortcut; `Interactable` wraps custom content without adding a shortcut label.

```svelte
<Button on_close={handleClick}>Persistent positional button</Button>
<Interactable on_close={handleClick}>Custom persistent positional control</Interactable>
<Button priority={0} on_close={handleClick}>Persistent with explicit priority</Button>
```

Import these components from `@legitminh/keyflow`. Persistence keeps the shortcut active; it does not pin the control onscreen or guarantee an unchanged shortcut as other controls register or reorder.

### Press, cursor and elapsed time

Buttons, interactables and keyboard keys accept `on_pressed_down`, `on_pressed_up`, `on_cursor_enter` and `on_cursor_exit`. Cursor callbacks cover mouse/pen movement and touch contacts, including dragging between keys. Keyboard focus stays separate. Up/exit events include `duration_ms`, pointer/key metadata, and cancellation details.

```svelte
<Button
  on_pressed_down={startPreview}
  on_pressed_up={(event) => {
    stopPreview();
    if (!event.cancelled) recordHold(event.duration_ms);
  }}
  on_cursor_enter={showHint}
  on_cursor_exit={hideHint}
  on_close={save}
>Save</Button>
```

Keyboard components accept shared defaults and per-key overrides. The `interaction` action and `create_interaction()` controller support custom elements and adapters. See the [interaction guide](docs/interactions.md) for timing, cancellation and migration from the deprecated `on_enter`/`on_exit` callbacks, or run `/interactions`.

### Dropdowns and submenus

`SubKeyframe` manages a shortcut-enabled trigger, item list, owned frame, nested menus, Back/Escape, outside-click dismissal and return focus. Add items or custom children without implementing frame plumbing:

```svelte
<SubKeyframe label="File" enterTrigger="f" items={[
  { label: 'New', on_select: createFile },
  { label: 'Open', keys: 'o', on_select: openFile },
  { label: 'Export', items: [
    { label: 'PDF', on_select: exportPdf },
    { label: 'Text', on_select: exportText }
  ] }
]} />
```

Use `children(context)` to append custom controls, `bind:open` for state, or `bind:this` for `enter()` / `exit()` / `toggle()`. See the [SubKeyframe guide](docs/subkeyframes.md) or run `/menus`.

### Hover buttons

`HoverButton` and `HoverButtonPositional` render custom content with the assigned key path and entered/pending progress overlaid at the top right on mouse hover or keyboard focus. The overlay takes no layout space. Their shortcuts work even when the overlay is hidden, and they share regular buttons' activation feedback and InputFrame gating. The path is excluded from the accessible name, so give the content a descriptive action label.

```svelte
<script lang="ts">
  import { HoverButton, HoverButtonPositional } from '@legitminh/keyflow';
  let count = $state(0);
</script>

<HoverButton priority={0} on_close={() => count++}>Count: {count}</HoverButton>
<HoverButtonPositional on_close={() => count++}>Count here: {count}</HoverButtonPositional>
```

`HoverButton` accepts `children`, `on_close`, and optional `priority`, matching `Button`. `HoverButtonPositional` accepts `children`, `on_close`, and optional `flood`, matching `ButtonPositional`; it registers only while visible and uses positional ordering. Hover controls can open a textbox by calling its bound `enter()` method; see [custom textbox openers](docs/textbox.md#open-from-any-client-control). For touch interfaces that need persistent shortcut hints, use `Button` or `ButtonPositional`.

Shortcut sequences grow as the number of registered controls increases; Escape clears partial input. Typing in inputs, textareas, selects, or editable content does not trigger shortcuts. Unregistered modifier shortcuts remain available to the browser.

## Static shortcuts

`StaticInteractable` fixes an exact input sequence to custom clickable content. `StaticButton` adds the same entered/pending shortcut display used by automatic buttons, with optional `flood` animation. Both remain registered offscreen until unmounted.

```svelte
<script lang="ts">
  import { StaticButton, StaticInteractable } from '@legitminh/keyflow';
</script>

<StaticButton keys={['ctrl', 'k']} on_close={openSearch}>Search</StaticButton>
<StaticButton keys="abc" on_close={runAction}>Run action</StaticButton>
<StaticButton keys={['esc', 'a']} on_close={goBack}>Go back</StaticButton>
<StaticInteractable keys="z" on_close={customAction}>Custom content</StaticInteractable>
```

A character string such as `"ab"` means press a then b. Use an array to include named keys, such as `['ctrl', 'k']`, `['shift', 'a']`, or `['esc', 'a']`. A recognized single name such as `"esc"` or `"shift"` binds that key alone; to spell a word that is also a key name, use individual character array entries. A literal `+` is an ordinary character key, never a sequence separator.

All keys follow the same rules: keydown order defines the sequence, keys may overlap or be released between presses, and the action runs once every participating key has been released. Sequences have no timeout. Repeated presses such as `"aab"` work; keyboard auto-repeat does not advance the sequence. Letter matching and displayed letters are always lowercase: `a` and `A` identify the same key. Displays concatenate their key symbols directly, such as `ab`, `⌘k`, or `⇧a`.

### Conflicts and automatic assignment

Static bindings must be unique and prefix-free within their InputFrame; different frames may reuse the same bindings. If `"a"` is bound, adding `"ab"` throws `RangeError`; adding `"a"` when `"ab"` exists also throws. The same applies to every key: `"esc"` conflicts with `['esc', 'a']`, and `"shift"` conflicts with `['shift', 'a']`. Siblings such as `"ab"` and `"ac"` are valid. OS aliases are resolved before checking conflicts. Rejected registrations leave existing bindings and reservations intact.

Every single-character key in a mounted static binding is reserved from its frame’s automatic alphabet. `"ab"` reserves `a` and `b`; `['ctrl', 'k']` reserves `k`. Reservations are shared: a key returns only after its last static binding changes or unmounts. `set_available_keys()` preserves mounted reservations.

`Button`, `Interactable`, `ButtonPositional`, and `InteractablePositional` keep their existing automatic assignment and priority behavior, using the remaining alphabet. As positional controls enter or leave view, their routes grow, shrink, or reorder while static bindings remain fixed. Static controls do not consume automatic token positions. Changes to automatic routes clear pending automatic input; a pending static sequence remains valid across automatic registration changes.

If reservations exhaust the automatic pool, automatic controls retain pointer activation and show no shortcut. A one-key effective pool supports one automatic control; multiple automatic controls need at least two available keys. Static bindings continue working independently.

### OS mapping and symbols

`ctrl`, `mod`, and `primary` map to Command on macOS and Control on Windows/Linux. `control` means literal Control; `command`, `cmd`, and `meta` mean literal Command/Meta. OS mapping changes a key's identity and label, while input matching still treats it as an ordinary sequence step.

| Binding | macOS label | Windows label |
| --- | --- | --- |
| `['ctrl', 'k']` | `⌘k` | `ctrlk` |
| `['control', 'k']` | `⌃k` | `ctrlk` |
| `['command', 'k']` | `⌘k` | `⊞k` |
| `['shift', 'k']` | `⇧k` | `⇧k` |
| `['alt', 'k']` | `⌥k` | `altk` |
| `'esc'` | `⎋` | `⎋` |
| `['esc', 'a']` | `⎋a` | `⎋a` |

Other defaults include `⇥` (tab), `⏎` (enter), `⌫` (backspace), `⌦` (delete), `␣` (space), and arrow symbols. `key_symbols`, `format_shortcut(keys, platform?)`, and `detect_shortcut_platform()` are exported for custom displays. `StaticButtonDisplay` and the bindable `StaticInteractable.myToken` support composing custom visualizers.

The browser detects the platform. Override it with `<Keyflow options={{ platform: 'mac' }}>` (`'mac'`, `'windows'`, `'linux'`, or `'auto'`). Registration and static labels initialize in the browser; `format_shortcut()` defaults to Windows during SSR. Keys use the lowercase `KeyboardEvent.key` value, so shifted punctuation and Option-produced characters follow the active layout. OS/browser input that never reaches the page cannot be captured. See [KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).

### Lifecycle and performance

A mismatched key clears the pending static sequence and can start a new sequence. Focus changes, window blur, hidden pages, composition input, and binding changes clear pending input. Form fields and editable content keep normal typing behavior. Recognized static steps prevent browser defaults. The existing automatic Escape reset and handling of unregistered browser modifier shortcuts are preserved. Clicking a static control invokes its token only while its frame is active.

Static input uses constant-time trie transitions per event. Each visualizer checks its cached path without searching other controls. Automatic routes and indices are rebuilt only when registration, ordering, or the effective alphabet changes. Automatic queries and each display take linear time in shortcut length; rendering across displays is linear in their combined shortcut lengths.

Run `pnpm demo` and visit `/static` for static sequences, OS previews and dynamic bindings, or `/mixed` to see static and visibility-based positional controls together.

## Layout components

`LineText`, `Indent`, and `Image` are public package exports. `LineText` limits text to 32 grid cells with quarter-cell side margins and registers the block for scroll-aware paging. `Indent` adds one grid cell of left padding. Both follow the current zoom setting.

```svelte
<script lang="ts">
  import { LineText, Indent, Image } from '@legitminh/keyflow';
</script>

<LineText>Introduction</LineText>
<Indent>
  <LineText>Indented content</LineText>
  <Image href="/images/project.jpg" alt="Project screenshot" maxWidth="100%" />
</Indent>
```

`Image` keeps the original defaults: automatic width and height, `maxWidth="75vw"`, `maxHeight="75vh"`, and `fit="contain"`. Use `width` and `height` (CSS lengths or pixel numbers), `maxWidth`, `maxHeight`, and `fit` to adapt the layout. Native image attributes such as `loading`, `srcset`, `sizes`, and `class` are forwarded. Supply `href` for the image source and `alt` for accessible text. Images register with `must_view` so lockstep paging avoids splitting them when possible.

## Configure the flow

Pass initial options to `Keyflow`. They are read on mount; saved session preferences take precedence over initial theme, size, and scrolling defaults.

```svelte
<Keyflow
  options={{
    storagePrefix: 'my-project:',
    minBox: 40,
    themeId: 0,
    lockstep: true,
    keys: ['a', 's', 'd', 'f'],
    themes: [
      {
        name: 'paper',
        name_to_color: {
          '--primary': '#222222',
          '--secondary': '#eeeeee',
          '--tertiary': '#777777',
          '--background': '#ffffff'
        }
      },
      {
        name: 'night',
        name_to_color: {
          '--primary': '#eeeeee',
          '--secondary': '#222222',
          '--tertiary': '#999999',
          '--background': '#111111'
        }
      }
    ]
  }}
>
  <!-- Document and content -->
</Keyflow>
```

### Shortcut key sets

`options.keys` sets the ordered pool of keys used to assign shortcuts automatically. Use an exported preset or a custom array:

```svelte
<script lang="ts">
  import { Keyflow, key_presets } from '@legitminh/keyflow';
</script>

<Keyflow options={{ keys: key_presets.letters }}>
  <!-- Document and content -->
</Keyflow>
```

| Preset | Keys, in assignment order | Count |
| --- | --- | --- |
| `key_presets.default` | `1234qwerasdfzxcv` | 16 |
| `key_presets.letters` | `abcdefghijklmnopqrstuvwxyz` | 26 |
| `key_presets.alphanumeric` | `abcdefghijklmnopqrstuvwxyz0123456789` | 36 |
| `key_presets.numeric` | `0123456789` | 10 |

Omitting `keys` uses the original 16-key default. The letters and alphanumeric presets use Latin letters A–Z; key matching is case-insensitive. The presets are read-only arrays.

For custom keys, pass an array such as `keys: ['a', 's', 'd', 'f']`. Supply at least two unique single-character keys; values are normalized to lowercase, and invalid configurations throw `RangeError`. Array order controls key assignment. When there are more registered controls than keys, Keyflow assigns longer sequences automatically.

Options are read on mount. To change the key set while running, use the existing public setter:

```ts
import { key_presets, set_available_keys } from '@legitminh/keyflow';

set_available_keys(key_presets.numeric);
// Or use a custom ordered pool:
set_available_keys(['j', 'k', 'l', ';']);
```

Changing the pool clears partial keyboard input and recalculates all displayed shortcuts.

### Theme and layout settings

The original site's `dark` and `light` toggle labels are preserved; supply named themes to change them. `ThemeToggle` cycles all configured themes. Grid size is measured in pixels. Storage failures fall back to in-memory preferences.

Use the exported reactive state for settings controls:

```ts
import { min_box, lockstep_scrolling, set_theme_id } from '@legitminh/keyflow';
min_box.set(48);
lockstep_scrolling.set(false);
set_theme_id(0);
```

Import the stylesheet once at the root. Override `--font-mono` and `--font-geist-mono` in your own stylesheet. Set theme colors through `themes` so switching themes retains your palette. `LineText` and `Indent` follow `--min-box`. Attach `use:must_view` to blocks paging should avoid splitting; blocks taller than a page can still be paged through.

Native mode preserves the visible scroll position when switching to or from lockstep mode. `Camera` observes viewport and content size changes and handles initial hashes and `hashchange`. Host routers should call `scroll_to_hash()` after their DOM update. For SvelteKit, put this in the root layout:

```ts
import { afterNavigate } from '$app/navigation';
import { tick } from 'svelte';
import { scroll_to_hash } from '@legitminh/keyflow';
afterNavigate(async () => {
  await tick();
  scroll_to_hash();
});
```

## Validate and release locally

```sh
pnpm check
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
```

Browser tests cover flick directions/cancellation/real touch dragging, half-screen docking, frame masking/restoration, virtual keyboard layouts and mouse/touch activation, custom key adapters, shortcut activation, form input, saved preferences, paging, anchor navigation, and native scrolling. To use an existing Chrome installation, set `CHROME_PATH` when running `pnpm test:browser`.

For a published release, commit completed features and run `pnpm release` (patch) or `pnpm release minor`. The script validates, bumps, packs, pushes, waits for CI, publishes and verifies the GitHub Release. `--dry-run` previews the plan and `--resume` retries an interrupted release commit without bumping again. See [PUBLISH.md](PUBLISH.md) for options and prerequisites.

For manual publication, follow the version/build/archive steps in PUBLISH.md. Keep content, routing, media, and site-specific effects in the consuming project. Package source lives in `src/lib`; `dist` and declarations are generated by `@sveltejs/package`.
