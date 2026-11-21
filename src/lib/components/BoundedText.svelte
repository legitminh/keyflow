<!--
  Single-line text whose width is bounded; longer content scrolls horizontally (native scrolling).
  `limit` is measured in `unit` (characters by default), so `limit={16}` fits 16 monospace characters.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { text = '', children, limit = 16, unit = 'ch', label, class: className = '' }: {
    /** Plain text content; ignored when `children` is supplied. */
    text?: string;
    /** Custom content rendered inside the bounded, scrollable box. */
    children?: Snippet;
    /** Maximum width before horizontal scrolling, in `unit`s. */
    limit?: number;
    /** CSS unit for `limit`, e.g. `ch`, `em`, `px`, `rem`. */
    unit?: string;
    /** Accessible name for the scroll region; defaults to `text`. */
    label?: string;
    class?: string;
  } = $props();
  let box = $state<HTMLElement>();
  let overflowing = $state(false);
  $effect(() => {
    void text; void limit; void unit;
    if (!box) return;
    const measure = () => { if (box) overflowing = box.scrollWidth > box.clientWidth + 1; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  });
</script>

<!-- Focusable only when it can scroll, so keyboard users can reach the hidden part. -->
<span class="keyflow-bounded-text {className}" class:overflowing bind:this={box} style:max-width={`${limit}${unit}`}
  title={text || undefined} tabindex={overflowing ? 0 : undefined} role={overflowing ? 'region' : undefined}
  aria-label={overflowing ? label ?? (text || undefined) : undefined}>
  <span class="keyflow-bounded-text-content">{#if children}{@render children()}{:else}{text}{/if}</span>
</span>

<style>
  .keyflow-bounded-text { display: inline-block; max-width: 16ch; overflow-x: auto; overflow-y: hidden; white-space: nowrap; vertical-align: middle;
    overscroll-behavior-x: contain; scrollbar-width: thin; box-sizing: content-box; }
  .keyflow-bounded-text-content { display: inline-block; white-space: nowrap; }
  .overflowing { scroll-snap-type: none; }
</style>
