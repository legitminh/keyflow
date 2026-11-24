# Dropdowns, menus and SubKeyframe

`SubKeyframe` supplies the common menu structure: a shortcut-enabled disclosure button, an item list below it, a private input frame, nested submenus, and a Back control. Opening masks the parent frame's bindings. Back or Escape returns to the previous frame, with focus restored to the menu's trigger.

```svelte
<script lang="ts">
  import { SubKeyframe } from '@legitminh/keyflow';
</script>

<SubKeyframe label="File" enterTrigger="f" items={[
  { label: 'New', on_select: createFile },
  { label: 'Open', keys: 'o', on_select: openFile },
  { label: 'Export', items: [
    { label: 'PDF', on_select: exportPdf },
    { label: 'Text', on_select: exportText }
  ] }
]} />
```

No manual `InputFrame`, frame-stack operations, registration, or cleanup is needed. Fixed shortcuts must remain prefix-free within each menu, including its `exitTrigger`. Each item without `keys` receives an automatic route. `keys` binds a fixed shortcut. Item callbacks run after the menu closes, so they can open another frame from the restored parent. Nested selection closes its immediate menu; its parent remains open. Escape/Back always returns one level. Closing an ancestor unwinds all its descendants.

## Extend the list with custom controls

The `children` snippet is rendered after the list, inside this menu's frame and before Back. Its context provides `frame`, `active`, `open`, `enter()`, `exit()`, `toggle()` and `select(item)`.

```svelte
<script lang="ts">
  import { SubKeyframe, Button, TextBox } from '@legitminh/keyflow';
</script>

<SubKeyframe label="Actions" items={[
  { label: 'Save', on_select: save }
]}>
  {#snippet children(menu)}
    <Button on_close={() => menu.select({ label: 'Custom', on_select: customAction })}>
      Custom action
    </Button>
    <SubKeyframe label="More">
      {#snippet children(child)}
        <Button on_close={child.exit}>Return to Actions</Button>
        <TextBox enterTrigger="t" label="Notes" />
      {/snippet}
    </SubKeyframe>
  {/snippet}
</SubKeyframe>
```

Omit `items` to supply the entire body with `children`. Regular Keyflow controls automatically inherit the menu's frame. Native controls can call `menu.exit()` or `menu.select(item)`; `select` checks the active frame and applies the menu's close policy. Custom actions that should stay open can omit `select` and run directly, or set `closeOnSelect={false}`.

`triggerContent(context)` customizes the opener's content while retaining its shortcut, accessible `label`, and expanded state. `itemDisplay(item, context)` customizes an item's content while retaining its button, lifecycle callbacks, disabled state, and routing. The item list still uses native buttons and list semantics. ArrowUp/Down, Home and End navigate enabled controls; Tab retains normal browser navigation. Editing inputs retain their native arrow behavior.

## State and instance API

```svelte
<script lang="ts">
  import { SubKeyframe, type SubKeyframeController } from '@legitminh/keyflow';
  let menu = $state<SubKeyframeController>();
  let open = $state(false);
</script>

<button onclick={() => menu?.enter()}>Open actions</button>
<SubKeyframe bind:this={menu} bind:open label="Actions" showTrigger={false}
  enterTrigger={null} items={actions} />
```

`enter()` returns a promise after the opening render. It is a no-op before mounting, while disabled, when already open, or when its parent frame is inactive. `exit()` closes this menu and any descendants, even when a descendant is topmost. `toggle()` combines them. `frame` exposes the stable owned `InputFrameController` for advanced integration. The component owns its lifetime; avoid disposing it yourself.

`bind:open` is synchronized with the actual stack, including external pops/resets. A menu stays open while a child masks it. Setting the binding opens/closes it under the same parent-frame gate. The rendered trigger receives return focus; without that trigger, focus returns to the external opener captured at entry.

An outside mouse/touch click closes the open dropdown tree before the outside control's click action runs. It preserves the clicked target and does not steal its focus. `closeOnOutside={false}` opts out. Disabling or unmounting a menu closes its descendants and unregisters all owned bindings.

## Props and item shape

