<script lang="ts">
  import type { Snippet } from 'svelte';
  import { readable } from 'svelte/store';
  import { empty_static_description, static_input, type StaticInputToken } from '../stores/static-input.js';
  import ShortcutDisplay from './ShortcutDisplay.svelte';
  let { token, children, flood = false }: {
    token?: StaticInputToken; children?: Snippet; flood?: boolean;
  } = $props();
  const empty = readable(empty_static_description);
  const progress = static_input.progress;
  let description = $derived(token?.description ?? empty);
  let matched = $derived($progress.depth > 0 && $description.nodes[$progress.depth - 1] === $progress.node);
  let count = $derived(matched ? $progress.depth : 0);
  let entered = $derived($description.labels.slice(0, count).join(''));
  let pending = $derived($description.labels.slice(count).join(''));
  let complete = $derived(matched && $progress.complete && count === $description.labels.length);
  // Recomputed only when the registered label changes, never by scanning other controls.
  let hue = $derived(Array.from($description.label).reduce((value, key) => (value * 31 + key.charCodeAt(0)) % 360, 0));
</script>

<ShortcutDisplay {entered} {pending} {complete} {hue} floods={flood} {children} />
