<script lang="ts">
  import type { Snippet } from 'svelte';
  import { flood } from '../actions/flood.js';
  let { entered, pending, complete, hue, floods = false, children }: {
    entered: string; pending: string; complete: boolean; hue: number;
    floods?: boolean; children?: Snippet;
  } = $props();
</script>

<div class="button">
  <div class="route" use:flood={{ enabled: floods, active: complete, color: `hsla(${hue}, 100%, 50%, 0.75)` }}>
    {#if entered}
      <div class="enter_route" style:background-color={`hsla(${hue}, 100%, 50%, 0.75)`}>{entered}</div>
    {/if}
    {#if pending}
      <div class="pending_route" style:background-color={`hsla(${hue}, 100%, 50%, 0.25)`}>{pending}</div>
    {/if}
  </div>
  {#if children}
    <div class="content" style:background-color={`hsla(${hue}, 100%, 50%, 0.125)`}>
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .button { display: flex; flex-wrap: wrap; }
  .route { display: flex; flex: none; white-space: nowrap; color: var(--tertiary); }
  .content { flex: 1 1 0; }
</style>