| Prop | Default / behavior |
| --- | --- |
| `label` | `'Menu'`; accessible trigger/panel label and initial frame name. |
| `items` | `[]`; readonly list of `SubKeyframeItem`. |
| `children(context)` | Extra/custom controls inside the owned frame. |
| `triggerContent(context)` | Custom trigger content. |
| `itemDisplay(item, context)` | Custom content for default list controls. |
| `enterTrigger` | `undefined` assigns an automatic route; a `Shortcut` is fixed; `null` disables keyboard entry. |
| `priority` | `0`; order of the automatic entry token. |
| `exitTrigger` | `'escape'`; reactive return shortcut. `null` leaves Back/API available. |
| `bind:open` | `false`; declarative open state synchronized with the stack. |
| `disabled` | `false`; disables entry and closes an open subtree. |
| `showTrigger` | `true`; hide for external openers. |
| `closeOnSelect` | `true`; return to the parent before invoking a leaf selection callback. |
| `closeOnOutside` | `true`; dismiss on an outside click/tap. |
| `backLabel` | `'Back'`; text of the built-in return button. |
| `onopen(context)`, `onclose(context)` | Actual inclusion/removal notifications, once per session. |
| `onselect(item, context)` | Selection notification, also forwarded through declarative nested lists. |
| Four press/cursor callbacks | Apply to the trigger; items can provide their own. |
| `class` | Root styling hook; `.subkeyframe-panel` and `.subkeyframe-items` can be styled by the client. |

Each item has `label`, optional stable `id`, `keys`, `disabled`, `on_select(item, context)`, and the four press/cursor callbacks. `closeOnSelect` overrides the containing policy. An `items` list turns the entry into another SubKeyframe and applies that policy to its children. Treat entries as either an action or a nested list; an entry with `items` opens its submenu rather than invoking `on_select`.

The component uses `section`, `ul`, and native button semantics rather than claiming an ARIA application menu. It supplies disclosure state, focus management, shortcuts and arrow navigation while remaining easy to extend with native inputs or custom controls.

Run `/menus` in the demo for list items, nested menus, custom content, an embedded editor, reactive bindings and lifecycle controls.

## Scroll pages and fixed overlays

Every menu has its own bounded camera and paging controls. Wheel/touch input scrolls the active menu instead of its parent document, including in lockstep mode. Nested menus retain independent positions; Back restores the parent's position and trigger focus. Arrow navigation reveals focused controls inside the menu. Native scrolling remains native when lockstep is disabled.

Panels fit the unobstructed visual viewport and their clipping ancestors. Fixed keyboards, fixed navigation bars and stuck sticky toolbars reduce this viewport. Paging controls stay above bottom overlays. Resizing, scrolling, changing keyboard height, hiding overlays and visual-viewport changes recalculate the bounds.

Declared items (including fixed-key items) register only while fully visible in their menu's usable viewport. Back/Escape remains available even when the Back control is offscreen. Custom `Button` / `StaticButton` controls retain their normal persistent policy; set `registered={false}` to suspend only their binding while keeping the native control focusable. `SubKeyframe` also accepts `registered` for controlled entry registration.

Fixed and sticky elements are detected automatically. For an absolutely positioned overlay, explicitly reserve its bounds with the exported action:

```svelte
<script>
  import { scroll_obstruction } from '@legitminh/keyflow';
</script>
<div class="floating-toolbar" use:scroll_obstruction>...</div>
```

Inline elements keep their normal layout space; reserve only UI that actually overlays scrollable content. An obstruction does not clip its own descendants, so keys on an overlaid virtual keyboard remain usable.

`Camera` and `ScrollIndicator` use their nearest input frame. `page_down`, `page_up` and `scroll_to` target the active frame's camera, falling back through the frame stack for frames without a camera. The legacy `state_viewport` and `y_pixels` exports continue to describe the root document. `Camera` accepts `class` and `worldClass` styling hooks; the default root classes remain `viewport` and `world`.

## Overlay presentation

`presentation="overlay"` opens the menu as a page stacked over the current page instead of in place. Practices:

- Use it for choice lists, and for any list that may be longer than the space beside its trigger. Inline menus are for short menus only.
- The overlay is moved to `document.body`, so page transforms, sticky headers and `overflow` on ancestors cannot clip it. It covers the whole viewport, scrolls only vertically, and wraps long labels instead of widening.
- It is modal: clicks on the page underneath do nothing, and the parent frame stays masked until an item is chosen or Back/Escape exits. `closeOnOutside` does not apply.
- Nested lists inherit the presentation.

```svelte
<SubKeyframe label="Language" presentation="overlay" items={languages} />
```
