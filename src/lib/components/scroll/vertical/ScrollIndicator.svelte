<script lang="ts">
  import { page_down, page_up, viewport_for } from '../../../stores/camera.svelte.js';
  import { get_input_frame } from '../../../input-frame-context.js';
  const camera = viewport_for(get_input_frame());
  import type { ScrollKeys } from '../../../scroll.js';
  import StaticButton from '../../StaticButton.svelte';
  import Button from '../../Button.svelte';
  import { observe_viewports, usable_viewport } from '../../../viewport.js';
  let element = $state<HTMLDivElement>();
  $effect(() => {
    const node = element;
    if (!node) return;
    return observe_viewports(() => {
      const bounds = usable_viewport(node), rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const bottom = Math.max(0, rect.bottom + (parseFloat(style.marginBottom) || 0) - bounds.bottom);
      const left = Math.max(0, bounds.left - rect.left + (parseFloat(style.marginLeft) || 0));
      const right = Math.max(0, rect.right + (parseFloat(style.marginRight) || 0) - bounds.right);
      for (const [key, value] of [['marginBottom', bottom], ['marginLeft', left], ['marginRight', right]] as const) {
        const next = `${Math.ceil(value)}px`;
        if (node.style[key] !== next) node.style[key] = next;
      }
    });
  });

  let { keys = {} }: { keys?: ScrollKeys | false } = $props();
</script>

{#if keys !== false && camera.viewport_pixels > 0 && camera.world_pixels > camera.viewport_pixels + 1}
  <div class="scroll" data-keyflow-scroll-controls bind:this={element}>
    {#if keys.down !== undefined}
      <StaticButton keys={keys.down} on_close={() => page_down(camera)}>&downarrow;</StaticButton>
    {:else}
      <Button on_close={() => page_down(camera)} priority={-2}>&downarrow;</Button>
    {/if}
    {#if keys.up !== undefined}
      <StaticButton keys={keys.up} on_close={() => page_up(camera)}>&uparrow;</StaticButton>
    {:else}
      <Button on_close={() => page_up(camera)} priority={-1}>&uparrow;</Button>
    {/if}
  </div>
{/if}

<style>
  .scroll {
    height: calc(var(--min-box));
    flex-shrink: 0;
  }
</style>
