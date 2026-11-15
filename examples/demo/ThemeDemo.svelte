<script lang="ts">
  import { Keyflow, ThemeToggle, get_current_theme, type KeyflowOptions } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';

  let mounted = $state(true);
  const options: KeyflowOptions = {
    themeId: 'system',
    themes: [
      { name: 'night', colorScheme: 'dark', name_to_color: { '--background': '#112233' } },
      { name: 'paper', colorScheme: 'light', name_to_color: { '--background': '#ddeeff' } }
    ]
  };
</script>

<label><input type="checkbox" bind:checked={mounted} />Mount Keyflow</label>
{#if mounted}
  <Keyflow {options}>
    <ThemeToggle />
    <output aria-label="Resolved palette">{get_current_theme().name}</output>
  </Keyflow>
{/if}
