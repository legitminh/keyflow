import { min_box } from './layout.svelte';
import { cubicOut } from 'svelte/easing';
import { Tween } from 'svelte/motion';
import { get } from 'svelte/store';
import { input_frame_manager, root_input_frame, type InputFrameController } from '../input-frames.js';
import { client_bounds, usable_viewport } from '../viewport.js';

class StateViewport {
  viewport_width = $state(0);
  viewport = $state<HTMLDivElement>();
  viewport_pixels = $state(0);
  viewport_height = $state(0);
  y = $state(0);
  world_height = $state(0);
  world_pixels = $state(0);
  world = $state<HTMLDivElement>();
  inset_top = $state(0);
  inset_bottom = $state(0);
}
/** Legacy root camera. Menu cameras never overwrite the root's position or bounds. */
export const state_viewport = new StateViewport();
const cameras = new WeakMap<InputFrameController, StateViewport>([[root_input_frame, state_viewport]]);
export function viewport_for(frame: InputFrameController) {
  let camera = cameras.get(frame);
  if (!camera) { camera = new StateViewport(); cameras.set(frame, camera); }
  return camera;
}
export function active_viewport() {
  for (const frame of [...get(input_frame_manager.stack)].reverse()) {
    const camera = cameras.get(frame);
    if (camera?.viewport?.isConnected) return camera;
  }
  return state_viewport;
}
/** Legacy root position mirror. Use scroll_to() for the active scroll frame. */
export const y_pixels = new Tween(0, { duration: 300, easing: cubicOut });
const must_views = new Set<HTMLElement>();
export const register_must_view = (node: HTMLElement) => { must_views.add(node); return () => { must_views.delete(node); }; };
const must_view_spans = (camera: StateViewport) => {
  if (!camera.world) return [];
  const top = camera.world.getBoundingClientRect().top + camera.inset_top;
  return [...must_views].filter((node) => node.closest('[data-keyflow-scroll-viewport]') === camera.viewport)
    .map((node) => { const rect = node.getBoundingClientRect(); return { start: rect.top - top, end: rect.bottom - top }; });
};
const page_pixels = (camera: StateViewport) => Math.max(1, camera.viewport_height * min_box.value);
const max_y = (camera: StateViewport) => camera.viewport ? Math.max(0, camera.viewport.scrollHeight - camera.viewport.clientHeight) : 0;
const resolve_camera = (value: unknown) => value instanceof StateViewport ? value : active_viewport();
export const sync_native_scroll = (candidate?: unknown) => {
  const camera = resolve_camera(candidate);
  if (!camera.viewport) return;
  camera.y = camera.viewport.scrollTop;
  if (camera === state_viewport) void y_pixels.set(camera.y, { duration: 0 });
};
export const scroll_to = (y: number, behavior: ScrollBehavior = 'smooth', camera = active_viewport()) => {
  if (!Number.isFinite(y)) return;
  update_viewport(camera);
  camera.viewport?.scrollTo({ top: Math.max(0, Math.min(y, max_y(camera))), behavior });
  sync_native_scroll(camera);
};
export const scroll_to_hash = (candidate?: unknown) => {
  const camera = resolve_camera(candidate);
  const { viewport, world } = camera;
  if (!viewport || !world || !window.location.hash) return;
  let id: string;
  try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (target && world.contains(target)) scroll_to(target.getBoundingClientRect().top - world.getBoundingClientRect().top - camera.inset_top, 'instant', camera);
};
const paddings = new WeakMap<HTMLElement, { top: number; bottom: number; left: number; right: number }>();
export const update_viewport = (candidate?: unknown) => {
  const camera = resolve_camera(candidate);
  const { viewport, world } = camera;
  if (!viewport || !world) return;
  let base = paddings.get(world);
  if (!base) {
    const style = getComputedStyle(world);
    base = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0, right: parseFloat(style.paddingRight) || 0 };
    paddings.set(world, base);
  }
  const rect = client_bounds(viewport), usable = usable_viewport(viewport), reservation = usable_viewport(viewport, true);
  const top = Math.max(0, usable.top - rect.top), bottom = Math.max(0, rect.bottom - usable.bottom);
  const left = Math.max(0, usable.left - rect.left), right = Math.max(0, rect.right - usable.right);
  for (const [property, value] of [['paddingTop', base.top + Math.max(0, reservation.top - rect.top)], ['paddingBottom', base.bottom + Math.max(0, rect.bottom - reservation.bottom)],
    ['paddingLeft', base.left + Math.max(0, reservation.left - rect.left)], ['paddingRight', base.right + Math.max(0, rect.right - reservation.right)]] as const) {
    const next = `${value}px`;
    if (world.style[property] !== next) world.style[property] = next;
  }
  camera.inset_top = top; camera.inset_bottom = bottom;
  camera.viewport_pixels = Math.max(0, usable.bottom - usable.top);
  camera.viewport_width = Math.max(0, Math.floor((usable.right - usable.left) / min_box.value));
  camera.viewport_height = Math.max(1, Math.floor(camera.viewport_pixels / min_box.value));
  camera.world_pixels = Math.max(0, world.getBoundingClientRect().height - top - bottom);
  camera.world_height = Math.ceil(camera.world_pixels / page_pixels(camera));
  sync_native_scroll(camera);
};
export const page_down = (candidate?: unknown) => {
  const camera = resolve_camera(candidate);
  update_viewport(camera);
  const top = camera.y, bottom = top + page_pixels(camera);
  if (camera.y >= max_y(camera)) return;
  let target = bottom;
  for (const { start, end } of must_view_spans(camera)) if (start > top && start < bottom && end > bottom) target = Math.min(target, start);
  scroll_to(target, 'smooth', camera);
};
export const page_up = (candidate?: unknown) => {
  const camera = resolve_camera(candidate);
  update_viewport(camera);
  const top = camera.y, bottom = top + page_pixels(camera);
  let target = top - page_pixels(camera);
  for (const { start, end } of must_view_spans(camera)) if (end < bottom && end > top && start < top) target = Math.max(target, end - page_pixels(camera));
  scroll_to(target, 'smooth', camera);
};
