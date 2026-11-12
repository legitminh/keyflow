<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import { format_shortcut } from '../shortcuts.js';
  import { press_virtual_key, type VirtualKeyHandler } from '../input-events.js';
  import { input_platform } from '../input-frames.js';
  import {
    resolve_flick_direction, flick_translation_key,
    type FlickDirection, type FlickBindings, type FlickBounds, type FlickTranslation
  } from '../flick.js';

  let { key, flick = {}, label, color, width = 1, disabled = false,
    pressed = false, onkey, children, class: className = '' }: {
    key: string; flick?: FlickBindings; label?: string; color?: string; width?: number;
    disabled?: boolean; pressed?: boolean; onkey?: VirtualKeyHandler;
    children?: Snippet; class?: string;
  } = $props();
  const directions: FlickDirection[] = ['up', 'down', 'left', 'right'];
  const descriptionId = $props.id();
  let element: HTMLButtonElement;
  let pointer: number | null = null;
  let bounds: FlickBounds | null = null;
  let dragging = $state(false);
  let direction = $state<FlickDirection | null>(null);
  let text = $derived(label ?? format_shortcut([key], $input_platform));
  let hue = $derived(Array.from(key).reduce((n, char) => (n * 31 + char.charCodeAt(0) * 61) % 360, 0));
  let description = $derived(`Tap ${key}. ${directions.filter((side) => flick[side]).map((side) =>
    `Flick ${side}: ${flick_translation_key(flick[side]!)}`).join('. ')}`);

  function caption(translation: FlickTranslation) {
    const value = typeof translation === 'string' ? { key: translation } : translation;
    return value.label ?? (value.key.length === 1 ? value.key : format_shortcut([value.key], $input_platform));
  }
  function cancel() {
    const id = pointer;
    pointer = null;
    bounds = null;
    dragging = false;
    direction = null;
    if (id !== null && element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
  function start(event: PointerEvent) {
    if (disabled || pointer !== null || event.button !== 0) return;
    event.preventDefault(); // Preserve editor focus and partial shortcut sequences.
    pointer = event.pointerId;
    bounds = element.getBoundingClientRect();
    dragging = true;
    direction = null;
    element.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (event.pointerId === pointer && bounds) direction = resolve_flick_direction(bounds, event.clientX, event.clientY);
  }
  function release(event: PointerEvent) {
    if (event.pointerId !== pointer || !bounds) return;
    event.preventDefault();
    const side = resolve_flick_direction(bounds, event.clientX, event.clientY);
    const translation = side ? flick[side] : key;
    cancel(); // Clear before dispatch: the action may unmount this keyboard.
    // An unmapped direction cancels, rather than accidentally invoking the center key.
    if (!disabled && translation !== undefined) press_virtual_key(flick_translation_key(translation), onkey);
  }
  function accessibleClick(event: MouseEvent) {
    // Pointer releases already emitted exactly one signal. Native keyboard/AT clicks have detail 0.
    if (!disabled && event.detail === 0) press_virtual_key(key, onkey);
  }
  const arrowDirections: Partial<Record<string, FlickDirection>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  function keydown(event: KeyboardEvent) {
    const side = arrowDirections[event.key];
    if (!event.altKey || !side || !flick[side]) return;
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !event.repeat) press_virtual_key(flick_translation_key(flick[side]!), onkey);
  }
  $effect(() => {
    // Changing a layout/adapter or disabling a key aborts its in-flight gesture.
    key; flick; onkey; disabled;
    untrack(cancel);
  });
  onDestroy(cancel);
</script>

<svelte:window onblur={cancel} />
<button type="button" bind:this={element} class="keyflow-key keyflow-flick-key {className}"
  class:pressed={pressed || dragging} data-flick={dragging ? direction ?? 'tap' : undefined}
  style:flex-grow={width} style:--key-color={color ?? `color-mix(in srgb, hsl(${hue} 65% 55%) 60%, var(--primary, #fff))`}
  aria-label={label ?? key} aria-describedby={descriptionId} {disabled}
  onpointerdown={start} onpointermove={move} onpointerup={release}
  onpointercancel={(event) => { if (event.pointerId === pointer) cancel(); }}
  onlostpointercapture={(event) => { if (event.pointerId === pointer) cancel(); }}
  onclick={accessibleClick} onkeydown={keydown} oncontextmenu={(event) => event.preventDefault()}>
  <span class="center" class:selected={dragging && direction === null} aria-hidden="true">
    {#if children}{@render children()}{:else}{text}{/if}
  </span>
  {#each directions as side}
    {#if flick[side]}
      <span class="hint {side}" class:selected={dragging && direction === side} aria-hidden="true">{caption(flick[side]!)}</span>
    {/if}
  {/each}
</button>
<span id={descriptionId} hidden>{description}. Alt plus an arrow activates its flick direction.</span>

<style>
  .keyflow-flick-key {
    position: relative; container-type: inline-size; flex-basis: 0; min-width: 0; min-height: var(--keyboard-key-height, 4.5rem);
    padding: .25rem; border: 1px solid var(--key-color); border-radius: var(--keyboard-key-radius, .25rem);
    color: var(--key-color); background: var(--keyboard-key-background, transparent);
    font: inherit; line-height: 1.2; cursor: pointer; touch-action: none; user-select: none;
    -webkit-user-select: none; text-align: center;
  }
  .center { display: inline-block; padding: .1em; }
  .hint { position: absolute; font-size: var(--keyboard-flick-hint-size, .6em); opacity: .75; max-width: 48%; overflow: hidden; white-space: nowrap; }
  .up { max-width: 95%; top: .25rem; left: 50%; transform: translateX(-50%); }
  .down { max-width: 95%; bottom: .25rem; left: 50%; transform: translateX(-50%); }
  .left { left: .15rem; top: 50%; transform: translateY(-50%); }
  .right { right: .15rem; top: 50%; transform: translateY(-50%); }
  @container (max-width: 3rem) {
    .left { top: 35%; }
    .right { top: 65%; }
  }
  .pressed { box-shadow: inset 0 0 0 1px var(--key-color); }
  .selected { opacity: 1; background: var(--key-color); color: var(--keyboard-pressed-color, #111); border-radius: .15em; }
  .keyflow-flick-key:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .keyflow-flick-key:disabled { opacity: .35; cursor: default; }
</style>
