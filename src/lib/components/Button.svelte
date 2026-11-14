<!-- 
  Persistent button with a displayed shortcut. Omitting priority uses positional ordering.
-->
<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  let {
    children,
    on_close = () => {},
    on_enter, on_exit,
    priority = undefined
  }: { children?: Snippet; on_close?: () => void; priority?: number } & InteractionHandlers = $props();

  import Interactable from './Interactable.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import type { InputToken } from '../stores/input.js';

  let positionalToken = $state<InputToken | undefined>();
</script>

<Interactable bind:priority bind:myToken={positionalToken} {on_close} {on_enter} {on_exit}>
  <ButtonDisplay token={positionalToken} {children} />
</Interactable>
