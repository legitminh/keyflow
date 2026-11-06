<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Shortcut } from '../shortcuts.js';
  import type { StaticInputToken } from '../stores/static-input.js';
  import StaticInteractable from './StaticInteractable.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';
  let { keys, on_close, children, flood = false }: {
    keys: Shortcut; on_close: () => void; children?: Snippet; flood?: boolean;
  } = $props();
  let token = $state<StaticInputToken>();
</script>

<StaticInteractable {keys} {on_close} bind:myToken={token}>
  <StaticButtonDisplay {token} {flood} {children} />
</StaticInteractable>
