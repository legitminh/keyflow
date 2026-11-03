// floods of color that spread from a screen rect until they cover the viewport, drawn by FloodOverlay

export type Flood = {
  id: number;
  origin: { left: number; top: number; width: number; height: number }; // viewport coords at start
  color: string; // any css color
  start: number; // performance.now() at start
  released: number | null; // performance.now() when the source let go, the flood fades only after this
  // low frequency ripples of the flood edge, so it grows unevenly but stays smooth
  ripples: { frequency: number; amplitude: number; phase: number; drift: number }[];
};

let next_id = 0;

export const FLOOD_SPREAD_MS = 400; // origin box to covered screen

export const state_flood = $state<{ floods: Flood[] }>({ floods: [] });

const make_ripples = () => {
  // integer frequencies keep the edge closed; amplitudes sum well below 1 so the edge never folds
  return [2, 3, 5, 7].map((frequency, i) => ({
    frequency,
    amplitude: [0.14, 0.09, 0.05, 0.025][i] * (0.7 + Math.random() * 0.6),
    phase: Math.random() * Math.PI * 2,
    drift: (Math.random() - 0.5) * 3 // radians per second
  }));
};

// returns the flood's id, pass it to release_flood when the source lets go
export const start_flood = (origin: DOMRect, color: string) => {
  const id = next_id++;
  state_flood.floods.push({
    id,
    origin: { left: origin.left, top: origin.top, width: origin.width, height: origin.height },
    color,
    start: performance.now(),
    released: null,
    ripples: make_ripples()
  });
  return id;
};

export const release_flood = (id: number) => {
  const flood = state_flood.floods.find((f) => f.id === id);
  if (flood && flood.released === null) flood.released = performance.now();
};

// resolves once every flood on screen has finished spreading, so an action can wait for the paint to cover
export const flood_covered = () => {
  const now = performance.now();
  const remaining = Math.max(0, ...state_flood.floods.map((f) => f.start + FLOOD_SPREAD_MS - now));
  return new Promise<void>((resolve) => setTimeout(resolve, remaining));
};

export const remove_flood = (id: number) => {
  const index = state_flood.floods.findIndex((f) => f.id === id);
  if (index !== -1) state_flood.floods.splice(index, 1);
};
