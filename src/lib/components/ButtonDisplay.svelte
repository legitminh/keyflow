<!-- Displays an automatically assigned shortcut using cached token routes and indices. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    map_numeric_route, map_key_route, map_input_index, list_key_strokes, type InputToken
  } from '../stores/input.js';
  import ShortcutDisplay from './ShortcutDisplay.svelte';
  let { children, token, flood = false }: {
    children?: Snippet; token?: InputToken; flood?: boolean;
  } = $props();
  let route = $derived(token ? $map_numeric_route.get(token) ?? [] : []);
  let labels = $derived(token ? $map_key_route.get(token) ?? [] : []);
  let count = $derived($list_key_strokes.every((key, index) => key === route[index]) ? $list_key_strokes.length : 0);
  let entered = $derived(labels.slice(0, count).join(''));
  let pending = $derived(labels.slice(count).join(''));
  let hue = $derived(((token ? $map_input_index.get(token) ?? 0 : 0) * 61) % 360);
  let complete = $derived(route.length > 0 && count === route.length);
</script>

<ShortcutDisplay {entered} {pending} {complete} {hue} floods={flood} {children} />
