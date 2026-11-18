import { fully_visible, observe_viewports } from '../viewport.js';

/** Positional shortcuts follow the unobstructed viewport of their scroll frame. */
export function visibility(node: HTMLElement, callbacks: { onFullyVisible?: () => void; onHidden?: () => void }) {
  let visible: boolean | undefined;
  let intersecting = true;
  const measure = (force = false) => {
    const next = (force || intersecting) && fully_visible(node);
    if (next === visible) return;
    if (next) intersecting = true;
    visible = next;
    if (next) callbacks.onFullyVisible?.(); else callbacks.onHidden?.();
  };
  const intersection = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting || fully_visible(node); measure(); }, { threshold: [0, 1] });
  intersection.observe(node);
  const stop = observe_viewports(measure);
  measure();
  const resize = new ResizeObserver(() => measure());
  resize.observe(node);
  return { update(next: typeof callbacks) { callbacks = next; }, destroy() { stop(); resize.disconnect(); intersection.disconnect(); if (visible) callbacks.onHidden?.(); } };
}
