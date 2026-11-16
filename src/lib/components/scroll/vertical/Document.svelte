<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ScrollKeys } from '../../../scroll.js';
  import ScrollIndicator from './ScrollIndicator.svelte';
  import Camera from './Camera.svelte';
  let { children, scrollKeys = {} }: { children: Snippet; scrollKeys?: ScrollKeys | false } = $props();
</script>

<Camera>
  {@render children()}
</Camera>
<ScrollIndicator keys={scrollKeys} />
