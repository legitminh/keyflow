export type FlickDirection = 'up' | 'down' | 'left' | 'right';
export type FlickTranslation = string | { key: string; label?: string };
export type FlickBindings = Readonly<Partial<Record<FlickDirection, FlickTranslation>>>;
export interface FlickBounds { left: number; right: number; top: number; bottom: number }

/** Classify the final release against the key's original viewport bounds. */
export function resolve_flick_direction(bounds: FlickBounds, x: number, y: number): FlickDirection | null {
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  // For diagonal releases, use the largest normalized border overrun. Vertical wins ties.
  const candidates: [FlickDirection, number][] = [
    ['up', (bounds.top - y) / height], ['down', (y - bounds.bottom) / height],
    ['left', (bounds.left - x) / width], ['right', (x - bounds.right) / width]
  ];
  let direction: FlickDirection | null = null;
  let overrun = 0;
  for (const [candidate, distance] of candidates) {
    if (distance > overrun) { direction = candidate; overrun = distance; }
  }
  return direction;
}

export const flick_translation_key = (translation: FlickTranslation): string =>
  typeof translation === 'string' ? translation : translation.key;
