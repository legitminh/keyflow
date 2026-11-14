<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import type { KeyboardStore } from '../keyboards.js';
  import type { VirtualKeyHandler } from '../input-events.js';
  import KeyboardDisplay from './KeyboardDisplay.svelte';
  let { store, toolbar, onkey, on_enter, on_exit, colors, class: className }: {
    store: KeyboardStore; toolbar?: Snippet; onkey?: VirtualKeyHandler;
    colors?: Readonly<Record<string, string>>; class?: string;
  } & InteractionHandlers = $props();
  let active = $derived(store.active);
</script>

{#if $active}<KeyboardDisplay layout={$active} {toolbar} {onkey} {on_enter} {on_exit} {colors} class={className} />{/if}
