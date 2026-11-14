<!-- 
 * InteractablePositional component is an interactable that only exists if it is visible!
 * 
 * This component is used to create an interactable element which have its position acting as the priority of the input token. The higher the position, the higher the priority. The lower the position, the lower the priority.
 * It takes in the following props:
 * - children: The content to be rendered inside the button.
 * - on_close: A function to be called when the button is clicked.
-->
<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';

  import type { InputToken } from '../stores/input.js';

  // visibility management
  import { visibility } from '../actions/visibility.js';
  import Interactable from './Interactable.svelte';

  let {
    children,
    on_close = () => {},
    on_enter, on_exit,
    myToken = $bindable()
  }: { children?: Snippet; on_close?: () => void; myToken?: InputToken } & InteractionHandlers = $props();

  let visible = $state(false);
</script>

<Interactable {on_close} {on_enter} {on_exit} bind:myToken registered={visible}>
  <div use:visibility={{ onFullyVisible: () => visible = true, onHidden: () => visible = false }}>
    {@render children?.()}
  </div>
</Interactable>
