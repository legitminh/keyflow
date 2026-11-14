<script lang="ts">
  import { input_token_interaction, type InteractionHandlers } from '../interaction.js';
  import { interaction } from '../actions/interaction.js';
  import type { Snippet } from 'svelte';
  import type { Shortcut } from '../shortcuts.js';
  import { create_static_token, type StaticInputToken } from '../stores/static-input.js';

  import { active_input_frame } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  const frame = get_input_frame();
  const { static_input } = frame;
  let { keys, on_close = () => {}, disabled = false, on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, children, myToken = $bindable() }: {
    keys: Shortcut; on_close?: () => void; disabled?: boolean; children?: Snippet; myToken?: StaticInputToken;
  } & InteractionHandlers = $props();
  const token = create_static_token(() => on_close());
  token.on_enter = (event) => on_enter?.(event);
  token.on_pressed_down = (event) => (on_pressed_down ?? on_enter)?.(event);
  token.on_pressed_up = (event) => (on_pressed_up ?? on_exit)?.(event);
  token.on_cursor_enter = (event) => (on_cursor_enter ?? on_enter)?.(event);
  token.on_cursor_exit = (event) => (on_cursor_exit ?? on_exit)?.(event);
  token.on_exit = (event) => on_exit?.(event);
  const description = token.description;
  const descriptionId = $props.id();
  $effect(() => {
    myToken = token;
    if (!disabled) return static_input.register(token, keys);
  });
</script>

<button type="button" use:interaction={{ controller: input_token_interaction(token), disabled: disabled || $active_input_frame !== frame }} disabled={disabled || $active_input_frame !== frame}
  onclick={() => { if (!disabled) frame.trigger(token, false); }} class="inline cursor-pointer"
  aria-describedby={descriptionId}>
  {@render children?.()}
</button>
<span id={descriptionId} hidden>{$active_input_frame === frame ? `Shortcut: ${$description.label}` : 'Inactive input frame'}</span>
