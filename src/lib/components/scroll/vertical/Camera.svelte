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
    page_down,
    page_up
  } from '../../../stores/camera.svelte.js';
  import { onMount, tick, untrack } from 'svelte';
  import { min_box } from '../../../stores/layout.svelte.js';
  import { lockstep_scrolling } from '../../../stores/scroll.svelte.js';

  $effect(() => {
    void min_box.value;
    untrack(update_viewport);
  });

  $effect(() => {
    const viewport = state_viewport.viewport;
    if (!lockstep_scrolling.enabled || !viewport) return;

    function wheelHandler(e: WheelEvent) {
      if (e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      if (Date.now() - last_scroll_time > scroll_delay) {
        if (e.deltaY > 0) {
          page_down();
        } else {
          page_up();
        }
        last_scroll_time = Date.now();
      }
    }

    // Touch-based swipe -> trigger single page up/down per gesture on mobile.
    let touchStartY: number | null = null;
    let lastTouchY: number | null = null;
    const scroll_delay = 400; // ms
    let last_scroll_time = 0;

    function touchStart(e: TouchEvent) {
      if (!e.touches || e.touches.length === 0) return;
      touchStartY = e.touches[0].clientY;
      lastTouchY = touchStartY;
    }

    function touchMove(e: TouchEvent) {
      if (touchStartY === null || !e.touches.length) return;
      lastTouchY = e.touches[0].clientY;

      // If the user has moved enough, prevent native scrolling so we
      // can perform a fixed-step page action on touchend.
      const moved = Math.abs((lastTouchY ?? 0) - touchStartY) > 10;
      if (moved) {
        // preventDefault requires the listener to be non-passive.
        e.preventDefault();
      }
    }

    function touchEnd() {
      if (touchStartY == null || lastTouchY == null) {
        touchStartY = null;
        lastTouchY = null;
        return;
      }

      const delta = touchStartY - lastTouchY;
      const THRESHOLD = 40; // px required to count as a page gesture

      if (Math.abs(delta) >= THRESHOLD) {
        if (Date.now() - last_scroll_time > scroll_delay) {
          if (delta > 0) {
            page_down();
          } else {
            page_up();
          }
          last_scroll_time = Date.now();
        }
      }

      touchStartY = null;
      lastTouchY = null;
    }

    viewport.addEventListener('wheel', wheelHandler, { passive: false });
    viewport.addEventListener('touchstart', touchStart, { passive: true });
    viewport.addEventListener('touchmove', touchMove, { passive: false });
    viewport.addEventListener('touchend', touchEnd, { passive: true });

    return () => {
      viewport.removeEventListener('wheel', wheelHandler as EventListener);
      viewport.removeEventListener('touchstart', touchStart as EventListener);
      viewport.removeEventListener('touchmove', touchMove as EventListener);
      viewport.removeEventListener('touchend', touchEnd as EventListener);
    };
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
  <div bind:this={state_viewport.world} class="world">
    {@render children()}
  </div>
</div>

<style>
  .world {
    display: flow-root;
    position: relative;
    z-index: 1;
  }
  .viewport {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
