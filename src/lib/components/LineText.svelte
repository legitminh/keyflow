<script lang="ts">
  import type { Snippet } from 'svelte';
  import { must_view } from '../actions/must_view.js';

  let { children }: { children?: Snippet } = $props();
</script>

<div class="line" use:must_view>
  {@render children?.()}
</div>

<style>
  .line {
    max-width: calc(var(--min-box) * 32);
    margin-left: calc(var(--min-box) / 4);
    margin-right: calc(var(--min-box) / 4);
  }
</style>
