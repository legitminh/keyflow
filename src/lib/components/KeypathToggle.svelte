<!-- Switches between showing and hiding shortcut keypaths in front of buttons. -->
<script lang="ts">
  import { keypath_visibility } from '../stores/keypath.svelte.js';
  import ButtonPositional from './ButtonPositional.svelte';
  let { shown_label = 'keypaths shown', hidden_label = 'keypaths hidden' }: {
    shown_label?: string; hidden_label?: string;
  } = $props();
</script>

<ButtonPositional on_close={() => keypath_visibility.toggle()}>
  {keypath_visibility.visible ? shown_label : hidden_label}
</ButtonPositional>
