<script lang="ts">
  import type { Snippet } from 'svelte';
  import ScrollIndicator from './ScrollIndicator.svelte';
  import Camera from './Camera.svelte';
  let { children }: { children: Snippet } = $props();
</script>

<Camera>
  {@render children()}
</Camera>
<ScrollIndicator />
