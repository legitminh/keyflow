<!-- 
  button that displays key route and only exist if visible
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    children,
    on_close,
    priority = undefined
  }: { children?: Snippet; on_close: () => void; priority?: number } = $props();

  import Interactable from './Interactable.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import type { InputToken } from '../stores/input.js';

  let positionalToken = $state<InputToken | undefined>();
</script>

<Interactable bind:priority bind:myToken={positionalToken} {on_close}>
  <ButtonDisplay token={positionalToken} {children} />
</Interactable>
