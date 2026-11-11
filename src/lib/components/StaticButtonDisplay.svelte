<script lang="ts">
  import type { Snippet } from 'svelte';
  import { readable } from 'svelte/store';
  import { empty_static_description, type StaticInputToken } from '../stores/static-input.js';
  import { input_token_activation } from '../stores/activation.js';
  import ShortcutDisplay from './ShortcutDisplay.svelte';
  import { active_input_frame } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  const frame = get_input_frame();
  const { static_input } = frame;
  let { token, children, flood = false }: {
    token?: StaticInputToken; children?: Snippet; flood?: boolean;
  } = $props();
  let activation = $derived(input_token_activation(token));
  let activated = $derived($active_input_frame === frame && $activation);
  const empty = readable(empty_static_description);
  const progress = static_input.progress;
  let description = $derived(token?.description ?? empty);
  let matched = $derived($progress.depth > 0 && $description.nodes[$progress.depth - 1] === $progress.node);
  let count = $derived(matched ? $progress.depth : 0);
  let entered = $derived($description.labels.slice(0, count).join(''));
  let pending = $derived($active_input_frame === frame ? $description.labels.slice(count).join('') : '');
  let complete = $derived(matched && $progress.complete && count === $description.labels.length);
  // Recomputed only when the registered label changes, never by scanning other controls.
  let hue = $derived(Array.from($description.label).reduce((value, key) => (value * 31 + key.charCodeAt(0)) % 360, 0));
</script>

<ShortcutDisplay {activated} {entered} {pending} {complete} {hue} floods={flood} {children} />
