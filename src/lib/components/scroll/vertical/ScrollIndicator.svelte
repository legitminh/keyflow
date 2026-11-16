<script lang="ts">
  import { page_down, page_up, state_viewport } from '../../../stores/camera.svelte.js';
  import type { ScrollKeys } from '../../../scroll.js';
  import StaticButton from '../../StaticButton.svelte';
  import Button from '../../Button.svelte';

  let { keys = {} }: { keys?: ScrollKeys | false } = $props();
</script>

{#if keys !== false && state_viewport.world_pixels > state_viewport.viewport_pixels}
  <div class="scroll">
    {#if keys.down !== undefined}
      <StaticButton keys={keys.down} on_close={page_down}>&downarrow;</StaticButton>
    {:else}
      <Button on_close={page_down} priority={-2}>&downarrow;</Button>
    {/if}
    {#if keys.up !== undefined}
      <StaticButton keys={keys.up} on_close={page_up}>&uparrow;</StaticButton>
    {:else}
      <Button on_close={page_up} priority={-1}>&uparrow;</Button>
    {/if}
  </div>
{/if}

<style>
  .scroll {
    height: calc(var(--min-box));
    flex-shrink: 0;
  }
</style>
