// lib/actions/must_view.ts
// registers this node with the lock-step scroll while it is on the page,
// so paging down snaps to its start instead of cutting it at the bottom edge
import { register_must_view } from '../stores/camera.svelte.js';

export function must_view(node: HTMLElement) {
  const unregister = register_must_view(node);
  return {
    destroy: unregister
  };
}
