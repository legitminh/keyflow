<!-- Persistent automatic or explicit shortcut button with a hover/focus route overlay. -->
<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import type { InputToken } from '../stores/input.js';
  import Interactable from './Interactable.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticInteractable from './StaticInteractable.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';
  import type { StaticInputToken } from '../stores/static-input.js';
  import type { Shortcut } from '../shortcuts.js';

  let { children, on_close = () => {}, disabled = false, on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, priority = undefined, keys }: {
    children?: Snippet; on_close?: () => void; disabled?: boolean; priority?: number; keys?: Shortcut;
  } & InteractionHandlers = $props();
  let token = $state<InputToken>();
  let staticToken = $state<StaticInputToken>();
</script>

{#if keys !== undefined}
  <StaticInteractable {keys} bind:myToken={staticToken} {on_close} {disabled} {on_enter} {on_exit} {on_pressed_down} {on_pressed_up} {on_cursor_enter} {on_cursor_exit}>
    <StaticButtonDisplay token={staticToken} {children} overlay />
  </StaticInteractable>
{:else}
  <Interactable {priority} bind:myToken={token} {on_close} {disabled} {on_enter} {on_exit} {on_pressed_down} {on_pressed_up} {on_cursor_enter} {on_cursor_exit}>
    <ButtonDisplay {token} {children} overlay />
  </Interactable>
{/if}
