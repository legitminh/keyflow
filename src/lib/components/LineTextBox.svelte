<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import TextBox from './TextBox.svelte';
  import type { TextBoxController } from '../textbox.js';
  import type { TextComposition } from '../text-input-method.js';

  let { value = $bindable(''), ...props }: Omit<ComponentProps<typeof TextBox>, 'singleLine' | 'rows' | 'wrap'> = $props();
  let box = $state<TextBoxController>();

  export async function enter() { await box?.enter(); }
  export async function exit() { await box?.exit(); }
  export function edit(change: (composition: TextComposition) => void) { return box?.edit(change) ?? false; }
</script>

<TextBox {...props} bind:this={box} bind:value singleLine />
