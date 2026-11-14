<script lang="ts">
  import type { Snippet } from 'svelte';
  import { flood } from '../actions/flood.js';
  let { entered, pending, complete, hue, activated = false, floods = false, overlay = false, children }: {
    entered: string; pending: string; complete: boolean; hue: number;
    activated?: boolean; floods?: boolean; overlay?: boolean; children?: Snippet;
  } = $props();
</script>

<div class="button" class:overlay class:highlighted={complete || activated} style:--shortcut-hue={hue}>
  <div class="route" aria-hidden={overlay ? true : undefined}
    use:flood={{ enabled: floods, active: complete, color: `hsla(${hue}, 100%, 50%, 0.75)` }}>
    {#if entered}
      <div class="enter_route" style:background-color={`hsla(${hue}, 100%, 50%, 0.75)`}>{entered}</div>
    {/if}
    {#if pending}
      <div class="pending_route">{pending}</div>
    {/if}
  </div>
  {#if children}
    <div class="content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .button { display: flex; flex-wrap: wrap; }
  .route { display: flex; flex: none; white-space: nowrap; color: var(--tertiary); }
  .content { flex: 1 1 0; background-color: hsl(var(--shortcut-hue) 100% 50% / .125); }
  .pending_route { background-color: hsl(var(--shortcut-hue) 100% 50% / .25); }
  .button.highlighted .content,
  :global(button:not(:disabled):active) .button .content { background-color: hsl(var(--shortcut-hue) 100% 50% / .35); }
  .button.highlighted .pending_route,
  :global(button:not(:disabled):active) .button .pending_route { background-color: hsl(var(--shortcut-hue) 100% 50% / .75); }
  .button.overlay { position: relative; }
  .overlay .route {
    position: absolute; inset-block-start: 0; inset-inline-end: 0; z-index: 1;
    visibility: hidden; pointer-events: none; background: var(--background, #fff);
    box-shadow: 0 0 0 1px currentColor;
  }
  :global(button:hover) .overlay .route,
  :global(button:focus-visible) .overlay .route { visibility: visible; }
</style>
