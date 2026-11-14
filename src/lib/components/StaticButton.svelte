<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import type { Shortcut } from '../shortcuts.js';
  import type { StaticInputToken } from '../stores/static-input.js';
  import StaticInteractable from './StaticInteractable.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';
  let { keys, on_close = () => {}, disabled = false, on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, children, flood = false }: {
    keys: Shortcut; on_close?: () => void; disabled?: boolean; children?: Snippet; flood?: boolean;
  } & InteractionHandlers = $props();
  let token = $state<StaticInputToken>();
</script>

<StaticInteractable {keys} {on_close} {disabled} {on_enter} {on_exit} {on_pressed_down} {on_pressed_up} {on_cursor_enter} {on_cursor_exit} bind:myToken={token}>
  <StaticButtonDisplay {token} {flood} {children} />
</StaticInteractable>
