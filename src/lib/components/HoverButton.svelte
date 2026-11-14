<!-- Persistent automatic button whose route overlays its content on hover or keyboard focus. -->
<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import type { InputToken } from '../stores/input.js';
  import Interactable from './Interactable.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';

  let { children, on_close = () => {}, disabled = false, on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, priority = undefined }: {
    children?: Snippet; on_close?: () => void; disabled?: boolean; priority?: number;
  } & InteractionHandlers = $props();
  let token = $state<InputToken>();
</script>

<Interactable {priority} bind:myToken={token} {on_close} {disabled} {on_enter} {on_exit} {on_pressed_down} {on_pressed_up} {on_cursor_enter} {on_cursor_exit}>
  <ButtonDisplay {token} {children} overlay />
</Interactable>
