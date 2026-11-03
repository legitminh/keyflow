# Keyflow

A reusable interaction system extracted from minh.website: keyboard-routed buttons, translucent shortcut labels, color-flood transitions, persistent themes and grid zoom, and lockstep page scrolling.

Built for **Svelte 5**, with no SvelteKit or site-content dependency. Mount one `Keyflow` root and one `Document` per page. State and preferences are shared across that application; independent embedded instances are not supported. The optional stylesheet sets document-wide typography, colors, and overflow for this full-page user flow.

## Try it

Use Node 24 and pnpm 9:

```sh
pnpm install --frozen-lockfile
pnpm demo
```

The standalone Vite demo is in `examples/demo`. It includes shortcut controls, a text input, themes, zoom, native scrolling, and an anchor destination.

## Use in another website

The package is local and has not been published to npm. Build an installable archive:

```sh
pnpm build
pnpm pack
```

Copy `legitminh-keyflow-0.1.0.tgz` into the consuming project's `vendor/` directory, then install it:

```sh
pnpm add ./vendor/legitminh-keyflow-0.1.0.tgz
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

`ButtonPositional` registers shortcuts for visible controls and orders them by position. `Button` accepts an explicit `priority` for persistent controls. Shortcut sequences grow as the number of controls increases; Escape clears partial input. Typing in inputs, textareas, selects, or editable content does not trigger shortcuts. Modifier shortcuts remain available to the browser.

`Link` waits for the color flood before assigning `window.location.href`, so it works with normal documents and full-page navigation. For client-side routing, pass your router callback to `ButtonPositional` and await `flood_covered()` before navigation.

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

The default alphabet is `1234qwerasdfzxcv`. The original site's `dark` and `light` toggle labels are preserved; supply named themes to change them. `ThemeToggle` cycles all configured themes. Grid size is measured in pixels. Storage failures fall back to in-memory preferences.

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
