# Keyflow

A reusable interaction system extracted from minh.website: keyboard-routed buttons, translucent shortcut labels, color-flood transitions, persistent themes and grid zoom, and lockstep page scrolling.

Built for **Svelte 5**, with no SvelteKit or site-content dependency. Mount one `Keyflow` root and one `Document` per page. State and preferences are shared across that application; independent embedded instances are not supported. The optional stylesheet sets document-wide typography, colors, and overflow for this full-page user flow.

## Add to your project
```sh
pnpm add https://github.com/legitminh/keyflow/releases/download/v0.1.2/legitminh-keyflow-0.1.2.tgz

pnpm check
pnpm build
```

## Try it

Use Node 24 and pnpm 9:

```sh
pnpm install --frozen-lockfile
pnpm demo
```

The standalone Vite demo is in `examples/demo`. It includes shortcut controls, a text input, themes, zoom, native scrolling, and an anchor destination.

## Use in another website

Install the archive from GitHub Releases using the command above; the package is not published to npm. To build an installable archive locally:

```sh
pnpm build
pnpm pack
```

Copy `legitminh-keyflow-0.1.2.tgz` into the consuming project's `vendor/` directory, then install it:

```sh
pnpm add ./vendor/legitminh-keyflow-0.1.2.tgz
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

Choose shortcut registration and ordering independently:

| Component | Priority | Shortcut active offscreen? |
| --- | --- | --- |
| `Button` / `Interactable`, omit `priority` | Automatic positional ordering | Yes |
| `Button` / `Interactable`, set `priority` | Explicit numeric ordering (lower first) | Yes |
| `ButtonPositional` / `InteractablePositional` | Automatic positional ordering | No |

For **persistent positional** controls, use `Button` or `Interactable` without a `priority` prop. Their shortcuts remain registered while offscreen and are removed when the component unmounts. `Button` displays the assigned shortcut; `Interactable` wraps custom content without adding a shortcut label.

```svelte
<Button on_close={handleClick}>Persistent positional button</Button>
<Interactable on_close={handleClick}>Custom persistent positional control</Interactable>
<Button priority={0} on_close={handleClick}>Persistent with explicit priority</Button>
```

Import these components from `@legitminh/keyflow`. Persistence keeps the shortcut active; it does not pin the control onscreen or guarantee an unchanged shortcut as other controls register or reorder.

Shortcut sequences grow as the number of registered controls increases; Escape clears partial input. Typing in inputs, textareas, selects, or editable content does not trigger shortcuts. Modifier shortcuts remain available to the browser.

`Link` waits for the color flood before assigning `window.location.href`, so it works with normal documents and full-page navigation. For client-side routing, pass your router callback to `ButtonPositional` and await `flood_covered()` before navigation.

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

Browser tests cover shortcut activation, form input, saved preferences, paging, anchor navigation, and native scrolling. To use an existing Chrome installation, set `CHROME_PATH` when running `pnpm test:browser`.

Before updating a consumer, increase the version in `package.json`, validate, pack, and install the new archive. Keep content, routing, media, and site-specific effects in the consuming project. Package source lives in `src/lib`; `dist` and declarations are generated by `@sveltejs/package`.
