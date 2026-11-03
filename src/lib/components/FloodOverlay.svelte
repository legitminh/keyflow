<!-- 
  full screen canvas that draws every flood in state_flood: each one spreads like paint from its origin box
  until it covers the viewport, holds while its source is held, then fades away. mount once, near the app root.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    state_flood,
    remove_flood,
    FLOOD_SPREAD_MS,
    type Flood
  } from '../stores/flood.svelte.js';

  const FADE_MS = 450; // covered screen to gone
  const SAMPLES = 160; // points along the flood edge
  const CORNER_ROUNDNESS = 4; // superellipse exponent of the origin box, higher is squarer

  let canvas = $state<HTMLCanvasElement>();
  let frame = 0;
  let reduced_motion = false;

  const ease_out = (t: number) => 1 - (1 - t) ** 3;

  // distance from the center of a (rounded) box to its edge in direction theta
  const box_radius = (theta: number, half_w: number, half_h: number) => {
    const c = Math.abs(Math.cos(theta)) / Math.max(half_w, 0.5);
    const s = Math.abs(Math.sin(theta)) / Math.max(half_h, 0.5);
    return (c ** CORNER_ROUNDNESS + s ** CORNER_ROUNDNESS) ** (-1 / CORNER_ROUNDNESS);
  };

  const draw_flood = (
    ctx: CanvasRenderingContext2D,
    flood: Flood,
    now: number,
    w: number,
    h: number
  ) => {
    const elapsed = now - flood.start;
    const spread_ms = reduced_motion ? 0 : FLOOD_SPREAD_MS;
    // fading starts once the screen is covered and the source has let go, whichever is later
    const hold_ms =
      flood.released === null ? Infinity : Math.max(spread_ms, flood.released - flood.start);
    if (elapsed >= hold_ms + FADE_MS) {
      remove_flood(flood.id);
      return;
    }

    const { left, top, width, height } = flood.origin;
    const cx = left + width / 2;
    const cy = top + height / 2;
    const seconds = elapsed / 1000;

    // how far the flood must reach past the box so its lowest dip still clears the farthest corner
    const farthest = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(w - cx, cy),
      Math.hypot(cx, h - cy),
      Math.hypot(w - cx, h - cy)
    );
    const max_dip = flood.ripples.reduce((sum, r) => sum + r.amplitude, 0);
    const reach = (farthest + 8) / (1 - max_dip);
    const growth = spread_ms === 0 ? reach : reach * ease_out(Math.min(elapsed / spread_ms, 1));

    ctx.globalAlpha = elapsed <= hold_ms ? 1 : 1 - (elapsed - hold_ms) / FADE_MS;
    ctx.fillStyle = flood.color;

    if (elapsed >= spread_ms) {
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const points: [number, number][] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const theta = (i / SAMPLES) * Math.PI * 2;
      let wobble = 1;
      for (const r of flood.ripples) {
        wobble += r.amplitude * Math.sin(r.frequency * theta + r.phase + r.drift * seconds);
      }
      const radius = box_radius(theta, width / 2, height / 2) + growth * wobble;
      points.push([cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius]);
    }

    // curve through midpoints so the edge has no corners
    ctx.beginPath();
    const mid = (a: [number, number], b: [number, number]) =>
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
    const start = mid(points[SAMPLES - 1], points[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < SAMPLES; i++) {
      const p = points[i];
      const m = mid(p, points[(i + 1) % SAMPLES]);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    ctx.closePath();
    ctx.fill();
  };

  const render = (now: number) => {
    frame = 0;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (const flood of [...state_flood.floods]) {
      draw_flood(ctx, flood, now, w, h);
    }
    ctx.globalAlpha = 1;

    if (state_flood.floods.length > 0) frame = requestAnimationFrame(render);
  };

  // start drawing whenever a flood appears; render keeps itself going until all are gone
  $effect(() => {
    if (state_flood.floods.length > 0 && frame === 0) {
      frame = requestAnimationFrame(render);
    }
  });

  onMount(() => {
    reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  });
</script>

<canvas bind:this={canvas} class="flood" aria-hidden="true"></canvas>

<style>
  .flood {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 1000;
  }
</style>
