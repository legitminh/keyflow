<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, href }: { children?: Snippet; href: string } = $props();
  import ButtonPositional from './ButtonPositional.svelte';
  import { flood_covered } from '../stores/flood.svelte.js';

  async function handleClose() {
    if (href) {
      await flood_covered(); // let the paint fill the screen before leaving
      window.location.href = href;
    }
  }
</script>

<ButtonPositional on_close={handleClose} flood>
  {@render children?.()}
</ButtonPositional>
