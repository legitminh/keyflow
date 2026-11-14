<!-- Visibility-scoped positional button with a hover/focus route overlay. -->
<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import type { InputToken } from '../stores/input.js';
  import InteractablePositional from './InteractablePositional.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';

  let { children, on_close = () => {}, on_enter, on_exit, flood = false }: {
    children?: Snippet; on_close?: () => void; flood?: boolean;
  } & InteractionHandlers = $props();
  let token = $state<InputToken>();
</script>

<InteractablePositional bind:myToken={token} {on_close} {on_enter} {on_exit}>
  <ButtonDisplay {token} {children} {flood} overlay />
</InteractablePositional>
