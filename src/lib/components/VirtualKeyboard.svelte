<script lang="ts">
  import type { Snippet } from 'svelte';
  import { keyboard_layouts, type KeyboardLayout, type KeyboardKey } from '../keyboards.js';
  import type { VirtualKeyHandler } from '../input-events.js';
  import KeyboardDisplay from './KeyboardDisplay.svelte';
  let { variant = 'alpha', layout, toolbar, keyDisplay, onkey, colors, class: className }: {
    variant?: keyof typeof keyboard_layouts; layout?: KeyboardLayout;
    toolbar?: Snippet; keyDisplay?: Snippet<[KeyboardKey]>; onkey?: VirtualKeyHandler;
    colors?: Readonly<Record<string, string>>; class?: string;
  } = $props();
</script>

<KeyboardDisplay layout={layout ?? keyboard_layouts[variant]} {toolbar} {keyDisplay} {onkey} {colors} class={className} />
