<!-- 
 * InteractablePositional component is an interactable that only exists if it is visible!
 * 
 * This component is used to create an interactable element which have its position acting as the priority of the input token. The higher the position, the higher the priority. The lower the position, the lower the priority.
 * It takes in the following props:
 * - children: The content to be rendered inside the button.
 * - on_close: A function to be called when the button is clicked.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import { add_input_token, remove_input_token, type InputToken } from '../stores/input.js';

  // visibility management
  import { visibility } from '../actions/visibility.js';
  import Interactable from './Interactable.svelte';

  let {
    children,
    on_close,
    myToken = $bindable()
  }: { children?: Snippet; on_close: () => void; myToken?: InputToken } = $props();

  function register() {
    if (!myToken) return;
    add_input_token(myToken);
  }

  function unregister() {
    if (myToken) remove_input_token(myToken);
  }
</script>

<Interactable {on_close} bind:myToken>
  <div use:visibility={{ onFullyVisible: register, onHidden: unregister }}>
    {@render children?.()}
  </div>
</Interactable>
