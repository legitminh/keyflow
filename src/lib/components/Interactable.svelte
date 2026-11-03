<!-- 
 * Interactable component
 * 
 * This component is used to create an interactable element that can be closed.
 * It takes in the following props:
 * - children: The content to be rendered inside the button.
 * - on_close: A function to be called when the button is clicked.
 * - priority: The priority of the input token (default is 0).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  import {
    add_input_token,
    remove_input_token,
    update_list_input_token,
    type InputToken
  } from '../stores/input.js';
  import { state_viewport } from '../stores/camera.svelte.js';

  let {
    children = undefined,
    on_close,
    priority = $bindable(),
    myToken = $bindable()
  }: {
    children?: Snippet;
    on_close: () => void;
    priority?: number;
    myToken?: InputToken;
  } = $props();
  let internalToken = $state<InputToken>({
    priority: 0,
    on_close: () => on_close?.()
  });

  if (!myToken) {
    myToken = internalToken;
  }

  $effect(() => {
    if (!myToken) return;
    myToken.on_close = () => on_close?.();
    myToken.priority = priority ?? 0;
  });

  const is_positional_priority = $derived(priority === undefined);

  function update_priority() {
    if (is_positional_priority && state_viewport.world && element && myToken) {
      const rect = element.getBoundingClientRect();
      const world_rect = state_viewport.world?.getBoundingClientRect();
      myToken.priority =
        (rect.top - world_rect.top) * window.innerWidth + (rect.left - world_rect.left); //must update this so that in the case the element isn't added to the list, it will still have the correct priority when added later
      update_list_input_token(myToken, myToken.priority);
      // console.log("all interactble positional priority change due to screen rescaling!", myToken.priority)
    }
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(update_priority);
    if (element) resizeObserver.observe(element);

    add_input_token(myToken);
    window.addEventListener('scroll', update_priority, { passive: true });
    window.addEventListener('resize', update_priority);
    return () => {
      window.removeEventListener('scroll', update_priority);
      window.removeEventListener('resize', update_priority);
      resizeObserver.disconnect();
      if (myToken) remove_input_token(myToken);
    };
  });

  let element = $state<HTMLButtonElement>();
</script>

{#if children}
  <button type="button" bind:this={element} onclick={on_close} class="inline cursor-pointer">
    {@render children?.()}
  </button>
{/if}
