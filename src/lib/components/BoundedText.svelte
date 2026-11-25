<!--
  Single-line text whose width is bounded. Longer content scrolls itself in an endless marquee loop:
  it rests at its start for `pause` milliseconds, glides left at `speed` pixels per second until the next
  copy of the start is back in place, then repeats. There is no scrollbar and nothing for the user to scroll.
  `limit` is measured in `unit` (characters by default), so `limit={16}` fits 16 monospace characters.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { text = '', children, limit = 16, unit = 'ch', speed = 40, pause = 1500, gap = '3ch', label, class: className = '' }: {
    /** Plain text content; ignored when `children` is supplied. */
    text?: string;
    /** Custom content rendered inside the bounded box. */
    children?: Snippet;
    /** Maximum width before the content starts auto-scrolling, in `unit`s. */
    limit?: number;
    /** CSS unit for `limit`, e.g. `ch`, `em`, `px`, `rem`. */
    unit?: string;
    /** Auto-scroll speed in pixels per second. */
    speed?: number;
    /** Rest at the start of every cycle, in milliseconds. */
    pause?: number;
    /** Space between the end of the content and its repeated start, as a CSS length. */
    gap?: string;
    /** Tooltip naming the full content; defaults to `text`. */
    label?: string;
    class?: string;
  } = $props();
  let box = $state<HTMLElement>();
  let track = $state<HTMLElement>();
  let content = $state<HTMLElement>();
  let copy = $state<HTMLElement>();
  let overflowing = $state(false);
  let reducedMotion = $state(false);

  $effect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion = query.matches; };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  $effect(() => {
    void text; void limit; void unit;
    if (!box || !content) return;
    const measure = () => { if (box && content) overflowing = content.offsetWidth > box.clientWidth + 1; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  });

  $effect(() => {
    void text; void gap;
    if (!overflowing || reducedMotion || !track || !content || !copy) return;
    const node = track;
    let animation: Animation | undefined;
    let distance = 0;
    const start = () => {
      // One cycle moves exactly one content width plus the gap, so the copy lands where the original began.
      const next = copy && content ? copy.offsetLeft - content.offsetLeft : 0;
      if (next <= 0 || next === distance) return;
      distance = next;
      animation?.cancel();
      const travel = (distance / Math.max(speed, 1)) * 1000;
      const rest = Math.max(pause, 0);
      animation = node.animate([
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: rest / (rest + travel) },
        { transform: `translateX(${-distance}px)`, offset: 1 }
      ], { duration: rest + travel, iterations: Infinity, easing: 'linear' });
    };
    start();
    const observer = new ResizeObserver(start);
    observer.observe(content);
    return () => { observer.disconnect(); animation?.cancel(); };
  });
</script>

<span class="keyflow-bounded-text {className}" class:overflowing bind:this={box} style:max-width={`${limit}${unit}`}
  title={label ?? (text || undefined)}>
  <span class="keyflow-bounded-text-track" bind:this={track}>
    <span class="keyflow-bounded-text-content" bind:this={content}>{#if children}{@render children()}{:else}{text}{/if}</span>
    {#if overflowing && !reducedMotion}
      <!-- Visual repeat of the start for a seamless loop; hidden from assistive tech and interaction. -->
      <span class="keyflow-bounded-text-content keyflow-bounded-text-copy" bind:this={copy} style:padding-left={gap}
        aria-hidden="true" inert>{#if children}{@render children()}{:else}{text}{/if}</span>
    {/if}
  </span>
</span>

<style>
  .keyflow-bounded-text { display: inline-block; max-width: 16ch; overflow: hidden; white-space: nowrap; vertical-align: middle;
    box-sizing: content-box; }
  .keyflow-bounded-text-track { display: inline-block; white-space: nowrap; will-change: transform; }
  .keyflow-bounded-text-content { display: inline-block; white-space: nowrap; }
</style>
