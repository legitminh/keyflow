import { min_box } from './layout.svelte';
import { cubicOut } from 'svelte/easing';
import { Tween } from 'svelte/motion';

class StateViewport {
  viewport_width = $state(0); // min_box
  viewport = $state<HTMLDivElement | undefined>(undefined); //div that describe the viewport the camera is capable of viewing
  viewport_pixels = $state(0); // height in pixels
  viewport_height = $state(0); // min_box
  y = $state(0); // pixels from the top of the world to the top of the viewport
  world_height = $state(0); // height in min_box_blocks
  world_pixels = $state(0); // height in pixels
  world = $state<HTMLDivElement | undefined>(undefined); //div that describe the world the camera is capable of viewing
}
export const state_viewport = new StateViewport();

/** Legacy position mirror. Use scroll_to() to move the document. */
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

// Native scrolling is the source of truth in both pointer modes.
const max_y = () => Math.max(0, state_viewport.world_pixels - state_viewport.viewport_pixels);

export const sync_native_scroll = () => {
  const viewport = state_viewport.viewport;
  if (!viewport) return;
  state_viewport.y = viewport.scrollTop;
  // Keep the public camera position in sync for existing integrations.
  void y_pixels.set(viewport.scrollTop, { duration: 0 });
};

/** Scroll to a pixel position in the document; use instant for screen restoration. */
export const scroll_to = (y: number, behavior: ScrollBehavior = 'smooth') => {
  if (!Number.isFinite(y)) return;
  update_viewport();
  state_viewport.viewport?.scrollTo({ top: Math.max(0, Math.min(y, max_y())), behavior });
  sync_native_scroll();
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

  scroll_to(target.getBoundingClientRect().top - world.getBoundingClientRect().top, 'instant');
};

export const update_viewport = () => {
  if (state_viewport.viewport && state_viewport.world) {
    const viewport_rect = state_viewport.viewport.getBoundingClientRect();
    state_viewport.viewport_pixels = state_viewport.viewport.clientHeight;
    state_viewport.viewport_width = Math.floor(viewport_rect.width / min_box.value);
    const viewport_height = Math.max(1, Math.floor(viewport_rect.height / min_box.value)); // in min_box rounded down

    state_viewport.viewport_height = viewport_height;

    state_viewport.world_pixels = state_viewport.world.getBoundingClientRect().height;
    state_viewport.world_height = Math.ceil(
      state_viewport.world_pixels / viewport_height / min_box.value
    );
    sync_native_scroll();
  }
};

// goes to whichever is closer: the start of an element cut by the bottom edge, or one full page down.
// an element is only snapped to if it starts below the top edge, so elements taller than the page still get paged through
export const page_down = () => {
  update_viewport(); //this updates before paging down to prevent situation of world dom internal changing between screen resizes
  const top = state_viewport.y;
  const bottom = top + page_pixels();
  if (bottom >= state_viewport.world_pixels) return; // nothing below the viewport
  let target = bottom;
  for (const { start, end } of must_view_spans()) {
    if (start > top && start < bottom && end > bottom) target = Math.min(target, start);
  }
  scroll_to(target);
};
// mirror of page_down: goes to whichever is closer: putting the end of an element cut by the top edge at the bottom, or one full page up
export const page_up = () => {
  update_viewport();
  const top = state_viewport.y;
  const bottom = top + page_pixels();
  let target = top - page_pixels();
  for (const { start, end } of must_view_spans()) {
    if (end < bottom && end > top && start < top) target = Math.max(target, end - page_pixels());
  }
  scroll_to(target);
};
