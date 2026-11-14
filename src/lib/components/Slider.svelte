<!-- Internal composition shared by the four public presets. -->
<script lang="ts">
  import SliderCore from './SliderCore.svelte';
  import HoverButton from './HoverButton.svelte';
  import ButtonPositional from './ButtonPositional.svelte';
  import type { HoverSliderProps, SliderController } from '../slider.js';

  let { value = $bindable(0), orientation = 'horizontal', mode = 'hover', controls,
    decreaseKeys, increaseKeys, decreaseLabel, increaseLabel, label = 'Slider', disabled = false,
    ...props }: HoverSliderProps & { orientation?: 'horizontal' | 'vertical'; mode?: 'hover' | 'positional' } = $props();
  let core = $state<SliderController>();
  const vertical = $derived(orientation === 'vertical');
</script>

{#snippet control(side: -1 | 1)}
  {@const text = side === -1 ? decreaseLabel ?? `Decrease ${label}` : increaseLabel ?? `Increase ${label}`}
  {#if mode === 'hover'}
    <HoverButton keys={side === -1 ? decreaseKeys ?? (vertical ? 'arrowdown' : 'arrowleft') : increaseKeys ?? (vertical ? 'arrowup' : 'arrowright')}
      {disabled} on_pressed_down={() => core?.start(side)} on_pressed_up={() => core?.stop(side)}>
      <span class="control-label">{text}</span><span aria-hidden="true">{side === -1 ? (vertical ? '↓' : '←') : (vertical ? '↑' : '→')}</span>
    </HoverButton>
  {:else}
    <ButtonPositional {disabled} on_pressed_down={() => core?.start(side)} on_pressed_up={() => core?.stop(side)}>
      <span class="control-label">{text}</span><span aria-hidden="true">{side === -1 ? (vertical ? '↓' : '←') : (vertical ? '↑' : '→')}</span>
    </ButtonPositional>
  {/if}
{/snippet}

<div class="keyflow-slider" class:vertical role="group" aria-label={label}>
  {#if !controls}{@render control(vertical ? 1 : -1)}{/if}
  <SliderCore bind:this={core} bind:value {orientation} {label} {disabled} {...props} />
  {#if controls && core}{@render controls(core)}{:else if !controls}{@render control(vertical ? -1 : 1)}{/if}
</div>

<style>
  .keyflow-slider { display: inline-flex; align-items: center; gap: 1rem; padding: .5rem; vertical-align: middle; max-width: 100%; box-sizing: border-box; }
  .vertical { flex-direction: column; }
  .control-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
