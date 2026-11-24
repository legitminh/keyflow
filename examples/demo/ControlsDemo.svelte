<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Keyflow, Document, Button, ButtonPositional, Interactable, StaticButton,
    HoverButton, HoverButtonPositional, TextBox, LineTextBox, NumberBox, InputFrame,
    create_input_frame, input_frame_manager, type TextBoxController, type Shortcut, type TextInputMethod
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';

  let textbox = $state<TextBoxController>();
  let title = $state('Ink'), amount = $state(25);
  let value = $state('');
  let entryMode = $state('external');
  let exitTrigger = $state<Shortcut>('escape');
  let disabled = $state(false);
  let mounted = $state(true);
  let showEntry = $state(false);
  let exitOnClickOutside = $state(false);
  let exitOnShiftEnter = $state(true);
  let linebox = $state<TextBoxController>();
  let entries = $state(0);
  let exits = $state(0);
  let hoverCount = $state(0);
  const enterTrigger = $derived(entryMode === 'external' ? null : entryMode === 'auto' ? undefined : entryMode);
  const stack = input_frame_manager.stack;
  const active = input_frame_manager.active;
  const child = create_input_frame({ name: 'child' });
  const open = () => { void textbox?.enter(); };
  // A tiny input method: letters compose an underlined, uppercase word; Space commits it, Backspace edits it.
  let composing = '';
  let composed = $state('');
  const shouting: TextInputMethod = {
    key(type, input, composition) {
      if (input.ctrlKey || input.metaKey || input.altKey) return false;
      const key = input.key;
      if (/^[a-z]$/i.test(key)) {
        if (type === 'keydown') { composing += key.toUpperCase(); composition.setMarked(composing); }
        return true;
      }
      if (key === ' ' && composing) {
        if (type === 'keydown') { composition.commit(`${composing} `); composing = ''; }
        return true;
      }
      if (key === 'Backspace' && composing) {
        if (type === 'keydown') { composing = composing.slice(0, -1); composition.setMarked(composing); }
        return true;
      }
      return false;
    },
    reset() { composing = ''; }
  };
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
        <label data-keyflow-textbox-keep-open>Exit binding <select bind:value={exitTrigger}>
          <option value="escape">Escape</option><option value="F2">F2</option>
        </select></label>
        <label><input type="checkbox" bind:checked={disabled} /> Disable editor</label>
        <label><input type="checkbox" bind:checked={mounted} /> Mount editor</label>
        <label><input type="checkbox" bind:checked={showEntry} /> Show built-in entry</label>
        <label data-keyflow-textbox-keep-open><input type="checkbox" bind:checked={exitOnClickOutside} /> Exit on outside click</label>
        <label data-keyflow-textbox-keep-open><input type="checkbox" bind:checked={exitOnShiftEnter} /> Exit on Shift+Enter</label>
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
        <button type="button" data-keyflow-textbox-keep-open onclick={open}>Native API opener</button>
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
          {exitOnClickOutside} {exitOnShiftEnter}
          label="Externally opened editor" onenter={() => entries++} onexit={() => exits++} />
      {/if}
      <div data-keyflow-textbox-keep-open role="group" aria-label="Editor suggestions">
        <button type="button" onclick={() => textbox?.edit((composition) => composition.insert('suggestion'))}>Insert suggestion</button>
      </div>
      <label>Outside field <input aria-label="Outside field" /></label>
      <TextBox bind:value={composed} inputMethod={shouting} label="Input method editor" enterTrigger={null} {exitOnClickOutside} {exitOnShiftEnter} />
      <div class="controls" role="group" aria-label="Single-line fields">
        <LineTextBox bind:this={linebox} bind:value={title} label="Layer title" {exitOnClickOutside} {exitOnShiftEnter} />
        <NumberBox bind:value={amount} min={0} max={100} step={0.5} label="Quantity" {exitOnClickOutside} {exitOnShiftEnter} />
        <span aria-label="Field values">{title}|{amount}</span>
      </div>
      <div data-keyflow-textbox-keep-open>
        <button type="button" onclick={() => linebox?.enter()}>Open title via API</button>
        <button type="button" onclick={() => linebox?.edit((text) => text.insert('new\nline'))}>Insert title suggestion</button>
        <button type="button" onclick={() => linebox?.exit()}>Finish title via API</button>
      </div>
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
