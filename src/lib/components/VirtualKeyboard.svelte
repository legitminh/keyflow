<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import { keyboard_layouts, type KeyboardLayout, type KeyboardKey } from '../keyboards.js';
  import type { VirtualKeyHandler } from '../input-events.js';
  import KeyboardDisplay from './KeyboardDisplay.svelte';
  let { variant = 'alpha', layout, toolbar, keyDisplay, onkey, on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, colors, class: className }: {
    variant?: keyof typeof keyboard_layouts; layout?: KeyboardLayout;
    toolbar?: Snippet; keyDisplay?: Snippet<[KeyboardKey]>; onkey?: VirtualKeyHandler;
    colors?: Readonly<Record<string, string>>; class?: string;
  } & InteractionHandlers = $props();
</script>

<KeyboardDisplay layout={layout ?? keyboard_layouts[variant]} {toolbar} {keyDisplay} {onkey} {on_enter} {on_exit} {on_pressed_down} {on_pressed_up} {on_cursor_enter} {on_cursor_exit} {colors} class={className} />
