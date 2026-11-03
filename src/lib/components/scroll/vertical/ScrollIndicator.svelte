<script lang="ts">
  import { page_down, page_up, state_viewport } from '../../../stores/camera.svelte.js';
  import { lockstep_scrolling } from '../../../stores/scroll.svelte.js';
  import Button from '../../Button.svelte';

  $effect(() => {
    if (!lockstep_scrolling.enabled) return;
    // #region mouse / touch events

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

    window.addEventListener('wheel', wheelHandler, { passive: false });
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('touchend', touchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', wheelHandler as EventListener);
      window.removeEventListener('touchstart', touchStart as EventListener);
      window.removeEventListener('touchmove', touchMove as EventListener);
      window.removeEventListener('touchend', touchEnd as EventListener);
    };
  });
</script>

{#if lockstep_scrolling.enabled && state_viewport.world_height > 1}
  <div class="scroll">
    <Button on_close={page_down} priority={-2}>&downarrow;</Button>
    <Button on_close={page_up} priority={-1}>&uparrow;</Button>
  </div>
{/if}

<style>
  .scroll {
    height: calc(var(--min-box));
  }
</style>
