<script lang="ts">
  import { themes, set_theme_id, state_theme } from '../stores/theme.svelte.js';
  import ButtonPositional from './ButtonPositional.svelte';

  function toggle_theme() {
    set_theme_id((state_theme.theme_id + 1) % themes.length);
  }

  let theme_name = $derived(themes[state_theme.theme_id]?.name ?? 'unknown');
</script>

<ButtonPositional on_close={toggle_theme}>
  {theme_name}
</ButtonPositional>
