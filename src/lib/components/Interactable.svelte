<!-- Registers a persistent automatic token in the nearest InputFrame. -->
<script lang="ts">
  import { input_token_interaction, type InteractionHandlers } from '../interaction.js';
  import { interaction } from '../actions/interaction.js';
  import type { Snippet } from 'svelte';
  import { onMount, untrack } from 'svelte';

  import type { InputToken } from '../stores/input.js';
  import { active_input_frame } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  import { state_viewport } from '../stores/camera.svelte.js';
  const frame = get_input_frame();

  let {
    children = undefined,
    on_close = () => {}, disabled = false,
    on_enter, on_exit, on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit,
    priority = $bindable(),
    myToken = $bindable(),
    registered = true
  }: {
    children?: Snippet;
    on_close?: () => void; disabled?: boolean;
    priority?: number;
    myToken?: InputToken;
    /** False lets a visibility wrapper manage registration. */
    registered?: boolean;
  } & InteractionHandlers = $props();
  let internalToken = $state<InputToken>({
    priority: 0,
    on_close: () => on_close?.(),
    on_enter: (event) => on_enter?.(event),
    on_pressed_down: (event) => (on_pressed_down ?? on_enter)?.(event),
    on_pressed_up: (event) => (on_pressed_up ?? on_exit)?.(event),
    on_cursor_enter: (event) => (on_cursor_enter ?? on_enter)?.(event),
    on_cursor_exit: (event) => (on_cursor_exit ?? on_exit)?.(event),
    on_exit: (event) => on_exit?.(event)
  });

  if (!myToken) {
    myToken = internalToken;
  }

  $effect(() => {
    const token = myToken;
    const explicitPriority = priority;
    // Re-measure when the camera or element becomes available, without tracking token writes.
    state_viewport.world;
    element;
    if (!token) return;
    untrack(() => {
      token.on_close = () => on_close?.();
      token.on_enter = (event) => on_enter?.(event);
      token.on_pressed_down = (event) => (on_pressed_down ?? on_enter)?.(event);
      token.on_pressed_up = (event) => (on_pressed_up ?? on_exit)?.(event);
      token.on_cursor_enter = (event) => (on_cursor_enter ?? on_enter)?.(event);
      token.on_cursor_exit = (event) => (on_cursor_exit ?? on_exit)?.(event);
      token.on_exit = (event) => on_exit?.(event);
      if (explicitPriority === undefined) update_priority();
      else frame.update(token, explicitPriority);
    });
  });

  const is_positional_priority = $derived(priority === undefined);

  function update_priority() {
    if (is_positional_priority && state_viewport.world && element && myToken) {
      const rect = element.getBoundingClientRect();
      const world_rect = state_viewport.world?.getBoundingClientRect();
      myToken.priority =
        (rect.top - world_rect.top) * window.innerWidth + (rect.left - world_rect.left);
      frame.update(myToken, myToken.priority);
    }
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(update_priority);
    if (element) resizeObserver.observe(element);

    // Dynamically mounted controls should enter the list in their measured position.
    update_priority();

    window.addEventListener('scroll', update_priority, { passive: true });
    window.addEventListener('resize', update_priority);
    return () => {
      window.removeEventListener('scroll', update_priority);
      window.removeEventListener('resize', update_priority);
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    const token = myToken;
    if (registered && !disabled && token) return untrack(() => frame.register(token));
  });

  let element = $state<HTMLButtonElement>();
</script>

{#if children}
  <button type="button" bind:this={element}
    use:interaction={{ controller: myToken ? input_token_interaction(myToken) : undefined, disabled: disabled || $active_input_frame !== frame }} disabled={disabled || $active_input_frame !== frame}
    onclick={() => { if (!disabled && myToken) frame.trigger(myToken, false); }} class="inline cursor-pointer">
    {@render children?.()}
  </button>
{/if}
