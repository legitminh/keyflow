<!-- Camera.svelte 
Unlocks scrollability for content within the world
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();

  import {
    update_viewport,
    sync_native_scroll,
    scroll_to_hash,
    state_viewport,
    y_pixels
  } from '../../../stores/camera.svelte.js';
  import { onMount, tick, untrack } from 'svelte';
  import { min_box } from '../../../stores/layout.svelte.js';
  import { lockstep_scrolling } from '../../../stores/scroll.svelte.js';

  $effect(() => {
    void min_box.value; // dependency tracking
    update_viewport();
  });

  $effect(() => {
    const enabled = lockstep_scrolling.enabled;
    untrack(() => {
      const viewport = state_viewport.viewport;
      if (!viewport) return;
      // Transfer the visible position between native scrolling and the camera.
      const y = enabled ? viewport.scrollTop : y_pixels.current;
      void y_pixels.set(y, { duration: 0 });
      viewport.scrollTop = enabled ? 0 : y;
      state_viewport.y = enabled ? y : viewport.scrollTop;
      update_viewport();
    });
  });

  onMount(() => {
    void tick().then(() => {
      update_viewport();
      scroll_to_hash();
    });
    const observer = new ResizeObserver(update_viewport);
    if (state_viewport.viewport) observer.observe(state_viewport.viewport);
    if (state_viewport.world) observer.observe(state_viewport.world);
    window.addEventListener('hashchange', scroll_to_hash);
    window.addEventListener('resize', update_viewport);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', scroll_to_hash);
      window.removeEventListener('resize', update_viewport);
    };
  });
</script>

<div
  bind:this={state_viewport.viewport}
  onscroll={sync_native_scroll}
  class:native-scroll={!lockstep_scrolling.enabled}
  class="viewport"
>
  <div
    bind:this={state_viewport.world}
    class="world"
    style:transform={lockstep_scrolling.enabled ? `translateY(-${y_pixels.current}px)` : undefined}
  >
    {@render children()}
  </div>
</div>

<style>
  .world {
    position: relative;
    z-index: 1;
  }
  .viewport {
    flex-grow: 1;
    overflow: hidden;
  }
  .viewport.native-scroll {
    min-height: 0;
    overflow-y: auto;
  }
</style>
