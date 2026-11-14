<script lang="ts">
  import type { InteractionHandlers } from '../interaction.js';
  import type { Snippet } from 'svelte';
  import type { KeyboardLayout, KeyboardKey } from '../keyboards.js';
  import type { VirtualKeyHandler } from '../input-events.js';
  import FlickKeyDisplay from './FlickKeyDisplay.svelte';
  import KeyboardKeyDisplay from './KeyboardKeyDisplay.svelte';
  let { layout, toolbar, children, keyDisplay, onkey, on_enter, on_exit, colors = {}, class: className = '' }: {
    layout?: KeyboardLayout; toolbar?: Snippet; children?: Snippet;
    keyDisplay?: Snippet<[KeyboardKey]>; onkey?: VirtualKeyHandler;
    colors?: Readonly<Record<string, string>>; class?: string;
  } & InteractionHandlers = $props();
</script>

<section class="keyflow-keyboard {className}" data-layout={layout?.id} aria-label={layout?.label ?? 'Virtual keyboard'}>
  {#if toolbar}<div class="keyboard-toolbar" role="group" aria-label="Keyboard controls">{@render toolbar()}</div>{/if}
  {#if layout}
    {#each layout.rows as row}
      <div class="keyboard-row">
        {#each row as key}
          {#if keyDisplay}{@render keyDisplay(key)}
          {:else if key.flick}<FlickKeyDisplay {...key} color={colors[key.key] ?? key.color} {onkey} on_enter={key.on_enter ?? on_enter} on_exit={key.on_exit ?? on_exit} />
          {:else}<KeyboardKeyDisplay {...key} color={colors[key.key] ?? key.color} {onkey} on_enter={key.on_enter ?? on_enter} on_exit={key.on_exit ?? on_exit} />{/if}
        {/each}
      </div>
    {/each}
  {/if}
  {@render children?.()}
</section>

<style>
  .keyflow-keyboard {
    display: flex; flex-direction: column; gap: var(--keyboard-gap, .3rem);
    padding: var(--keyboard-padding, .5rem); width: 100%; box-sizing: border-box;
    background: var(--keyboard-background, var(--background, #171717));
    font-family: var(--keyboard-font, monospace);
    font-size: var(--keyboard-font-size, .875rem);
  }
  .keyboard-row { display: flex; gap: var(--keyboard-gap, .3rem); }
  .keyboard-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
</style>
