/** Shared geometry for scrolling, menu sizing and visibility-based shortcuts. */
export interface ViewportBounds { top: number; right: number; bottom: number; left: number }
const listeners = new Set<(force?: boolean) => void>();
const overlays = new Set<HTMLElement>();
const dirty = new Set<HTMLElement>();
let observer: MutationObserver | undefined, resize: ResizeObserver | undefined, pending = 0;

function intersect(a: ViewportBounds, b: ViewportBounds): ViewportBounds {
  return { top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom), left: Math.max(a.left, b.left) };
}
function area(r: ViewportBounds) { return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top); }
export function client_bounds(node: HTMLElement): ViewportBounds {
  const r = node.getBoundingClientRect();
  return { top: r.top + node.clientTop, left: r.left + node.clientLeft,
    bottom: r.top + node.clientTop + node.clientHeight, right: r.left + node.clientLeft + node.clientWidth };
}
function clipped_bounds(node: HTMLElement) {
  const visual = window.visualViewport;
  let bounds = { top: visual?.offsetTop ?? 0, left: visual?.offsetLeft ?? 0,
    bottom: (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight),
    right: (visual?.offsetLeft ?? 0) + (visual?.width ?? document.documentElement.clientWidth) };
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), r = client_bounds(parent);
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { bounds.top = Math.max(bounds.top, r.top); bounds.bottom = Math.min(bounds.bottom, r.bottom); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { bounds.left = Math.max(bounds.left, r.left); bounds.right = Math.min(bounds.right, r.right); }
  }
  return bounds;
}
function covering(node: HTMLElement, bounds: ViewportBounds, padding = false) {
  const result: ViewportBounds[] = [];
  for (const overlay of overlays) {
    if (!overlay.isConnected || overlay === node || overlay.contains(node)) continue;
    const style = getComputedStyle(overlay);
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none' || Number(style.opacity) === 0) continue;
    const r = overlay.getBoundingClientRect(), overlap = intersect(bounds, r);
    if (!area(overlap)) continue;
    const hits = document.elementsFromPoint((overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2);
    const cover = hits.findIndex((hit) => hit === overlay || overlay.contains(hit));
    const target = hits.findIndex((hit) => (hit === node || node.contains(hit)) && hit !== overlay && !overlay.contains(hit));
    if (cover === -1 || (target !== -1 && target <= cover)) continue;
    if (padding && style.position === 'sticky' && node.contains(overlay)) continue;
    if (style.position === 'sticky') {
      const clip = clipped_bounds(overlay);
      const top = parseFloat(style.top), bottom = parseFloat(style.bottom), left = parseFloat(style.left), right = parseFloat(style.right);
      if (!(Number.isFinite(top) && r.top <= clip.top + top + 1) && !(Number.isFinite(bottom) && r.bottom >= clip.bottom - bottom - 1) &&
          !(Number.isFinite(left) && r.left <= clip.left + left + 1) && !(Number.isFinite(right) && r.right >= clip.right - right - 1)) continue;
    }
    result.push(overlap);
  }
  return result;
}
/** Intersect ancestor clips and the visual viewport, then remove edge overlays. */
export function usable_viewport(node: HTMLElement, padding = false): ViewportBounds {
  if (dirty.size) { for (const root of dirty) if (root.isConnected) scan(root); dirty.clear(); }
  let bounds = clipped_bounds(node);
  if (node.hasAttribute('data-keyflow-scroll-viewport')) bounds = intersect(bounds, client_bounds(node));
  const base = { ...bounds };
  for (const r of covering(node, base, padding)) {
    if (r.right - r.left >= (base.right - base.left) * .5) {
      if (r.top <= base.top + 1) bounds.top = Math.max(bounds.top, r.bottom);
      else if (r.bottom >= base.bottom - 1) bounds.bottom = Math.min(bounds.bottom, r.top);
    }
    if (r.bottom - r.top >= (base.bottom - base.top) * .5) {
      if (r.left <= base.left + 1) bounds.left = Math.max(bounds.left, r.right);
      else if (r.right >= base.right - 1) bounds.right = Math.min(bounds.right, r.left);
    }
  }
  return bounds;
}
export function fully_visible(node: HTMLElement) {
  const r = node.getBoundingClientRect(), bounds = usable_viewport(node);
  if (!node.getClientRects().length || r.width <= 0 || r.height <= 0 || r.top < bounds.top - .5 ||
      r.bottom > bounds.bottom + .5 || r.left < bounds.left - .5 || r.right > bounds.right + .5) return false;
  return !covering(node, intersect(r, bounds)).some((cover) => area(cover) > 1);
}
function scan(root: HTMLElement) {
  for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    if (!(node instanceof HTMLElement)) continue;
    const style = getComputedStyle(node);
    const relevant = style.position === 'fixed' || style.position === 'sticky' || node.hasAttribute('data-keyflow-scroll-obstruction');
    if (relevant && !overlays.has(node)) { overlays.add(node); resize?.observe(node); }
    else if (!relevant && overlays.delete(node)) resize?.unobserve(node);
  }
}
function flush(force = false) {
  pending = 0;
  for (const root of dirty) if (root.isConnected) scan(root);
  dirty.clear();
  for (const node of overlays) if (!node.isConnected) { overlays.delete(node); resize?.unobserve(node); }
  for (const callback of [...listeners]) callback(force);
}
export function invalidate_viewports() { if (!pending && listeners.size) pending = requestAnimationFrame(() => flush()); }
export function refresh_viewports() {
  cancelAnimationFrame(pending);
  // Resolve geometry before exposing a newly entered frame's shortcuts.
  flush(true); flush(true);
}
/** One DOM observer/listener set is shared by all cameras and positional controls. */
export function observe_viewports(callback: (force?: boolean) => void) {
  if (!listeners.size) {
    resize = new ResizeObserver(invalidate_viewports);
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLElement) dirty.add(record.target);
        for (const node of record.addedNodes) if (node instanceof HTMLElement) dirty.add(node);
      }
      invalidate_viewports();
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'open', 'data-keyflow-scroll-obstruction'] });
    dirty.add(document.documentElement);
    window.addEventListener('scroll', invalidate_viewports, true);
    window.addEventListener('resize', invalidate_viewports);
    window.visualViewport?.addEventListener('resize', invalidate_viewports);
    window.visualViewport?.addEventListener('scroll', invalidate_viewports);
  }
  listeners.add(callback); invalidate_viewports();
  return () => {
    listeners.delete(callback);
    if (listeners.size) return;
    observer?.disconnect(); resize?.disconnect(); overlays.clear(); dirty.clear(); cancelAnimationFrame(pending); pending = 0;
    window.removeEventListener('scroll', invalidate_viewports, true); window.removeEventListener('resize', invalidate_viewports);
    window.visualViewport?.removeEventListener('resize', invalidate_viewports); window.visualViewport?.removeEventListener('scroll', invalidate_viewports);
  };
}
/** Reserve space for an absolute overlay as well as automatically detected fixed/sticky UI. */
export function scroll_obstruction(node: HTMLElement) {
  const previous = node.getAttribute('data-keyflow-scroll-obstruction'); node.setAttribute('data-keyflow-scroll-obstruction', '');
  return { destroy() { if (previous === null) node.removeAttribute('data-keyflow-scroll-obstruction'); else node.setAttribute('data-keyflow-scroll-obstruction', previous); } };
}
