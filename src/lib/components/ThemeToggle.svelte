<script lang="ts">
  import { themes, set_theme_id, state_theme } from '../stores/theme.svelte.js';
  import ButtonPositional from './ButtonPositional.svelte';

  function toggle_theme() {
    const current = state_theme.theme_id;
    set_theme_id(current === 'system' ? 0 : current + 1 < themes.length ? current + 1 : 'system');
  }

  let theme_name = $derived(state_theme.theme_id === 'system' ? 'system' : themes[state_theme.theme_id]?.name ?? 'unknown');
</script>

<ButtonPositional on_close={toggle_theme}>
  {theme_name}
</ButtonPositional>
