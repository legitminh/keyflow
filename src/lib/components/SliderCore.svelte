<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { active_input_frame } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  import { normalize_slider_value, type SliderCoreProps, type SliderDirection } from '../slider.js';

  let { value = $bindable(0), min = 0, max = 100, step = 1, speed,
    orientation = 'horizontal', disabled = false, label = 'Slider', valueText,
    onchange, class: className = '' }: SliderCoreProps = $props();
  const frame = get_input_frame();
  const enabled = $derived(!disabled && $active_input_frame === frame);
  const rate = $derived(speed ?? (max - min) / 2);
  let element: HTMLDivElement;
  let pointer: number | undefined;
  let dragging = $state(false);
  let animation: number | undefined;
  let previousTime: number | undefined;
  let raw = 0;
  let lastApplied: number | undefined;
  const held = new Set<SliderDirection>();
  const position = $derived((normalize_slider_value(value, min, max, step) - min) / (max - min) * 100);

  function apply(candidate: number) {
    const next = normalize_slider_value(candidate, min, max, step);
    lastApplied = next;
    if (value !== next) {
      value = next;
      onchange?.(next);
    }
  }
  export function set(candidate: number) {
    if (!enabled) return;
    apply(candidate);
    raw = value;
  }
  export function shift(steps: number) { set(value + steps * step); }
  function direction() { return (held.has(1) ? 1 : 0) - (held.has(-1) ? 1 : 0); }
  function animate(time: number) {
    animation = undefined;
    if (!enabled || !held.size) return stop();
    const elapsed = previousTime === undefined ? 0 : Math.max(0, time - previousTime) / 1000;
    previousTime = time;
    raw = Math.max(min, Math.min(max, raw + direction() * rate * elapsed));
    apply(raw);
    if (enabled && held.size) animation = requestAnimationFrame(animate);
  }
  export function start(side: SliderDirection) {
    if (!enabled || pointer !== undefined || held.has(side)) return;
    if (side !== -1 && side !== 1) throw new RangeError('Slider direction must be -1 or 1');
    held.add(side);
    shift(direction());
    if (animation === undefined) {
      previousTime = undefined;
      animation = requestAnimationFrame(animate);
    }
  }
  export function stop(side?: SliderDirection) {
    if (side === undefined) held.clear(); else held.delete(side);
    if (!held.size) {
      if (animation !== undefined) cancelAnimationFrame(animation);
      animation = undefined;
      previousTime = undefined;
    }
  }
  function release() {
    const id = pointer;
    pointer = undefined;
    dragging = false;
    if (id !== undefined && element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
  function cancel() { stop(); release(); }
  function move(event: PointerEvent) {
    if (!enabled || pointer !== event.pointerId) return;
    const rect = element.getBoundingClientRect();
    const length = orientation === 'horizontal' ? rect.width : rect.height;
    if (!length) return;
    const ratio = orientation === 'horizontal' ? (event.clientX - rect.left) / length : (rect.bottom - event.clientY) / length;
    set(min + Math.max(0, Math.min(1, ratio)) * (max - min));
  }
  function press(event: PointerEvent) {
    if (!enabled || pointer !== undefined || event.button !== 0) return;
    event.preventDefault();
    stop();
    pointer = event.pointerId;
    dragging = true;
    element.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    move(event);
  }
  $effect(() => {
    const next = normalize_slider_value(value, min, max, step);
    if (value !== lastApplied) raw = next;
    if (value !== next) untrack(() => apply(next));
  });
  $effect(() => {
    enabled; min; max; step; orientation;
    if (!Number.isFinite(rate) || rate < 0) throw new RangeError('Slider speed must be finite and nonnegative');
    untrack(cancel);
  });
  onDestroy(cancel);
</script>

<svelte:window onblur={cancel} />
<svelte:document onvisibilitychange={() => { if (document.hidden) cancel(); }} />
<div bind:this={element} role="slider" tabindex={enabled ? 0 : -1}
  aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
  aria-valuetext={valueText?.(value)} aria-orientation={orientation} aria-disabled={!enabled}
  class="keyflow-slider-core {orientation} {className}" class:dragging
  style:--slider-position={`${position}%`}
  onpointerdown={press} onpointermove={move}
  onpointerup={(event) => { if (pointer === event.pointerId) { move(event); release(); } }}
  onpointercancel={(event) => { if (pointer === event.pointerId) release(); }}
  onlostpointercapture={(event) => { if (pointer === event.pointerId) release(); }}>
  <span class="track" aria-hidden="true"></span>
  <span class="thumb" aria-hidden="true"></span>
</div>

<style>
  .keyflow-slider-core { position: relative; flex: 1 1 auto; touch-action: none; user-select: none; cursor: pointer; color: var(--slider-color, currentColor); }
  .horizontal { width: var(--slider-length, 12rem); min-width: 3rem; height: var(--slider-hit-size, 2rem); }
  .vertical { height: var(--slider-length, 12rem); min-height: 3rem; width: var(--slider-hit-size, 2rem); }
  .track, .thumb { position: absolute; display: block; pointer-events: none; background: currentColor; }
  .track { opacity: .4; border-radius: 1rem; }
  .horizontal .track { left: 0; right: 0; height: var(--slider-track-size, 2px); top: 50%; transform: translateY(-50%); }
  .vertical .track { top: 0; bottom: 0; width: var(--slider-track-size, 2px); left: 50%; transform: translateX(-50%); }
  .thumb { width: var(--slider-thumb-size, 1rem); height: var(--slider-thumb-size, 1rem); border-radius: 50%; }
  .horizontal .thumb { left: var(--slider-position); top: 50%; transform: translate(-50%, -50%); }
  .vertical .thumb { bottom: var(--slider-position); left: 50%; transform: translate(-50%, 50%); }
  .keyflow-slider-core:focus-visible { outline: 2px solid currentColor; outline-offset: .3rem; }
  .keyflow-slider-core[aria-disabled="true"] { opacity: .4; cursor: default; }
  .dragging .thumb { box-shadow: 0 0 0 .2rem color-mix(in srgb, currentColor 20%, transparent); }
</style>
