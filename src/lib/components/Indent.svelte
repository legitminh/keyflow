<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<div style="padding-left: var(--min-box)">
  {@render children?.()}
</div>
