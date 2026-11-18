<!-- Camera.svelte 
Unlocks scrollability for content within the world
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, class: className = 'viewport', worldClass = 'world' }: { children: Snippet; class?: string; worldClass?: string } = $props();

  import {
    update_viewport,
    sync_native_scroll,
    scroll_to_hash,
    viewport_for, active_viewport,
    page_down,
    page_up
  } from '../../../stores/camera.svelte.js';
  import { onMount, tick, untrack } from 'svelte';
  import { min_box } from '../../../stores/layout.svelte.js';
  import { lockstep_scrolling } from '../../../stores/scroll.svelte.js';
  import { get_input_frame } from '../../../input-frame-context.js';
  import { observe_viewports, invalidate_viewports } from '../../../viewport.js';
  const camera = viewport_for(get_input_frame());
  const measure = () => update_viewport(camera);
  const hash = () => scroll_to_hash(camera);

  $effect(() => {
    void min_box.value;
    untrack(measure);
  });

  $effect(() => {
    const viewport = camera.viewport;
    if (!lockstep_scrolling.enabled || !viewport) return;

    function wheelHandler(e: WheelEvent) {
      if (active_viewport() !== camera || (e.target instanceof Element && e.target.closest('[data-keyflow-scroll-viewport]') !== viewport) || e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      if (Date.now() - last_scroll_time > scroll_delay) {
        if (e.deltaY > 0) {
          page_down(camera);
        } else {
          page_up(camera);
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
      if (active_viewport() !== camera || (e.target instanceof Element && e.target.closest('[data-keyflow-scroll-viewport]') !== viewport) || !e.touches?.length) return;
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
            page_down(camera);
          } else {
            page_up(camera);
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
      measure();
      hash();
    });
    const observer = new ResizeObserver(invalidate_viewports);
    if (camera.viewport) observer.observe(camera.viewport);
    if (camera.world) observer.observe(camera.world);
    const stop = observe_viewports(measure);
    window.addEventListener('hashchange', hash);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      stop();
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('resize', measure);
      camera.viewport = undefined; camera.world = undefined;
    };
  });
</script>

<div
  bind:this={camera.viewport}
  data-keyflow-scroll-viewport
  onscroll={() => { sync_native_scroll(camera); invalidate_viewports(); }}
  class:native-scroll={!lockstep_scrolling.enabled}
  class={className}
>
  <div bind:this={camera.world} class={worldClass} data-keyflow-scroll-world>
    {@render children()}
  </div>
</div>

<style>
  [data-keyflow-scroll-world] {
    box-sizing: border-box;
    display: flow-root;
    position: relative;
    z-index: 1;
  }
  [data-keyflow-scroll-viewport] {
    overscroll-behavior: contain;
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
