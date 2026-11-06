<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Shortcut } from '../shortcuts.js';
  import { create_static_token, static_input, type StaticInputToken } from '../stores/static-input.js';

  let { keys, on_close, children, myToken = $bindable() }: {
    keys: Shortcut; on_close: () => void; children?: Snippet; myToken?: StaticInputToken;
  } = $props();
  const token = create_static_token(() => on_close());
  const description = token.description;
  const descriptionId = $props.id();
  $effect(() => {
    myToken = token;
    return static_input.register(token, keys);
  });
</script>

<button type="button" onclick={on_close} class="inline cursor-pointer"
  aria-describedby={descriptionId}>
  {@render children?.()}
</button>
<span id={descriptionId} hidden>Shortcut: {$description.label}</span>
