<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { initializeKeyflow, type KeyflowOptions } from '../runtime.js';
  import { provide_input_frame } from '../input-frame-context.js';
  import { root_input_frame } from '../input-frames.js';
  import FloodOverlay from './FloodOverlay.svelte';

  let { children, options = {} }: { children: Snippet; options?: KeyflowOptions } = $props();
  provide_input_frame(root_input_frame);
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
