<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { initializeKeyflow, type KeyflowOptions } from '../runtime.js';
  import FloodOverlay from './FloodOverlay.svelte';

  let { children, options = {} }: { children: Snippet; options?: KeyflowOptions } = $props();
  onMount(() => initializeKeyflow(options));
</script>

<div class="keyflow">{@render children()}</div>
<FloodOverlay />

<style>
  .keyflow {
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 100dvh;
    height: 100dvh;
    overflow: hidden;
  }
</style>
