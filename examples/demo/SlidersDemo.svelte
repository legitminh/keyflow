<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Keyflow, Document, SliderCore, HorizontalHoverSlider, VerticalHoverSlider,
    HorizontalPositionalSlider, VerticalPositionalSlider, HorizontalSlider, BoundedText, Interactable, InputFrame,
    StaticButton, Button, KeyboardKeyDisplay, create_input_frame, input_frame_manager,
    type SliderController
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
  let horizontal = $state(50);
  let vertical = $state(50);
  let positional = $state(50);
  let persistent = $state(50);
  let positionalVertical = $state(50);
  let custom = $state(50);
  let snippetValue = $state(0);
  let core = $state<SliderController>();
  let disabled = $state(false);
  let mounted = $state(true);
  let rebound = $state(false);
  let showColors = $state(false);
  const child = create_input_frame({ name: 'slider menu' });
  const active = input_frame_manager.active;
  onDestroy(() => child.dispose());
</script>

<Keyflow options={{ lockstep: false, keys: ['a', 'b'] }}>
  <Document>
    <main>
      <h1>Sliders and shared key colors</h1>
      <p>Drag the dots or hold a control or its shortcut. Horizontal increases right; vertical increases up.</p>
      <div class="settings">
        <label><input type="checkbox" bind:checked={disabled} /> Disable sliders</label>
        <label><input type="checkbox" bind:checked={mounted} /> Mount sliders</label>
        <label><input type="checkbox" bind:checked={rebound} /> Use J/K instead of left/right</label>
        <label><input type="checkbox" bind:checked={showColors} /> Show color samples</label>
        <button type="button" onclick={() => input_frame_manager.push(child)}>Open child frame</button>
        <button type="button" onclick={() => { horizontal = 50; vertical = 50; positional = 50; positionalVertical = 50; custom = 50; }}>Reset values</button>
      </div>
      <InputFrame frame={child}>
        <div hidden={$active !== child}><StaticButton keys="escape" on_close={() => input_frame_manager.pop()}>Close child frame</StaticButton></div>
      </InputFrame>
      {#if mounted}
        <section>
          <h2>Horizontal hover: {horizontal}</h2>
          <HorizontalHoverSlider bind:value={horizontal} label="Horizontal hover" {disabled} speed={40}
            decreaseKeys={rebound ? 'j' : 'arrowleft'} increaseKeys={rebound ? 'k' : 'arrowright'} />
          <h2>Horizontal positional: {positional}</h2>
          <HorizontalPositionalSlider bind:value={positional} label="Horizontal positional" {disabled} speed={40} />
          <h2>Horizontal persistent: {persistent}</h2>
          <HorizontalSlider bind:value={persistent} label="Horizontal persistent" {disabled} speed={40} />
          <h2>Bounded title: <BoundedText text="a-very-long-file-name-that-scrolls.visual" /></h2>
        </section>
        <section class="columns">
          <div><h2>Vertical hover: {vertical}</h2><VerticalHoverSlider bind:value={vertical} label="Vertical hover" {disabled} speed={40} /></div>
          <div><h2>Vertical positional: {positionalVertical}</h2><VerticalPositionalSlider bind:value={positionalVertical} label="Vertical positional" {disabled} speed={40} /></div>
        </section>
        <section>
          <h2>Custom core: {custom}</h2>
          <div class="custom">
            <Interactable {disabled} on_pressed_down={() => core?.start(-1)} on_pressed_up={() => core?.stop(-1)}>Custom decrease</Interactable>
            <SliderCore bind:this={core} bind:value={custom} label="Custom core" min={10} max={90} step={0.5} speed={20} {disabled} />
            <Interactable {disabled} on_pressed_down={() => core?.start(1)} on_pressed_up={() => core?.stop(1)}>Custom increase</Interactable>
          </div>
        </section>
        <section>
          <h2>Preset with custom controls: {snippetValue}</h2>
          <HorizontalPositionalSlider bind:value={snippetValue} label="Snippet controls" min={-1} max={1} step={0.1} {disabled}>
            {#snippet controls(slider)}
              <StaticButton keys="u" {disabled} on_close={() => slider.shift(-1)}>Snippet decrease</StaticButton>
              <StaticButton keys="i" {disabled} on_close={() => slider.shift(1)}>Snippet increase</StaticButton>
              <button type="button" onclick={() => slider.set(10)}>Set snippet maximum</button>
            {/snippet}
          </HorizontalPositionalSlider>
        </section>
      {/if}
      {#if showColors}<section class="colors">
        <h2>Shared key space</h2>
        <StaticButton keys="escape">Escape color</StaticButton><KeyboardKeyDisplay key="escape" />
        <StaticButton keys="é">Latin color</StaticButton><KeyboardKeyDisplay key="é" />
        <StaticButton keys="界">Outside color space</StaticButton><KeyboardKeyDisplay key="界" />
        {#each Array.from({ length: 258 }) as _, index}
          <Button priority={index + 100}>Color sample {index}</Button>
        {/each}
      </section>
      {/if}
    </main>
  </Document>
</Keyflow>

<style>
  main { padding: 2rem; font: 1rem/1.5 system-ui, sans-serif; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1rem; margin-block: 1rem; }
  section { margin-block: 1.5rem; }
  .settings, .columns, .custom { display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center; }
  .columns { align-items: flex-start; }
  main :global(button) { font: inherit; padding: .35rem; border: 1px solid currentColor; }
  .colors { display: flex; flex-wrap: wrap; gap: .5rem; }
  .colors h2 { width: 100%; }
  .colors :global(.keyflow-key) { flex: 0 0 5rem; }
</style>
