<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Keyflow, Document, Button, ButtonPositional, Interactable, StaticButton,
    HoverButton, HoverButtonPositional, TextBox, InputFrame,
    create_input_frame, input_frame_manager, type TextBoxController, type Shortcut
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';

  let textbox = $state<TextBoxController>();
  let value = $state('');
  let entryMode = $state('external');
  let exitTrigger = $state<Shortcut>('escape');
  let disabled = $state(false);
  let mounted = $state(true);
  let showEntry = $state(false);
  let entries = $state(0);
  let exits = $state(0);
  let hoverCount = $state(0);
  const enterTrigger = $derived(entryMode === 'external' ? null : entryMode === 'auto' ? undefined : entryMode);
  const stack = input_frame_manager.stack;
  const active = input_frame_manager.active;
  const child = create_input_frame({ name: 'child' });
  const open = () => { void textbox?.enter(); };
  onDestroy(() => child.dispose());
</script>

<Keyflow options={{ keys: ['a', 'b'], lockstep: false }}>
  <Document>
    <main>
      <h1>Custom textbox openers & hover buttons</h1>
      <p>Each opener calls the same bound TextBox API. Hover a button to reveal its route and progress.</p>
      <p aria-label="Frame stack">{$stack.map((frame) => frame.name).join(' → ')}</p>
      <p aria-label="Editing sessions">Entries: {entries}; exits: {exits}</p>
      <div class="settings">
        <label>Entry binding <select bind:value={entryMode}>
          <option value="external">External controls only</option>
          <option value="auto">Automatic</option>
          <option value="t">T</option><option value="y">Y</option>
        </select></label>
        <label>Exit binding <select bind:value={exitTrigger}>
          <option value="escape">Escape</option><option value="F2">F2</option>
        </select></label>
        <label><input type="checkbox" bind:checked={disabled} /> Disable editor</label>
        <label><input type="checkbox" bind:checked={mounted} /> Mount editor</label>
        <label><input type="checkbox" bind:checked={showEntry} /> Show built-in entry</label>
      </div>
      <div class="controls" role="group" aria-label="Textbox openers">
        <Button priority={0} on_close={open}>Ordered opener</Button>
        <ButtonPositional on_close={open}>Positional opener</ButtonPositional>
        <Interactable on_close={open}>Custom interactable opener</Interactable>
        <StaticButton keys="z" on_close={open}>Absolute opener</StaticButton>
        <HoverButton priority={1} on_close={open}>Hover opener</HoverButton>
        <HoverButtonPositional on_close={open}>Positional hover opener</HoverButtonPositional>
      </div>
      <div class="controls">
        <button type="button" onclick={open}>Native API opener</button>
        <button type="button" onclick={() => textbox?.exit()}>Exit via API</button>
        <button type="button" onclick={() => input_frame_manager.push(child)}>Push child frame</button>
      </div>
      <InputFrame frame={child}>
        <div hidden={$active !== child}>
          <StaticButton keys="q" on_close={() => input_frame_manager.pop()}>Close child</StaticButton>
        </div>
      </InputFrame>
      {#if mounted}
        <TextBox bind:this={textbox} bind:value {enterTrigger} {exitTrigger} {disabled} {showEntry}
          label="Externally opened editor" onenter={() => entries++} onexit={() => exits++} />
      {/if}
      <p aria-label="Hover activations">Hover actions: {hoverCount}</p>
      <div class="controls" role="group" aria-label="Hover actions">
        <HoverButton priority={2} on_close={() => hoverCount++}>Hover action</HoverButton>
        <HoverButtonPositional on_close={() => hoverCount++}>Positional hover action</HoverButtonPositional>
      </div>
      <div class="spacer" aria-hidden="true"></div>
      <div class="controls" role="group" aria-label="Offscreen hover actions">
        <HoverButton priority={3} on_close={() => hoverCount++}>Persistent offscreen action</HoverButton>
        <HoverButtonPositional on_close={() => hoverCount++}>Visible positional action</HoverButtonPositional>
      </div>
    </main>
  </Document>
</Keyflow>

<style>
  main { padding: 1rem; font: 1rem/1.5 system-ui, sans-serif; }
  h1 { font-size: 1.5rem; }
  .settings, .controls { display: flex; flex-wrap: wrap; gap: 1rem; margin-block: 1rem; }
  main :global(button) { font: inherit; padding: .5rem; border: 1px solid currentColor; }
  main :global(button:disabled) { opacity: .4; }
  .spacer { height: 110vh; }
</style>
