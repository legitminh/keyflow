<script lang="ts">
  import { create_interaction, type InteractionHandlers } from '../interaction.js';
  import { interaction } from '../actions/interaction.js';
  import type { Snippet } from 'svelte';
  import { format_shortcut } from '../shortcuts.js';
  import { press_virtual_key, type VirtualKeyHandler } from '../input-events.js';
  import { input_platform } from '../input-frames.js';

  let { key, label, color, width = 1, disabled = false, pressed = false,
    onkey, on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, children, class: className = '' }: {
    key: string; label?: string; color?: string; width?: number; disabled?: boolean;
    pressed?: boolean; onkey?: VirtualKeyHandler; children?: Snippet; class?: string;
  } & InteractionHandlers = $props();
  const lifecycle = create_interaction(() => ({ on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit }));
  let text = $derived(label ?? format_shortcut([key], $input_platform));
  let hue = $derived(Array.from(key).reduce((n, char) => (n * 31 + char.charCodeAt(0) * 61) % 360, 0));
</script>

<button type="button" use:interaction={{ controller: lifecycle, disabled, key }} class="keyflow-key {className}" class:pressed
  style:flex-grow={width} style:--key-color={color ?? `color-mix(in srgb, hsl(${hue} 65% 55%) 60%, var(--primary, #fff))`}
  aria-label={label ?? key} {disabled}
  onpointerdown={(event) => event.preventDefault()}
  onclick={() => press_virtual_key(key, onkey)}>
  {#if children}{@render children()}{:else}<span aria-hidden="true">[{text}]</span>{/if}
</button>

<style>
  .keyflow-key {
    flex-basis: 0; min-width: 0; min-height: var(--keyboard-key-height, 2.75rem);
    padding: .35rem .15rem; border: 1px solid var(--key-color); border-radius: var(--keyboard-key-radius, .25rem);
    color: var(--key-color); background: var(--keyboard-key-background, transparent);
    font: inherit; line-height: 1.2; cursor: pointer; touch-action: manipulation;
  }
  .keyflow-key:active, .keyflow-key.pressed { background: var(--key-color); color: var(--keyboard-pressed-color, #111); }
  .keyflow-key:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .keyflow-key:disabled { opacity: .35; cursor: default; }
</style>
