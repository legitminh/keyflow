<!-- 
  button that displays key route and only exist if visible
-->
<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  let {
    children,
    on_close = () => {},
    on_enter, on_exit,
    flood = false
  }: { children?: Snippet; on_close?: () => void; flood?: boolean } & InteractionHandlers = $props();

  import InteractablePositional from './InteractablePositional.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import type { InputToken } from '../stores/input.js';

  let positionalToken = $state<InputToken | undefined>();
</script>

<InteractablePositional bind:myToken={positionalToken} {on_close} {on_enter} {on_exit}>
  <ButtonDisplay token={positionalToken} {flood} {children} />
</InteractablePositional>
