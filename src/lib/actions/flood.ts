// lib/actions/flood.ts
// floods the screen with `color` from this node's box when `active` turns true or the enclosing button is pressed with a pointer,
// and lets it fade once the key path clears or the pointer lets go
import { start_flood, release_flood } from '../stores/flood.svelte.js';

type FloodParams = { active: boolean; color: string; enabled?: boolean };

export function flood(node: HTMLElement, params: FloodParams) {
  let current = params;
  let was_active = params.active; // an element mounting already active shouldn't flood
  let flood_id: number | null = null;

  const start = () => {
    if ((current.enabled ?? true) && flood_id === null) {
      flood_id = start_flood(node.getBoundingClientRect(), current.color);
    }
  };

  const release = () => {
    if (flood_id !== null) release_flood(flood_id);
    flood_id = null;
  };

  const update = (next: FloodParams) => {
    current = next;
    if (next.active && !was_active) {
      start();
    } else if (!next.active && was_active) {
      release();
    }
    was_active = next.active;
  };

  // mouse / touch: the press can land anywhere on the button, but the paint still pours from this node
  const pressable = node.closest('button') ?? node;
  const on_pointer_down = (event: PointerEvent) => {
    if (event.button !== 0 || (pressable instanceof HTMLButtonElement && pressable.disabled)) return;
    start();
    window.addEventListener('pointerup', on_pointer_up);
    window.addEventListener('pointercancel', on_pointer_up);
  };
  const on_pointer_up = () => {
    window.removeEventListener('pointerup', on_pointer_up);
    window.removeEventListener('pointercancel', on_pointer_up);
    release();
  };
  pressable.addEventListener('pointerdown', on_pointer_down);

  return {
    update,
    destroy() {
      pressable.removeEventListener('pointerdown', on_pointer_down);
      on_pointer_up();
    }
  };
}
