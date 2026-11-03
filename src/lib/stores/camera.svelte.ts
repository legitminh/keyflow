import { min_box } from './layout.svelte';
import { lockstep_scrolling } from './scroll.svelte';
import { flushSync } from 'svelte';
import {
  cubicOut
  // quintOut,
  // expoOut,
  // quartOut,
  // cubicInOut
} from 'svelte/easing';
import { Tween } from 'svelte/motion';

class StateViewport {
  viewport_width = $state(0); // min_box
  viewport = $state<HTMLDivElement | undefined>(undefined); //div that describe the viewport the camera is capable of viewing
  viewport_height = $state(0); // min_box
  y = $state(0); // pixels from the top of the world to the top of the viewport
  world_height = $state(0); // height in min_box_blocks
  world_pixels = $state(0); // height in pixels
  world = $state<HTMLDivElement | undefined>(undefined); //div that describe the world the camera is capable of viewing
}
export const state_viewport = new StateViewport();

export const y_pixels = new Tween(0, {
  duration: 300,
  easing: cubicOut
});

// elements on the page that paging should avoid cutting at the bottom edge, registered by the must_view action
const must_views = new Set<HTMLElement>();
export const register_must_view = (node: HTMLElement) => {
  must_views.add(node);
  return () => {
    must_views.delete(node);
  };
};

// start and end of every must view element, in pixels from the top of the world
const must_view_spans = () => {
  if (!state_viewport.world) return [];
  const world_top = state_viewport.world.getBoundingClientRect().top;
  return [...must_views].map((node) => {
    const rect = node.getBoundingClientRect();
    return { start: rect.top - world_top, end: rect.bottom - world_top };
  });
};

// one page is the viewport height rounded down to whole min_boxes
const page_pixels = () => state_viewport.viewport_height * min_box.value;

// the furthest the camera may go while still showing some of the world
const max_y = () =>
  Math.max(
    0,
    state_viewport.world_pixels -
      (lockstep_scrolling.enabled ? min_box.value : (state_viewport.viewport?.clientHeight ?? 0))
  );

const move_to = (y: number) => {
  state_viewport.y = Math.max(0, Math.min(y, max_y()));
  y_pixels.target = state_viewport.y;
};

// Fragment navigation can scroll an overflow-hidden viewport independently of
// our transform. Absorb that offset so paging continues from the visible position.
export const sync_native_scroll = () => {
  const viewport = state_viewport.viewport;
  if (!viewport) return;
  if (!lockstep_scrolling.enabled) {
    state_viewport.y = viewport.scrollTop;
    return;
  }
  if (viewport.scrollTop === 0) return;

  const y = Math.max(0, Math.min(y_pixels.current + viewport.scrollTop, max_y()));
  flushSync(() => {
    state_viewport.y = y;
    void y_pixels.set(y, { duration: 0 });
  });
  viewport.scrollTop = 0;
};

export const scroll_to_hash = () => {
  const { viewport, world } = state_viewport;
  if (!viewport || !world || !window.location.hash) return;
  let id: string;
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target || !world.contains(target)) return;

  update_viewport();
  const y = Math.max(
    0,
    Math.min(target.getBoundingClientRect().top - world.getBoundingClientRect().top, max_y())
  );
  if (!lockstep_scrolling.enabled) {
    viewport.scrollTop = y;
    state_viewport.y = viewport.scrollTop;
    return;
  }
  flushSync(() => {
    state_viewport.y = y;
    void y_pixels.set(y, { duration: 0 });
  });
  viewport.scrollTop = 0;
};

export const update_viewport = () => {
  if (state_viewport.viewport && state_viewport.world) {
    const viewport_rect = state_viewport.viewport.getBoundingClientRect();
    state_viewport.viewport_width = Math.floor(viewport_rect.width / min_box.value);
    const viewport_height = Math.max(1, Math.floor(viewport_rect.height / min_box.value)); // in min_box rounded down

    state_viewport.viewport_height = viewport_height;

    state_viewport.world_pixels = state_viewport.world.getBoundingClientRect().height;
    state_viewport.world_height = Math.ceil(
      state_viewport.world_pixels / viewport_height / min_box.value
    );
    if (state_viewport.y > max_y()) move_to(state_viewport.y);
  }
};

// goes to whichever is closer: the start of an element cut by the bottom edge, or one full page down.
// an element is only snapped to if it starts below the top edge, so elements taller than the page still get paged through
export const page_down = () => {
  if (!lockstep_scrolling.enabled) return;
  update_viewport(); //this updates before paging down to prevent situation of world dom internal changing between screen resizes
  sync_native_scroll();
  const top = state_viewport.y;
  const bottom = top + page_pixels();
  if (bottom >= state_viewport.world_pixels) return; // nothing below the viewport
  let target = bottom;
  for (const { start, end } of must_view_spans()) {
    if (start > top && start < bottom && end > bottom) target = Math.min(target, start);
  }
  move_to(target);
};
// mirror of page_down: goes to whichever is closer: putting the end of an element cut by the top edge at the bottom, or one full page up
export const page_up = () => {
  if (!lockstep_scrolling.enabled) return;
  update_viewport();
  sync_native_scroll();
  const top = state_viewport.y;
  const bottom = top + page_pixels();
  let target = top - page_pixels();
  for (const { start, end } of must_view_spans()) {
    if (end < bottom && end > top && start < top) target = Math.max(target, end - page_pixels());
  }
  move_to(target);
};

// let box = $derived(Math.max(1, $min_box || 1));
// export const columns = writable(0);
// $derived(Math.max(1, Math.floor(viewport_width / box)));
// export let rows = $derived(Math.max(1, Math.floor(viewport_height / box)));
// let cells = $derived(Array.from({ length: columns * rows }, (_, index) => index + 1));
